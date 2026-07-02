import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Clock3,
  FileQuestion,
  Flame,
  Layers3,
  MessageSquareText,
  Newspaper,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import useAuthStore from "../../../store/authStore";
import useChatStore from "../../../store/chatStore";

export default function StudyPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const chats = useChatStore((state) => state.chats);
  const setActiveChat = useChatStore((state) => state.setActiveChat);

  const completedChats = chats.filter(
    (chat) => chat.messages.length > 0
  );
  const totalChats =
    typeof profile?.totalChats === "number"
      ? Math.max(profile.totalChats, completedChats.length)
      : completedChats.length;
  const recentChats = completedChats.slice(0, 4);
  const firstName =
    profile?.name?.trim().split(/\s+/)[0] ||
    user?.displayName?.trim().split(/\s+/)[0] ||
    "Student";

  function openChat(chatId) {
    setActiveChat(chatId);
    navigate("/chat");
  }

  const comingSoon = [
    {
      title: "AI Mock Tests",
      description: "Practice exam-style tests generated from study material.",
      icon: FileQuestion,
      color: "bg-violet-100 text-violet-700",
    },
    {
      title: "Flashcards",
      description: "Review key facts with quick, focused recall sessions.",
      icon: Layers3,
      color: "bg-amber-100 text-amber-700",
    },
    {
      title: "Current Affairs",
      description: "A focused feed for Assam and national exam preparation.",
      icon: Newspaper,
      color: "bg-rose-100 text-rose-700",
    },
    {
      title: "Study Planner",
      description: "Organize goals, revision cycles, and upcoming topics.",
      icon: CalendarDays,
      color: "bg-cyan-100 text-cyan-700",
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-20 sm:px-6 sm:pt-20 lg:px-8 lg:pt-8">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-xl shadow-blue-200/60 sm:p-8 lg:p-10">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-blue-100">
                Study dashboard
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                Welcome back, {firstName}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
                Continue learning with answers grounded in your uploaded
                ebooks and built for competitive exam preparation.
              </p>
              <button
                type="button"
                onClick={() => navigate("/chat")}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-50"
              >
                Ask AssamWork AI
                <ArrowRight size={17} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-80">
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <MessageSquareText size={21} className="text-blue-100" />
                <p className="mt-4 text-3xl font-bold">{totalChats}</p>
                <p className="mt-1 text-xs text-blue-100">Total chats</p>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <Flame size={21} className="text-amber-300" />
                <p className="mt-4 text-lg font-bold">Ready</p>
                <p className="mt-1 text-xs text-blue-100">Study activity</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-900">Recent chats</p>
                <p className="mt-1 text-xs text-slate-500">
                  Continue your latest study conversations.
                </p>
              </div>
              <Clock3 size={20} className="text-slate-400" />
            </div>

            {recentChats.length > 0 ? (
              <div className="mt-5 divide-y divide-slate-100">
                {recentChats.map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => openChat(chat.id)}
                    className="flex w-full min-w-0 items-center gap-3 py-4 text-left transition hover:text-blue-700"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <MessageSquareText size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {chat.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {chat.messages.length} messages
                      </p>
                    </div>
                    <ArrowRight size={17} className="shrink-0 text-slate-400" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                <MessageSquareText className="mx-auto text-slate-400" />
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  No study chats yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Ask your first question to begin your study activity.
                </p>
              </div>
            )}
          </section>

          <div className="grid gap-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                <BookOpenCheck size={21} />
              </div>
              <h2 className="mt-4 font-bold text-slate-900">Subjects</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Subjects from your uploaded study library will appear here as
                your ebook collection grows.
              </p>
            </section>

            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
              <ShieldCheck size={24} className="text-emerald-700" />
              <h2 className="mt-4 font-bold text-emerald-950">
                Ebook-grounded AI
              </h2>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                AssamWork AI answers only from uploaded ebooks and shows
                available sources with every answer.
              </p>
            </section>
          </div>
        </div>

        <section className="mt-8">
          <div>
            <p className="text-lg font-bold text-slate-900">Coming soon</p>
            <p className="mt-1 text-sm text-slate-500">
              More ways to prepare, revise, and track progress.
            </p>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {comingSoon.map(({ title, description, icon: Icon, color }) => (
              <article
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
                  <Icon size={21} />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <h3 className="font-bold text-slate-900">{title}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Soon
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
