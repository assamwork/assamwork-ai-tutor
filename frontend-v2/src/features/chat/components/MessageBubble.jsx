import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpenCheck, Sparkles } from "lucide-react";

import MessageActions from "./MessageActions";

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";

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

            <div className="mt-3">
              <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <BookOpenCheck size={15} className="text-emerald-600" />
                Answer sources
              </h4>

              {message.sources?.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {message.sources.map((source, index) => (
                    <div
                      key={`${source.subject ?? "subject"}-${source.book ?? "book"}-${index}`}
                      className="min-w-0 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3"
                    >
                      <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                        Verified from uploaded ebook
                      </p>
                      <p
                        className="mt-1 truncate text-sm font-semibold text-slate-800"
                        title={source.book || "Book not specified"}
                      >
                        {source.book || "Book not specified"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-600">
                        Subject: {source.subject || "Subject not specified"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600">
                  Source not available
                </div>
              )}
            </div>

            <MessageActions content={message.content} />
          </>
        )}
      </div>
    </div>
  );
}
