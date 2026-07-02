import useChat from "./useChat";
import useActiveChat from "./useActiveChat";

export default function useChatActions() {
  const activeChat = useActiveChat();

  const {
    createNewChat,
    openChat,
    addUserMessage,
    addAssistantMessage,
  } = useChat();

  return {
    activeChat,

    createNewChat,

    openChat,

    sendUserMessage(content) {
      if (!activeChat) return;

      return addUserMessage(
        activeChat.id,
        content
      );
    },

    sendAssistantMessage(content) {
      if (!activeChat) return;

      return addAssistantMessage(
        activeChat.id,
        content
      );
    },
  };
}