import { Sparkles } from "lucide-react";

export default function TypingIndicator() {
  return (
    <div className="flex min-w-0 items-start gap-2 sm:gap-3" aria-live="polite">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm sm:h-9 sm:w-9">
        <Sparkles size={16} />
      </div>

      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-4">
        <div className="flex items-center gap-1.5">

          <div
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500"
            style={{ animationDelay: "0ms" }}
          />

          <div
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500"
            style={{ animationDelay: "150ms" }}
          />

          <div
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500"
            style={{ animationDelay: "300ms" }}
          />

          <span className="ml-2 text-sm text-slate-500">
            Searching AssamWork study materials...
          </span>

        </div>
      </div>
    </div>
  );
}
