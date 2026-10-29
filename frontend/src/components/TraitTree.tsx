import type { RouteTraitGroup, Trait } from "../api/types";

// A route's traits laid out like the in-game picker: the main group's icon over its four
// core options (bowed into an arc), then its Sub1 / Sub2 options, then the secondary
// group's icon and options. The route's picks are ringed; the rest are dimmed.
export default function TraitTree({ groups, picked }: { groups: RouteTraitGroup[]; picked: number[] }) {
  return (
    <div className="trait-tree">
      {groups.map((group, i) => {
        const core = group.core.find((t) => picked.includes(t.code));
        return (
          <div className="trait-tree__group" key={group.key}>
            <div className="trait-tree__head">
              {group.imageUrl && <img className="trait-tree__group-icon" src={group.imageUrl} alt="" />}
              <span>
                <span className="trait-tree__role">{i === 0 ? "메인" : "보조"}</span>
                {group.name}
              </span>
            </div>
            {group.core.length > 0 && (
              <>
                <div className="trait-tree__core">
                  {group.core.map((trait, j) => (
                    <TraitIcon
                      trait={trait}
                      active={picked.includes(trait.code)}
                      size="core"
                      key={trait.code}
                      // bow the row into an arc, like the game's core picker
                      offset={[0, 10, 10, 0][j] ?? 0}
                    />
                  ))}
                </div>
                {core && <p className="trait-tree__core-name">{core.name}</p>}
              </>
            )}
            <div className="trait-tree__subs">
              {[group.sub1, group.sub2].map((tier, j) => (
                <div className="trait-tree__tier" key={j}>
                  {tier.map((trait) => (
                    <TraitIcon trait={trait} active={picked.includes(trait.code)} size="sub" key={trait.code} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TraitIcon({
  trait,
  active,
  size,
  offset = 0,
}: {
  trait: Trait;
  active: boolean;
  size: "core" | "sub";
  offset?: number;
}) {
  return (
    <span
      className={`trait-icon trait-icon--${size}` + (active ? " trait-icon--active" : "")}
      style={offset ? { transform: `translateY(${offset}px)` } : undefined}
      title={trait.description ? `${trait.name}\n${trait.description}` : trait.name}
    >
      {trait.imageUrl ? <img src={trait.imageUrl} alt={trait.name} /> : trait.name[0]}
    </span>
  );
}
