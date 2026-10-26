export interface CharacterSummary {
  id: number;
  code: number;
  name: string;
  nameEn: string;
  weaponType: string;
  difficulty: number;
  imageUrl: string;
}

export interface Skill {
  id: number;
  characterId: number;
  slot: string;
  name: string;
  description: string;
  imageUrl: string;
  order: number;
}

export interface CharacterDetail extends CharacterSummary {
  description: string;
  skills: Skill[];
}

export interface Item {
  id: number;
  code: number;
  name: string;
  grade: number;
  type: string;
  stats: string;
  description: string;
  imageUrl: string;
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

export interface GameMap {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
}

export interface Monster {
  id: number;
  name: string;
  type: string;
  mapId: number | null;
  description: string;
  imageUrl: string;
  dropInfo: string;
  map?: { id: number; name: string } | null;
}

export interface GameMapDetail extends GameMap {
  monsters: Monster[];
}
