import { Router } from "express";
import { prisma } from "../prisma.js";

export const mapsRouter = Router();

// GET /api/maps — list all maps
mapsRouter.get("/", async (_req, res) => {
  const maps = await prisma.gameMap.findMany({ orderBy: { name: "asc" } });
  res.json(maps);
});

// GET /api/maps/:id — map detail including monsters found there
mapsRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }

  const map = await prisma.gameMap.findUnique({
    where: { id },
    include: { monsters: true },
  });

  if (!map) {
    res.status(404).json({ error: "map not found" });
    return;
  }

  res.json(map);
});
