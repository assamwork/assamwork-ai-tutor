import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles } from "lucide-react";

import MessageActions from "./MessageActions";
import RevisionCard from "./RevisionCard";
import SourceCard from "./SourceCard";

const markdownComponents = {
  h1: ({ children }) => (
    <h1 className="mb-2 mt-1 text-xl font-bold leading-tight text-slate-950 sm:text-2xl">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-4 text-lg font-bold leading-tight text-slate-950 sm:text-xl">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-3 text-base font-bold leading-tight text-slate-900 sm:text-lg">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-2.5 last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 ml-5 list-disc space-y-1 last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 ml-5 list-decimal space-y-1 last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="pl-1">
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 rounded-r-xl border-l-4 border-blue-200 bg-blue-50/60 px-3 py-2.5 text-slate-700">
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
    <div className="my-3 overflow-x-auto rounded-xl border border-slate-200">
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
    <pre className="my-3 overflow-x-auto rounded-xl bg-slate-950 p-3 text-sm leading-6 text-slate-100 shadow-inner">
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

function splitRevisionContent(content = "") {
  const revisionHeadingPattern =
    /(?:^|\n)(?:#{1,6}\s*)?(?:\*\*)?\s*(revision(?:\s+(?:points|notes))?|quick revision|helpful revision|key revision points)\s*(?:\*\*)?\s*:?\s*\n/i;
  const match = revisionHeadingPattern.exec(content);

  if (!match?.index && match?.index !== 0) {
    return {
      answerContent: content,
      revisionContent: "",
    };
  }

  const headingStart = match.index;
  const revisionStart = headingStart + match[0].length;

  return {
    answerContent: content.slice(0, headingStart).trim(),
    revisionContent: content.slice(revisionStart).trim(),
  };
}

function getMessageParts(message) {
  if (typeof message.revision === "string" && message.revision.trim()) {
    return {
      answerContent: message.content,
      revisionContent: message.revision,
    };
  }

  // Legacy fallback for messages saved before the API returned revision
  // separately. New messages should use message.revision.
  return splitRevisionContent(message.content);
}

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const sources = Array.isArray(message.sources)
    ? message.sources
    : [];
  const { answerContent, revisionContent } = getMessageParts(message);

  return (
    <div className={`flex max-w-full min-w-0 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm sm:mr-3">
          <Sparkles size={14} />
        </div>
      )}

      <div
        className={`min-w-0 overflow-hidden ${
          isUser
            ? "max-w-[82%] rounded-2xl bg-slate-900 px-4 py-2.5 text-sm leading-6 text-white shadow-sm sm:text-[15px]"
            : "max-w-full flex-1 sm:max-w-3xl"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">
            {message.content}
          </p>
        ) : (
          <>
            <article className="assistant-message min-w-0 overflow-x-auto px-0 py-0 text-[15px] leading-7 text-slate-700 sm:text-base">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {answerContent}
              </ReactMarkdown>
            </article>

            <RevisionCard
              content={revisionContent}
              markdownComponents={markdownComponents}
            />

            <SourceCard sources={sources} />

            <MessageActions content={message.content} />
          </>
        )}
      </div>
    </div>
  );
}
