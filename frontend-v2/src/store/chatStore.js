import { create } from "zustand";

const createChat = () => ({
  id: crypto.randomUUID(),
  title: "New Chat",
  createdAt: new Date().toISOString(),
  messages: [],
});

const firstChat = createChat();

const useChatStore = create((set) => ({
  chats: [firstChat],

  activeChatId: firstChat.id,

  isLoading: false,

  createChat() {
    set((state) => {
      const chat = createChat();

      return {
        chats: [chat, ...state.chats],
        activeChatId: chat.id,
      };
    });
  },

  setActiveChat(id) {
    set({
      activeChatId: id,
    });
  },

  renameChat(chatId, title) {
    const nextTitle = title.trim();

    if (!nextTitle) return;

    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              title: nextTitle,
            }
          : chat
      ),
    }));
  },

  deleteChat(chatId) {
    set((state) => {
      const remainingChats = state.chats.filter(
        (chat) => chat.id !== chatId
      );

      if (remainingChats.length === 0) {
        const chat = createChat();

        return {
          chats: [chat],
          activeChatId: chat.id,
        };
      }

      return {
        chats: remainingChats,
        activeChatId:
          state.activeChatId === chatId
            ? remainingChats[0].id
            : state.activeChatId,
      };
    });
  },

  addUserMessage(content) {
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== state.activeChatId) return chat;

        return {
          ...chat,

          title:
            chat.messages.length === 0
              ? content.slice(0, 40)
              : chat.title,

          messages: [
            ...chat.messages,
            {
              id: crypto.randomUUID(),
              role: "user",
              content,
            },
          ],
        };
      }),
    }));
  },

  addAssistantMessage(message) {
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== state.activeChatId) return chat;

        return {
          ...chat,

          messages: [
            ...chat.messages,

            {
              id: crypto.randomUUID(),
              role: "assistant",

              content:
                typeof message === "string"
                  ? message
                  : message.content,

              sources:
                typeof message === "string"
                  ? []
                  : message.sources || [],
            },
          ],
        };
      }),
    }));
  },

  setLoading(value) {
    set({
      isLoading: value,
    });
  },
}));

export default useChatStore;
