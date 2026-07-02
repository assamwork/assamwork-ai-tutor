import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpenCheck,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import MessageActions from "./MessageActions";

const markdownComponents = {
  h1: ({ children }) => (
    <h1 className="mb-3 mt-1 text-2xl font-bold leading-tight text-slate-950">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-5 text-xl font-bold leading-tight text-slate-950">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 text-lg font-bold leading-tight text-slate-900">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-3 last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-4 ml-5 list-disc space-y-1.5 last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-4 ml-5 list-decimal space-y-1.5 last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="pl-1">
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 rounded-r-xl border-l-4 border-blue-200 bg-blue-50/60 px-4 py-3 text-slate-700">
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4 hover:text-blue-800"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-r border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-800 last:border-r-0">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-r border-slate-200 px-3 py-2 align-top last:border-r-0">
      {children}
    </td>
  ),
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm leading-6 text-slate-100 shadow-inner">
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    const isBlockCode = Boolean(className);

    if (isBlockCode) {
      return (
        <code className={`${className} whitespace-pre text-slate-100`}>
          {children}
        </code>
      );
    }

    return (
      <code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[0.92em] font-semibold text-slate-800">
        {children}
      </code>
    );
  },
};

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const sources = Array.isArray(message.sources)
    ? message.sources
    : [];
  const hasSources = sources.length > 0;

  return (
    <div className={`flex max-w-full min-w-0 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mr-2 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm sm:mr-3 sm:h-9 sm:w-9">
          <Sparkles size={16} />
        </div>
      )}

      <div
        className={`min-w-0 overflow-hidden ${
          isUser
            ? "max-w-[82%] rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-sm sm:max-w-[75%] sm:px-5"
            : "max-w-full flex-1 sm:max-w-4xl"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-7">
            {message.content}
          </p>
        ) : (
          <>
            <article className="min-w-0 overflow-x-auto rounded-2xl border border-slate-200 bg-white px-3.5 py-4 text-sm leading-7 text-slate-700 shadow-sm sm:px-6 sm:py-5 sm:text-base">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {message.content}
              </ReactMarkdown>
            </article>

            <section className="mt-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm sm:mt-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                <h4 className="flex min-w-0 items-center gap-2 text-xs font-bold text-slate-800 sm:text-sm">
                  <BookOpenCheck
                    size={16}
                    className="shrink-0 text-emerald-600"
                  />
                  <span className="min-w-0">
                    Sources from AssamWork study materials
                  </span>
                </h4>

                {hasSources && (
                  <button
                    type="button"
                    onClick={() => setSourcesOpen((open) => !open)}
                    aria-expanded={sourcesOpen}
                    className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:px-2.5 sm:py-1.5 sm:text-xs"
                  >
                    {sourcesOpen ? (
                      <>
                        Hide sources
                        <ChevronUp size={15} />
                      </>
                    ) : (
                      <>
                        Show sources
                        <ChevronDown size={15} />
                      </>
                    )}
                  </button>
                )}
              </div>

              {hasSources ? (
                sourcesOpen && (
                  <div className="mt-2 grid gap-2 sm:mt-3 sm:grid-cols-2 sm:gap-3">
                    {sources.map((source, index) => (
                    <div
                      key={`${source.subject ?? "subject"}-${source.book ?? "book"}-${index}`}
                      className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 sm:p-3.5"
                    >
                      <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 sm:px-2.5 sm:py-1 sm:text-[10px]">
                        <ShieldCheck size={12} />
                        <span className="truncate">Verified ebook source</span>
                      </div>

                      <dl className="mt-2 space-y-1.5 sm:mt-3 sm:space-y-2">
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[11px]">
                            Book
                          </dt>
                          <dd className="mt-0.5 break-words text-xs font-bold leading-5 text-slate-800 sm:text-sm">
                            {source?.book || "Book not specified"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[11px]">
                            Subject
                          </dt>
                          <dd className="mt-0.5 break-words text-xs font-medium text-slate-700 sm:text-sm">
                            {source?.subject || "Subject not specified"}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-2 grid gap-1 border-t border-slate-200 pt-2 text-[11px] text-slate-500 sm:mt-3 sm:gap-1.5 sm:pt-3 sm:text-xs">
                        <p>Confidence: Coming soon</p>
                        <p>Excerpt: Coming soon</p>
                        <p>Page: Coming soon</p>
                      </div>
                    </div>
                    ))}
                  </div>
                )
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Source not available for this answer.
                </p>
              )}
            </section>

            <MessageActions content={message.content} />
          </>
        )}
      </div>
    </div>
  );
}
