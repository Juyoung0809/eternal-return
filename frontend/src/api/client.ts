import type {
  CharacterDetail,
  CharacterSummary,
  GameMap,
  GameMapDetail,
  Item,
  ItemDetail,
  Monster,
} from "./types";

// Dev server proxies /api to the backend (see vite.config.ts); same-origin in prod.
const BASE_URL = "/api";

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Request to ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getCharacters: () => request<CharacterSummary[]>("/characters"),
  getCharacter: (id: number) => request<CharacterDetail>(`/characters/${id}`),
  getItems: () => request<Item[]>("/items"),
  getItem: (id: number) => request<ItemDetail>(`/items/${id}`),
  getMaps: () => request<GameMap[]>("/maps"),
  getMap: (id: number) => request<GameMapDetail>(`/maps/${id}`),
  getMonsters: () => request<Monster[]>("/monsters"),
  getMonster: (id: number) => request<Monster>(`/monsters/${id}`),
};
