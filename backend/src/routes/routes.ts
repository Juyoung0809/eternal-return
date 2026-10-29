import { Router } from "express";
import type { Prisma, Route } from "@prisma/client";
import { prisma } from "../prisma.js";
import { parseIntParam } from "../params.js";

export const routesRouter = Router();

// Route's list columns are stored JSON-encoded; hand them to the client as real arrays.
function decodeRoute(route: Route) {
  const { itemCodes, lateItemSets, remoteItemCodes, areas, traitCodes, skillPath, ...rest } = route;
  return {
    ...rest,
    itemCodes: JSON.parse(itemCodes) as number[],
    lateItemSets: JSON.parse(lateItemSets) as number[][],
    remoteItemCodes: JSON.parse(remoteItemCodes) as number[],
    areas: JSON.parse(areas) as string[],
    traitCodes: JSON.parse(traitCodes) as number[],
    skillPath: skillPath ? skillPath.split(",") : [],
  };
}

// Skill.slot -> the key a route's skillPath uses (T is the passive).
const SKILL_KEY: Record<string, string> = { PASSIVE: "T", SKILL_1: "Q", SKILL_2: "W", SKILL_3: "E", SKILL_4: "R" };

// A route's traits are [core, main sub, main sub, secondary sub, secondary sub]. Returns
// the main group (with its core options) and the secondary group, each with every
// option so the page can show the picks in context.
async function traitTree(traitCodes: number[]) {
  const picked = await prisma.trait.findMany({ where: { code: { in: traitCodes } } });
  const groupOf = (code: number | undefined) => picked.find((t) => t.code === code)?.group;
  const keys = [groupOf(traitCodes[0]), groupOf(traitCodes[3]) ?? groupOf(traitCodes[4])].filter(
    (key): key is string => key !== undefined,
  );
  const [groups, options] = await Promise.all([
    prisma.traitGroup.findMany({ where: { key: { in: keys } } }),
    prisma.trait.findMany({ where: { group: { in: keys } }, orderBy: { order: "asc" } }),
  ]);
  return keys.flatMap((key, i) => {
    const group = groups.find((g) => g.key === key);
    if (!group) return [];
    const ofType = (type: string) => options.filter((t) => t.group === key && t.type === type);
    return [{ ...group, core: i === 0 ? ofType("Core") : [], sub1: ofType("Sub1"), sub2: ofType("Sub2") }];
  });
}

// The API's own usage counter (`count`) is always 0, so likes stand in for "most used".
// Win rate has no sample size attached, and routes with 1-3 likes routinely show 100%,
// so in win-rate order anything under MIN_LIKES_FOR_WIN_RATE sinks below the rest.
const MIN_LIKES_FOR_WIN_RATE = 10;

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

// `id` breaks ties so pages never overlap or skip rows with equal sort keys.
const ORDERS = {
  popular: [{ likes: "desc" }, { winRate: "desc" }, { id: "asc" }],
  winRate: [{ winRate: "desc" }, { likes: "desc" }, { id: "asc" }],
  newest: [{ sharedAt: "desc" }, { id: "desc" }],
  oldest: [{ sharedAt: "asc" }, { id: "asc" }],
} satisfies Record<string, Prisma.RouteOrderByWithRelationInput[]>;
type RouteSort = keyof typeof ORDERS;
const isRouteSort = (value: unknown): value is RouteSort => typeof value === "string" && value in ORDERS;

const withCharacter = { character: { select: { id: true, name: true, imageUrl: true } } } as const;

// One page of routes in the given order. Win-rate order is two tiers (routes with enough
// likes first, then the rest), which SQL ORDER BY can't express through Prisma, so the
// page is stitched from the end of the first tier and the start of the second.
async function findRoutePage(where: Prisma.RouteWhereInput, sort: RouteSort, skip: number, take: number) {
  if (sort !== "winRate") {
    return prisma.route.findMany({ where, orderBy: ORDERS[sort], skip, take, include: withCharacter });
  }
  const reliable = { ...where, likes: { gte: MIN_LIKES_FOR_WIN_RATE } };
  const unreliable = { ...where, likes: { lt: MIN_LIKES_FOR_WIN_RATE } };
  const reliableCount = await prisma.route.count({ where: reliable });
  const first =
    skip < reliableCount
      ? await prisma.route.findMany({ where: reliable, orderBy: ORDERS.winRate, skip, take, include: withCharacter })
      : [];
  const remaining = take - first.length;
  const second =
    remaining > 0
      ? await prisma.route.findMany({
          where: unreliable,
          orderBy: ORDERS.winRate,
          skip: Math.max(0, skip - reliableCount),
          take: remaining,
          include: withCharacter,
        })
      : [];
  return [...first, ...second];
}

// GET /api/routes — one page of shared routes:
//   ?page=1&pageSize=10 (max 50), ?sort=popular|winRate|newest|oldest (default popular),
//   optional ?characterId=, ?weaponType= and ?q= (title search). Responds
//   { routes, total, page, pageSize }.
routesRouter.get("/", async (req, res) => {
  const { weaponType, q, sort = "popular" } = req.query;
  const characterId = parseIntParam(req.query.characterId);
  const page = parseIntParam(req.query.page) ?? 1;
  const pageSize = parseIntParam(req.query.pageSize) ?? DEFAULT_PAGE_SIZE;
  if (characterId === null) {
    res.status(400).json({ error: "invalid characterId" });
    return;
  }
  if (page === null || page < 1 || pageSize === null || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    res.status(400).json({ error: `invalid page/pageSize (pageSize must be 1-${MAX_PAGE_SIZE})` });
    return;
  }
  if (!isRouteSort(sort)) {
    res.status(400).json({ error: `invalid sort (expected one of: ${Object.keys(ORDERS).join(", ")})` });
    return;
  }

  const where: Prisma.RouteWhereInput = {
    characterId,
    weaponType: typeof weaponType === "string" && weaponType ? weaponType : undefined,
    title: typeof q === "string" && q.trim() ? { contains: q.trim() } : undefined,
  };
  const [total, routes] = await Promise.all([
    prisma.route.count({ where }),
    findRoutePage(where, sort, (page - 1) * pageSize, pageSize),
  ]);
  res.json({
    routes: routes.map((r) => ({ ...decodeRoute(r), character: r.character })),
    total,
    page,
    pageSize,
  });
});

// GET /api/routes/characters — characters that have at least one route, with counts,
// for splitting the route browser by character. Declared before /:id so it isn't
// swallowed by that param route.
routesRouter.get("/characters", async (_req, res) => {
  const counts = await prisma.route.groupBy({ by: ["characterId"], _count: { _all: true } });
  const characters = await prisma.character.findMany({
    where: { id: { in: counts.map((c) => c.characterId) } },
    select: { id: true, name: true, imageUrl: true },
    orderBy: { name: "asc" },
  });
  const countById = new Map(counts.map((c) => [c.characterId, c._count._all]));
  res.json(characters.map((c) => ({ ...c, routeCount: countById.get(c.id) ?? 0 })));
});

// GET /api/routes/weapons?characterId= — weapon types that have routes (for one
// character, or overall), with counts, for the route browser's weapon filter.
routesRouter.get("/weapons", async (req, res) => {
  const characterId = parseIntParam(req.query.characterId);
  if (characterId === null) {
    res.status(400).json({ error: "invalid characterId" });
    return;
  }
  const counts = await prisma.route.groupBy({
    by: ["weaponType"],
    where: { characterId, weaponType: { not: "" } },
    _count: { _all: true },
  });
  res.json(
    counts
      .map((c) => ({ weaponType: c.weaponType, routeCount: c._count._all }))
      .sort((a, b) => b.routeCount - a.routeCount),
  );
});

// Every item's recipe and sources, for expanding a route's targets into base materials.
// Loaded per request: ~800 rows, and it changes only when `er:import` runs.
async function loadRecipeBook() {
  const items = await prisma.item.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      grade: true,
      imageUrl: true,
      spawnAreas: true,
      droppedBy: true,
      materials: { select: { code: true } },
    },
  });
  return new Map(items.map((i) => [i.code, i]));
}

// The base materials (items with no recipe) needed to craft `targets`, with how many of
// each, where they spawn, and which of the route's areas has them — so the route page
// can say what to pick up where.
function baseMaterials(book: Awaited<ReturnType<typeof loadRecipeBook>>, targets: number[], routeAreas: string[]) {
  const counts = new Map<number, number>();
  const expand = (code: number) => {
    const item = book.get(code);
    if (!item) return;
    if (item.materials.length === 0) counts.set(code, (counts.get(code) ?? 0) + 1);
    else for (const m of item.materials) expand(m.code);
  };
  for (const code of targets) expand(code);

  return [...counts].flatMap(([code, count]) => {
    const item = book.get(code);
    if (!item) return [];
    const spawnAreas = JSON.parse(item.spawnAreas) as string[];
    return [
      {
        item: { id: item.id, code: item.code, name: item.name, grade: item.grade, imageUrl: item.imageUrl },
        count,
        spawnAreas,
        droppedBy: JSON.parse(item.droppedBy) as string[],
        // route areas (in visit order) whose boxes hold it
        routeAreas: routeAreas.filter((area) => spawnAreas.includes(area)),
      },
    ];
  });
}

// GET /api/routes/:id — route detail, with target items resolved in slot order
routesRouter.get("/:id", async (req, res) => {
  const id = parseIntParam(req.params.id);
  if (id == null) {
    res.status(400).json({ error: "invalid id" });
    return;
  }

  const route = await prisma.route.findUnique({
    where: { id },
    include: withCharacter,
  });

  if (!route) {
    res.status(404).json({ error: "route not found" });
    return;
  }

  const decoded = decodeRoute(route);
  const [items, traitGroups, tacticalSkill, skills, recipeBook] = await Promise.all([
    prisma.item.findMany({
      where: { code: { in: [...decoded.itemCodes, ...decoded.lateItemSets.flat(), ...decoded.remoteItemCodes] } },
      select: { id: true, code: true, name: true, grade: true, type: true, imageUrl: true },
    }),
    traitTree(decoded.traitCodes),
    prisma.tacticalSkill.findUnique({ where: { code: route.tacticalSkillCode } }),
    prisma.skill.findMany({
      where: { characterId: route.characterId, slot: { in: Object.keys(SKILL_KEY) } },
      select: { slot: true, name: true, imageUrl: true },
    }),
    loadRecipeBook(),
  ]);
  const itemByCode = new Map(items.map((i) => [i.code, i]));
  const resolve = (codes: number[]) => codes.flatMap((code) => itemByCode.get(code) ?? []);

  res.json({
    ...decoded,
    character: route.character,
    items: resolve(decoded.itemCodes),
    lateItemSets: decoded.lateItemSets.map(resolve).filter((set) => set.length > 0),
    remoteItems: resolve(decoded.remoteItemCodes),
    materials: baseMaterials(recipeBook, decoded.itemCodes, decoded.areas),
    traitGroups,
    tacticalSkill,
    skillKeys: Object.fromEntries(skills.map((s) => [SKILL_KEY[s.slot], { name: s.name, imageUrl: s.imageUrl }])),
  });
});
