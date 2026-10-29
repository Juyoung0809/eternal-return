import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import type { Skill } from "../api/types";
import RouteList from "../components/RouteList";
import WeaponPanel from "../components/WeaponPanel";

const SLOT_KEY: Record<string, string> = {
  PASSIVE: "P",
  NORMAL_ATTACK: "A",
  SKILL_1: "Q",
  SKILL_2: "W",
  SKILL_3: "E",
  SKILL_4: "R",
};

const SLOT_ORDER = ["PASSIVE", "SKILL_1", "SKILL_2", "SKILL_3", "SKILL_4"];

function SkillIcon({ skill, size = "md" }: { skill: Skill; size?: "md" | "lg" }) {
  return (
    <span className={`skill-icon skill-icon--${size}`}>
      {skill.imageUrl ? <img src={skill.imageUrl} alt="" /> : SLOT_KEY[skill.slot]}
    </span>
  );
}

export default function CharacterDetailPage() {
  const { id } = useParams();
  const characterId = Number(id);
  const { data: character, loading, error } = useFetch(() => api.getCharacter(characterId), [characterId]);
  // Only the three most-used routes here; the full list lives on the routes page.
  const { data: routes } = useFetch(
    () => api.getRoutes({ characterId, sort: "popular", pageSize: 3 }),
    [characterId],
  );
  const [activeSlot, setActiveSlot] = useState<string>("PASSIVE");
  const [activeSkinId, setActiveSkinId] = useState<number | null>(null);

  if (loading) return <p className="status">불러오는 중...</p>;
  if (error) return <p className="status status--error">에러: {error}</p>;
  if (!character) return <p className="status">실험체를 찾을 수 없습니다.</p>;

  const skillsBySlot = new Map<string, Skill>(character.skills.map((s) => [s.slot, s]));
  const orderedSkills = SLOT_ORDER.flatMap((slot) => skillsBySlot.get(slot) ?? []);
  const activeSkill = skillsBySlot.get(activeSlot);
  const activeSkin = character.skins.find((s) => s.id === activeSkinId) ?? character.skins[0];

  return (
    <div>
      <Link to="/characters" className="back-link">
        ← 실험체 목록
      </Link>

      <div className="character-layout">
        <section className="skin-showcase">
          <div className="skin-showcase__stage">
            {activeSkin ? (
              <img src={activeSkin.imageUrl} alt={`${character.name} - ${activeSkin.name}`} />
            ) : (
              <span className="skin-showcase__placeholder">{character.name[0]}</span>
            )}
            {activeSkin && <p className="skin-showcase__caption">{activeSkin.name}</p>}
          </div>
          {character.skins.length > 1 && (
            <div className="skin-showcase__thumbs" role="tablist" aria-label="스킨">
              {character.skins.map((skin) => (
                <button
                  key={skin.id}
                  type="button"
                  role="tab"
                  aria-selected={skin.id === activeSkin?.id}
                  className={"skin-thumb" + (skin.id === activeSkin?.id ? " skin-thumb--active" : "")}
                  onClick={() => setActiveSkinId(skin.id)}
                  title={skin.name}
                >
                  <img src={skin.imageUrl} alt={skin.name} loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="character-layout__main">
          <section className="hero">
            <div className="hero__thumb hero__thumb--small">
              {character.imageUrl ? <img src={character.imageUrl} alt="" /> : character.name[0]}
            </div>
            <div className="hero__body">
              <p className="hero__eyebrow">
                #{String(character.code).padStart(3, "0")} · {character.nameEn}
              </p>
              <h1 className="hero__title">{character.name}</h1>
              <div className="tag-row">
                {character.weapons.length > 0
                  ? character.weapons.map((w) => (
                      <span className="tag tag--accent" key={w.weaponKey}>
                        {w.weapon.name}
                      </span>
                    ))
                  : character.weaponType && <span className="tag tag--accent">{character.weaponType}</span>}
                {character.skins.length > 0 && <span className="tag">스킨 {character.skins.length}종</span>}
              </div>
              {character.description && <p className="hero__desc">{character.description}</p>}
            </div>
          </section>

          <section className="panel">
            <h2 className="panel__title">스킬</h2>
            {orderedSkills.length > 0 ? (
              <>
                <div className="skill-tabs" role="tablist">
                  {orderedSkills.map((skill) => (
                    <button
                      key={skill.slot}
                      type="button"
                      role="tab"
                      aria-selected={activeSlot === skill.slot}
                      className={"skill-tab" + (activeSlot === skill.slot ? " skill-tab--active" : "")}
                      onClick={() => setActiveSlot(skill.slot)}
                      title={skill.name}
                    >
                      <SkillIcon skill={skill} />
                      <span className="skill-tab__key">{SLOT_KEY[skill.slot]}</span>
                    </button>
                  ))}
                </div>

                {activeSkill && (
                  <div className="skill">
                    <div className="skill__head">
                      <SkillIcon skill={activeSkill} size="lg" />
                      <div>
                        <span className="skill__key">{SLOT_KEY[activeSkill.slot]}</span>
                        <h3 className="skill__name">{activeSkill.name}</h3>
                      </div>
                    </div>
                    <p className="skill__text">{activeSkill.description || "설명이 없습니다."}</p>

                    {activeSkill.variants.length > 0 && (
                      <div className="skill__section">
                        <h4>다른 형태 · 연계</h4>
                        <ul className="effect-list">
                          {activeSkill.variants.map((variant) => (
                            <li key={`${variant.name}-${variant.description}`}>
                              <strong>{variant.name}</strong>
                              {variant.description && <span>{variant.description}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {activeSkill.scaling.length > 0 && (
                      <div className="skill__section">
                        <h4>피해 계수</h4>
                        <div className="tag-row">
                          {activeSkill.scaling.map((stat) => (
                            <span className="tag" key={stat}>
                              {stat}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeSkill.tips && (
                      <div className="skill__section">
                        <h4>참고</h4>
                        <p className="skill__tips">{activeSkill.tips}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="empty">스킬 정보는 준비 중입니다.</p>
            )}
          </section>

          <WeaponPanel weapons={character.weapons} />

          <section className="panel">
            <div className="panel__head">
              <h2 className="panel__title">추천 루트</h2>
              {routes && routes.total > 0 && (
                <Link to={`/routes?character=${character.id}`} className="text-link">
                  전체 보기 →
                </Link>
              )}
            </div>
            {routes && routes.routes.length > 0 ? (
              <RouteList routes={routes.routes} showCharacter={false} />
            ) : (
              <p className="empty">공유된 루트가 없습니다.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
