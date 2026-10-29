import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import ItemTile from "../components/ItemTile";
import TraitTree from "../components/TraitTree";
import type { RouteMaterial } from "../api/types";

// Skill order is shown as levels 1-10 over 11-20.
const SKILL_ROW_LENGTH = 10;

const chunk = <T,>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

// The base materials behind the target items, grouped by the first area on the route
// that has each one; anything the route never passes gets its own group with where it
// can be found instead.
function MaterialPlan({ materials, areas }: { materials: RouteMaterial[]; areas: string[] }) {
  const stops = areas
    .map((area, i) => ({ area, step: i + 1, materials: materials.filter((m) => m.routeAreas[0] === area) }))
    .filter((stop) => stop.materials.length > 0);
  const elsewhere = materials.filter((m) => m.routeAreas.length === 0);
  const total = materials.reduce((sum, m) => sum + m.count, 0);

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">필요 재료</h2>
        <span className="panel__meta">목표 아이템 기준 · 재료 {total}개</span>
      </div>
      <div className="material-plan">
        {stops.map((stop) => (
          <div className="material-plan__stop" key={stop.area}>
            <p className="material-plan__area">
              <span className="route-path__step">{stop.step}</span>
              {stop.area}에서
            </p>
            <div className="material-plan__items">
              {stop.materials.map((m) => (
                <MaterialChip material={m} key={m.item.id} />
              ))}
            </div>
          </div>
        ))}
        {elsewhere.length > 0 && (
          <div className="material-plan__stop material-plan__stop--elsewhere">
            <p className="material-plan__area">경로 밖에서</p>
            <div className="material-plan__items">
              {elsewhere.map((m) => (
                <MaterialChip material={m} key={m.item.id} showSource />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function MaterialChip({ material: m, showSource = false }: { material: RouteMaterial; showSource?: boolean }) {
  const source = m.droppedBy.length > 0 ? m.droppedBy.join(" · ") : m.spawnAreas.join(" · ");
  return (
    <Link
      to={`/items?item=${m.item.id}`}
      className={`material-chip grade-${m.item.grade}`}
      title={[m.spawnAreas.length && `지역: ${m.spawnAreas.join(", ")}`, m.droppedBy.length && `야생동물: ${m.droppedBy.join(", ")}`]
        .filter(Boolean)
        .join("\n")}
    >
      <span className="material-chip__icon">{m.item.imageUrl ? <img src={m.item.imageUrl} alt="" /> : m.item.name[0]}</span>
      <span className="material-chip__name">
        <span>
          {m.item.name}
          {m.count > 1 && <b>×{m.count}</b>}
        </span>
        {showSource && <small>{source || "획득처 정보 없음"}</small>}
      </span>
    </Link>
  );
}

export default function RouteDetailPage() {
  const { id } = useParams();
  const routeId = Number(id);
  const { data: route, loading, error } = useFetch(() => api.getRoute(routeId), [routeId]);

  if (loading) return <p className="status">불러오는 중...</p>;
  if (error) return <p className="status status--error">에러: {error}</p>;
  if (!route) return <p className="status">루트를 찾을 수 없습니다.</p>;

  return (
    <div>
      <Link to="/routes" className="back-link">
        ← 루트 목록
      </Link>

      <section className="hero">
        <Link to={`/characters/${route.character.id}`} className="hero__thumb hero__thumb--small">
          {route.character.imageUrl ? <img src={route.character.imageUrl} alt={route.character.name} /> : route.character.name[0]}
        </Link>
        <div className="hero__body">
          <p className="hero__eyebrow">
            {route.authorNickname} · v{route.version} · {new Date(route.sharedAt).toLocaleDateString("ko-KR")} 공유
          </p>
          <h1 className="hero__title">{route.title || "(제목 없음)"}</h1>
          <div className="tag-row">
            <Link to={`/characters/${route.character.id}`} className="tag tag--accent">
              {route.character.name}
            </Link>
            {route.weaponType && <span className="tag">{route.weaponType}</span>}
            {route.languageCode !== "ko" && <span className="tag">{route.languageCode}</span>}
          </div>
        </div>
        <dl className="hero__stats">
          <div>
            <dt>추천</dt>
            <dd>{route.likes.toLocaleString()}</dd>
          </div>
          <div>
            <dt>승률</dt>
            <dd>{route.winRate}%</dd>
          </div>
          <div title={route.tacticalSkill?.description}>
            <dt>전술 스킬</dt>
            <dd className="hero__tactical">
              {route.tacticalSkill?.imageUrl && <img src={route.tacticalSkill.imageUrl} alt="" />}
              {route.tacticalSkill?.name ?? "정보 없음"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h2 className="panel__title">이동 경로</h2>
        <ol className="route-path">
          {route.areas.map((area, i) => (
            <li key={`${area}-${i}`}>
              <span className="route-path__area">
                <span className="route-path__step">{i + 1}</span>
                {area}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {route.items.length > 0 && (
        <section className="panel">
          <h2 className="panel__title">목표 아이템</h2>
          <div className="tile-row">
            {route.items.map((item) => (
              <ItemTile item={item} key={item.id} />
            ))}
          </div>
        </section>
      )}

      {route.materials.length > 0 && <MaterialPlan materials={route.materials} areas={route.areas} />}

      {route.lateItemSets.length > 0 && (
        <section className="panel">
          <h2 className="panel__title">후반 아이템</h2>
          <div className="item-sets">
            {route.lateItemSets.map((set, i) => (
              <div className="item-sets__row" key={i}>
                <span className="item-sets__label">{i + 1}</span>
                <div className="tile-row">
                  {set.map((item, j) => (
                    <ItemTile item={item} key={`${item.id}-${j}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {route.remoteItems.length > 0 && (
        <section className="panel">
          <h2 className="panel__title">원격 드론 구매</h2>
          <div className="tile-row">
            {route.remoteItems.map((item, i) => (
              <ItemTile item={item} key={`${item.id}-${i}`} />
            ))}
          </div>
        </section>
      )}

      <div className="route-detail-grid">
        {route.traitGroups.length > 0 && (
          <section className="panel">
            <h2 className="panel__title">특성</h2>
            <TraitTree groups={route.traitGroups} picked={route.traitCodes} />
          </section>
        )}

        {route.skillPath.length > 0 && (
          <section className="panel">
            <h2 className="panel__title">스킬 순서</h2>
            <div className="skill-order">
              {chunk(route.skillPath, SKILL_ROW_LENGTH).map((row, r) => (
                <ol className="skill-order__row" key={r} start={r * SKILL_ROW_LENGTH + 1}>
                  {row.map((key, i) => {
                    const level = r * SKILL_ROW_LENGTH + i + 1;
                    const skill = route.skillKeys[key];
                    return (
                      <li
                        key={level}
                        className={"skill-step" + (key ? ` skill-step--${key.toLowerCase()}` : " skill-step--empty")}
                        title={key ? `${level}레벨: ${skill?.name ?? key}` : `${level}레벨: 미정`}
                      >
                        <span className="skill-step__level">{level}</span>
                        <span className="skill-step__icon">
                          {skill?.imageUrl && <img src={skill.imageUrl} alt="" />}
                          <span className="skill-step__key">{key || "–"}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ))}
            </div>
          </section>
        )}
      </div>

      {route.description && (
        <section className="panel">
          <h2 className="panel__title">설명</h2>
          <p className="prose">{route.description}</p>
        </section>
      )}
    </div>
  );
}
