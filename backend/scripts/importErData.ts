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
//     which l10n keys held Jackie's real skill names. Covers all 91 characters as of
//     2026-10. No "basic attack" skill entry exists per character
//     (that's shared per weapon type), so NORMAL_ATTACK is never populated here.
//     Descriptions contain the game's raw `{0}`, `{1}`... value placeholders
//     (resolved client-side against per-level coefficient tables we don't fetch);
//     cleanSkillText strips them.
//   - Also stores the trait and tactical-skill tables that routes reference by code.
//   - Routes (/v1/weaponRoutes/recommend) and fankit images are synced separately by
//     `er:routes` (scripts/importRoutes.ts) and `er:images` (scripts/importFankitImages.ts).
import "dotenv/config";
import { prisma } from "../src/prisma.js";
import { getMetaData, getL10nMap } from "../src/services/erApiClient.js";
import { MASTERY_WEAPON_KEY, weaponSkillCode } from "./masteryCodes.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
// Our Skill.slot values in kit order. A character's skill groups are 1{ccc}{n}00; n is
// usually 1-5, but not always (띠아 uses 1, 4, 5, 6, 7), so the slots are assigned to
// whichever five groups the character actually has, in order.
const SKILL_SLOTS = ["PASSIVE", "SKILL_1", "SKILL_2", "SKILL_3", "SKILL_4"];
const STANDARD_SLOT_GROUPS = [1, 2, 3, 4, 5];

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

// For prose that can't avoid placeholders (tips, and descriptions missing a LobbyDesc):
// turn "(+공격력의 {1})" scaling asides into "(공격력 계수)" — dropping them outright can
// leave a sentence with a hole ("기본 공격이 로 적용됩니다") — then word the remaining
// numbers generically so sentences stay grammatical.
function describeSkillText(raw: string): string {
  return cleanSkillText(
    raw
      .replace(/\(\+([^)]*?)의 \{\d+\}\)/g, "($1 계수)")
      .replace(/\{\d+\}초/g, "일정 시간")
      .replace(/\{\d+\}/g, "일정 수치"),
  );
}

// "(+공격력의 {1})", "(+대상 현재 체력의 {2})" -> ["공격력", "대상 현재 체력"]
function scalingStats(coefText: string): string[] {
  const stats = [...coefText.matchAll(/\(\+([^)]*?)의 \{\d+\}\)/g)].map((m) => m[1].trim());
  return [...new Set(stats)];
}

// Armor slots have no l10n key of their own; these are the in-game slot names.
const ARMOR_SLOT: Record<string, string> = { Head: "머리", Chest: "옷", Arm: "팔/장식", Leg: "다리" };

// Equipment sub-category for the item browser's filters: weapon kind or armor slot.
function itemSubType(row: Record<string, any>, l10n: Map<string, string>): string {
  if (row.itemType === "Weapon") return l10n.get(`WeaponType/${row.weaponType}`) ?? row.weaponType ?? "";
  if (row.itemType === "Armor") return ARMOR_SLOT[row.armorType] ?? row.armorType ?? "";
  return "";
}

// "잠식 변이 늑대" / "변이 늑대" -> listed as "늑대" when the plain animal also drops it, so
// the list names species rather than every variant; mutant-only drops keep "변이 ...".
function speciesList(names: Set<string>): string[] {
  const merged = new Set([...names].map((n) => n.replace(/^잠식 /, "")));
  return [...merged].filter((n) => !(n.startsWith("변이 ") && merged.has(n.slice(3))));
}

// Where each item comes from, for the item browser's "획득처" hints:
//   - spawnAreas: areas whose boxes can hold it (ItemSpawn rows, one per spawn group)
//   - droppedBy: wildlife whose drop group includes it (MonsterDropGroup -> DropGroup)
async function importItemSources(l10n: Map<string, string>) {
  console.log("Fetching ItemSpawn + Area + DropGroup + MonsterDropGroup...");
  const spawns = await getMetaData<Record<string, any>>("ItemSpawn");
  await sleep(1200);
  const areas = await getMetaData<Record<string, any>>("Area");
  await sleep(1200);
  const dropGroups = await getMetaData<Record<string, any>>("DropGroup");
  await sleep(1200);
  const monsterDrops = await getMetaData<Record<string, any>>("MonsterDropGroup");

  const areaName = new Map(areas.map((a) => [a.code as number, l10n.get(`Area/Name/${a.name}`) ?? a.name]));
  const areaCodesByItem = new Map<number, Set<number>>();
  for (const s of spawns) {
    if (!areaCodesByItem.has(s.itemCode)) areaCodesByItem.set(s.itemCode, new Set());
    areaCodesByItem.get(s.itemCode)!.add(s.areaCode);
  }

  const monstersByGroup = new Map<number, Set<number>>();
  for (const m of monsterDrops) {
    if (!monstersByGroup.has(m.dropGroup)) monstersByGroup.set(m.dropGroup, new Set());
    monstersByGroup.get(m.dropGroup)!.add(m.monsterCode);
  }
  const monsterNamesByItem = new Map<number, Set<string>>();
  for (const d of dropGroups) {
    const itemCode = Number(d.itemCode); // DropGroup sends item codes as strings
    for (const monster of monstersByGroup.get(d.groupCode) ?? []) {
      if (!monsterNamesByItem.has(itemCode)) monsterNamesByItem.set(itemCode, new Set());
      monsterNamesByItem.get(itemCode)!.add(l10n.get(`Monster/Name/${monster}`) ?? String(monster));
    }
  }

  const items = await prisma.item.findMany({ select: { code: true } });
  await prisma.$transaction(
    items.map(({ code }) =>
      prisma.item.update({
        where: { code },
        data: {
          spawnAreas: JSON.stringify(
            [...(areaCodesByItem.get(code) ?? [])].sort((a, b) => a - b).flatMap((a) => areaName.get(a) ?? []),
          ),
          droppedBy: JSON.stringify(speciesList(monsterNamesByItem.get(code) ?? new Set())),
        },
      }),
    ),
  );
  console.log(
    `  -> ${items.filter((i) => areaCodesByItem.has(i.code)).length} items found in boxes, ` +
      `${items.filter((i) => monsterNamesByItem.has(i.code)).length} dropped by wildlife.`,
  );
}

// Weapon kinds (with their weapon skill, D) and each character's weapons with the
// official 5-axis ratings from CharacterAttributes. skillImageUrl is left alone on
// update — `er:images` owns it.
async function importWeapons(l10n: Map<string, string>) {
  console.log("Fetching CharacterAttributes...");
  const attributes = await getMetaData<Record<string, any>>("CharacterAttributes");
  const masteryCodeByKey = new Map(Object.entries(MASTERY_WEAPON_KEY).map(([code, key]) => [key, Number(code)]));

  for (const key of new Set(attributes.map((a) => a.mastery as string))) {
    const masteryCode = masteryCodeByKey.get(key);
    const skillCode = masteryCode === undefined ? undefined : weaponSkillCode(masteryCode);
    const lobbyDesc = skillCode && l10n.get(`Skill/LobbyDesc/${skillCode}`);
    const data = {
      name: l10n.get(`WeaponType/${key}`) ?? key,
      description: cleanSkillText(l10n.get(`WeaponType/Desc/${key}`) ?? ""),
      skillName: skillCode ? cleanSkillText(l10n.get(`Skill/Group/Name/${skillCode}`) ?? "") : "",
      skillDescription: lobbyDesc
        ? cleanSkillText(lobbyDesc)
        : describeSkillText((skillCode && l10n.get(`Skill/Group/Desc/${skillCode}`)) || ""),
    };
    await prisma.weaponType.upsert({ where: { key }, update: data, create: { key, ...data } });
  }

  const characters = await prisma.character.findMany({ select: { id: true, code: true } });
  const idByCode = new Map(characters.map((c) => [c.code, c.id]));
  const rows = attributes.flatMap((a, i) => {
    const characterId = idByCode.get(a.characterCode);
    if (characterId === undefined) return [];
    return [
      {
        characterId,
        weaponKey: a.mastery as string,
        order: i,
        difficulty: a.controlDifficulty as number,
        attack: a.attack as number,
        defense: a.defense as number,
        disruptor: a.disruptor as number,
        move: a.move as number,
        assistance: a.assistance as number,
        guide: cleanSkillText(l10n.get(`CharacterGuide/${a.characterCode}/${a.mastery}`) ?? ""),
      },
    ];
  });
  await prisma.$transaction([prisma.characterWeapon.deleteMany(), prisma.characterWeapon.createMany({ data: rows })]);
  console.log(`  -> ${rows.length} character weapons.`);
}

// Each trait group's own name lives under a round Trait/Name code.
const TRAIT_GROUP_NAME_CODE: Record<string, number> = {
  Havoc: 7000000,
  Fortification: 7100000,
  Support: 7200000,
  Chaos: 7300000,
};
const TRAIT_TYPES = new Set(["Core", "Sub1", "Sub2"]);

// Routes reference traits by code; store the selectable ones (the Trait table also has
// retired rows and 92 Cobalt-mode augments, which routes never use). imageUrl is left
// alone on update — `er:images` owns it.
async function importTraits(l10n: Map<string, string>) {
  console.log("Fetching Trait...");
  const rows = (await getMetaData<Record<string, any>>("Trait")).filter(
    (t) => t.active && t.traitGroup in TRAIT_GROUP_NAME_CODE && TRAIT_TYPES.has(t.traitType),
  );
  for (const [key, nameCode] of Object.entries(TRAIT_GROUP_NAME_CODE)) {
    const name = l10n.get(`Trait/Name/${nameCode}`) ?? key;
    await prisma.traitGroup.upsert({ where: { key }, update: { name }, create: { key, name } });
  }
  for (const t of rows) {
    const data = {
      name: cleanSkillText(l10n.get(`Trait/Name/${t.code}`) ?? String(t.code)),
      description: cleanSkillText(l10n.get(`Trait/Tooltip/${t.code}`) ?? ""),
      group: t.traitGroup as string,
      type: t.traitType as string,
      order: t.traitSortOrder as number,
    };
    await prisma.trait.upsert({ where: { code: t.code }, update: data, create: { code: t.code, ...data } });
  }
  await prisma.trait.deleteMany({ where: { code: { notIn: rows.map((t) => t.code) } } });
  console.log(`  -> ${rows.length} traits.`);
}

// Tactical skill text is keyed by the group's icon number (VSkillIcon_4000000 ->
// Skill/Group/Name/4000000), while routes reference the group code (30).
async function importTacticalSkills(l10n: Map<string, string>) {
  console.log("Fetching TacticalSkillSetGroup...");
  const groups = await getMetaData<Record<string, any>>("TacticalSkillSetGroup");
  for (const g of groups) {
    const iconCode = String(g.icon).replace("VSkillIcon_", "");
    const name = l10n.get(`Skill/Group/Name/${iconCode}`);
    if (!name) continue;
    const data = { name: cleanSkillText(name), description: cleanSkillText(l10n.get(`Skill/Group/LobbyDesc/${iconCode}`) ?? "") };
    await prisma.tacticalSkill.upsert({ where: { code: g.group }, update: data, create: { code: g.group, ...data } });
  }
  console.log(`  -> ${groups.length} tactical skills.`);
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

  // Every character skill code (1{ccc}{slot}{xx}), sorted, for finding a slot's forms.
  const skillCodes = [...l10n.keys()]
    .map((k) => /^Skill\/Group\/Name\/(1\d{6})$/.exec(k)?.[1])
    .filter((c): c is string => c !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
  // LobbyDesc is the full, number-free wording the game shows in the lobby; the in-game
  // Desc is the same text with {n} value slots, used only as a fallback.
  const skillDescription = (code: number) => {
    const lobbyDesc = l10n.get(`Skill/LobbyDesc/${code}`);
    return lobbyDesc ? cleanSkillText(lobbyDesc) : describeSkillText(l10n.get(`Skill/Group/Desc/${code}`) ?? "");
  };

  console.log(`Upserting ${characters.length} characters (with skill kits)...`);
  let skillCoverage = 0;
  for (const row of characters) {
    const name = l10n.get(`Character/Name/${row.code}`) ?? row.name;
    // Official positions (탱커, 전사, 암살자, 스킬 딜러, 원거리 딜러, 지원가); some characters
    // have a second one, and "None" marks an empty slot.
    const positionList = [row.charArcheType1, row.charArcheType2]
      .filter((type): type is string => Boolean(type) && type !== "None")
      .map((type) => l10n.get(`CharArchetype/${type}`) ?? type);
    const positions = JSON.stringify(positionList);
    const archetype = positionList[0] ?? "";
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
        positions,
        description: archetype ? `${archetype} 유형의 실험체입니다.` : "",
      },
      create: {
        code: row.code,
        name,
        nameEn: row.name,
        weaponType,
        positions,
        description: archetype ? `${archetype} 유형의 실험체입니다.` : "",
      },
    });

    const codePrefix = `1${String(row.code).padStart(3, "0")}`;
    const kitBase = Number(codePrefix) * 1000; // 1{ccc}000
    const groups = [
      ...new Set(skillCodes.filter((c) => c >= kitBase && c < kitBase + 1000).map((c) => Math.floor((c - kitBase) / 100))),
    ].sort((a, b) => a - b);
    const slotGroups = groups.length === SKILL_SLOTS.length ? groups : STANDARD_SLOT_GROUPS;

    const skills = SKILL_SLOTS.map((slot, order) => {
      // A slot spans codes {slotBase}..{slotBase + 99}: "00" is usually the skill, and
      // multi-stage / alternate forms sit at 10, 20, ... (2nd hit, empowered version,
      // stance swap). Some slots have no "00" at all (character 37's R starts at 10), so
      // every code in the range is considered.
      const slotBase = kitBase + slotGroups[order] * 100;
      // One entry per distinct name: several codes often repeat a name (recasts, or the
      // same skill with only in-game {n} text); prefer the one with lobby wording.
      const byName = new Map<string, { code: number; name: string; description: string; lobby: boolean }>();
      for (const c of skillCodes.filter((c) => c >= slotBase && c < slotBase + 100)) {
        const name = cleanSkillText(l10n.get(`Skill/Group/Name/${c}`) ?? "");
        if (!name) continue;
        const form = { code: c, name, description: skillDescription(c), lobby: l10n.has(`Skill/LobbyDesc/${c}`) };
        const existing = byName.get(name);
        if (!existing || (!existing.description && form.description) || (!existing.lobby && form.lobby)) byName.set(name, form);
      }
      const forms = [...byName.values()].sort((a, b) => a.code - b.code);
      // The main entry is the first form with a description (10552's "00" has none).
      const main = forms.find((f) => f.description) ?? forms[0];
      if (!main) return null;
      const groupCode = main.code;
      const description = main.description;
      // The other forms (2nd hit, empowered, other stance/colour). Text identical to the
      // main skill's — 띠아's colours share one lobby blurb — is left out, name only.
      const variants = forms
        .filter((f) => f !== main)
        .map((f) => ({ name: f.name, description: f.description === main.description ? "" : f.description }));
      const tips = describeSkillText(l10n.get(`Skill/Group/ExpansionTip/${groupCode}`) ?? "");
      const scaling = scalingStats(l10n.get(`Skill/Group/Coef/${groupCode}`) ?? "");
      return {
        slot,
        name: main.name,
        description,
        tips,
        scaling: JSON.stringify(scaling),
        variants: JSON.stringify(variants),
        order,
      };
    }).filter((s): s is NonNullable<typeof s> => s !== null);

    if (skills.length > 0) {
      skillCoverage++;
      // Simplest correct way to keep this idempotent: replace the whole kit each run —
      // but keep the icons `er:images` attached, which come from a different source.
      const iconBySlot = new Map(
        (await prisma.skill.findMany({ where: { characterId: character.id } })).map((s) => [s.slot, s.imageUrl]),
      );
      await prisma.skill.deleteMany({ where: { characterId: character.id } });
      await prisma.skill.createMany({
        data: skills.map((s) => ({ ...s, characterId: character.id, imageUrl: iconBySlot.get(s.slot) ?? "" })),
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
  const syncedItemCodes: number[] = [];

  for (const { metaType, typeLabel } of ITEM_TABLES) {
    await sleep(1200);
    console.log(`Fetching ${metaType}...`);
    const rows = await getMetaData<Record<string, any>>(metaType);

    console.log(`Upserting ${rows.length} ${typeLabel} items...`);
    for (const row of rows) {
      // Rows with no Korean name are unreleased/internal (e.g. 409404 — no name, not
      // part of any recipe), so they'd only show up as "아이템 409404" placeholders.
      const name = l10n.get(`Item/Name/${row.code}`);
      if (!name) continue;
      syncedItemCodes.push(row.code);
      const data = {
        name,
        type: typeLabel,
        subType: itemSubType(row, l10n),
        grade: GRADE_RANK[row.itemGrade] ?? 1,
        stats: JSON.stringify(pickStats(row)),
        description: describeSkillText(l10n.get(`Item/Effects/${row.code}`) ?? ""),
        flavor: cleanSkillText(l10n.get(`Item/Help/${row.code}`) ?? ""),
      };

      await prisma.item.upsert({ where: { code: row.code }, update: data, create: { code: row.code, ...data } });

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

  // Drop anything the API no longer returns — e.g. prisma/seed.ts's placeholder items
  // (codes 101/102), which would otherwise linger in the list next to the real data.
  const staleItems = await prisma.item.deleteMany({ where: { code: { notIn: syncedItemCodes } } });
  console.log(`  -> removed ${staleItems.count} stale items not in the API.`);

  await sleep(1200);
  await importItemSources(l10n);
  await sleep(1200);
  await importWeapons(l10n);
  await sleep(1200);
  await importTraits(l10n);
  await sleep(1200);
  await importTacticalSkills(l10n);

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
