-- AlterTable
ALTER TABLE "Item" ADD COLUMN "tags" TEXT NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "WeaponType" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "skillName" TEXT NOT NULL DEFAULT '',
    "skillDescription" TEXT NOT NULL DEFAULT '',
    "skillImageUrl" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "CharacterWeapon" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "characterId" INTEGER NOT NULL,
    "weaponKey" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "attack" INTEGER NOT NULL DEFAULT 0,
    "defense" INTEGER NOT NULL DEFAULT 0,
    "disruptor" INTEGER NOT NULL DEFAULT 0,
    "move" INTEGER NOT NULL DEFAULT 0,
    "assistance" INTEGER NOT NULL DEFAULT 0,
    "guide" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "CharacterWeapon_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterWeapon_weaponKey_fkey" FOREIGN KEY ("weaponKey") REFERENCES "WeaponType" ("key") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CharacterWeapon_characterId_weaponKey_key" ON "CharacterWeapon"("characterId", "weaponKey");
