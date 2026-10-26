import { Router } from "express";
import { prisma } from "../prisma.js";

export const monstersRouter = Router();

// GET /api/monsters — list wildlife/monsters, optional ?mapId= & ?type= filters
monstersRouter.get("/", async (req, res) => {
  const { mapId, type } = req.query;

  const monsters = await prisma.monster.findMany({
    where: {
      mapId: typeof mapId === "string" ? Number(mapId) : undefined,
      type: typeof type === "string" ? type : undefined,
    },
    include: { map: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
  res.json(monsters);
});

// GET /api/monsters/:id — monster detail
monstersRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }

  const monster = await prisma.monster.findUnique({
    where: { id },
    include: { map: true },
  });

  if (!monster) {
    res.status(404).json({ error: "monster not found" });
    return;
  }

  res.json(monster);
});
