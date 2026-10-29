-- Routes now store trait/tactical-skill codes instead of resolved names. Old rows hold
-- names, so they're cleared here; `npm run er:routes` refills them.
ALTER TABLE "Route" DROP COLUMN "traits";
ALTER TABLE "Route" DROP COLUMN "tacticalSkill";
ALTER TABLE "Route" ADD COLUMN "traitCodes" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Route" ADD COLUMN "tacticalSkillCode" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Trait" (
    "code" INTEGER NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "group" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "TraitGroup" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "TacticalSkill" (
    "code" INTEGER NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT ''
);
