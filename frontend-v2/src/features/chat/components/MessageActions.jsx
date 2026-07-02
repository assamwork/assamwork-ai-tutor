import { Copy, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function MessageActions({ content }) {
  const [copyStatus, setCopyStatus] = useState("idle");
  const resetTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function copyMessage() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard is unavailable.");
      }

      await navigator.clipboard.writeText(content);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }

    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = window.setTimeout(
      () => setCopyStatus("idle"),
      2000
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2" aria-live="polite">

      <button
        onClick={copyMessage}
        type="button"
        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
      >
        {copyStatus === "copied" ? <Check size={15} /> : <Copy size={15} />}

        {copyStatus === "copied"
          ? "Copied"
          : copyStatus === "failed"
          ? "Copy failed"
          : "Copy answer"}

      </button>

    </div>
  );
}
