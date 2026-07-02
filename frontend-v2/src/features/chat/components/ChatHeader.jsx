import { BookOpenCheck, Home, Menu, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ChatHeader({ title, onOpenSidebar }) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white/90 pt-[env(safe-area-inset-top)] shadow-sm shadow-slate-200/60 backdrop-blur-xl lg:shadow-none">
      <div className="flex h-14 items-center justify-between gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6 lg:px-8">

        <button
          type="button"
          onClick={() => onOpenSidebar?.()}
          aria-label="Open navigation menu"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 lg:hidden"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0 flex-1">

          <h1 className="truncate text-[17px] font-bold leading-5 text-slate-900 sm:text-lg">
            AssamWork AI
          </h1>

          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-3 text-slate-500 sm:text-sm">
            <BookOpenCheck size={13} className="shrink-0 text-blue-600" />
            <span className="truncate">
              {title || "Ebook-grounded AI tutor"}
            </span>
          </p>

        </div>

        <button
          type="button"
          onClick={() => navigate("/study")}
          aria-label="Go to Study Dashboard"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700 transition hover:bg-blue-100 md:hidden"
        >
          <Home size={17} />
        </button>

        <div className="hidden max-w-sm items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 md:flex">
          <ShieldCheck size={16} className="shrink-0" />
          Answers are generated only from AssamWork uploaded ebooks.
        </div>
      </div>
    </header>
  );
}
