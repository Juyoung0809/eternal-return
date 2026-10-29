// Page links around the current page, always showing the first and last page:
// ‹ 1 … 4 5 [6] 7 8 … 4651 ›
const WINDOW = 2;

function pageNumbers(page: number, totalPages: number): Array<number | "gap"> {
  const pages = new Set([1, totalPages]);
  for (let p = page - WINDOW; p <= page + WINDOW; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ["gap" as const, p] : [p]));
}

export default function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="페이지">
      <button
        type="button"
        className="pagination__item"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="이전 페이지"
      >
        ‹
      </button>
      {pageNumbers(page, totalPages).map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="pagination__gap">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className={"pagination__item" + (p === page ? " pagination__item--active" : "")}
            aria-current={p === page ? "page" : undefined}
            onClick={() => onChange(p)}
          >
            {p.toLocaleString()}
          </button>
        ),
      )}
      <button
        type="button"
        className="pagination__item"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="다음 페이지"
      >
        ›
      </button>
    </nav>
  );
}
