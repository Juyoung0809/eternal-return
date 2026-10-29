// Client for the official Eternal Return Open API.
// Docs: https://developer.eternalreturn.io/static/media/OpenAPI_KR_20260724.html
// Get an API key from "My Dashboard" at developer.eternalreturn.io, then set
// ER_API_KEY in backend/.env.

const BASE_URL = "https://open-api.bser.io";

// Most endpoints put the payload under `data`, but some use their own key
// (e.g. /v1/weaponRoutes/recommend returns `result` + a `next` cursor).
interface ErEnvelope {
  code: number;
  message: string;
  [key: string]: unknown;
}

function getApiKey(): string {
  const key = process.env.ER_API_KEY;
  if (!key) {
    throw new Error(
      "ER_API_KEY is not set. Get a key from developer.eternalreturn.io (My Dashboard) and add it to backend/.env",
    );
  }
  return key;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The API rate-limits aggressively (429) with no documented threshold, so back off
// and retry a few times rather than failing a whole sync run over one blip.
async function erRequest(path: string, retriesLeft = 4, backoffMs = 2000): Promise<ErEnvelope> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-api-key": getApiKey() },
  });

  if (res.status === 429 && retriesLeft > 0) {
    await sleep(backoffMs);
    return erRequest(path, retriesLeft - 1, backoffMs * 2);
  }

  if (!res.ok) {
    throw new Error(`Eternal Return API request to ${path} failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as ErEnvelope;
  if (body.code !== 200) {
    throw new Error(`Eternal Return API error for ${path}: [${body.code}] ${body.message}`);
  }
  return body;
}

async function erGet<T>(path: string): Promise<T> {
  return (await erRequest(path)).data as T;
}

/** GET /v2/data/hash — table name -> content hash, useful to detect when data changed. */
export function getMetaHash(): Promise<Record<string, number>> {
  return erGet<Record<string, number>>("/v2/data/hash");
}

/**
 * GET /v2/data/{metaType} — a game data table as a list of row objects.
 * Known metaType values (per docs): Character, CharacterLevelUpStat, CharacterMastery,
 * CharacterModeModifier, WeaponTypeInfo, ItemSkillLinker, ItemSpawn, ItemWeapon, ItemArmor,
 * ItemSpecial, ItemConsumable, Monster, MonsterLevelUpStat, MonsterDropGroup, DropGroup,
 * VFCredit, Season. Row shape is undocumented — inspect a live response before mapping fields.
 */
export function getMetaData<T = Record<string, unknown>>(metaType: string): Promise<T[]> {
  return erGet<T[]>(`/v2/data/${metaType}`);
}

/**
 * One shared build route as returned by /v1/weaponRoutes/recommend. The docs call the
 * wrapper keys `recommendedWeaponRoute*`, but the live API sends `recommendWeaponRoute*`.
 * List-ish fields (weaponCodes, traitCodes, paths, ...) arrive as JSON-encoded strings.
 */
export interface ErWeaponRoute {
  recommendWeaponRoute: {
    id: number;
    title: string;
    userNickname: string;
    characterCode: number;
    weaponType: number; // mastery code, see the docs' 숙련도 table
    weaponCodes: string; // "[110405,202423,...]" — target item per equipment slot
    // '{"0":[...],"1":[...]}' — the author's late-game item sets; 999999 marks an empty slot
    lateGameItemCodes: string | null;
    remoteTransferItemCodes: string | null; // "[401110]" — remote-drone purchases
    traitCodes: string;
    tacticalSkillGroupCode: number;
    paths: string; // "[30,110]" — area codes in visit order
    version: string;
    languageCode: string;
    share: boolean;
    updateDtm: number; // epoch ms
    v2Like: number;
    v2WinRate: number;
  };
  recommendWeaponRouteDesc: {
    recommendWeaponRouteId: number;
    skillPath: string; // "q,w,e,..." with blank entries for unset levels
    desc?: string;
  };
}

/**
 * GET /v1/weaponRoutes/recommend — up to 100 shared routes per page. Pass the
 * previous page's `next` cursor to continue; `next` is absent on the last page.
 */
export async function getRecommendedRoutes(next?: number): Promise<{ routes: ErWeaponRoute[]; next?: number }> {
  const body = await erRequest(`/v1/weaponRoutes/recommend${next ? `?next=${next}` : ""}`);
  return { routes: (body.result as ErWeaponRoute[]) ?? [], next: body.next as number | undefined };
}

export type L10nLanguage =
  | "Korean"
  | "English"
  | "Japanese"
  | "ChineseSimplified"
  | "ChineseTraditional"
  | "French"
  | "Spanish"
  | "SpanishLatin"
  | "Portuguese"
  | "PortugueseLatin"
  | "Indonesian"
  | "German"
  | "Russian"
  | "Thai"
  | "Vietnamese"
  | "Italian"
  | "Polish";

/** GET /v1/l10n/{language} — returns a download link for the localization text dump. */
async function getL10nPath(language: L10nLanguage): Promise<string> {
  const { l10Path } = await erGet<{ l10Path: string }>(`/v1/l10n/${language}`);
  return l10Path;
}

/**
 * Downloads and parses the localization dump for a language into a lookup map.
 * File format is line-delimited "key┃value" pairs, e.g. "Character/Name/1┃재키".
 */
export async function getL10nMap(language: L10nLanguage): Promise<Map<string, string>> {
  const path = await getL10nPath(language);
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Failed to download l10n file for ${language}: ${res.status}`);
  }
  const text = await res.text();

  const map = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const sep = line.indexOf("┃");
    if (sep === -1) continue;
    map.set(line.slice(0, sep), line.slice(sep + 1));
  }
  return map;
}
