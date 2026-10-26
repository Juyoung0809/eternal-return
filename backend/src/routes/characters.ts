import { Router } from "express";
import { prisma } from "../prisma.js";

export const charactersRouter = Router();

// GET /api/characters — list all characters (light fields for grid views)
charactersRouter.get("/", async (_req, res) => {
  const characters = await prisma.character.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      nameEn: true,
      weaponType: true,
      difficulty: true,
      imageUrl: true,
    },
  });
  res.json(characters);
});

// GET /api/characters/:id — full detail including skills
charactersRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }

  const character = await prisma.character.findUnique({
    where: { id },
    include: { skills: { orderBy: { order: "asc" } } },
  });

  if (!character) {
    res.status(404).json({ error: "character not found" });
    return;
  }

  res.json(character);
});
