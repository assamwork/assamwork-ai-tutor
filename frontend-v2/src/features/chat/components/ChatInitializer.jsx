import { useEffect } from "react";

import useAuthStore from "../../../store/authStore";
import useChatStore from "../../../store/chatStore";

export default function ChatInitializer({ children }) {
  const user = useAuthStore((state) => state.user);
  const initializeChats = useChatStore(
    (state) => state.initializeChats
  );
  const resetChats = useChatStore((state) => state.resetChats);

  useEffect(() => {
    if (!user) {
      resetChats();
      return;
    }

    void initializeChats(user.uid);
  }, [user, initializeChats, resetChats]);

  return children;
}
