import { useMemo } from "react";

import useChatStore from "../../../store/chatStore";

export default function useMessages() {
  const chats = useChatStore((state) => state.chats);
  const activeChatId = useChatStore((state) => state.activeChatId);

  const activeChat = useMemo(() => {
    return chats.find(
      (chat) => chat.id === activeChatId
    );
  }, [chats, activeChatId]);

  return {
    activeChat,
    messages: activeChat?.messages || [],
  };
}