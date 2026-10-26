import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";

export default function MonstersPage() {
  const { data: monsters, loading, error } = useFetch(() => api.getMonsters());

  if (loading) return <p className="status">불러오는 중...</p>;
  if (error) return <p className="status status--error">에러: {error}</p>;

  return (
    <div className="grid">
      {monsters?.map((m) => (
        <Link to={`/monsters/${m.id}`} key={m.id} className="card">
          <div className="card__thumb">{m.imageUrl ? <img src={m.imageUrl} alt={m.name} /> : m.name[0]}</div>
          <div className="card__body">
            <h3>{m.name}</h3>
          </div>
        </Link>
      ))}
      {monsters?.length === 0 && <p className="status">등록된 야생동물이 없습니다.</p>}
    </div>
  );
}
