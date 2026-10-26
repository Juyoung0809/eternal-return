import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import RecipeTree from "../components/RecipeTree";

const GRADE_LABEL: Record<number, string> = { 1: "일반", 2: "고급", 3: "희귀", 4: "영웅", 5: "전설", 6: "초월" };

const STAT_LABEL: Record<string, string> = {
  attackPower: "공격력",
  attackPowerByLv: "레벨당 공격력 증가",
  defense: "방어력",
  defenseByLv: "레벨당 방어력 증가",
  maxHp: "최대 체력",
  maxHpByLv: "레벨당 최대 체력 증가",
  skillAmp: "스킬 증폭",
  skillAmpByLevel: "레벨당 스킬 증폭 증가",
  skillAmpRatio: "스킬 증폭 비율",
  adaptiveForce: "적응형 능력치",
  adaptiveForceByLevel: "레벨당 적응형 능력치 증가",
  criticalStrikeChance: "치명타 확률",
  criticalStrikeDamage: "치명타 피해",
  cooldownReduction: "쿨다운 감소",
  ultCooldownReduction: "궁극기 쿨다운 감소",
  tacticalCooldownReduction: "전술 스킬 쿨다운 감소",
  weaponCooldownReduction: "무기 스킬 쿨다운 감소",
  moveSpeed: "이동 속도",
  moveSpeedRatio: "이동 속도 증가율",
  moveSpeedOutOfCombat: "전투 외 이동 속도",
  attackSpeedRatio: "공격 속도",
  attackRange: "공격 사거리",
  sightRange: "시야",
  lifeSteal: "생명력 흡수",
  normalLifeSteal: "기본 공격 생명력 흡수",
  skillLifeSteal: "스킬 생명력 흡수",
  hpRegen: "체력 재생",
  hpRegenRatio: "체력 재생 비율",
  heal: "회복량",
  hpRecover: "체력 회복",
  penetrationDefense: "방어 관통",
  penetrationDefenseRatio: "방어 관통 비율",
  increaseBasicAttackDamage: "기본 공격 피해 증가",
  increaseBasicAttackDamageRatio: "기본 공격 피해 증가율",
  increaseBasicAttackDamageRatioByLv: "레벨당 기본 공격 피해 증가율",
  healerGiveHpHealRatio: "치유량 증가",
  gadgetEnergyGain: "가젯 에너지 충전량",
  uniqueAttackRange: "고유 공격 사거리",
  uniqueTenacity: "고유 강인함",
  uniqueMoveSpeed: "고유 이동 속도",
  uniqueLifeSteal: "고유 생명력 흡수",
  uniqueSkillAmpRatio: "고유 스킬 증폭 비율",
  uniquePenetrationDefense: "고유 방어 관통",
  uniquePenetrationDefenseRatio: "고유 방어 관통 비율",
  uniqueCooldownLimit: "고유 쿨다운 제한",
  uniqueHpHealedIncreaseRatio: "고유 회복량 증가",
};

export default function ItemDetailPage() {
  const { id } = useParams();
  const itemId = Number(id);
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
    <div>
      <Link to="/items" className="back-link">
        ← 아이템 목록
      </Link>
      <div className="detail-panel">
        {item.imageUrl && (
          <div className="detail-panel__thumb">
            <img src={item.imageUrl} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}
        <h2>{item.name}</h2>

        <table className="info-table">
          <tbody>
            <tr>
              <td>종류</td>
              <td>{item.type}</td>
            </tr>
            <tr>
              <td>등급</td>
              <td>{GRADE_LABEL[item.grade] ?? `등급 ${item.grade}`}</td>
            </tr>
            {item.description && (
              <tr>
                <td>설명</td>
                <td>{item.description}</td>
              </tr>
            )}
          </tbody>
        </table>

        {Object.keys(stats).length > 0 && (
          <>
            <h3>능력치</h3>
            <ul className="stat-list">
              {Object.entries(stats).map(([key, value]) => (
                <li key={key}>
                  {STAT_LABEL[key] ?? key}: {value}
                </li>
              ))}
            </ul>
          </>
        )}

        {item.materials.length > 0 && (
          <>
            <h3>제작법</h3>
            <RecipeTree materials={item.materials} />
          </>
        )}

        {item.materialOf.length > 0 && (
          <>
            <h3>상위 조합 아이템</h3>
            <ul className="link-list">
              {item.materialOf.map((m) => (
                <li key={m.id}>
                  <Link to={`/items/${m.id}`}>{m.name}</Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
