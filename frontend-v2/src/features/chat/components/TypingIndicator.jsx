import { Sparkles } from "lucide-react";

export default function TypingIndicator() {
  return (
    <div className="flex items-start gap-3" aria-live="polite">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
        <Sparkles size={17} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
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
            Searching uploaded ebooks...
          </span>

        </div>
      </div>
    </div>
  );
}
