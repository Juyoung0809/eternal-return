import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";

export default function MonsterDetailPage() {
  const { id } = useParams();
  const monsterId = Number(id);
  const { data: monster, loading, error } = useFetch(() => api.getMonster(monsterId), [monsterId]);

  if (loading) return <p className="status">불러오는 중...</p>;
  if (error) return <p className="status status--error">에러: {error}</p>;
  if (!monster) return <p className="status">야생동물을 찾을 수 없습니다.</p>;

  return (
    <div>
      <Link to="/monsters" className="back-link">
        ← 야생동물 목록
      </Link>
      <div className="detail-panel">
        <h2>{monster.name}</h2>
        <table className="info-table">
          <tbody>
            <tr>
              <td>종류</td>
              <td>{monster.type}</td>
            </tr>
            {monster.map && (
              <tr>
                <td>서식 맵</td>
                <td>
                  <Link to={`/maps/${monster.map.id}`}>{monster.map.name}</Link>
                </td>
              </tr>
            )}
            {monster.description && (
              <tr>
                <td>설명</td>
                <td>{monster.description}</td>
              </tr>
            )}
          </tbody>
        </table>
        {monster.dropInfo && (
          <>
            <h3>드랍 아이템</h3>
            <p className="detail-body">{monster.dropInfo}</p>
          </>
        )}
      </div>
    </div>
  );
}
