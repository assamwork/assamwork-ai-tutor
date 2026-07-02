import useChatActions from "./useChatActions";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function useCloudComposer() {
  const {
    activeChat,
    sendUserMessage,
    sendAssistantMessage,
  } = useChatActions();

  async function ask(question) {
    if (!activeChat) return;

    await sendUserMessage(question);

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

    const data = await response.json();

    await sendAssistantMessage(
      data.answer ??
        "No answer returned."
    );
  }

  return {
    ask,
  };
}
