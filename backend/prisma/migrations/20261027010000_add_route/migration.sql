-- CreateTable
CREATE TABLE "Route" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "routeId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "authorNickname" TEXT NOT NULL,
    "characterId" INTEGER NOT NULL,
    "weaponType" TEXT NOT NULL,
    "itemCodes" TEXT NOT NULL DEFAULT '[]',
    "areas" TEXT NOT NULL DEFAULT '[]',
    "traits" TEXT NOT NULL DEFAULT '[]',
    "tacticalSkill" TEXT NOT NULL DEFAULT '',
    "skillPath" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "likes" INTEGER NOT NULL DEFAULT 0,
    "winRate" REAL NOT NULL DEFAULT 0,
    "version" TEXT NOT NULL DEFAULT '',
    "languageCode" TEXT NOT NULL DEFAULT '',
    "sharedAt" DATETIME NOT NULL,
    CONSTRAINT "Route_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Route_routeId_key" ON "Route"("routeId");

