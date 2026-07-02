import { BookOpenCheck, ShieldCheck } from "lucide-react";

export default function ChatHeader({ title }) {
  return (
    <header className="shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex min-h-16 items-center justify-between gap-4 py-3 pl-16 pr-4 sm:px-6 lg:px-8">

        <div className="min-w-0">

          <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">
            {title}
          </h1>

          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 sm:text-sm">
            <BookOpenCheck size={14} className="text-blue-600" />
            Ebook-grounded AI tutor
          </p>

        </div>

        <div className="hidden max-w-sm items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 md:flex">
          <ShieldCheck size={16} className="shrink-0" />
          Answers are generated only from AssamWork uploaded ebooks.
        </div>
      </div>
    </header>
  );
}
