import { Copy, Check } from "lucide-react";
import { useState } from "react";

export default function MessageActions({ content }) {
  const [copyStatus, setCopyStatus] = useState("idle");

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }

    window.setTimeout(() => setCopyStatus("idle"), 2000);
  }

  return (
    <div className="mt-3 flex items-center gap-2">

      <button
        onClick={copyMessage}
        type="button"
        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
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
