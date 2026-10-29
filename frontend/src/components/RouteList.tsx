import { Link } from "react-router-dom";
import type { RouteSummary } from "../api/types";

// Compact one-row-per-route list: title, who it's for, the area path, and its popularity.
// `showCharacter` is off on a character's own page, where the name would be redundant.
export default function RouteList({ routes, showCharacter = true }: { routes: RouteSummary[]; showCharacter?: boolean }) {
  return (
    <ul className="route-list">
      {routes.map((route) => (
        <li key={route.id}>
          <Link to={`/routes/${route.id}`} className="route-row">
            {showCharacter && (
              <span className="avatar">
                {route.character.imageUrl ? <img src={route.character.imageUrl} alt="" /> : route.character.name[0]}
              </span>
            )}
            <div className="route-row__main">
              <span className="route-row__title">{route.title || "(제목 없음)"}</span>
              <span className="tag-row">
                {showCharacter && <span className="tag tag--accent">{route.character.name}</span>}
                <span className="tag">{route.weaponType}</span>
                {route.languageCode !== "ko" && <span className="tag">{route.languageCode}</span>}
              </span>
            </div>
            <span className="route-row__path">{route.areas.join(" → ")}</span>
            <dl className="route-row__stats">
              <div>
                <dt>추천</dt>
                <dd>{route.likes.toLocaleString()}</dd>
              </div>
              <div>
                <dt>승률</dt>
                <dd>{route.winRate}%</dd>
              </div>
              <div className="route-row__date">
                <dt>공유</dt>
                <dd>{new Date(route.sharedAt).toLocaleDateString("ko-KR")}</dd>
              </div>
            </dl>
          </Link>
        </li>
      ))}
    </ul>
  );
}
