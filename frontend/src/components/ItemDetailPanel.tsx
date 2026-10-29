import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { ADAPTIVE_FORCE_RATE, GRADE_LABEL, STAT_LABEL } from "../constants";
import RecipeTree from "./RecipeTree";
import ItemTile from "./ItemTile";

// Ratio stats come as fractions (criticalStrikeChance 0.2 = 20%); cooldown reductions
// are already whole percents (cooldownReduction 15 = 15%). Checked against the data.
const FRACTION_STATS = new Set([
  "moveSpeedRatio",
  "attackSpeedRatio",
  "penetrationDefenseRatio",
  "hpRegenRatio",
  "skillAmpRatio",
  "lifeSteal",
  "normalLifeSteal",
  "skillLifeSteal",
  "criticalStrikeChance",
  "criticalStrikeDamage",
  "healerGiveHpHealRatio",
  "increaseBasicAttackDamageRatio",
  "increaseBasicAttackDamageRatioByLv",
  "uniqueTenacity",
  "uniqueSkillAmpRatio",
  "uniqueLifeSteal",
  "uniquePenetrationDefenseRatio",
  "uniqueHpHealedIncreaseRatio",
]);
const PERCENT_STATS = new Set(["cooldownReduction", "ultCooldownReduction", "tacticalCooldownReduction", "weaponCooldownReduction"]);

const ADAPTIVE_STATS = new Set(["adaptiveForce", "adaptiveForceByLevel"]);

function formatStat(key: string, value: number) {
  if (FRACTION_STATS.has(key)) return `${+(value * 100).toFixed(1)}%`;
  if (PERCENT_STATS.has(key)) return `${value}%`;
  return String(+value.toFixed(2));
}

// The item browser's right-hand panel: one item's stats, effect, recipe tree and the
// items it goes into. Mounted per selected id, so switching items refetches.
export default function ItemDetailPanel({ itemId }: { itemId: number }) {
  const { data: item, loading, error } = useFetch(() => api.getItem(itemId), [itemId]);

  if (loading) return <p className="status">불러오는 중...</p>;
  if (error) return <p className="status status--error">에러: {error}</p>;
  if (!item) return <p className="status">아이템을 찾을 수 없습니다.</p>;

  let stats: Record<string, number> = {};
  try {
    stats = JSON.parse(item.stats);
  } catch {
    // leave stats empty if malformed
  }

  return (
    <div className={`item-detail grade-${item.grade}`}>
      <header className="item-detail__head">
        <span className="item-detail__icon">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : item.name[0]}</span>
        <div>
          <h2 className="item-detail__name">{item.name}</h2>
          <div className="tag-row">
            <span className={`tag tag--grade grade-${item.grade}`}>{GRADE_LABEL[item.grade] ?? `등급 ${item.grade}`}</span>
            <span className="tag">{item.subType || item.type}</span>
          </div>
        </div>
      </header>

      {item.description && <p className="item-detail__effect">{item.description}</p>}

      {Object.keys(stats).length > 0 && (
        <section className="item-detail__section">
          <h3>능력치</h3>
          <dl className="stat-grid">
            {Object.entries(stats).map(([key, value]) => (
              <div className="stat-grid__row" key={key}>
                <dt>{STAT_LABEL[key] ?? key}</dt>
                {ADAPTIVE_STATS.has(key) ? (
                  // Adaptive force turns into one of these — show both outcomes.
                  <dd className="stat-grid__adaptive">
                    <span>공격력 +{formatStat(key, value * ADAPTIVE_FORCE_RATE.attackPower)}</span>
                    <small>또는</small>
                    <span>스킬 증폭 +{formatStat(key, value * ADAPTIVE_FORCE_RATE.skillAmp)}</span>
                  </dd>
                ) : (
                  <dd>{formatStat(key, value)}</dd>
                )}
              </div>
            ))}
          </dl>
        </section>
      )}

      {(item.spawnAreas.length > 0 || item.droppedBy.length > 0) && (
        <section className="item-detail__section">
          <h3>획득처</h3>
          <dl className="item-detail__sources">
            {item.spawnAreas.length > 0 && (
              <div>
                <dt>지역</dt>
                <dd>{item.spawnAreas.join(" · ")}</dd>
              </div>
            )}
            {item.droppedBy.length > 0 && (
              <div>
                <dt>야생동물</dt>
                <dd>{item.droppedBy.join(" · ")}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {item.materials.length > 0 && (
        <section className="item-detail__section">
          <h3>조합법</h3>
          <p className="item-detail__formula">
            {item.materials.map((m) => m.name).join(" + ")} = {item.name}
          </p>
          <RecipeTree materials={item.materials} />
          <p className="item-detail__hint">재료에 마우스를 올리면 얻을 수 있는 지역과 야생동물이 나옵니다.</p>
        </section>
      )}

      {item.materialOf.length > 0 && (
        <section className="item-detail__section">
          <h3>상위 조합 아이템</h3>
          <div className="tile-row">
            {item.materialOf.map((m) => (
              <ItemTile item={m} key={m.id} />
            ))}
          </div>
        </section>
      )}

      {item.flavor && <p className="item-detail__flavor">{item.flavor}</p>}
    </div>
  );
}
