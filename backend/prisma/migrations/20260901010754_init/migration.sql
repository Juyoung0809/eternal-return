-- CreateTable
CREATE TABLE "Character" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "weaponType" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "characterId" INTEGER NOT NULL,
    "slot" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Skill_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "grade" INTEGER NOT NULL DEFAULT 1,
    "type" TEXT NOT NULL,
    "stats" TEXT NOT NULL DEFAULT '{}',
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GameMap" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "Monster" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mapId" INTEGER,
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "dropInfo" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Monster_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "GameMap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_Recipe" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_Recipe_A_fkey" FOREIGN KEY ("A") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_Recipe_B_fkey" FOREIGN KEY ("B") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Character_code_key" ON "Character"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Item_code_key" ON "Item"("code");

-- CreateIndex
CREATE UNIQUE INDEX "_Recipe_AB_unique" ON "_Recipe"("A", "B");

-- CreateIndex
CREATE INDEX "_Recipe_B_index" ON "_Recipe"("B");
