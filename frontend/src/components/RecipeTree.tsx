import { Link } from "react-router-dom";
import type { RecipeMaterial } from "../api/types";

const GRADE_LABEL: Record<number, string> = { 1: "일반", 2: "고급", 3: "희귀", 4: "영웅", 5: "전설", 6: "초월" };

// Renders one item box, and — if it was itself crafted from something — the "+"-joined
// pair of materials underneath, recursing down to the base components. Reads top-down:
// this item, made from the row below it, each of those made from the row below that.
function RecipeNode({ item }: { item: RecipeMaterial }) {
  return (
    <div className="recipe-node">
      <Link to={`/items/${item.id}`} className="recipe-node__box">
        <span className="recipe-node__thumb">{item.imageUrl ? <img src={item.imageUrl} alt={item.name} /> : item.name[0]}</span>
        <span className="recipe-node__name">{item.name}</span>
        <span className={`tag tag--grade-${item.grade} recipe-node__grade`}>{GRADE_LABEL[item.grade] ?? item.grade}</span>
      </Link>

      {item.materials.length > 0 && (
        <>
          <div className="recipe-node__connector" aria-hidden="true" />
          <div className="recipe-node__children">
            {item.materials.map((material, i) => (
              <div className="recipe-node__child" key={material.id}>
                {i > 0 && <span className="recipe-node__plus">+</span>}
                <RecipeNode item={material} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function RecipeTree({ materials }: { materials: RecipeMaterial[] }) {
  if (materials.length === 0) return null;

  return (
    <div className="recipe-tree">
      <div className="recipe-tree__row">
        {materials.map((material, i) => (
          <div className="recipe-node__child" key={material.id}>
            {i > 0 && <span className="recipe-node__plus">+</span>}
            <RecipeNode item={material} />
          </div>
        ))}
      </div>
    </div>
  );
}
