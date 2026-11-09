// Links character art from the Eternal Return community fankit (a public Google Drive,
// browsable through the drive-portal site's file-listing API) into the DB:
//   - Character.imageUrl      <- 02. Default/{Name}_Mini_00 (profile)
//   - Character.fullImageUrl  <- 02. Default/{Name}_Full_00 (full body)
//   - Skin rows               <- default + each skin folder's *_Full* image
//   - Skill.imageUrl          <- 03. Skill Icon/*_{P,Q,W,E,R}*
//   - Item / Trait / TraitGroup / TacticalSkill / weapon skill icons <- 02. Ingame_Image
//     (by English name)
// Files aren't copied into the repo — URLs point at /api/images, which fetches from
// Drive and caches on disk (backend/data/images). Run after
// `er:import` so the characters and skills exist.
//
//   npm run er:images -w backend
//   npm run er:images -w backend -- --icons-only   # skip character art
//
// Folder/file naming in the fankit is hand-made and inconsistent ("Skill icon" vs
// "Skill Icon", "Concept ARt", Debi & Marlene's two icon sets, Aya's empty icon
// folder), so matching is by loose patterns and anything unmatched is just skipped.
import "dotenv/config";
import { prisma } from "../src/prisma.js";
import { getMetaData, getL10nMap } from "../src/services/erApiClient.js";
import { MASTERY_WEAPON_KEY, weaponSkillCode } from "./masteryCodes.js";

const PORTAL = "https://drive-portal-bice.vercel.app";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function listFolder(folderId?: string, retriesLeft = 3): Promise<DriveFile[]> {
  await sleep(100); // the portal proxies Drive's API; keep the request rate modest
  try {
    const res = await fetch(`${PORTAL}/api/files${folderId ? `?folderId=${folderId}` : ""}`);
    if (!res.ok) throw new Error(`Fankit portal listing ${folderId ?? "(root)"} failed: ${res.status}`);
    return ((await res.json()) as { files: DriveFile[] }).files;
  } catch (err) {
    // The portal occasionally drops connections (ECONNRESET) mid-run; retry a few times.
    if (retriesLeft === 0) throw err;
    await sleep(2000);
    return listFolder(folderId, retriesLeft - 1);
  }
}

// Stored as our own proxy path (src/routes/images.ts), not Drive's URL: Google rejects
// hotlinked Drive images (429 when a Referer is present), so browsers go through us.
const driveImage = (fileId: string, width: number) => `/api/images/${fileId}?w=${width}`;

const isFolder = (f: DriveFile) => f.mimeType === "application/vnd.google-apps.folder";
const folderNumber = (f: DriveFile) => Number(/^(\d+)\./.exec(f.name)?.[1] ?? NaN);
const stripNumber = (name: string) => name.replace(/^\d+\.\s*/, "");
// Drops accents first so "István" matches the API's "Istvan".
const normalize = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// The passive shows up as "P", "T" (its in-game key) or the word "Passive".
const ICON_SLOTS: Record<string, string> = {
  P: "PASSIVE",
  T: "PASSIVE",
  Q: "SKILL_1",
  W: "SKILL_2",
  E: "SKILL_3",
  R: "SKILL_4",
};

// "Jackie_Q1.png", "Jackie_E_Leaping Strike.png", "01. P.png", "Cathy_T.png",
// "Yuki_Passive.png", "00. Xiukai Passive.png" -> Q / E / P / P / P / P
function iconSlot(fileName: string): string | undefined {
  const base = fileName.replace(/\.[a-z]+$/i, "");
  if (/(?:^|[_\s.])passive(?=[_\s.]|$)/i.test(base)) return "PASSIVE";
  const letter = /(?:^|[_\s.])([PTQWER])\d?(?=[_\s.]|$)/.exec(base)?.[1];
  return letter ? ICON_SLOTS[letter] : undefined;
}

async function main() {
  const root = await listFolder();
  // `-- --icons-only` skips the slow per-character walk.
  if (!process.argv.includes("--icons-only")) await linkCharacterArt(root);
  await linkIngameIcons(root);
}

async function linkCharacterArt(root: DriveFile[]) {
  console.log("Fetching CharacterSkin + Korean localization...");
  const apiSkins = await getMetaData<Record<string, any>>("CharacterSkin");
  const l10n = await getL10nMap("Korean");

  const characterRoot = root.find((f) => isFolder(f) && /character/i.test(f.name));
  if (!characterRoot) throw new Error("Couldn't find the Character folder in the fankit root.");

  // Folders are "{number}. {EnglishName}". The numbers mostly follow character codes but
  // not always (the fankit has "003. Hyunwoo" while Hyunwoo is code 7, and 14-18 are
  // shuffled too), so folders are matched by English name. NPC folders (Dr. Hana,
  // Wickeline...) match no character and are skipped.
  const characterFolders = (await listFolder(characterRoot.id)).filter(isFolder);
  const characters = await prisma.character.findMany({ select: { id: true, code: true, name: true, nameEn: true } });
  const characterByName = new Map(characters.map((c) => [normalize(c.nameEn), c]));

  let linked = 0;
  for (const folder of characterFolders) {
    const character = characterByName.get(normalize(stripNumber(folder.name)));
    if (!character) {
      console.log(`  skip ${folder.name}: no character with that name in the DB`);
      continue;
    }

    const subfolders = (await listFolder(folder.id)).filter(isFolder);
    const defaultFolder = subfolders.find((f) => /default/i.test(f.name));
    const iconFolder = subfolders.find((f) => /skill\s*icon/i.test(f.name));
    // 01-05 are concept art / default / icons / skill gifs / voice; 99 is lobby videos.
    const skinFolders = subfolders.filter((f) => folderNumber(f) >= 6 && folderNumber(f) < 99);

    const defaultFiles = defaultFolder ? await listFolder(defaultFolder.id) : [];
    const mini = defaultFiles.find((f) => /mini/i.test(f.name));
    const full = defaultFiles.find((f) => /full/i.test(f.name));

    await prisma.character.update({
      where: { id: character.id },
      data: {
        imageUrl: mini ? driveImage(mini.id, 256) : "",
        fullImageUrl: full ? driveImage(full.id, 1000) : "",
      },
    });

    const characterSkins = apiSkins.filter((s) => s.characterCode === character.code);
    const skins: Array<{ code: number | null; name: string; imageUrl: string; order: number }> = [];
    if (full) {
      const defaultSkin = characterSkins.find((s) => s.index === 0);
      skins.push({ code: defaultSkin?.code ?? null, name: "기본 스킨", imageUrl: driveImage(full.id, 1000), order: 0 });
    }
    for (const skinFolder of skinFolders) {
      const skinFull = (await listFolder(skinFolder.id)).find((f) => /full/i.test(f.name));
      if (!skinFull) continue;
      const englishName = stripNumber(skinFolder.name);
      // Folder names use the fankit's "-ER" stylization ("ExecutionER Jackie"); compare
      // case/punctuation-insensitively against the API's English skin names.
      const apiSkin = characterSkins.find((s) => normalize(s.name) === normalize(englishName));
      skins.push({
        code: apiSkin?.code ?? null,
        name: (apiSkin && l10n.get(`Skin/Name/${apiSkin.code}`)?.trim()) || englishName,
        imageUrl: driveImage(skinFull.id, 1000),
        order: folderNumber(skinFolder),
      });
    }
    await prisma.skin.deleteMany({ where: { characterId: character.id } });
    await prisma.skin.createMany({ data: skins.map((s) => ({ ...s, characterId: character.id })) });

    const iconFiles = iconFolder ? (await listFolder(iconFolder.id)).sort((a, b) => a.name.localeCompare(b.name)) : [];
    const iconBySlot = new Map<string, string>();
    for (const file of iconFiles) {
      const slot = iconSlot(file.name);
      if (slot && !iconBySlot.has(slot)) iconBySlot.set(slot, file.id);
    }
    for (const [slot, fileId] of iconBySlot) {
      await prisma.skill.updateMany({
        where: { characterId: character.id, slot },
        data: { imageUrl: driveImage(fileId, 128) },
      });
    }

    linked++;
    console.log(
      `  ${character.name}: profile ${mini ? "✓" : "✗"}, full ${full ? "✓" : "✗"}, ${skins.length} skins, ${iconBySlot.size}/5 icons`,
    );
  }

  console.log(`\nLinked fankit art for ${linked}/${characters.length} characters.`);
}

// "021. SCV (Self-Controlled Vehicle).png" -> "scv": a parenthetical gloss isn't part
// of the item's name.
const fileKey = (fileName: string) =>
  normalize(stripNumber(fileName.replace(/\.[a-z0-9]+$/i, "").replace(/\s*\([^)]*\)/g, "")));

// Items the game has since renamed in English while the fankit keeps the old file
// name. Matched by folder and grade slot (e.g. Rapier is the 고급 entry of the rapier
// folder, Twin Swords the 일반 entry of dual swords).
const ITEM_NAME_ALIASES: Record<string, string> = {
  "Instant Camera": "Polaroid Camera", // 폴라로이드 카메라
  "Fencing Rapier": "Rapier", // 레이피어
  "Twin Blades": "Twin Swords", // 쌍칼
};

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Looks up icons by English name. The fankit's file names have hand-typed slips
// ("Miltary Suit", "Shapened Spear", "Lock OnTracker"), so a long name with no exact
// match falls back to the single closest file within two edits.
function iconMatcher(files: DriveFile[]) {
  const byKey = new Map<string, DriveFile>();
  for (const f of files) if (!byKey.has(fileKey(f.name))) byKey.set(fileKey(f.name), f);
  const find = (key: string): DriveFile | undefined => {
    const exact = byKey.get(key);
    const maxEdits = key.length >= 8 ? 2 : key.length >= 6 ? 1 : 0;
    if (exact || maxEdits === 0) return exact;
    const close = [...byKey].map(([k, f]) => ({ f, d: editDistance(k, key) })).filter((c) => c.d <= maxEdits);
    close.sort((a, b) => a.d - b.d);
    return close.length === 1 || (close.length > 1 && close[0].d < close[1].d) ? close[0]?.f : undefined;
  };
  return (englishName: string | undefined): DriveFile | undefined => {
    if (!englishName) return undefined;
    // Variants ("Hydra - Crimson", "Cadmus' Call Lv2") share the base item's art.
    const base = englishName.replace(/\s*-\s*[^-]+$/, "").replace(/\s+Lv\.?\s*\d+$/i, "");
    return find(normalize(englishName)) ?? (base !== englishName ? find(normalize(base)) : undefined);
  };
}

// Every image under a folder, recursively, skipping subfolders whose name matches `skip`.
async function listImages(folderId: string, skip?: RegExp): Promise<DriveFile[]> {
  const entries = await listFolder(folderId);
  const nested = await Promise.all(
    entries.filter((f) => isFolder(f) && !skip?.test(f.name)).map((f) => listImages(f.id, skip)),
  );
  return [...entries.filter((f) => f.mimeType.startsWith("image/")), ...nested.flat()];
}

// Item, trait and tactical-skill icons from 02. Ingame_Image, matched on the English
// names in the official l10n (fankit file names are English).
async function linkIngameIcons(root: DriveFile[]) {
  const ingame = root.find((f) => isFolder(f) && /ingame/i.test(f.name));
  if (!ingame) throw new Error("Couldn't find the Ingame_Image folder in the fankit root.");
  const en = await getL10nMap("English");
  const sections = await listFolder(ingame.id);
  const loadout = sections.find((f) => /loadout/i.test(f.name));

  // Items: everything except loadout / rank / weapon-skill art and the weapon-type icons.
  const itemFiles = (
    await Promise.all(
      sections
        .filter((f) => isFolder(f) && !/loadout|rank|weapon skill/i.test(f.name))
        .map((f) => listImages(f.id, /weapon group/i)),
    )
  ).flat();
  const findItemIcon = iconMatcher(itemFiles);
  const items = await prisma.item.findMany({ select: { code: true } });
  let itemHits = 0;
  for (const item of items) {
    const englishName = en.get(`Item/Name/${item.code}`);
    const file = findItemIcon(englishName) ?? findItemIcon(englishName && ITEM_NAME_ALIASES[englishName]);
    if (!file) continue;
    itemHits++;
    await prisma.item.update({ where: { code: item.code }, data: { imageUrl: driveImage(file.id, 128) } });
  }
  console.log(`Item icons: ${itemHits}/${items.length}`);

  const loadoutFolders = loadout ? (await listFolder(loadout.id)).filter(isFolder) : [];

  // Trait folders are named after their group ("01. Havoc"), and hold the group's own
  // icon as "{Group}1.png" next to its trait icons.
  let traitHits = 0;
  const traits = await prisma.trait.findMany();
  for (const group of await prisma.traitGroup.findMany()) {
    const folder = loadoutFolders.find((f) => normalize(stripNumber(f.name)) === normalize(group.key));
    const files = folder ? await listFolder(folder.id) : [];
    const groupIcon = files.find((f) => fileKey(f.name) === `${normalize(group.key)}1`);
    if (groupIcon) {
      await prisma.traitGroup.update({ where: { key: group.key }, data: { imageUrl: driveImage(groupIcon.id, 128) } });
    }
    const findTraitIcon = iconMatcher(files);
    for (const trait of traits.filter((t) => t.group === group.key)) {
      const file = findTraitIcon(en.get(`Trait/Name/${trait.code}`));
      if (!file) continue;
      traitHits++;
      await prisma.trait.update({ where: { code: trait.code }, data: { imageUrl: driveImage(file.id, 128) } });
    }
  }
  console.log(`Trait icons: ${traitHits}/${traits.length}`);

  const tacticalFolder = loadoutFolders.find((f) => /tactical/i.test(f.name));
  const findTacticalIcon = iconMatcher(tacticalFolder ? await listFolder(tacticalFolder.id) : []);
  const iconCodeByGroup = new Map(
    (await getMetaData<Record<string, any>>("TacticalSkillSetGroup")).map((g) => [
      g.group as number,
      String(g.icon).replace("VSkillIcon_", ""),
    ]),
  );
  const tacticals = await prisma.tacticalSkill.findMany();
  let tacticalHits = 0;
  for (const skill of tacticals) {
    const file = findTacticalIcon(en.get(`Skill/Group/Name/${iconCodeByGroup.get(skill.code)}`));
    if (!file) continue;
    tacticalHits++;
    await prisma.tacticalSkill.update({ where: { code: skill.code }, data: { imageUrl: driveImage(file.id, 128) } });
  }
  console.log(`Tactical skill icons: ${tacticalHits}/${tacticals.length}`);

  // Weapon skills: "★Weapon Skill/01. Dagger_Cloak and Dagger.png" — matched on the part
  // after the underscore against the skill's English name.
  const weaponSkillFolder = sections.find((f) => isFolder(f) && /weapon skill/i.test(f.name));
  const weaponSkillFiles = (weaponSkillFolder ? await listFolder(weaponSkillFolder.id) : []).map((f) => ({
    ...f,
    name: f.name.slice(f.name.indexOf("_") + 1),
  }));
  const findWeaponSkillIcon = iconMatcher(weaponSkillFiles);
  const masteryCodeByKey = new Map(Object.entries(MASTERY_WEAPON_KEY).map(([code, key]) => [key, Number(code)]));
  const weapons = await prisma.weaponType.findMany();
  let weaponHits = 0;
  for (const weapon of weapons) {
    const masteryCode = masteryCodeByKey.get(weapon.key);
    if (masteryCode === undefined) continue;
    const file = findWeaponSkillIcon(en.get(`Skill/Group/Name/${weaponSkillCode(masteryCode)}`));
    if (!file) continue;
    weaponHits++;
    await prisma.weaponType.update({ where: { key: weapon.key }, data: { skillImageUrl: driveImage(file.id, 128) } });
  }
  console.log(`Weapon skill icons: ${weaponHits}/${weapons.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
