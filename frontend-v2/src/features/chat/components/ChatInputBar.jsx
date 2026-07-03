import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpenCheck,
  Mic,
  Paperclip,
  SendHorizontal,
  Square,
} from "lucide-react";

export default function ChatInputBar({
  value,
  setValue,
  onSubmit,
  isLoading = false,
  placeholder = "Ask AssamWork AI",
  ariaLabel = "Ask AssamWork AI",
  helperText,
  sendIcon = "send",
  size = "default",
  onStop,
}) {
  const noticeTimerRef = useRef(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  function showNotice(message) {
    setNotice(message);

    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }

    noticeTimerRef.current = window.setTimeout(() => setNotice(""), 2600);
  }

  function handleSubmit() {
    if (!value.trim() || isLoading) return;
    onSubmit();
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  const SendIcon = sendIcon === "arrow" ? ArrowUp : SendHorizontal;
  const isCompact = size === "compact";
  const frameClassName =
    "chat-input-bar grid min-w-0 grid-cols-[minmax(2.75rem,1fr)_minmax(0,3.4fr)_minmax(2.75rem,1fr)] items-center gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)_minmax(0,1fr)] sm:gap-2";
  const controlClassName = isCompact
    ? "chat-input-button mx-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-slate-500 transition hover:text-slate-700"
    : "chat-input-button mx-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-slate-500 transition hover:text-slate-700 sm:h-11 sm:w-11";
  const sendClassName = isCompact
    ? "chat-send-button flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
    : "chat-send-button flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none sm:h-[2.125rem] sm:w-[2.125rem]";
  const textareaClassName = isCompact
    ? "chat-composer-input h-9 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-0.5 py-1.5 text-[14px] leading-6 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed sm:text-[15px]"
    : "chat-composer-input h-9 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-0.5 py-1.5 text-[14px] leading-6 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed sm:text-[15px]";
  const iconSize = isCompact ? 15 : 17;
  const sendIconSize = isCompact ? 16 : 17;

  return (
    <div className="relative">
      {notice && (
        <p
          id="composer-notice"
          role="status"
          className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-center text-xs font-medium text-blue-700 shadow-sm"
        >
          {notice}
        </p>
      )}

      <div className={frameClassName}>
        <button
          type="button"
          onClick={() =>
            showNotice("Image and PDF attachments are coming soon.")
          }
          aria-label="Image and PDF attachments are coming soon"
          aria-describedby="composer-notice"
          className={controlClassName}
        >
          <Paperclip size={iconSize} />
        </button>

        <div className="chat-composer-pill flex h-11 min-w-0 items-center gap-1.5 rounded-full border px-2.5 shadow-lg transition sm:h-12 sm:px-3">
          <textarea
            rows={1}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            aria-label={ariaLabel}
            aria-describedby={helperText ? "chat-input-helper" : undefined}
            placeholder={placeholder}
            className={textareaClassName}
          />

          <button
            type="button"
            onClick={isLoading ? onStop : handleSubmit}
            disabled={!isLoading && !value.trim()}
            aria-label={isLoading ? "Stop generating" : "Send message"}
            className={sendClassName}
          >
            {isLoading ? (
              <Square size={13} fill="currentColor" />
            ) : (
              <SendIcon size={sendIconSize} />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => showNotice("Voice input is coming soon.")}
          aria-label="Voice input is coming soon"
          aria-describedby="composer-notice"
          className={controlClassName}
        >
          <Mic size={iconSize} />
        </button>
      </div>

      {helperText && (
        <p
          id="chat-input-helper"
          className="mt-2 hidden items-center justify-center gap-1.5 text-center text-[11px] text-slate-500 sm:flex sm:text-xs"
        >
          <BookOpenCheck size={13} className="text-emerald-600" />
          {helperText}
        </p>
      )}
    </div>
  );
}
