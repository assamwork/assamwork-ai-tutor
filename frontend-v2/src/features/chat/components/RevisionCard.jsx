import { useState } from "react";
import { Check, ChevronDown, NotebookText } from "lucide-react";

function parseRevisionItems(content = "") {
  return content
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/^\s*(?:[-*]|\u2022|\u2713|\d+[.)])\s*/, "")
        .replace(/\*\*/g, "")
        .trim()
    )
    .filter(Boolean)
    .slice(0, 8);
}

export default function RevisionCard({ content }) {
  const [isOpen, setIsOpen] = useState(false);
  const revisionItems = parseRevisionItems(content);

  if (!revisionItems.length) {
    return null;
  }

  return (
    <section className="revision-card overflow-hidden rounded-lg border px-3 py-2.5 backdrop-blur-xl sm:px-3.5">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex min-h-9 w-full min-w-0 items-center justify-between gap-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="revision-card-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
            <NotebookText size={15} />
          </span>
          <span className="revision-card-title block truncate text-sm font-semibold leading-5 sm:text-[15px]">
            Quick Revision
          </span>
        </span>

        <ChevronDown
          size={16}
          className={`revision-card-chevron shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <ul className="revision-card-content mt-2 grid gap-1.5 border-t pt-3">
          {revisionItems.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="revision-card-note flex min-w-0 items-center gap-2 text-sm font-medium leading-5 sm:text-[15px]"
            >
              <span className="revision-card-check flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                <Check size={13} strokeWidth={2.4} />
              </span>
              <span className="min-w-0 truncate">
                {item}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
