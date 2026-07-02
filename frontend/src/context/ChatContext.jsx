import { createContext, useEffect, useState } from "react";

export const ChatContext = createContext();

const STORAGE_KEY = "assamwork-ai-chats";

export default function ChatProvider({ children }) {
  const [conversations, setConversations] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      return JSON.parse(saved);
    }

    return [
      {
        id: Date.now(),
        title: "New Chat",
        messages: [],
      },
    ];
  });

  const [activeChat, setActiveChat] = useState(() => {
    const saved = localStorage.getItem("assamwork-active-chat");

    return saved ? Number(saved) : conversations[0].id;
  });

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(conversations)
    );
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem(
      "assamwork-active-chat",
      activeChat
    );
  }, [activeChat]);

  const currentChat =
    conversations.find((c) => c.id === activeChat) ||
    conversations[0];

  function addMessage(role, content) {
    setConversations((prev) =>
      prev.map((chat) => {
        if (chat.id !== activeChat) return chat;

        const messages = [
          ...chat.messages,
          {
            id: crypto.randomUUID(),
            role,
            content,
          },
        ];

        return {
          ...chat,
          messages,
          title:
            chat.messages.length === 0
              ? content.substring(0, 40)
              : chat.title,
        };
      })
    );
  }

  function createChat() {
    const id = Date.now();

    const chat = {
      id,
      title: "New Chat",
      messages: [],
    };

    setConversations((prev) => [chat, ...prev]);

    setActiveChat(id);
  }

  function deleteChat(id) {
    if (conversations.length === 1) return;

    const remaining = conversations.filter(
      (chat) => chat.id !== id
    );

    setConversations(remaining);

    setActiveChat(remaining[0].id);
  }

  function clearCurrentChat() {
    setConversations((prev) =>
      prev.map((chat) =>
        chat.id === activeChat
          ? {
              ...chat,
              title: "New Chat",
              messages: [],
            }
          : chat
      )
    );
  }

  return (
    <ChatContext.Provider
      value={{
        conversations,
        currentChat,
        activeChat,
        setActiveChat,
        addMessage,
        createChat,
        deleteChat,
        clearCurrentChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}