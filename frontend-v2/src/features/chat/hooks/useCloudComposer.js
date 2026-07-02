import useChatActions from "./useChatActions";

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