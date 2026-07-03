import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, NotebookText } from "lucide-react";

export default function RevisionCard({
  content,
  markdownComponents,
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!content?.trim()) {
    return null;
  }

  return (
    <section className="revision-card mt-3 overflow-hidden rounded-2xl border px-3 py-2.5 shadow-sm backdrop-blur-xl sm:max-w-3xl sm:px-3.5">
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
            Revision
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
        <div className="revision-card-content mt-2 border-t pt-3 text-sm leading-6 sm:text-[15px]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}
    </section>
  );
}
