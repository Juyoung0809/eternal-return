// Prisma CLI settings (replaces the deprecated `prisma` key in package.json). With a
// config file present the CLI no longer reads .env itself, so load it here for
// DATABASE_URL.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
