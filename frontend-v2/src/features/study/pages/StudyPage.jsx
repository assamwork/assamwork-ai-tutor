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
    <div className="flex h-full max-w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,#eef5ff_0%,#f8fafc_44%,#ffffff_100%)]">
      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-32 pt-20 sm:px-6 sm:pb-36 sm:pt-20 lg:px-8 lg:pt-10">
        <div className="mx-auto flex min-h-full max-w-4xl flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-xl shadow-blue-200/70 sm:h-14 sm:w-14">
            <Sparkles size={24} />
          </div>

          <p className="mt-4 text-xs font-bold uppercase tracking-[0.24em] text-blue-600">
            AssamWork AI
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            <span className="block text-slate-700">{greeting}</span>
            <span className="block">{learnerName}</span>
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
            Ready to study today?
          </p>

          <div className="mt-8 grid w-full max-w-2xl grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
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
                className="min-h-12 rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 sm:text-sm"
              >
                {item}
              </button>
            ))}
          </div>

          <a
            href="https://www.assamwork.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-blue-100 bg-white/80 px-4 py-3 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/70"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <ShoppingBag size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">
                AssamWork Study Materials
              </p>
              <p className="truncate text-xs text-slate-500">
                Exam-ready PDFs, PYQs, mock tests and revision notes.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">
              Explore materials →
            </span>
          </a>
        </div>
      </main>

      <section className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
        <div className="mx-auto max-w-3xl">
          <ChatInputBar
            value={prompt}
            setValue={setPrompt}
            onSubmit={sendFromHome}
            isLoading={isLoading}
            placeholder="Ask AssamWork AI"
            ariaLabel="Ask AssamWork AI"
            helperText="Answers are grounded in AssamWork study materials."
            sendIcon="arrow"
          />
        </div>
      </section>
    </div>
  );
}
