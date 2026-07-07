import { useState } from "react";
import { BookOpenCheck, ChevronDown } from "lucide-react";

function getSourceBook(source) {
  return source?.book || source?.filename || source?.bookName || "Book not specified";
}

function normalizePageValue(value, isZeroIndexed = false) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);

  if (Number.isFinite(numericValue)) {
    return isZeroIndexed || numericValue === 0
      ? numericValue + 1
      : numericValue;
  }

  return value;
}

function getSourcePage(source) {
  const page =
    source?.display_page ??
    source?.displayPage ??
    source?.source_page_label ??
    source?.page ??
    source?.pageNumber ??
    source?.page_number ??
    source?.source_page ??
    source?.pdf_page ??
    source?.pageNo ??
    source?.page_no;

  const normalizedPage =
    normalizePageValue(page) ??
    normalizePageValue(
      source?.pdf_page_index ??
        source?.pdfPageIndex ??
        source?.page_index ??
        source?.pageIndex,
      true
    );

  if (normalizedPage === null) {
    return "Page not available";
  }

  const pageLabel = String(normalizedPage).trim();
  const prefix = /-|,/.test(pageLabel) ? "Pages" : "Page";

  return `${prefix} ${pageLabel}`;
}

export default function SourceCard({ sources = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const sourceList = Array.isArray(sources) ? sources : [];
  const visibleSources = sourceList.slice(0, 3);
  const hiddenCount = Math.max(sourceList.length - visibleSources.length, 0);

  if (!sourceList.length) {
    return null;
  }

  return (
    <section className="source-card overflow-hidden rounded-lg border px-3 py-2.5 backdrop-blur-xl sm:px-3.5">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex min-h-9 w-full min-w-0 items-center justify-between gap-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="source-card-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
            <BookOpenCheck size={15} />
          </span>
          <span className="min-w-0">
            <span className="source-card-title block truncate text-sm font-semibold leading-5 sm:text-[15px]">
              Sources
            </span>
          </span>
        </span>

        <ChevronDown
          size={16}
          className={`source-card-chevron shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="source-card-list mt-2 border-t pt-2">
          {visibleSources.map((source, index) => (
            <div
              key={`${getSourceBook(source)}-${getSourcePage(source)}-${index}`}
              className="source-card-row grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl px-2 py-2"
            >
              <p className="min-w-0 truncate text-sm font-medium leading-5">
                {getSourceBook(source)}
              </p>
              <p className="shrink-0 text-xs font-medium leading-5">
                {getSourcePage(source)}
              </p>
            </div>
          ))}
          {hiddenCount > 0 && (
            <div className="source-card-more rounded-xl px-2 py-2 text-xs font-semibold leading-5">
              +{hiddenCount} more
            </div>
          )}
        </div>
      )}
    </section>
  );
}
