import { Router } from "express";
import { prisma } from "../prisma.js";

export const itemsRouter = Router();

// Only "finished" gear and directly-usable items are worth browsing in the codex —
// the low-grade weapon/armor rows are mostly intermediate crafting materials (still
// kept in the DB and reachable via a finished item's "조합 재료" list, just not listed
// on their own). 무기/방어구 must be 영웅(4) grade or higher; 특수/소비 always show
// since those are already complete, directly-usable items regardless of grade.
const EQUIPMENT_TYPES = ["무기", "방어구"];
const USABLE_TYPES = ["특수", "소비"];
const MIN_EQUIPMENT_GRADE = 4;

// GET /api/items — list codex-worthy items, optional ?type= & ?grade= to narrow further
itemsRouter.get("/", async (req, res) => {
  const { type, grade } = req.query;

  const items = await prisma.item.findMany({
    where: {
      AND: [
        {
          OR: [
            { type: { in: EQUIPMENT_TYPES }, grade: { gte: MIN_EQUIPMENT_GRADE } },
            { type: { in: USABLE_TYPES } },
          ],
        },
        { type: typeof type === "string" ? type : undefined },
        { grade: typeof grade === "string" ? Number(grade) : undefined },
      ],
    },
    orderBy: [{ grade: "asc" }, { name: "asc" }],
  });
  res.json(items);
});

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

// GET /api/items/:id — item detail including the full crafting recipe tree
itemsRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
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

  res.json(item);
});
