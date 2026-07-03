import { useRef } from "react";
import useChatStore from "../../../store/chatStore";
import ChatInputBar from "./ChatInputBar";

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
  const sendingRef = useRef(false);

  const {
    addUserMessage,
    addAssistantMessage,
    createChat,
    activeChatId,
    isLoading,
    setLoading,
  } = useChatStore();

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
          revision: data.revision ?? "",
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

  return (
    <div className="composer-shell relative z-20 flex-none shrink-0 border-t px-2.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:px-6 sm:py-3">
      <div className="mx-auto max-w-3xl">
        <ChatInputBar
          value={prompt}
          setValue={setPrompt}
          onSubmit={sendMessage}
          isLoading={isLoading}
          placeholder="Ask from AssamWork study materials..."
          ariaLabel="Ask from AssamWork study materials"
          helperText="Answers are grounded in AssamWork study materials. Verify important information."
        />
      </div>
    </div>
  );
}
