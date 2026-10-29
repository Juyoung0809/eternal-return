-- AlterTable
ALTER TABLE "Route" ADD COLUMN "lateItemSets" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Route" ADD COLUMN "remoteItemCodes" TEXT NOT NULL DEFAULT '[]';
