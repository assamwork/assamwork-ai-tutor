import { useEffect, useRef } from "react";
import { BookOpenCheck, SendHorizontal } from "lucide-react";

import useChatStore from "../../../store/chatStore";

export default function Composer({
  prompt,
  setPrompt,
}) {
  const textareaRef = useRef(null);
  const sendingRef = useRef(false);

  const {
    addUserMessage,
    addAssistantMessage,
    createChat,
    activeChatId,
    isLoading,
    setLoading,
  } = useChatStore();

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [prompt]);

  async function sendMessage() {
    if (!prompt.trim() || isLoading || sendingRef.current) return;

    const question = prompt.trim();
    sendingRef.current = true;
    let targetChatId = activeChatId;

    try {
      targetChatId = targetChatId || (await createChat());

      if (!targetChatId) return;

      setLoading(true, targetChatId);

      const savedUserMessageId = await addUserMessage(
        question,
        targetChatId
      );

      if (!savedUserMessageId) return;

      setPrompt("");

      const response = await fetch(
        "http://127.0.0.1:8000/ask",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();

      await addAssistantMessage(
        {
          content:
            data.answer ??
            "No answer returned.",
          sources: data.sources ?? [],
        },
        targetChatId
      );
    } catch (err) {
      console.error(err);

      if (targetChatId) {
        await addAssistantMessage(
          {
            content:
              "Unable to connect to AssamWork AI backend.",
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

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-6 sm:py-4">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-lg shadow-slate-200/70 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 sm:gap-3 sm:rounded-3xl sm:p-3">

          <textarea
            ref={textareaRef}
            rows={1}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            aria-label="Ask from your uploaded ebooks"
            placeholder="Ask from your uploaded ebooks..."
            className="max-h-40 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2.5 text-sm leading-6 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed sm:px-3 sm:text-base"
          />

          <button
            type="button"
            onClick={sendMessage}
            disabled={isLoading || !prompt.trim()}
            aria-label={isLoading ? "Waiting for answer" : "Send message"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:rounded-2xl"
          >
            <SendHorizontal size={20} />
          </button>

        </div>

        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500 sm:text-xs">
          <BookOpenCheck size={13} className="text-emerald-600" />
          Answers use uploaded ebooks only. Verify important information.
        </p>
      </div>
    </div>
  );
}
