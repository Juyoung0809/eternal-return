// Weapon mastery codes (the docs' 숙련도 table) -> the API's weapon type keys. Route
// weaponType uses these codes, which don't follow WeaponTypeInfo's row order, and each
// weapon's skill (D) lives at Skill/Group/*/{3000000 + code * 1000} (단검 15 -> 3015000).
export const MASTERY_WEAPON_KEY: Record<number, string> = {
  1: "Glove",
  2: "Tonfa",
  3: "Bat",
  4: "Whip",
  5: "HighAngleFire",
  6: "DirectFire",
  7: "Bow",
  8: "CrossBow",
  9: "Pistol",
  10: "AssaultRifle",
  11: "SniperRifle",
  13: "Hammer",
  14: "Axe",
  15: "OneHandSword",
  16: "TwoHandSword",
  17: "Polearm",
  18: "DualSword",
  19: "Spear",
  20: "Nunchaku",
  21: "Rapier",
  22: "Guitar",
  23: "Camera",
  24: "Arcana",
  25: "VFArm",
};

export const weaponSkillCode = (masteryCode: number) => 3000000 + masteryCode * 1000;
