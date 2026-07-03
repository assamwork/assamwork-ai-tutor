import { useState } from "react";
import { BookOpenCheck, ChevronDown } from "lucide-react";

function getSourceBook(source) {
  return source?.book || source?.bookName || "Book not specified";
}

function getSourcePage(source) {
  const page =
    source?.page ??
    source?.pageNumber ??
    source?.page_number ??
    source?.pageNo ??
    source?.page_no;

  if (page === null || page === undefined || page === "") {
    return "Page not available";
  }

  return `Page ${page}`;
}

export default function SourceCard({ sources = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const sourceList = Array.isArray(sources) ? sources : [];

  if (!sourceList.length) {
    return null;
  }

  const mainSource = sourceList[0];
  const remainingCount = Math.max(sourceList.length - 1, 0);

  return (
    <section className="source-card mt-3 overflow-hidden rounded-2xl border px-3 py-2.5 shadow-sm backdrop-blur-xl sm:max-w-3xl sm:px-3.5">
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
              {getSourceBook(mainSource)}
              {remainingCount > 0 ? ` +${remainingCount}` : ""}
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
          {sourceList.map((source, index) => (
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
        </div>
      )}
    </section>
  );
}
