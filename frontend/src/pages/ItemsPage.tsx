import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";

export default function ItemsPage() {
  const { data: items, loading, error } = useFetch(() => api.getItems());

  if (loading) return <p className="status">불러오는 중...</p>;
  if (error) return <p className="status status--error">에러: {error}</p>;

  return (
    <div className="grid">
      {items?.map((item) => (
        <Link to={`/items/${item.id}`} key={item.id} className="card">
          <div className="card__thumb">{item.imageUrl ? <img src={item.imageUrl} alt={item.name} /> : item.name[0]}</div>
          <div className="card__body">
            <h3>{item.name}</h3>
          </div>
        </Link>
      ))}
      {items?.length === 0 && <p className="status">등록된 아이템이 없습니다.</p>}
    </div>
  );
}
