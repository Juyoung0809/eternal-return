// Saves the current database as prisma/snapshot.db.gz — the data `npm run seed` and
// `prisma migrate reset` restore. Run after a full import (er:import, er:images,
// er:routes) so a reset brings everything back without calling the API again.
//
//   npm run db:snapshot -w backend
//
import { createSnapshot, SNAPSHOT_PATH } from "../prisma/snapshot.js";

const { bytes } = createSnapshot();
console.log(`Wrote ${SNAPSHOT_PATH} (${(bytes / 1024 / 1024).toFixed(1)} MB).`);
