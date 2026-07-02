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
        content,
        activeChat.id
      );
    },

    sendAssistantMessage(content) {
      if (!activeChat) return;

      return addAssistantMessage(
        content,
        activeChat.id
      );
    },
  };
}
