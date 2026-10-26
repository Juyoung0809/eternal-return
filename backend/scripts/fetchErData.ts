// One-off inspection tool: pulls raw tables from the Eternal Return Open API
// and l10n(Korean) into backend/data/raw/ so we can see real field names before
// writing the Prisma upsert mapping. Run after setting ER_API_KEY in backend/.env.
//
//   npm run er:sync -w backend
//
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getMetaData, getMetaHash, getL10nMap } from "../src/services/erApiClient.js";

const OUT_DIR = path.resolve(import.meta.dirname, "..", "data", "raw");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Tables relevant to the codex (character / item / monster). Add more metaType
// names here as needed — see getMetaData's doc comment for the known list.
const META_TYPES = ["Character", "ItemWeapon", "ItemArmor", "ItemSpecial", "ItemConsumable", "ItemMisc", "Monster"];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log("Fetching /v2/data/hash (table version info)...");
  const hash = await getMetaHash();
  await writeFile(path.join(OUT_DIR, "hash.json"), JSON.stringify(hash, null, 2));

  for (const metaType of META_TYPES) {
    console.log(`Fetching /v2/data/${metaType}...`);
    const rows = await getMetaData(metaType);
    await writeFile(path.join(OUT_DIR, `${metaType}.json`), JSON.stringify(rows, null, 2));
    console.log(`  -> ${rows.length} rows, first row keys: ${rows[0] ? Object.keys(rows[0]).join(", ") : "(empty)"}`);
    await sleep(1500); // be polite to the (undocumented) rate limit between tables
  }

  console.log("Fetching Korean l10n dump...");
  const l10n = await getL10nMap("Korean");
  await writeFile(
    path.join(OUT_DIR, "l10n-ko.json"),
    JSON.stringify(Object.fromEntries(l10n), null, 2),
  );
  console.log(`  -> ${l10n.size} localization entries`);

  console.log(`\nDone. Inspect the JSON files in ${OUT_DIR} to confirm field names,`);
  console.log("then update the Prisma seed/sync logic to map real fields.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
