// Item grade number (backend Item.grade) -> in-game Korean label.
export const GRADE_LABEL: Record<number, string> = { 1: "일반", 2: "고급", 3: "희귀", 4: "영웅", 5: "전설", 6: "초월" };

// Adaptive force (적응형 능력치) becomes attack power or skill amp, whichever the build
// favors. The API only gives the one number (StatType/AdaptiveForce: "공격력 또는 스킬
// 증폭") with no conversion; this rate was checked in-game (2026-10) — 1 adaptive force =
// 1 attack power or 2 skill amp. Update here if a patch changes it.
export const ADAPTIVE_FORCE_RATE = { attackPower: 1, skillAmp: 2 };
const ADAPTIVE_KEYS = ["adaptiveForce", "adaptiveForceByLevel"];

// Stat filter categories for the item browser: each groups the Item.stats keys that
// mean the same stat (flat / per-level / ratio variants). Listed in display order.
// Adaptive-force items count toward both 공격력 and 스킬 증폭, since they give either.
export const STAT_CATEGORIES: Array<{ label: string; keys: string[] }> = [
  { label: "공격력", keys: ["attackPower", "attackPowerByLv", ...ADAPTIVE_KEYS] },
  { label: "스킬 증폭", keys: ["skillAmp", "skillAmpByLevel", "skillAmpRatio", "uniqueSkillAmpRatio", ...ADAPTIVE_KEYS] },
  { label: "적응형 능력치", keys: ADAPTIVE_KEYS },
  { label: "공격 속도", keys: ["attackSpeedRatio"] },
  { label: "치명타", keys: ["criticalStrikeChance", "criticalStrikeDamage"] },
  { label: "기본 공격 강화", keys: ["increaseBasicAttackDamage", "increaseBasicAttackDamageRatio", "increaseBasicAttackDamageRatioByLv"] },
  { label: "방어 관통", keys: ["penetrationDefense", "penetrationDefenseRatio", "uniquePenetrationDefense", "uniquePenetrationDefenseRatio"] },
  { label: "쿨다운 감소", keys: ["cooldownReduction", "ultCooldownReduction", "tacticalCooldownReduction", "weaponCooldownReduction"] },
  { label: "최대 체력", keys: ["maxHp", "maxHpByLv"] },
  { label: "방어력", keys: ["defense", "defenseByLv"] },
  { label: "체력 재생", keys: ["hpRegen", "hpRegenRatio"] },
  { label: "생명력 흡수", keys: ["lifeSteal", "normalLifeSteal", "skillLifeSteal", "uniqueLifeSteal"] },
  { label: "이동 속도", keys: ["moveSpeed", "moveSpeedRatio", "moveSpeedOutOfCombat", "uniqueMoveSpeed"] },
  { label: "사거리", keys: ["attackRange", "uniqueAttackRange"] },
  { label: "시야", keys: ["sightRange"] },
  { label: "치유 증가", keys: ["healerGiveHpHealRatio", "uniqueHpHealedIncreaseRatio"] },
  { label: "강인함", keys: ["uniqueTenacity"] },
];

// Special materials in the order the item browser lists them.
export const SPECIAL_MATERIALS = ["운석", "생명의 나무", "미스릴", "포스 코어", "VF 혈액 샘플", "진화의 돌"];

// Item stat field (Item.stats keys) -> Korean label.
export const STAT_LABEL: Record<string, string> = {
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
