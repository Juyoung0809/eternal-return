import { Router } from "express";
import { prisma } from "../prisma.js";
import { parseIntParam } from "../params.js";

export const charactersRouter = Router();

const decodePositions = (positions: string) => JSON.parse(positions) as string[];

// GET /api/characters — list all characters (light fields for grid views). Ordered by
// code, which the game assigns in release order; the page re-sorts client-side.
charactersRouter.get("/", async (_req, res) => {
  const characters = await prisma.character.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      nameEn: true,
      weaponType: true,
      positions: true,
      difficulty: true,
      imageUrl: true,
    },
  });
  res.json(characters.map((c) => ({ ...c, positions: decodePositions(c.positions) })));
});

// GET /api/characters/:id — full detail including skills (with their JSON columns
// decoded) and skins
charactersRouter.get("/:id", async (req, res) => {
  const id = parseIntParam(req.params.id);
  if (id == null) {
    res.status(400).json({ error: "invalid id" });
    return;
  }

  const character = await prisma.character.findUnique({
    where: { id },
    include: {
      skills: { orderBy: { order: "asc" } },
      skins: { orderBy: { order: "asc" }, select: { id: true, code: true, name: true, imageUrl: true } },
      weapons: { orderBy: { order: "asc" }, include: { weapon: true } },
    },
  });

  if (!character) {
    res.status(404).json({ error: "character not found" });
    return;
  }

  res.json({
    ...character,
    positions: decodePositions(character.positions),
    skills: character.skills.map((s) => ({
      ...s,
      scaling: JSON.parse(s.scaling) as string[],
      variants: JSON.parse(s.variants) as Array<{ name: string; description: string }>,
    })),
  });
});
