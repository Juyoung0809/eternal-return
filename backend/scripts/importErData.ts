// Pulls live data from the Eternal Return Open API and upserts it into the local
// Prisma database, replacing the placeholder seed data with the real game data.
//
//   npm run er:import -w backend
//
// Notes on API coverage (see backend/data/raw/*.json from `npm run er:sync` for
// the raw shapes this was reverse-engineered from — the API has no public schema
// docs for row fields):
//   - Character skill (passive + skill 1-4) names/descriptions aren't in any of the
//     44 /v2/data tables, but they ARE in the l10n text dump under the undocumented
//     key pattern `Skill/Group/{Name,Desc}/1{characterCode:03}{slot}` where slot is
//     100 (passive), 200, 300, 400, 500 (skills 1-4) — reverse-engineered by checking
//     which l10n keys held Jackie's real skill names. Covers 90/91 characters (the
//     91st isn't released yet). No "basic attack" skill entry exists per character
//     (that's shared per weapon type), so NORMAL_ATTACK is never populated here.
//     Descriptions still contain the game's raw `{0}`, `{1}`... value placeholders
//     (resolved client-side against per-level coefficient tables we don't fetch), so
//     they're shown as-is rather than filled in.
//   - There's no "Map" table either, so GameMap rows stay hand-curated; monsters are
//     just attached to whichever map already exists (or left mapless if none does).
//   - Monster drop tables (DropGroup/MonsterDropGroup) aren't joined here yet, so
//     dropInfo stays blank for API-synced monsters.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { getMetaData, getL10nMap } from "../src/services/erApiClient.js";

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ARCHETYPE_KO: Record<string, string> = {
  Warrior: "전사",
  Tanker: "탱커",
  Assasin: "암살자",
  Marksman: "사격수",
  Mage: "마법사",
  Supporter: "서포터",
};

const MUTANT_KO: Record<string, string> = {
  None: "일반",
  Mutant: "돌연변이",
  PurpleMutant: "보라 돌연변이",
};

const GRADE_RANK: Record<string, number> = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Epic: 4,
  Legend: 5,
  Mythic: 6,
};

// Numeric fields worth surfacing on an item's stat block, across all five item tables.
// This was originally a short hand-picked list, which silently dropped any item whose
// only stats were things like penetrationDefenseRatio or a *ByLv growth stat — 19 items
// ended up showing an empty "능력치" section, and many more were quietly missing lines.
// Broadened by auditing every nonzero numeric field actually present in the raw tables
// (excluding bookkeeping fields like codes/ids/counts that aren't player-facing stats).
const STAT_FIELDS = [
  "attackPower",
  "attackPowerByLv",
  "defense",
  "defenseByLv",
  "maxHp",
  "maxHpByLv",
  "skillAmp",
  "skillAmpByLevel",
  "skillAmpRatio",
  "adaptiveForce",
  "adaptiveForceByLevel",
  "criticalStrikeChance",
  "criticalStrikeDamage",
  "cooldownReduction",
  "ultCooldownReduction",
  "tacticalCooldownReduction",
  "weaponCooldownReduction",
  "moveSpeed",
  "moveSpeedRatio",
  "moveSpeedOutOfCombat",
  "attackSpeedRatio",
  "attackRange",
  "sightRange",
  "lifeSteal",
  "normalLifeSteal",
  "skillLifeSteal",
  "hpRegen",
  "hpRegenRatio",
  "heal",
  "hpRecover",
  "penetrationDefense",
  "penetrationDefenseRatio",
  "increaseBasicAttackDamage",
  "increaseBasicAttackDamageRatio",
  "increaseBasicAttackDamageRatioByLv",
  "healerGiveHpHealRatio",
  "gadgetEnergyGain",
  "uniqueAttackRange",
  "uniqueTenacity",
  "uniqueMoveSpeed",
  "uniqueLifeSteal",
  "uniqueSkillAmpRatio",
  "uniquePenetrationDefense",
  "uniquePenetrationDefenseRatio",
  "uniqueCooldownLimit",
  "uniqueHpHealedIncreaseRatio",
] as const;

function pickStats(row: Record<string, unknown>): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const key of STAT_FIELDS) {
    const value = row[key];
    if (typeof value === "number" && value !== 0) stats[key] = value;
  }
  return stats;
}

// slot code suffix -> our Skill.slot enum value, in kit order.
const SKILL_SLOTS: Array<{ code: string; slot: string }> = [
  { code: "100", slot: "PASSIVE" },
  { code: "200", slot: "SKILL_1" },
  { code: "300", slot: "SKILL_2" },
  { code: "400", slot: "SKILL_3" },
  { code: "500", slot: "SKILL_4" },
];

// Strips the game's rich-text markup (<color=..>, <i>, etc.) from skill text, and
// drops the `{0}`, `{1}`... value placeholders entirely — confirmed there's no table
// or l10n key anywhere in the public API that supplies the numbers to fill them (the
// per-level coefficients live only in the game client), so left in they just read as
// stray braces mid-sentence. Removing them leaves the grammar a little rough around
// where a number used to sit, but that reads better than the placeholder syntax.
function cleanSkillText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/\\n/g, "\n") // literal backslash-n text, not an actual newline byte
    .replace(/\{\d+\}/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ +([)%,.])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function main() {
  console.log("Fetching Korean localization...");
  const l10n = await getL10nMap("Korean");
  await sleep(1200);

  console.log("Fetching Character + CharacterMastery...");
  const characters = await getMetaData<Record<string, any>>("Character");
  await sleep(1200);
  const masteries = await getMetaData<Record<string, any>>("CharacterMastery");
  const masteryByCode = new Map(masteries.map((m) => [m.code, m]));
  await sleep(1200);

  console.log(`Upserting ${characters.length} characters (with skill kits)...`);
  let skillCoverage = 0;
  for (const row of characters) {
    const name = l10n.get(`Character/Name/${row.code}`) ?? row.name;
    const archetype = ARCHETYPE_KO[row.charArcheType1] ?? row.charArcheType1 ?? "";
    const mastery = masteryByCode.get(row.code);
    const weaponType = mastery?.weapon1
      ? (l10n.get(`WeaponType/${mastery.weapon1}`) ?? mastery.weapon1)
      : "";

    const character = await prisma.character.upsert({
      where: { code: row.code },
      update: {
        name,
        nameEn: row.name,
        weaponType,
        description: archetype ? `${archetype} 유형의 실험체입니다.` : "",
      },
      create: {
        code: row.code,
        name,
        nameEn: row.name,
        weaponType,
        description: archetype ? `${archetype} 유형의 실험체입니다.` : "",
      },
    });

    const codePrefix = `1${String(row.code).padStart(3, "0")}`;
    const skills = SKILL_SLOTS.map(({ code, slot }, order) => {
      const rawName = l10n.get(`Skill/Group/Name/${codePrefix}${code}`);
      if (!rawName) return null;
      const rawDesc = l10n.get(`Skill/Group/Desc/${codePrefix}${code}`) ?? "";
      return { slot, name: cleanSkillText(rawName), description: cleanSkillText(rawDesc), order };
    }).filter((s): s is NonNullable<typeof s> => s !== null);

    if (skills.length > 0) {
      skillCoverage++;
      // Simplest correct way to keep this idempotent: replace the whole kit each run.
      await prisma.skill.deleteMany({ where: { characterId: character.id } });
      await prisma.skill.createMany({
        data: skills.map((s) => ({ ...s, characterId: character.id })),
      });
    }
  }
  console.log(`  -> real skill kits found for ${skillCoverage}/${characters.length} characters.`);

  const ITEM_TABLES: Array<{ metaType: string; typeLabel: string }> = [
    { metaType: "ItemWeapon", typeLabel: "무기" },
    { metaType: "ItemArmor", typeLabel: "방어구" },
    { metaType: "ItemSpecial", typeLabel: "특수" },
    { metaType: "ItemConsumable", typeLabel: "소비" },
    // Base crafting materials (nails, mithril, cloth, ...) — makeMaterial1/2 on the
    // tables above often point at one of these, so without it most crafting recipes
    // were only half-resolving (one material found, one dangling).
    { metaType: "ItemMisc", typeLabel: "재료" },
  ];

  const materialLinks: Array<{ code: number; materials: number[] }> = [];

  for (const { metaType, typeLabel } of ITEM_TABLES) {
    await sleep(1200);
    console.log(`Fetching ${metaType}...`);
    const rows = await getMetaData<Record<string, any>>(metaType);

    console.log(`Upserting ${rows.length} ${typeLabel} items...`);
    for (const row of rows) {
      const name = l10n.get(`Item/Name/${row.code}`) ?? `아이템 ${row.code}`;
      const grade = GRADE_RANK[row.itemGrade] ?? 1;
      const stats = JSON.stringify(pickStats(row));

      await prisma.item.upsert({
        where: { code: row.code },
        update: { name, type: typeLabel, grade, stats },
        create: { code: row.code, name, type: typeLabel, grade, stats },
      });

      const materials = [row.makeMaterial1, row.makeMaterial2].filter(
        (m): m is number => typeof m === "number" && m > 0,
      );
      if (materials.length > 0) materialLinks.push({ code: row.code, materials });
    }
  }

  console.log(`Linking ${materialLinks.length} item crafting relations...`);
  for (const { code, materials } of materialLinks) {
    // Materials sometimes reference codes outside our synced tables (e.g. event-only
    // items) — `connect` on a missing id throws, so resolve to existing ones first.
    const existing = await prisma.item.findMany({
      where: { code: { in: materials } },
      select: { id: true },
    });
    if (existing.length === 0) continue;
    await prisma.item.update({
      where: { code },
      data: { materials: { set: existing.map((e) => ({ id: e.id })) } },
    });
  }

  await sleep(1200);
  console.log("Fetching Monster...");
  const monsters = await getMetaData<Record<string, any>>("Monster");
  const defaultMap = await prisma.gameMap.findFirst();

  console.log(`Upserting ${monsters.length} monsters (no per-monster map data in the API, so all are attached to "${defaultMap?.name ?? "(no map seeded)"}")...`);
  for (const row of monsters) {
    const name = l10n.get(`Monster/Name/${row.code}`) ?? row.monster;
    const gradeLabel = l10n.get(`ItemGrade/${row.grade}`) ?? row.grade;
    const mutantLabel = MUTANT_KO[row.mutantType] ?? "";

    await prisma.monster.upsert({
      where: { code: row.code },
      update: {
        name,
        type: gradeLabel,
        description: mutantLabel ? `${mutantLabel} 개체` : "",
        mapId: defaultMap?.id,
      },
      create: {
        code: row.code,
        name,
        type: gradeLabel,
        description: mutantLabel ? `${mutantLabel} 개체` : "",
        mapId: defaultMap?.id,
      },
    });
  }

  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
