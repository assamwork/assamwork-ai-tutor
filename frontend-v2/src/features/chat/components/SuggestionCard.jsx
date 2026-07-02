export default function SuggestionCard({
  title,
  description,
  onClick,
  variant = "card",
}) {
  if (variant === "chip") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        {title}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:p-5"
    >
      <h3 className="mb-2 text-base font-semibold text-slate-900 group-hover:text-blue-600">
        {title}
      </h3>

      <p className="text-sm leading-6 text-slate-500">
        {description}
      </p>
    </button>
  );
}
