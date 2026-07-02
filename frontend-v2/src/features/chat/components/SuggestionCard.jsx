export default function SuggestionCard({
  title,
  description,
  onClick,
}) {
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
