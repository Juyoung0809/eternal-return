import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";

export default function MapDetailPage() {
  const { id } = useParams();
  const mapId = Number(id);
  const { data: map, loading, error } = useFetch(() => api.getMap(mapId), [mapId]);

  if (loading) return <p className="status">불러오는 중...</p>;
  if (error) return <p className="status status--error">에러: {error}</p>;
  if (!map) return <p className="status">맵을 찾을 수 없습니다.</p>;

  return (
    <div>
      <Link to="/maps" className="back-link">
        ← 맵 목록
      </Link>
      <div className="detail-panel">
        <h2>{map.name}</h2>
        <table className="info-table">
          <tbody>
            <tr>
              <td>설명</td>
              <td>{map.description || "정보 없음"}</td>
            </tr>
          </tbody>
        </table>

        <h3>서식 야생동물</h3>
        <ul className="link-list">
          {map.monsters.map((m) => (
            <li key={m.id}>
              <Link to={`/monsters/${m.id}`}>{m.name}</Link> <span className="tag">{m.type}</span>
            </li>
          ))}
          {map.monsters.length === 0 && <li className="status">등록된 야생동물이 없습니다.</li>}
        </ul>
      </div>
    </div>
  );
}
