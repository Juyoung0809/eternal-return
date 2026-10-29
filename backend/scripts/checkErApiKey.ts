// Quick sanity check that ER_API_KEY in backend/.env is accepted by the Open API,
// without running a full import. Makes a single lightweight request (/v2/data/hash).
//
//   npm run er:check -w backend
//
import "dotenv/config";
import { getMetaHash } from "../src/services/erApiClient.js";

async function main() {
  const hash = await getMetaHash();
  console.log(`ER_API_KEY OK — /v2/data/hash returned ${Object.keys(hash).length} tables.`);
}

main().catch((err) => {
  console.error(`ER_API_KEY check failed: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
