import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";

export default function MapsPage() {
  const { data: maps, loading, error } = useFetch(() => api.getMaps());

  if (loading) return <p className="status">불러오는 중...</p>;
  if (error) return <p className="status status--error">에러: {error}</p>;

  return (
    <div className="grid">
      {maps?.map((map) => (
        <Link to={`/maps/${map.id}`} key={map.id} className="card">
          <div className="card__thumb">{map.imageUrl ? <img src={map.imageUrl} alt={map.name} /> : map.name[0]}</div>
          <div className="card__body">
            <h3>{map.name}</h3>
          </div>
        </Link>
      ))}
      {maps?.length === 0 && <p className="status">등록된 맵이 없습니다.</p>}
    </div>
  );
}
