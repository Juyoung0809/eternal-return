import type { RecipeMaterial } from "../api/types";
import ItemTile from "./ItemTile";

// Renders one item box, and — if it was itself crafted from something — the "+"-joined
// pair of materials underneath, recursing down to the base components. Reads top-down:
// this item, made from the row below it, each of those made from the row below that.
function RecipeNode({ item }: { item: RecipeMaterial }) {
  return (
    <div className="recipe-node">
      <ItemTile item={item} />

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
