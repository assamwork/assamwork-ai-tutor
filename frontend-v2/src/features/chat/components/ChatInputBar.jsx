import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpenCheck,
  LoaderCircle,
  Mic,
  Paperclip,
  SendHorizontal,
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
}) {
  const textareaRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [value]);

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
  const frameClassName = isCompact
    ? "chat-input-bar flex min-w-0 items-end gap-1 rounded-[1.35rem] border border-slate-200 bg-white p-1 shadow-lg shadow-slate-200/70 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 sm:gap-2 sm:rounded-3xl sm:p-2"
    : "chat-input-bar flex min-w-0 items-end gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-200/70 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 sm:gap-3 sm:rounded-3xl sm:p-3";
  const controlClassName = isCompact
    ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 sm:h-10 sm:w-10 sm:rounded-2xl"
    : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 sm:h-11 sm:w-11 sm:rounded-2xl";
  const sendClassName = isCompact
    ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none sm:h-10 sm:w-10 sm:rounded-2xl"
    : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none sm:h-11 sm:w-11 sm:rounded-2xl";
  const textareaClassName = isCompact
    ? "max-h-[4.5rem] min-h-9 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-1.5 py-1.5 text-[15px] leading-6 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed sm:min-h-10 sm:px-2 sm:py-2"
    : "max-h-[5.75rem] min-h-10 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-1.5 py-2 text-[15px] leading-6 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed sm:min-h-11 sm:max-h-40 sm:px-3 sm:py-2.5 sm:text-base";
  const iconSize = isCompact ? 15 : 16;
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

        <textarea
          ref={textareaRef}
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
          onClick={() => showNotice("Voice input is coming soon.")}
          aria-label="Voice input is coming soon"
          aria-describedby="composer-notice"
          className={controlClassName}
        >
          <Mic size={iconSize} />
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading || !value.trim()}
          aria-label={isLoading ? "Waiting for answer" : "Send message"}
          className={sendClassName}
        >
          {isLoading ? (
            <LoaderCircle size={sendIconSize} className="animate-spin" />
          ) : (
            <SendIcon size={sendIconSize} />
          )}
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
