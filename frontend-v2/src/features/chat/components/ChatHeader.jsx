import { BookOpenCheck, Home, Menu, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ChatHeader({ title, onOpenSidebar }) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] shadow-sm shadow-slate-200/60 backdrop-blur lg:shadow-none">
      <div className="flex min-h-15 items-center justify-between gap-2 px-3 py-2.5 sm:min-h-16 sm:gap-3 sm:px-6 sm:py-3 lg:px-8">

        <button
          type="button"
          onClick={() => onOpenSidebar?.()}
          aria-label="Open navigation menu"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 lg:hidden"
        >
          <Menu size={21} />
        </button>

        <div className="min-w-0 flex-1">

          <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">
            AssamWork AI
          </h1>

          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 sm:text-sm">
            <BookOpenCheck size={14} className="text-blue-600" />
            <span className="truncate">
              {title || "Ebook-grounded AI tutor"}
            </span>
          </p>

        </div>

        <button
          type="button"
          onClick={() => navigate("/study")}
          aria-label="Go to Study Dashboard"
          className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100 md:hidden"
        >
          <Home size={17} />
          <span className="hidden min-[390px]:inline">Home</span>
        </button>

        <div className="hidden max-w-sm items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 md:flex">
          <ShieldCheck size={16} className="shrink-0" />
          Answers are generated only from AssamWork uploaded ebooks.
        </div>
      </div>
    </header>
  );
}
