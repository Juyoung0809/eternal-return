import { useState } from "react";
import type { CharacterWeapon } from "../api/types";

const AXES = [
  { key: "attack", label: "공격" },
  { key: "defense", label: "방어" },
  { key: "disruptor", label: "방해" },
  { key: "move", label: "이동" },
  { key: "assistance", label: "지원" },
] as const;
const MAX_RATING = 5; // CharacterAttributes rates each axis 1-5
const MAX_DIFFICULTY = 5; // controlDifficulty, also 1-5

// A character's weapons: per weapon, the official 5-axis ratings as a radar chart, the
// control difficulty, the in-game guide blurb, and the weapon skill (D).
export default function WeaponPanel({ weapons }: { weapons: CharacterWeapon[] }) {
  const [activeKey, setActiveKey] = useState(weapons[0]?.weaponKey);
  const active = weapons.find((w) => w.weaponKey === activeKey) ?? weapons[0];
  if (!active) return null;

  return (
    <section className="panel">
      <h2 className="panel__title">무기</h2>
      {weapons.length > 1 && (
        <div className="segmented" role="tablist">
          {weapons.map((w) => (
            <button
              key={w.weaponKey}
              type="button"
              role="tab"
              aria-selected={w.weaponKey === active.weaponKey}
              className={"segmented__item" + (w.weaponKey === active.weaponKey ? " segmented__item--active" : "")}
              onClick={() => setActiveKey(w.weaponKey)}
            >
              {w.weapon.name}
            </button>
          ))}
        </div>
      )}

      <div className="weapon">
        <RadarChart weapon={active} />
        <div className="weapon__body">
          <p className="weapon__difficulty">
            조작 난이도
            <span aria-label={`${active.difficulty} / ${MAX_DIFFICULTY}`}>
              {Array.from({ length: MAX_DIFFICULTY }, (_, i) => (
                <i key={i} className={i < active.difficulty ? "is-on" : undefined} />
              ))}
            </span>
          </p>
          {active.guide && <p className="weapon__guide">{active.guide}</p>}

          {active.weapon.skillName && (
            <div className="weapon-skill">
              <span className="skill-icon skill-icon--md">
                {active.weapon.skillImageUrl ? <img src={active.weapon.skillImageUrl} alt="" /> : "D"}
              </span>
              <div>
                <p className="weapon-skill__name">
                  <span className="skill__key">D</span>
                  {active.weapon.skillName}
                </p>
                <p className="weapon-skill__text">{active.weapon.skillDescription}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function RadarChart({ weapon }: { weapon: CharacterWeapon }) {
  const size = 220;
  const center = size / 2;
  const radius = 74;
  // Axis i points up and goes clockwise.
  const point = (i: number, ratio: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
    return [center + Math.cos(angle) * radius * ratio, center + Math.sin(angle) * radius * ratio] as const;
  };
  const polygon = (ratioAt: (i: number) => number) =>
    AXES.map((_, i) => point(i, ratioAt(i)).join(",")).join(" ");

  return (
    <svg className="radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${weapon.weapon.name} 능력치`}>
      {[1, 2, 3, 4, 5].map((level) => (
        <polygon key={level} className="radar__grid" points={polygon(() => level / MAX_RATING)} />
      ))}
      {AXES.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} className="radar__grid" x1={center} y1={center} x2={x} y2={y} />;
      })}
      <polygon className="radar__value" points={polygon((i) => weapon[AXES[i].key] / MAX_RATING)} />
      {AXES.map((axis, i) => {
        const [x, y] = point(i, 1.28);
        return (
          <text key={axis.key} className="radar__label" x={x} y={y} textAnchor="middle" dominantBaseline="middle">
            {axis.label} <tspan className="radar__score">{weapon[axis.key]}</tspan>
          </text>
        );
      })}
    </svg>
  );
}
