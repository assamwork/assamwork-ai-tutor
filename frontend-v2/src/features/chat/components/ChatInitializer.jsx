import { useEffect } from "react";

import useAuthStore from "../../../store/authStore";
import useChatStore from "../../../store/chatStore";

export default function ChatInitializer({ children }) {
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!user) return;

    // Cloud initialization will be added later.
  }, [user]);

  return children;
}