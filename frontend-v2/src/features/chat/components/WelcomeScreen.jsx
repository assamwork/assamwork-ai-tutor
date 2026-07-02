import { BookOpenCheck, Sparkles } from "lucide-react";
import SuggestionCard from "./SuggestionCard";

export default function WelcomeScreen({ onSelectPrompt }) {
  const suggestions = [
    {
      title: "Explain Deepor Beel",
      prompt: "Explain Deepor Beel from AssamWork study materials in exam-oriented language.",
    },
    {
      title: "Summarize Indian Polity",
      prompt: "Summarize Indian Polity from AssamWork study materials with key points.",
    },
    {
      title: "Generate MCQs",
      prompt: "Generate 10 MCQs from AssamWork study materials with answers.",
    },
    {
      title: "Create revision notes",
      prompt: "Create concise revision notes from AssamWork study materials.",
    },
  ];

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-2 py-5 text-center sm:min-h-[58vh] sm:py-12">

      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200/70 sm:mb-4 sm:h-14 sm:w-14">
        <Sparkles size={22} />
      </div>

      <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-blue-600">
        AssamWork AI
      </p>

      <h1 className="text-[1.7rem] font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl">
        Ask from AssamWork study materials
      </h1>

      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:mt-3 sm:text-base sm:leading-7">
        Get exam-focused answers based on AssamWork&apos;s curated study library.
      </p>

      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 sm:mt-4 sm:text-sm">
        <BookOpenCheck size={16} className="text-blue-600" />
        Answers include sources from AssamWork study materials.
      </div>

      <div className="mt-5 flex w-full flex-wrap justify-center gap-2 sm:mt-7 sm:gap-3">

        {suggestions.map((item) => (
          <SuggestionCard
            key={item.title}
            title={item.title}
            variant="chip"
            onClick={() => onSelectPrompt(item.prompt)}
          />
        ))}

      </div>

    </div>
  );
}
