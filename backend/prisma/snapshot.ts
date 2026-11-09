// A compressed copy of a fully imported database (prisma/snapshot.db.gz), so a
// migration reset doesn't mean re-running the ~15-minute API import. `npm run
// db:snapshot` writes it from the current DB; prisma/seed.ts restores from it — and
// Prisma runs that seed after `prisma migrate reset` (or a reset during `migrate dev`).
//
// Uses Node's built-in SQLite driver on one connection: ATTACH and PRAGMA
// foreign_keys are per-connection, which Prisma's pooled client can't guarantee.
import "dotenv/config";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gunzipSync, gzipSync } from "node:zlib";

const PRISMA_DIR = import.meta.dirname;
export const SNAPSHOT_PATH = path.join(PRISMA_DIR, "snapshot.db.gz");

// DATABASE_URL is "file:./dev.db", relative to the prisma/ folder like Prisma reads it.
function databasePath(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!url.startsWith("file:")) throw new Error(`Expected a SQLite file: DATABASE_URL, got ${url}`);
  return path.resolve(PRISMA_DIR, url.slice("file:".length));
}

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

// Tables worth copying: everything but SQLite internals and Prisma's migration log
// (the target DB keeps its own, matching its migration state).
function dataTables(db: DatabaseSync, schema: string): string[] {
  return (
    db
      .prepare(
        `SELECT name FROM ${schema}.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations'`,
      )
      .all() as Array<{ name: string }>
  ).map((r) => r.name);
}

const columns = (db: DatabaseSync, schema: string, table: string) =>
  (db.prepare(`PRAGMA ${schema}.table_info(${quote(table)})`).all() as Array<{ name: string }>).map((c) => c.name);

/** Writes the current database, compacted, to prisma/snapshot.db.gz. */
export function createSnapshot(): { bytes: number } {
  const dir = mkdtempSync(path.join(tmpdir(), "er-snapshot-"));
  const compact = path.join(dir, "snapshot.db");
  try {
    const db = new DatabaseSync(databasePath());
    db.exec(`VACUUM INTO '${compact.replace(/'/g, "''")}'`);
    db.close();
    const gz = gzipSync(readFileSync(compact), { level: 9 });
    writeFileSync(SNAPSHOT_PATH, gz);
    return { bytes: gz.length };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Replaces every table's rows with the snapshot's. Only columns present on both sides
 * are copied, so a snapshot taken before a later migration still loads (new columns
 * keep their defaults). Returns rows copied per table.
 */
export function restoreSnapshot(): Record<string, number> {
  const dir = mkdtempSync(path.join(tmpdir(), "er-snapshot-"));
  const snapshotDb = path.join(dir, "snapshot.db");
  writeFileSync(snapshotDb, gunzipSync(readFileSync(SNAPSHOT_PATH)));
  const db = new DatabaseSync(databasePath());
  const copied: Record<string, number> = {};
  try {
    db.exec(`ATTACH DATABASE '${snapshotDb.replace(/'/g, "''")}' AS snap`);
    db.exec("PRAGMA foreign_keys = OFF");
    db.exec("BEGIN");
    const targetTables = new Set(dataTables(db, "main"));
    for (const table of dataTables(db, "snap").filter((t) => targetTables.has(t))) {
      const targetColumns = new Set(columns(db, "main", table));
      const shared = columns(db, "snap", table).filter((c) => targetColumns.has(c)).map(quote).join(", ");
      db.exec(`DELETE FROM main.${quote(table)}`);
      db.exec(`INSERT INTO main.${quote(table)} (${shared}) SELECT ${shared} FROM snap.${quote(table)}`);
      copied[table] = (db.prepare(`SELECT COUNT(*) AS n FROM main.${quote(table)}`).get() as { n: number }).n;
    }
    db.exec("COMMIT");
  } catch (err) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw err;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
    if (db.isOpen) {
      try {
        db.exec("DETACH DATABASE snap");
      } catch {
        // not attached if ATTACH itself failed
      }
      db.close();
    }
    rmSync(dir, { recursive: true, force: true });
  }
  return copied;
}

export const hasSnapshot = () => existsSync(SNAPSHOT_PATH);
