import type {
  CharacterDetail,
  CharacterSummary,
  ItemDetail,
  ItemSummary,
  RouteCharacter,
  RouteDetail,
  RoutePage,
  RouteSort,
  RouteWeapon,
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
  getItems: () => request<ItemSummary[]>("/items"),
  getItem: (id: number) => request<ItemDetail>(`/items/${id}`),
  getRoutes: (
    {
      characterId,
      weaponType,
      q,
      sort,
      page,
      pageSize,
    }: { characterId?: number; weaponType?: string; q?: string; sort?: RouteSort; page?: number; pageSize?: number } = {},
  ) => {
    const params = new URLSearchParams();
    if (characterId) params.set("characterId", String(characterId));
    if (weaponType) params.set("weaponType", weaponType);
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
    if (page) params.set("page", String(page));
    if (pageSize) params.set("pageSize", String(pageSize));
    const query = params.toString();
    return request<RoutePage>(query ? `/routes?${query}` : "/routes");
  },
  getRouteCharacters: () => request<RouteCharacter[]>("/routes/characters"),
  getRouteWeapons: (characterId?: number) =>
    request<RouteWeapon[]>(characterId ? `/routes/weapons?characterId=${characterId}` : "/routes/weapons"),
  getRoute: (id: number) => request<RouteDetail>(`/routes/${id}`),
};
