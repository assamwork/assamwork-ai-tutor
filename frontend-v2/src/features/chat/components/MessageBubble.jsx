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

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const sources = Array.isArray(message.sources)
    ? message.sources
    : [];
  const hasSources = sources.length > 0;

  return (
    <div className={`flex min-w-0 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mr-3 mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <Sparkles size={17} />
        </div>
      )}

      <div
        className={`min-w-0 overflow-hidden ${
          isUser
            ? "max-w-[88%] rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-sm sm:max-w-[75%] sm:px-5"
            : "w-full max-w-4xl"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-7">
            {message.content}
          </p>
        ) : (
          <>
            <article className="min-w-0 overflow-x-auto rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm leading-7 text-slate-700 shadow-sm sm:px-6 sm:text-base">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ children }) => (
                    <div className="my-4 overflow-x-auto">
                      <table className="min-w-full border-collapse text-left text-sm">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-slate-200 bg-slate-50 px-3 py-2 font-semibold">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-slate-200 px-3 py-2 align-top">
                      {children}
                    </td>
                  ),
                  pre: ({ children }) => (
                    <pre className="my-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">
                      {children}
                    </pre>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </article>

            <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-800">
                  <BookOpenCheck
                    size={17}
                    className="shrink-0 text-emerald-600"
                  />
                  Sources from uploaded ebooks
                </h4>

                {hasSources && (
                  <button
                    type="button"
                    onClick={() => setSourcesOpen((open) => !open)}
                    aria-expanded={sourcesOpen}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
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
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {sources.map((source, index) => (
                    <div
                      key={`${source.subject ?? "subject"}-${source.book ?? "book"}-${index}`}
                      className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5"
                    >
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                        <ShieldCheck size={12} />
                        Verified ebook source
                      </div>

                      <dl className="mt-3 space-y-2">
                        <div>
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Book
                          </dt>
                          <dd className="mt-0.5 break-words text-sm font-bold leading-5 text-slate-800">
                            {source?.book || "Book not specified"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Subject
                          </dt>
                          <dd className="mt-0.5 break-words text-sm font-medium text-slate-700">
                            {source?.subject || "Subject not specified"}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-3 grid gap-1.5 border-t border-slate-200 pt-3 text-xs text-slate-500">
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
