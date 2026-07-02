import { useMemo } from "react";

import useChatStore from "../../../store/chatStore";

export default function useActiveChat() {
  const chats = useChatStore((state) => state.chats);
  const activeChatId = useChatStore((state) => state.activeChatId);

  return useMemo(() => {
    return (
      chats.find((chat) => chat.id === activeChatId) ||
      null
    );
  }, [chats, activeChatId]);
}