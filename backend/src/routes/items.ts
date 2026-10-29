import { Router } from "express";
import type { Item } from "@prisma/client";
import { prisma } from "../prisma.js";
import { parseIntParam } from "../params.js";

export const itemsRouter = Router();

// Items kept in the DB (recipe trees still reach them through GET /:id) but left out of
// the browser list:
//   - 재료: base crafting materials, only interesting as part of a recipe.
//   - 502207 망원 카메라 (the duplicate that's only an ingredient), 502209 위장 카메라 (its
//     product), 502210 모닥불, 504201 아글라이아의 선물 - 고급.
//   - 303501-303510: 현상금 and the 크레딧 / 크레딧+ / 크레딧++ currency pickups.
const HIDDEN_TYPES = ["재료"];
const HIDDEN_CODES = [502207, 502209, 502210, 504201, ...Array.from({ length: 10 }, (_, i) => 303501 + i)];

// GET /api/items — browsable items, light fields only (the browser shows them as small
// icons and filters client-side); optional ?type= & ?grade= to narrow.
itemsRouter.get("/", async (req, res) => {
  const { type } = req.query;
  const grade = parseIntParam(req.query.grade);
  if (grade === null) {
    res.status(400).json({ error: "invalid grade" });
    return;
  }

  const [items, specialMaterialsOf] = await Promise.all([
    prisma.item.findMany({
      where: {
        AND: [
          { type: { notIn: HIDDEN_TYPES } },
          { code: { notIn: HIDDEN_CODES } },
          { type: typeof type === "string" ? type : undefined, grade },
        ],
      },
      select: { id: true, code: true, name: true, grade: true, type: true, subType: true, imageUrl: true, stats: true },
      orderBy: [{ grade: "desc" }, { name: "asc" }],
    }),
    specialMaterialLookup(),
  ]);
  res.json(
    items.map(({ stats, ...item }) => ({
      ...item,
      statKeys: Object.keys(JSON.parse(stats) as Record<string, number>),
      specialMaterials: specialMaterialsOf(item.code),
    })),
  );
});

// "Special" materials are the grade-4 base materials (생명의 나무, 운석, 미스릴, 포스 코어,
// VF 혈액 샘플, 진화의 돌) — the ones that gate legendary/transcendent gear. Returns a
// lookup from item code to the special materials anywhere in its recipe tree.
const SPECIAL_MATERIAL_MIN_GRADE = 4;
async function specialMaterialLookup() {
  const all = await prisma.item.findMany({
    select: { code: true, name: true, type: true, grade: true, materials: { select: { code: true } } },
  });
  const byCode = new Map(all.map((i) => [i.code, i]));
  const memo = new Map<number, Set<string>>();
  const collect = (code: number): Set<string> => {
    const cached = memo.get(code);
    if (cached) return cached;
    const item = byCode.get(code);
    const found = new Set<string>();
    memo.set(code, found); // set first: guards against a malformed cyclic recipe
    if (item?.type === "재료" && item.grade >= SPECIAL_MATERIAL_MIN_GRADE) found.add(item.name);
    for (const m of item?.materials ?? []) for (const name of collect(m.code)) found.add(name);
    return found;
  };
  return (code: number) => [...collect(code)];
}

// A full recipe chain can run several tiers deep (e.g. 영웅 무기 <- 희귀 <- 고급 <- 기본
// x2), so `materials` needs to nest a handful of levels to reach the base components —
// unlike `materialOf`, which stays one level (an item can be a component of many
// higher items, so recursing there would blow up combinatorially for little benefit).
const materialsTree = {
  materials: {
    include: {
      materials: {
        include: {
          materials: {
            include: { materials: true },
          },
        },
      },
    },
  },
};

type ItemRow = Item & { materials?: ItemRow[]; materialOf?: ItemRow[] };

// spawnAreas / droppedBy are stored JSON-encoded; decode them through the whole tree so
// every recipe tile can show where its item comes from.
function decodeItem({ spawnAreas, droppedBy, materials, materialOf, ...rest }: ItemRow): unknown {
  return {
    ...rest,
    spawnAreas: JSON.parse(spawnAreas) as string[],
    droppedBy: JSON.parse(droppedBy) as string[],
    ...(materials && { materials: materials.map(decodeItem) }),
    ...(materialOf && { materialOf: materialOf.map(decodeItem) }),
  };
}

// GET /api/items/:id — item detail including the full crafting recipe tree
itemsRouter.get("/:id", async (req, res) => {
  const id = parseIntParam(req.params.id);
  if (id == null) {
    res.status(400).json({ error: "invalid id" });
    return;
  }

  const item = await prisma.item.findUnique({
    where: { id },
    include: { ...materialsTree, materialOf: true },
  });

  if (!item) {
    res.status(404).json({ error: "item not found" });
    return;
  }

  res.json(decodeItem(item));
});
