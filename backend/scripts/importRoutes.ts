// Syncs every shared build route from /v1/weaponRoutes/recommend into the Route table.
// The API pages 100 at a time behind a `next` cursor and supports no sorting or
// filtering, so the whole set is stored locally and /api/routes pages over it.
// Takes several minutes; run after `er:import` (routes need characters in the DB).
//
//   npm run er:routes -w backend
//   ROUTE_MAX_PAGES=5 npm run er:routes -w backend   # quick partial sync
//
import "dotenv/config";
import { prisma } from "../src/prisma.js";
import { getMetaData, getL10nMap, getRecommendedRoutes, type ErWeaponRoute } from "../src/services/erApiClient.js";
import { MASTERY_WEAPON_KEY } from "./masteryCodes.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The API rate-limits without a documented threshold. erApiClient's short backoff covers
// blips, but a 500-page walk can hit a sustained limit (seen around page 100), so a page
// that still fails gets a long cooldown and another try instead of aborting the run.
const PAGE_DELAY_MS = 500;
const RATE_LIMIT_COOLDOWN_MS = 60_000;
const PAGE_ATTEMPTS = 5;
const MAX_PAGES = Number(process.env.ROUTE_MAX_PAGES) || Infinity;

async function fetchRoutePage(next: number | undefined) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await getRecommendedRoutes(next);
    } catch (err) {
      const rateLimited = err instanceof Error && / 429\b/.test(err.message);
      if (!rateLimited || attempt === PAGE_ATTEMPTS) throw err;
      console.log(`  rate limited at next=${next}; cooling down ${RATE_LIMIT_COOLDOWN_MS / 1000}s (attempt ${attempt})`);
      await sleep(RATE_LIMIT_COOLDOWN_MS);
    }
  }
}

// '{"0":[...],"1":[...]}' -> [[...], [...]] in key order, without the 999999 empty-slot
// marker; sets left empty are dropped.
const EMPTY_SLOT = 999999;
function lateItemSets(raw: string | null): number[][] {
  if (!raw) return [];
  const sets = JSON.parse(raw) as Record<string, number[]> | number[][];
  return Object.entries(sets)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, codes]) => codes.filter((code) => code > 0 && code !== EMPTY_SLOT))
    .filter((codes) => codes.length > 0);
}

function skillPath(raw: string) {
  const keys = raw.split(",").map((s) => s.trim().toUpperCase());
  return keys.some(Boolean) ? keys.join(",") : "";
}

async function main() {
  console.log("Fetching Korean localization + Area...");
  const l10n = await getL10nMap("Korean");
  await sleep(1200);
  const areas = await getMetaData<Record<string, any>>("Area");
  const areaName = new Map(areas.map((a) => [a.code as number, l10n.get(`Area/Name/${a.name}`) ?? a.name]));

  const characterIdByCode = new Map(
    (await prisma.character.findMany({ select: { id: true, code: true } })).map((c) => [c.code, c.id]),
  );
  if (characterIdByCode.size === 0) throw new Error("No characters in the DB — run `npm run er:import -w backend` first.");

  const toRow = ({ recommendWeaponRoute: r, recommendWeaponRouteDesc: d }: ErWeaponRoute, characterId: number) => {
    const weaponKey = MASTERY_WEAPON_KEY[r.weaponType];
    return {
      title: r.title,
      authorNickname: r.userNickname,
      characterId,
      weaponType: (weaponKey && l10n.get(`WeaponType/${weaponKey}`)) || weaponKey || "",
      itemCodes: JSON.stringify(JSON.parse(r.weaponCodes)),
      lateItemSets: JSON.stringify(lateItemSets(r.lateGameItemCodes)),
      remoteItemCodes: JSON.stringify(r.remoteTransferItemCodes ? (JSON.parse(r.remoteTransferItemCodes) as number[]) : []),
      areas: JSON.stringify((JSON.parse(r.paths) as number[]).map((code) => areaName.get(code) ?? `지역 ${code}`)),
      // Codes, resolved against the Trait / TacticalSkill tables (filled by er:import).
      traitCodes: JSON.stringify(JSON.parse(r.traitCodes)),
      tacticalSkillCode: r.tacticalSkillGroupCode ?? 0,
      // skillPath lists every level, with blanks for levels the author didn't plan. Keep
      // the blanks so each key stays at its level; a route with no plan at all stores "".
      skillPath: skillPath(d.skillPath),
      description: d.desc ?? "",
      likes: r.v2Like,
      winRate: r.v2WinRate,
      version: r.version,
      languageCode: r.languageCode,
      sharedAt: new Date(r.updateDtm),
    };
  };

  const syncedRouteIds = new Set<number>();
  const started = Date.now();
  let next: number | undefined;
  let page = 0;
  do {
    page++;
    const result = await fetchRoutePage(next);
    const rows = result.routes.flatMap((route) => {
      const characterId = characterIdByCode.get(route.recommendWeaponRoute.characterCode);
      return route.recommendWeaponRoute.share && characterId ? [{ route, characterId }] : [];
    });

    // One transaction per page — far faster than 100 separate SQLite writes.
    await prisma.$transaction(
      rows.map(({ route, characterId }) => {
        const data = toRow(route, characterId);
        const routeId = route.recommendWeaponRoute.id;
        syncedRouteIds.add(routeId);
        return prisma.route.upsert({ where: { routeId }, update: data, create: { routeId, ...data } });
      }),
    );

    if (page % 25 === 0) {
      console.log(`  page ${page}: ${syncedRouteIds.size} routes so far (${Math.round((Date.now() - started) / 1000)}s)`);
    }
    next = result.next;
    await sleep(PAGE_DELAY_MS);
  } while (next && page < MAX_PAGES);

  console.log(`Upserted ${syncedRouteIds.size} shared routes from ${page} pages.`);

  // Only prune after a full walk — a partial sync shouldn't delete the routes it skipped.
  if (!next) {
    const existing = await prisma.route.findMany({ select: { routeId: true } });
    const stale = existing.map((r) => r.routeId).filter((id) => !syncedRouteIds.has(id));
    for (let i = 0; i < stale.length; i += 500) {
      await prisma.route.deleteMany({ where: { routeId: { in: stale.slice(i, i + 500) } } });
    }
    console.log(`Removed ${stale.length} routes no longer shared.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
