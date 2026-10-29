import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import type { Item } from "../api/types";
import { GRADE_LABEL } from "../constants";

type TileItem = Pick<Item, "id" | "name" | "grade" | "imageUrl"> & Partial<Pick<Item, "spawnAreas" | "droppedBy">>;

// Small grade-tinted item box that opens the item in the item browser's detail panel.
// Used wherever items show up as a set: crafting trees, a route's target items, "used
// to craft" lists. When the item's sources are known (recipe trees), hovering shows
// where to find it.
export default function ItemTile({ item }: { item: TileItem }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const hasSources = Boolean(item.spawnAreas?.length || item.droppedBy?.length);
  const show = (e: React.SyntheticEvent<HTMLElement>) => hasSources && setAnchor(e.currentTarget.getBoundingClientRect());
  const hide = () => setAnchor(null);

  return (
    <Link
      to={`/items?item=${item.id}`}
      className={`item-tile grade-${item.grade}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span className="item-tile__thumb">{item.imageUrl ? <img src={item.imageUrl} alt={item.name} /> : item.name[0]}</span>
      <span className="item-tile__name">{item.name}</span>
      <span className="item-tile__grade">{GRADE_LABEL[item.grade] ?? item.grade}</span>
      {/* Portaled so the recipe tree's scroll box doesn't clip it */}
      {anchor && createPortal(<ItemSources item={item} anchor={anchor} />, document.body)}
    </Link>
  );
}

function ItemSources({ item, anchor }: { item: TileItem; anchor: DOMRect }) {
  return (
    <span className="item-sources" role="tooltip" style={{ left: anchor.left + anchor.width / 2, top: anchor.top }}>
      <strong>{item.name}</strong>
      {item.spawnAreas && item.spawnAreas.length > 0 && (
        <span>
          <em>지역</em>
          {item.spawnAreas.join(" · ")}
        </span>
      )}
      {item.droppedBy && item.droppedBy.length > 0 && (
        <span>
          <em>야생동물</em>
          {item.droppedBy.join(" · ")}
        </span>
      )}
    </span>
  );
}
