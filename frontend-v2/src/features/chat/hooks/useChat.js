import useAuthStore from "../../../store/authStore";
import useChatStore from "../../../store/chatStore";

export default function useChat() {
  const user = useAuthStore((state) => state.user);

  const {
    chats,
    activeChatId,
    isLoading,
    createChat,
    setActiveChat,
    addUserMessage,
    addAssistantMessage,
    setLoading,
  } = useChatStore();

  return {
    user,
    chats,
    activeChatId,
    loading: isLoading,

    createNewChat: createChat,

    openChat: setActiveChat,

    addUserMessage,

    addAssistantMessage,

    setLoading,
  };
}