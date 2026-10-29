export interface CharacterSummary {
  id: number;
  code: number;
  name: string;
  nameEn: string;
  weaponType: string;
  positions: string[]; // official archetypes, e.g. ["전사", "탱커"]
  difficulty: number;
  imageUrl: string;
}

export interface Skill {
  id: number;
  characterId: number;
  slot: string;
  name: string;
  description: string;
  tips: string;
  scaling: string[];
  // other forms of the same key: 2nd/3rd hit, empowered or alternate versions
  variants: Array<{ name: string; description: string }>;
  imageUrl: string;
  order: number;
}

export interface Skin {
  id: number;
  code: number | null;
  name: string;
  imageUrl: string;
}

export interface WeaponType {
  key: string; // "OneHandSword"
  name: string; // "단검"
  description: string;
  skillName: string; // weapon skill (D)
  skillDescription: string;
  skillImageUrl: string;
}

// One weapon a character can use, with the official 1-5 ratings per axis.
export interface CharacterWeapon {
  id: number;
  weaponKey: string;
  weapon: WeaponType;
  difficulty: number;
  attack: number;
  defense: number;
  disruptor: number;
  move: number;
  assistance: number;
  guide: string;
}

export interface CharacterDetail extends CharacterSummary {
  description: string;
  fullImageUrl: string;
  skills: Skill[];
  skins: Skin[];
  weapons: CharacterWeapon[];
}

// What the item list returns: enough to draw and filter the icon grid.
export interface ItemSummary {
  id: number;
  code: number;
  name: string;
  grade: number;
  type: string; // "무기" | "방어구" | "특수" | "소비" | "재료"
  subType: string; // weapon kind or armor slot, "" otherwise
  imageUrl: string;
  statKeys?: string[]; // list only: which stats it grants (Item.stats keys)
  specialMaterials?: string[]; // list only: special materials in its recipe tree (미스릴 ...)
}

export interface Item extends ItemSummary {
  stats: string;
  description: string; // effect text
  flavor: string; // lore text
  spawnAreas: string[]; // areas whose boxes can hold it
  droppedBy: string[]; // wildlife that drop it
}

// Recipe materials nest a few levels deep (base components -> ... -> this item),
// matching how many tiers the backend's /api/items/:id include actually fetches.
export interface RecipeMaterial extends Item {
  materials: RecipeMaterial[];
}

export interface ItemDetail extends Item {
  materials: RecipeMaterial[];
  materialOf: Item[];
}

export interface RouteSummary {
  id: number;
  routeId: number;
  title: string;
  authorNickname: string;
  characterId: number;
  character: { id: number; name: string; imageUrl: string };
  weaponType: string;
  itemCodes: number[];
  lateItemSets: number[][];
  remoteItemCodes: number[];
  areas: string[];
  traitCodes: number[]; // [core, main sub ×2, secondary sub ×2]
  tacticalSkillCode: number;
  skillPath: string[]; // key per level ("Q", "W", "E", "R", "T"; "" = unplanned)
  description: string;
  likes: number;
  winRate: number;
  version: string;
  languageCode: string;
  sharedAt: string;
}

export type RouteSort = "popular" | "winRate" | "newest" | "oldest";

export interface RoutePage {
  routes: RouteSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RouteCharacter {
  id: number;
  name: string;
  imageUrl: string;
  routeCount: number;
}

export interface Trait {
  code: number;
  name: string;
  description: string;
  group: string;
  type: "Core" | "Sub1" | "Sub2";
  imageUrl: string;
}

// One trait group as a route uses it: every option, with the route's picks among them.
// Only the main (first) group lists core options.
export interface RouteTraitGroup {
  key: string;
  name: string;
  imageUrl: string;
  core: Trait[];
  sub1: Trait[];
  sub2: Trait[];
}

export interface TacticalSkill {
  code: number;
  name: string;
  description: string;
  imageUrl: string;
}

export type RouteItem = Pick<Item, "id" | "code" | "name" | "grade" | "type" | "imageUrl">;

// A base material the route's target items need, and where to get it.
export interface RouteMaterial {
  item: Pick<Item, "id" | "code" | "name" | "grade" | "imageUrl">;
  count: number;
  spawnAreas: string[];
  droppedBy: string[];
  routeAreas: string[]; // the route's own areas (visit order) that hold it
}

export interface RouteWeapon {
  weaponType: string;
  routeCount: number;
}

export interface RouteDetail extends Omit<RouteSummary, "lateItemSets"> {
  items: RouteItem[]; // early-game target per equipment slot
  lateItemSets: RouteItem[][]; // the author's late-game item sets, resolved
  remoteItems: RouteItem[]; // remote-drone purchases
  materials: RouteMaterial[]; // base materials for `items`, see RouteMaterial
  traitGroups: RouteTraitGroup[];
  tacticalSkill: TacticalSkill | null;
  skillKeys: Partial<Record<string, { name: string; imageUrl: string }>>; // by skillPath key
}
