import { useRef, useState } from "react";
import { ShoppingBag, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

import useAuthStore from "../../../store/authStore";
import useChatStore from "../../../store/chatStore";
import ChatInputBar from "../../chat/components/ChatInputBar";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getFriendlyChatError(error) {
  if (error?.message === "Unable to get an answer right now.") {
    return error.message;
  }

  return "Unable to reach AssamWork AI. Please check your connection and try again.";
}

function getTimeAwareGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good Morning,";
  if (hour < 17) return "Good Afternoon,";
  return "Good Evening,";
}

export default function StudyPage() {
  const navigate = useNavigate();
  const sendingRef = useRef(false);
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const {
    addUserMessage,
    addAssistantMessage,
    createChat,
    isLoading,
    setLoading,
  } = useChatStore();
  const [prompt, setPrompt] = useState("");

  const learnerName =
    profile?.name?.trim().split(/\s+/)[0] ||
    user?.displayName?.trim().split(/\s+/)[0] ||
    user?.email?.split("@")[0] ||
    "AssamWork learner";

  const greeting = getTimeAwareGreeting();

  async function sendFromHome() {
    if (!prompt.trim() || isLoading || sendingRef.current) return;

    const question = prompt.trim();
    sendingRef.current = true;
    let targetChatId = null;

    try {
      targetChatId = await createChat();

      if (!targetChatId) return;

      setLoading(true, targetChatId);

      const savedUserMessageId = await addUserMessage(
        question,
        targetChatId
      );

      if (!savedUserMessageId) return;

      setPrompt("");
      navigate("/chat");

      const response = await fetch(`${API_URL}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to get an answer right now.");
      }

      const data = await response.json();

      await addAssistantMessage(
        {
          content: data.answer ?? "No answer returned.",
          sources: data.sources ?? [],
        },
        targetChatId
      );
    } catch (error) {
      if (targetChatId) {
        await addAssistantMessage(
          {
            content: getFriendlyChatError(error),
            sources: [],
          },
          targetChatId
        );
      }
    } finally {
      sendingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="home-shell flex h-full max-w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,#eef5ff_0%,#f8fafc_44%,#ffffff_100%)]">
      <main className="min-h-0 flex-1 overflow-hidden px-4 pb-4 pt-16 sm:px-6 sm:pb-6 sm:pt-20 lg:px-8 lg:pt-10">
        <div className="mx-auto flex min-h-full max-w-4xl flex-col items-center justify-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-200/70 sm:h-14 sm:w-14 sm:rounded-3xl">
            <Sparkles size={22} />
          </div>

          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.24em] text-blue-600 sm:mt-4 sm:text-xs">
            AssamWork AI
          </p>

          <h1 className="home-heading mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:mt-3 sm:text-5xl">
            <span className="block text-slate-700">{greeting}</span>
            <span className="block break-words">{learnerName}</span>
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:mt-3 sm:text-base">
            Ready to study today?
          </p>

          <div className="mt-6 grid w-full max-w-2xl grid-cols-2 gap-2 sm:mt-8 sm:grid-cols-4 sm:gap-3">
            {[
              "📘 Explain a topic",
              "📝 Generate MCQs",
              "📄 Summarize chapter",
              "🎯 Practice PYQs",
            ].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPrompt(item)}
                className="home-chip min-h-11 rounded-2xl border border-slate-200 bg-white/80 px-2.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 sm:min-h-12 sm:px-3 sm:py-3 sm:text-sm"
              >
                {item}
              </button>
            ))}
          </div>

          <a
            href="https://www.assamwork.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="home-material-card mt-4 grid w-full max-w-2xl grid-cols-[2.25rem_minmax(0,1fr)] gap-3 rounded-2xl border border-blue-100 bg-white/80 px-3 py-2.5 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/70 sm:mt-5 sm:flex sm:items-center sm:px-4 sm:py-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white sm:h-10 sm:w-10">
              <ShoppingBag size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-5 text-slate-900">
                AssamWork Study Materials
              </p>
              <p className="text-xs leading-4 text-slate-500">
                Exam-ready PDFs, PYQs, mock tests and revision notes.
              </p>
            </div>
            <span className="col-span-2 inline-flex min-h-8 w-full shrink-0 items-center justify-center rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white sm:min-h-9 sm:w-auto">
              Explore materials →
            </span>
          </a>
        </div>
      </main>

      <section className="home-composer shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5">
        <div className="mx-auto max-w-2xl">
          <ChatInputBar
            value={prompt}
            setValue={setPrompt}
            onSubmit={sendFromHome}
            isLoading={isLoading}
            placeholder="Ask AssamWork AI"
            ariaLabel="Ask AssamWork AI"
            sendIcon="arrow"
            size="compact"
          />
        </div>
      </section>
    </div>
  );
}
