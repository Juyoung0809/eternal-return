// Fills the database after a migration reset (Prisma runs this after `prisma migrate
// reset`) or via `npm run seed`. With prisma/snapshot.db.gz present (`npm run
// db:snapshot` after a full import) the real game data is restored from it; without
// one, a tiny sample set keeps the app browsable until `er:import` runs.
import "dotenv/config";
import { prisma } from "../src/prisma.js";
import { hasSnapshot, restoreSnapshot, SNAPSHOT_PATH } from "./snapshot.js";

async function main() {
  if (hasSnapshot()) {
    const copied = restoreSnapshot();
    const summary = Object.entries(copied)
      .map(([table, rows]) => `${table} ${rows}`)
      .join(", ");
    console.log(`Restored ${SNAPSHOT_PATH}: ${summary}`);
    return;
  }

  await prisma.skill.deleteMany();
  await prisma.character.deleteMany();
  await prisma.item.deleteMany();

  await prisma.character.create({
    data: {
      code: 1,
      name: "재키",
      nameEn: "Jackie",
      weaponType: "글러브",
      difficulty: 2,
      description: "근접 딜링과 기동성을 겸비한 격투가 캐릭터.",
      skills: {
        create: [
          { slot: "PASSIVE", name: "필사의 반격", order: 0 },
          { slot: "SKILL_1", name: "어퍼컷", order: 1 },
          { slot: "SKILL_2", name: "질풍노도", order: 2 },
          { slot: "SKILL_3", name: "회심의 일격", order: 3 },
          { slot: "SKILL_4", name: "왕의 품격", order: 4 },
        ],
      },
    },
  });

  await prisma.character.create({
    data: {
      code: 2,
      name: "아야",
      nameEn: "Aya",
      weaponType: "듀얼블레이드",
      difficulty: 2,
      description: "은신과 기습에 특화된 스피드형 딜러.",
      skills: {
        create: [
          { slot: "PASSIVE", name: "그림자 밟기", order: 0 },
          { slot: "SKILL_1", name: "베어내기", order: 1 },
          { slot: "SKILL_2", name: "잔상", order: 2 },
          { slot: "SKILL_3", name: "은신", order: 3 },
          { slot: "SKILL_4", name: "심판의 칼날", order: 4 },
        ],
      },
    },
  });

  const basicSword = await prisma.item.create({
    data: {
      code: 101,
      name: "낡은 검",
      grade: 1,
      type: "무기",
      stats: JSON.stringify({ attack: 8 }),
      description: "기본 등급 근접 무기.",
    },
  });

  await prisma.item.create({
    data: {
      code: 102,
      name: "장검",
      grade: 2,
      type: "무기",
      stats: JSON.stringify({ attack: 20, critChance: 5 }),
      description: "낡은 검을 조합해 만드는 상위 무기.",
      materials: { connect: [{ id: basicSword.id }] },
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
