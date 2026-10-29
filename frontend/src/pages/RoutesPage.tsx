import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { RouteSort } from "../api/types";
import { useFetch } from "../hooks/useFetch";
import RouteList from "../components/RouteList";
import Pagination from "../components/Pagination";

const PAGE_SIZE = 10;

const SORT_OPTIONS: Array<{ value: RouteSort; label: string }> = [
  { value: "popular", label: "많이 사용된 순" },
  { value: "winRate", label: "승률 높은 순" },
  { value: "newest", label: "최신순" },
  { value: "oldest", label: "오래된순" },
];

const isRouteSort = (value: string | null): value is RouteSort => SORT_OPTIONS.some((o) => o.value === value);

export default function RoutesPage() {
  // Character, weapon, title search, sort and page live in the URL
  // (?character=12&weapon=단검&q=초보&sort=winRate&page=3) so a view can be linked to
  // directly (e.g. from a character's page) and survives reloads. Each page is fetched
  // on demand — the full set is ~45k routes.
  const [searchParams, setSearchParams] = useSearchParams();
  const characterId = Number(searchParams.get("character")) || undefined;
  const weaponType = searchParams.get("weapon") ?? undefined;
  const titleQuery = searchParams.get("q") ?? undefined;
  const sortParam = searchParams.get("sort");
  const sort: RouteSort = isRouteSort(sortParam) ? sortParam : "popular";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const { data: characters } = useFetch(() => api.getRouteCharacters());
  const { data: weapons } = useFetch(() => api.getRouteWeapons(characterId), [characterId]);
  const { data: result, loading, error } = useFetch(
    () => api.getRoutes({ characterId, weaponType, q: titleQuery, sort, page, pageSize: PAGE_SIZE }),
    [characterId, weaponType, titleQuery, sort, page],
  );
  const [search, setSearch] = useState("");
  const [titleDraft, setTitleDraft] = useState(titleQuery ?? "");

  const updateParams = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next);
  };
  // A new character, weapon, search or sort starts over at page 1; a new character also
  // drops the weapon filter, since the weapon list is per character.
  const selectCharacter = (id?: number) =>
    updateParams({ character: id ? String(id) : undefined, weapon: undefined, page: undefined });
  const selectWeapon = (value?: string) => updateParams({ weapon: value, page: undefined });
  const selectSort = (value: RouteSort) => updateParams({ sort: value === "popular" ? undefined : value, page: undefined });
  const submitTitle = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ q: titleDraft.trim() || undefined, page: undefined });
  };
  const goToPage = (next: number) => {
    updateParams({ page: next > 1 ? String(next) : undefined });
    window.scrollTo({ top: 0 });
  };

  const query = search.trim();
  const visibleCharacters = (characters ?? []).filter((c) => query === "" || c.name.includes(query));
  const totalCount = (characters ?? []).reduce((sum, c) => sum + c.routeCount, 0);
  const selected = characters?.find((c) => c.id === characterId);
  const totalPages = result ? Math.ceil(result.total / PAGE_SIZE) : 0;

  return (
    <div className="page-layout">
      <aside className="sidebar">
        <input
          className="search-input"
          type="search"
          placeholder="실험체 이름 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="sidebar__section">
          <div className="sidebar__heading">
            <h2>실험체</h2>
          </div>
          <ul className="route-character-list">
            <li>
              <button
                type="button"
                className={"route-character" + (characterId ? "" : " route-character--active")}
                onClick={() => selectCharacter(undefined)}
              >
                <span className="route-character__name">전체</span>
                <span className="route-character__count">{totalCount.toLocaleString()}</span>
              </button>
            </li>
            {visibleCharacters.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={"route-character" + (c.id === characterId ? " route-character--active" : "")}
                  onClick={() => selectCharacter(c.id)}
                >
                  <span className="route-character__name">
                    <span className="avatar avatar--sm">{c.imageUrl ? <img src={c.imageUrl} alt="" /> : c.name[0]}</span>
                    {c.name}
                  </span>
                  <span className="route-character__count">{c.routeCount.toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="main-content">
        <header className="page-header">
          <h1>{selected ? `${selected.name} 루트` : "전체 루트"}</h1>
          {result && <span className="page-header__count">{result.total.toLocaleString()}</span>}
        </header>
        <div className="segmented">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={"segmented__item" + (sort === option.value ? " segmented__item--active" : "")}
              onClick={() => selectSort(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {sort === "winRate" && (
          <p className="route-hint">추천 10개 미만인 루트는 승률 표본이 적어 뒤쪽에 표시됩니다.</p>
        )}

        <div className="route-filters">
          {weapons && weapons.length > 1 && (
            <div className="chip-group">
              <button
                type="button"
                className={"chip" + (weaponType ? "" : " chip--active")}
                onClick={() => selectWeapon(undefined)}
              >
                전체 무기
              </button>
              {weapons.map((w) => (
                <button
                  key={w.weaponType}
                  type="button"
                  className={"chip" + (w.weaponType === weaponType ? " chip--active" : "")}
                  aria-pressed={w.weaponType === weaponType}
                  onClick={() => selectWeapon(w.weaponType === weaponType ? undefined : w.weaponType)}
                >
                  {w.weaponType} <span className="chip__count">{w.routeCount.toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
          <form className="route-filters__search" onSubmit={submitTitle} role="search">
            <input
              className="search-input"
              type="search"
              placeholder="루트 제목 검색 (Enter)"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
            />
          </form>
        </div>

        {loading && <p className="status">불러오는 중...</p>}
        {error && <p className="status status--error">에러: {error}</p>}
        {result && (
          <>
            <RouteList routes={result.routes} showCharacter={!characterId} />
            {result.routes.length === 0 && <p className="status">등록된 루트가 없습니다.</p>}
            <Pagination page={page} totalPages={totalPages} onChange={goToPage} />
          </>
        )}
      </div>
    </div>
  );
}
