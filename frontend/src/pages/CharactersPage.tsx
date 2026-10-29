import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import type { CharacterSummary } from "../api/types";

type CharacterSort = "releaseDesc" | "releaseAsc" | "nameAsc" | "nameDesc";

// The API has no release date, but character codes are assigned in release order
// (1 = 재키, the original roster), so code stands in for it.
const SORT_OPTIONS: Array<{ value: CharacterSort; label: string; compare: (a: CharacterSummary, b: CharacterSummary) => number }> = [
  { value: "nameAsc", label: "가나다순", compare: (a, b) => a.name.localeCompare(b.name, "ko") },
  { value: "nameDesc", label: "가나다 역순", compare: (a, b) => b.name.localeCompare(a.name, "ko") },
  { value: "releaseDesc", label: "최신 출시순", compare: (a, b) => b.code - a.code },
  { value: "releaseAsc", label: "오래된 출시순", compare: (a, b) => a.code - b.code },
];

export default function CharactersPage() {
  const { data: characters, loading, error } = useFetch(() => api.getCharacters());
  const [selectedWeapons, setSelectedWeapons] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<CharacterSort>("nameAsc");

  // weapon filter list is built from whatever's actually in the data,
  // rather than a hardcoded list, so it stays correct as the roster grows.
  const weaponTypes = useMemo(() => {
    const set = new Set((characters ?? []).map((c) => c.weaponType).filter(Boolean));
    return Array.from(set).sort();
  }, [characters]);

  const toggleWeapon = (weapon: string) => {
    setSelectedWeapons((prev) => (prev.includes(weapon) ? prev.filter((w) => w !== weapon) : [...prev, weapon]));
  };

  const visible = (characters ?? []).filter((c) => {
    const matchesWeapon = selectedWeapons.length === 0 || selectedWeapons.includes(c.weaponType);
    const matchesSearch = search.trim() === "" || c.name.includes(search.trim());
    return matchesWeapon && matchesSearch;
  });
  visible.sort(SORT_OPTIONS.find((o) => o.value === sort)!.compare);

  if (loading) return <p className="status">불러오는 중...</p>;
  if (error) return <p className="status status--error">에러: {error}</p>;

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
            <h2>무기</h2>
            {selectedWeapons.length > 0 && (
              <button type="button" className="text-button" onClick={() => setSelectedWeapons([])}>
                초기화
              </button>
            )}
          </div>
          <div className="chip-group">
            {weaponTypes.map((weapon) => (
              <button
                key={weapon}
                type="button"
                className={"chip" + (selectedWeapons.includes(weapon) ? " chip--active" : "")}
                aria-pressed={selectedWeapons.includes(weapon)}
                onClick={() => toggleWeapon(weapon)}
              >
                {weapon}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="page-header">
          <h1>실험체</h1>
          <span className="page-header__count">{visible.length}</span>
        </header>
        <div className="segmented">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={"segmented__item" + (sort === option.value ? " segmented__item--active" : "")}
              aria-pressed={sort === option.value}
              onClick={() => setSort(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="card-grid">
          {visible.map((c) => (
            <Link to={`/characters/${c.id}`} key={c.id} className="card">
              <div className="card__thumb">{c.imageUrl ? <img src={c.imageUrl} alt={c.name} /> : c.name[0]}</div>
              <div className="card__body">
                <h3 className="card__title">{c.name}</h3>
                <p className="card__meta">{c.positions.join(" · ")}</p>
              </div>
            </Link>
          ))}
        </div>
        {visible.length === 0 && <p className="status">조건에 맞는 실험체가 없습니다.</p>}
      </div>
    </div>
  );
}
