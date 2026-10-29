import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import { GRADE_LABEL, SPECIAL_MATERIALS, STAT_CATEGORIES } from "../constants";
import type { ItemSummary } from "../api/types";
import ItemDetailPanel from "../components/ItemDetailPanel";

const CATEGORIES = [
  { key: "equipment", label: "장비", types: ["무기", "방어구"] },
  { key: "consumable", label: "소비", types: ["소비"] },
  { key: "special", label: "특수", types: ["특수"] },
] as const;

// The weapon supply boxes get their own section in 특수 instead of mixing into grades.
const isSupplyBox = (item: ItemSummary) => item.name.endsWith("보급 상자");
type CategoryKey = (typeof CATEGORIES)[number]["key"];

// Equipment splits into weapons (then by weapon kind) and the four armor slots.
// Listed (and sorted) in this order: weapons, then chest, head, arm, leg.
const EQUIPMENT_SLOTS = ["무기", "옷", "머리", "팔/장식", "다리"];
const slotOf = (item: ItemSummary) => (item.type === "무기" ? "무기" : item.subType);

// Within a grade: by slot, weapons grouped by kind, then by name.
const slotRank = (item: ItemSummary) => {
  const rank = EQUIPMENT_SLOTS.indexOf(slotOf(item));
  return rank === -1 ? EQUIPMENT_SLOTS.length : rank;
};
const byEquipmentSlot = (a: ItemSummary, b: ItemSummary) =>
  slotRank(a) - slotRank(b) ||
  (a.type === "무기" ? a.subType.localeCompare(b.subType, "ko") : 0) ||
  a.name.localeCompare(b.name, "ko");

const categoryOf = (item: ItemSummary): CategoryKey =>
  CATEGORIES.find((c) => (c.types as readonly string[]).includes(item.type))?.key ?? "equipment";

// Item browser: a compact icon grid grouped by grade, with the selected item's details
// (stats, recipe, what it builds into) in a side panel. Category, filters and the
// selected item live in the URL (?cat=equipment&slot=무기&weapon=단검&grade=5&item=12).
export default function ItemsPage() {
  const { data: items, loading, error } = useFetch(() => api.getItems());
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");

  const selectedId = Number(params.get("item")) || null;
  const selected = items?.find((i) => i.id === selectedId);
  // Links from elsewhere (recipe trees, routes) only carry ?item=, so the tab follows
  // the item they point at.
  const category: CategoryKey =
    (CATEGORIES.find((c) => c.key === params.get("cat"))?.key ?? (selected && categoryOf(selected))) || "equipment";
  const slot = category === "equipment" ? params.get("slot") : null;
  const weapon = slot === "무기" ? params.get("weapon") : null;
  const grade = Number(params.get("grade")) || null;
  // Equipment only: a special material in the recipe, and stat categories (?stat=공격력,치명타
  // — an item must grant every one picked).
  const special = category === "equipment" ? params.get("special") : null;
  const statLabels = category === "equipment" ? (params.get("stat")?.split(",").filter(Boolean) ?? []) : [];
  const pickedStats = STAT_CATEGORIES.filter((c) => statLabels.includes(c.label));

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  const inCategory = useMemo(() => {
    const types: readonly string[] = CATEGORIES.find((c) => c.key === category)!.types;
    return (items ?? []).filter((i) => types.includes(i.type));
  }, [items, category]);

  const weaponKinds = useMemo(
    () => [...new Set(inCategory.filter((i) => i.type === "무기").map((i) => i.subType))].sort((a, b) => a.localeCompare(b, "ko")),
    [inCategory],
  );

  // Only offer the stat categories / special materials some item here actually has.
  const statOptions = useMemo(
    () => STAT_CATEGORIES.filter((c) => inCategory.some((i) => c.keys.some((k) => i.statKeys?.includes(k)))),
    [inCategory],
  );
  const specialOptions = useMemo(
    () => SPECIAL_MATERIALS.filter((m) => inCategory.some((i) => i.specialMaterials?.includes(m))),
    [inCategory],
  );

  const visible = inCategory.filter(
    (i) =>
      (!slot || slotOf(i) === slot) &&
      (!weapon || i.subType === weapon) &&
      (!grade || i.grade === grade) &&
      (!special || i.specialMaterials?.includes(special)) &&
      pickedStats.every((c) => c.keys.some((k) => i.statKeys?.includes(k))) &&
      (search.trim() === "" || i.name.includes(search.trim())),
  );
  const toggleStat = (label: string) => {
    const next = statLabels.includes(label) ? statLabels.filter((l) => l !== label) : [...statLabels, label];
    update({ stat: next.length > 0 ? next.join(",") : null });
  };
  // The API already orders by grade (high first), then name.
  const boxes = visible.filter(isSupplyBox);
  const rest = visible.filter((i) => !isSupplyBox(i));
  const sections = [
    ...(boxes.length > 0 ? [{ key: "boxes", title: "보급 상자", grade: boxes[0].grade, items: boxes }] : []),
    ...[...new Set(rest.map((i) => i.grade))].map((g) => ({
      key: `grade-${g}`,
      title: GRADE_LABEL[g],
      grade: g,
      items: rest.filter((i) => i.grade === g).sort(category === "equipment" ? byEquipmentSlot : () => 0),
    })),
  ];

  const select = (id: number) => {
    update({ item: String(id), cat: category });
    // On narrow screens the panel sits below the grid; bring it into view.
    if (window.matchMedia("(max-width: 900px)").matches) {
      requestAnimationFrame(() => document.querySelector(".item-panel")?.scrollIntoView({ behavior: "smooth" }));
    }
  };

  if (loading) return <p className="status">불러오는 중...</p>;
  if (error) return <p className="status status--error">에러: {error}</p>;

  return (
    <div className="items-layout">
      <div className="main-content">
        <header className="page-header">
          <h1>아이템</h1>
          <span className="page-header__count">{visible.length}</span>
        </header>

        <div className="segmented">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              className={"segmented__item" + (category === c.key ? " segmented__item--active" : "")}
              aria-pressed={category === c.key}
              onClick={() => update({ cat: c.key, slot: null, weapon: null, special: null, stat: null })}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="item-filters">
          {category === "equipment" && (
            <FilterRow
              label="부위"
              options={EQUIPMENT_SLOTS}
              value={slot}
              onChange={(value) => update({ slot: value, weapon: null })}
            />
          )}
          {slot === "무기" && (
            <FilterRow label="무기" options={weaponKinds} value={weapon} onChange={(value) => update({ weapon: value })} />
          )}
          <FilterRow
            label="등급"
            options={[6, 5, 4, 3, 2, 1].map(String)}
            format={(g) => GRADE_LABEL[Number(g)]}
            value={grade ? String(grade) : null}
            onChange={(value) => update({ grade: value })}
          />
          {category === "equipment" && specialOptions.length > 0 && (
            <FilterRow
              label="특수 재료"
              options={specialOptions}
              value={special}
              onChange={(value) => update({ special: value })}
            />
          )}
          {category === "equipment" && statOptions.length > 0 && (
            <div className="item-filters__row">
              <span className="item-filters__label">능력치</span>
              <div className="chip-group">
                <button
                  type="button"
                  className={"chip" + (statLabels.length === 0 ? " chip--active" : "")}
                  onClick={() => update({ stat: null })}
                >
                  전체
                </button>
                {statOptions.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    className={"chip" + (statLabels.includes(c.label) ? " chip--active" : "")}
                    aria-pressed={statLabels.includes(c.label)}
                    onClick={() => toggleStat(c.label)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <input
            className="search-input item-filters__search"
            type="search"
            placeholder="아이템 이름 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {sections.map(({ key, title, grade: g, items: group }) => (
          <section className={`item-group grade-${g}`} key={key}>
            <h2 className="item-group__title">
              {title} <span>{group.length}</span>
            </h2>
            <div className="item-grid">
              {group.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`item-cell grade-${item.grade}` + (item.id === selectedId ? " item-cell--active" : "")}
                  title={item.name}
                  aria-pressed={item.id === selectedId}
                  onClick={() => select(item.id)}
                >
                  <span className="item-cell__icon">
                    {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : item.name[0]}
                  </span>
                  <span className="item-cell__name">{item.name}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
        {visible.length === 0 && <p className="status">조건에 맞는 아이템이 없습니다.</p>}
      </div>

      <aside className="item-panel">
        {selectedId ? (
          <ItemDetailPanel itemId={selectedId} key={selectedId} />
        ) : (
          <p className="item-panel__empty">아이템을 선택하면 능력치와 조합법이 여기에 표시됩니다.</p>
        )}
      </aside>
    </div>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
  format = (option) => option,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (value: string | null) => void;
  format?: (option: string) => string;
}) {
  return (
    <div className="item-filters__row">
      <span className="item-filters__label">{label}</span>
      <div className="chip-group">
        <button type="button" className={"chip" + (value === null ? " chip--active" : "")} onClick={() => onChange(null)}>
          전체
        </button>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={"chip" + (value === option ? " chip--active" : "")}
            aria-pressed={value === option}
            onClick={() => onChange(value === option ? null : option)}
          >
            {format(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
