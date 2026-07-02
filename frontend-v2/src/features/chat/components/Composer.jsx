import { useEffect, useRef, useState } from "react";
import { BookOpenCheck, Paperclip, SendHorizontal } from "lucide-react";

import useChatStore from "../../../store/chatStore";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getFriendlyChatError(error) {
  if (error?.message === "Unable to get an answer right now.") {
    return error.message;
  }

  return "Unable to reach AssamWork AI. Please check your connection and try again.";
}

export default function Composer({
  prompt,
  setPrompt,
}) {
  const textareaRef = useRef(null);
  const sendingRef = useRef(false);
  const attachmentTimerRef = useRef(null);
  const [attachmentMessage, setAttachmentMessage] = useState("");

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

  useEffect(() => {
    return () => {
      if (attachmentTimerRef.current) {
        window.clearTimeout(attachmentTimerRef.current);
      }
    };
  }, []);

  function showAttachmentMessage() {
    setAttachmentMessage("Image and file attachments are coming soon.");

    if (attachmentTimerRef.current) {
      window.clearTimeout(attachmentTimerRef.current);
    }

    attachmentTimerRef.current = window.setTimeout(
      () => setAttachmentMessage(""),
      2600
    );
  }

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
        `${API_URL}/ask`,
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
        throw new Error("Unable to get an answer right now.");
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
      if (targetChatId) {
        await addAssistantMessage(
          {
            content: getFriendlyChatError(err),
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

          <button
            type="button"
            onClick={showAttachmentMessage}
            aria-label="Image and file attachments are coming soon"
            aria-describedby="attachment-helper"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 sm:rounded-2xl"
          >
            <Paperclip size={19} />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            aria-label="Ask from your uploaded ebooks"
            aria-describedby="chat-input-helper"
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

        {attachmentMessage && (
          <p
            id="attachment-helper"
            role="status"
            className="mt-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-center text-xs font-medium text-blue-700"
          >
            {attachmentMessage}
          </p>
        )}

        <p
          id="chat-input-helper"
          className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500 sm:text-xs"
        >
          <BookOpenCheck size={13} className="text-emerald-600" />
          Answers use uploaded ebooks only. Verify important information.
        </p>
      </div>
    </div>
  );
}
