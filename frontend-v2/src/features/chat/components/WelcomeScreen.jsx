import { BookOpenCheck, LibraryBig, ShieldCheck } from "lucide-react";
import SuggestionCard from "./SuggestionCard";

export default function WelcomeScreen({ onSelectPrompt }) {
  const suggestions = [
    {
      title: "Explain a topic",
      description: "Get a clear, exam-oriented explanation from your ebooks.",
      prompt: "Explain an important topic from my uploaded ebooks.",
    },
    {
      title: "Create revision notes",
      description: "Turn ebook material into concise last-minute notes.",
      prompt: "Create concise revision notes from my uploaded ebooks.",
    },
    {
      title: "Practice with MCQs",
      description: "Generate source-grounded questions with explanations.",
      prompt: "Generate 10 MCQs from my uploaded ebooks with answers.",
    },
    {
      title: "Compare concepts",
      description: "Understand differences with a structured comparison.",
      prompt: "Compare two related concepts from my uploaded ebooks.",
    },
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center py-6 text-center sm:py-12 lg:py-16">

      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200 sm:h-20 sm:w-20">
        <LibraryBig size={34} />
      </div>

      <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
        Your competitive exam study companion
      </p>

      <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
        Ask from your uploaded ebooks
      </h1>

      <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
        Prepare for APSC, ADRE, Assam Police, TET, and other competitive
        exams with answers grounded in your AssamWork study library.
      </p>

      <div className="mt-6 flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 sm:text-sm">
        <ShieldCheck size={16} className="shrink-0" />
        Answers are generated only from AssamWork uploaded ebooks.
      </div>

      <div className="mt-5 flex items-center gap-2 text-xs text-slate-500 sm:text-sm">
        <BookOpenCheck size={16} className="text-blue-600" />
        Ebook sources are shown with every answer.
      </div>

      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2 sm:gap-4">

        {suggestions.map((item) => (
          <SuggestionCard
            key={item.title}
            title={item.title}
            description={item.description}
            onClick={() => onSelectPrompt(item.prompt)}
          />
        ))}

      </div>

    </div>
  );
}
