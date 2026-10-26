import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";

export default function CharactersPage() {
  const { data: characters, loading, error } = useFetch(() => api.getCharacters());
  const [selectedWeapons, setSelectedWeapons] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  // weapon-type checkbox list is built from whatever's actually in the data,
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

  if (loading) return <p className="status">불러오는 중...</p>;
  if (error) return <p className="status status--error">에러: {error}</p>;

  return (
    <div className="page-layout">
      <aside className="sidebar">
        <h2>무기 선택</h2>
        <ul>
          {weaponTypes.map((weapon) => (
            <li key={weapon}>
              <input
                type="checkbox"
                id={`weapon-${weapon}`}
                checked={selectedWeapons.includes(weapon)}
                onChange={() => toggleWeapon(weapon)}
              />
              <label htmlFor={`weapon-${weapon}`}>{weapon}</label>
            </li>
          ))}
        </ul>
        <div className="search-container">
          <input
            type="text"
            placeholder="실험체 이름 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={() => setSearch("")}>초기화</button>
        </div>
      </aside>

      <div className="main-content">
        <div className="grid">
          {visible.map((c) => (
            <Link to={`/characters/${c.id}`} key={c.id} className="card">
              <div className="card__thumb">{c.imageUrl ? <img src={c.imageUrl} alt={c.name} /> : c.name[0]}</div>
              <div className="card__body">
                <h3>{c.name}</h3>
              </div>
            </Link>
          ))}
          {visible.length === 0 && <p className="status">조건에 맞는 캐릭터가 없습니다.</p>}
        </div>
      </div>
    </div>
  );
}
