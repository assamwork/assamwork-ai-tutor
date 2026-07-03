import { create } from "zustand";

import chatRepository from "../features/chat/repository/chatRepository";

const DEFAULT_CHAT_TITLE = "New AI Tutor Chat";

function toLocalDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeChat(chat) {
  return {
    ...chat,
    title: chat.title?.trim() || DEFAULT_CHAT_TITLE,
    createdAt: toLocalDate(chat.createdAt),
    updatedAt: toLocalDate(chat.updatedAt),
    messageCount:
      typeof chat.messageCount === "number" ? chat.messageCount : 0,
    messages: [],
    messagesLoaded: false,
  };
}

function normalizeMessage(message) {
  return {
    ...message,
    role: message.role || "assistant",
    content: message.content || "",
    revision: message.revision || "",
    sources: normalizeSources(
      Array.isArray(message.sources) ? message.sources : []
    ),
    createdAt: toLocalDate(message.createdAt),
  };
}

function normalizeSources(rawSources = []) {
  return rawSources.map((source) => {
    const pdfPageIndex =
      source?.pdf_page_index ??
      source?.pdfPageIndex ??
      source?.page_index ??
      source?.pageIndex ??
      null;
    const legacyPage =
      source?.page ??
      source?.pageNumber ??
      source?.page_number ??
      source?.source_page ??
      source?.pdf_page ??
      source?.pageNo ??
      source?.page_no ??
      null;
    const displayPage =
      source?.display_page ??
      source?.displayPage ??
      source?.source_page_label ??
      legacyPage ??
      (pdfPageIndex !== null && pdfPageIndex !== undefined
        ? Number(pdfPageIndex) + 1
        : null);

    return {
      subject: source?.subject ?? null,
      book: source?.book ?? source?.bookName ?? source?.filename ?? null,
      filename: source?.filename ?? source?.book ?? source?.bookName ?? null,
      chunk_id: source?.chunk_id ?? source?.chunkId ?? null,
      pdf_page_index: pdfPageIndex,
      display_page: displayPage,
      source_page_label: source?.source_page_label ?? source?.sourcePageLabel ?? "",
    };
  });
}

const useChatStore = create((set, get) => ({
  uid: null,
  initializedUid: null,
  chats: [],
  activeChatId: null,
  isLoading: false,
  loadingChatId: null,
  chatsLoading: false,
  messageLoadingIds: {},
  error: null,

  clearError() {
    set({
      error: null,
    });
  },

  async retryChats() {
    const { uid } = get();

    if (!uid) return;

    set({
      initializedUid: null,
    });

    await get().initializeChats(uid);
  },

  resetChats() {
    set({
      uid: null,
      initializedUid: null,
      chats: [],
      activeChatId: null,
      isLoading: false,
      loadingChatId: null,
      chatsLoading: false,
      messageLoadingIds: {},
      error: null,
    });
  },

  async initializeChats(uid) {
    if (!uid) {
      get().resetChats();
      return;
    }

    if (get().initializedUid === uid) return;

    set({
      uid,
      initializedUid: uid,
      chats: [],
      activeChatId: null,
      chatsLoading: true,
      messageLoadingIds: {},
      error: null,
    });

    try {
      const cloudChats = await chatRepository.getChats(uid);

      if (get().uid !== uid) return;

      const chats = cloudChats.map(normalizeChat);
      const activeChatId = chats[0]?.id ?? null;

      set({
        chats,
        activeChatId,
        chatsLoading: false,
      });

      if (activeChatId) {
        await get().loadMessages(activeChatId);
      }
    } catch (error) {
      console.error("Unable to load chats:", error);

      if (get().uid !== uid) return;

      set({
        chatsLoading: false,
        initializedUid: null,
        error: "Unable to load cloud chats. Please try again.",
      });
    }
  },

  async createChat() {
    const { uid } = get();

    if (!uid) {
      set({
        error: "Sign in is required to create a chat.",
      });
      return null;
    }

    try {
      const id = await chatRepository.createChat(
        uid,
        DEFAULT_CHAT_TITLE
      );
      const now = new Date().toISOString();
      const chat = {
        id,
        title: DEFAULT_CHAT_TITLE,
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
        messages: [],
        messagesLoaded: true,
      };

      set((state) => ({
        chats: [chat, ...state.chats],
        activeChatId: id,
        error: null,
      }));

      return id;
    } catch (error) {
      console.error("Unable to create chat:", error);
      set({
        error: "Unable to create a cloud chat. Please try again.",
      });
      return null;
    }
  },

  setActiveChat(id) {
    const chat = get().chats.find((item) => item.id === id);

    if (!chat) return;

    set({
      activeChatId: id,
    });

    if (!chat.messagesLoaded) {
      void get().loadMessages(id);
    }
  },

  async loadMessages(chatId) {
    const { uid, messageLoadingIds } = get();
    const chat = get().chats.find((item) => item.id === chatId);

    if (
      !uid ||
      !chat ||
      chat.messagesLoaded ||
      messageLoadingIds[chatId]
    ) {
      return;
    }

    set((state) => ({
      messageLoadingIds: {
        ...state.messageLoadingIds,
        [chatId]: true,
      },
    }));

    try {
      const cloudMessages = await chatRepository.getMessages(
        uid,
        chatId
      );

      if (get().uid !== uid) return;

      set((state) => ({
        chats: state.chats.map((item) =>
          item.id === chatId
            ? {
                ...item,
                messages: cloudMessages.map(normalizeMessage),
                messageCount: Math.max(
                  item.messageCount,
                  cloudMessages.length
                ),
                messagesLoaded: true,
              }
            : item
        ),
        messageLoadingIds: {
          ...state.messageLoadingIds,
          [chatId]: false,
        },
      }));
    } catch (error) {
      console.error("Unable to load messages:", error);

      if (get().uid !== uid) return;

      set((state) => ({
        messageLoadingIds: {
          ...state.messageLoadingIds,
          [chatId]: false,
        },
        error: "Unable to load messages for this chat.",
      }));
    }
  },

  async renameChat(chatId, title) {
    const nextTitle = title.trim();
    const { uid, chats } = get();
    const currentChat = chats.find((chat) => chat.id === chatId);

    if (!uid || !nextTitle || !currentChat) return false;

    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              title: nextTitle,
              updatedAt: new Date().toISOString(),
            }
          : chat
      ),
      error: null,
    }));

    try {
      await chatRepository.renameChat(uid, chatId, nextTitle);
      return true;
    } catch (error) {
      console.error("Unable to rename chat:", error);
      set((state) => ({
        chats: state.chats.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                title: currentChat.title,
                updatedAt: currentChat.updatedAt,
              }
            : chat
        ),
        error: "Unable to rename this chat. The previous title was restored.",
      }));
      return false;
    }
  },

  async deleteChat(chatId) {
    const { uid, chats, activeChatId } = get();
    const deletedIndex = chats.findIndex((chat) => chat.id === chatId);

    if (!uid || deletedIndex === -1) return false;

    const deletedChat = chats[deletedIndex];
    const remainingChats = chats.filter((chat) => chat.id !== chatId);
    const nextActiveChatId =
      activeChatId === chatId
        ? remainingChats[0]?.id ?? null
        : activeChatId;

    set({
      chats: remainingChats,
      activeChatId: nextActiveChatId,
      error: null,
    });

    if (nextActiveChatId) {
      const nextChat = remainingChats.find(
        (chat) => chat.id === nextActiveChatId
      );

      if (nextChat && !nextChat.messagesLoaded) {
        void get().loadMessages(nextActiveChatId);
      }
    }

    try {
      await chatRepository.deleteChat(uid, chatId);
      return true;
    } catch (error) {
      console.error("Unable to delete chat:", error);

      set((state) => {
        const restoredChats = [...state.chats];
        restoredChats.splice(deletedIndex, 0, deletedChat);

        return {
          chats: restoredChats,
          activeChatId,
          error: "Unable to delete this chat. It was restored.",
        };
      });

      return false;
    }
  },

  async addUserMessage(content, chatId = get().activeChatId) {
    const cleanContent = content.trim();
    const { uid } = get();
    const chat = get().chats.find((item) => item.id === chatId);

    if (!uid || !chat || !cleanContent) return null;

    const isFirstMessage = chat.messageCount === 0;
    const nextTitle =
      isFirstMessage && chat.title === DEFAULT_CHAT_TITLE
        ? cleanContent.slice(0, 40).trim()
        : null;
    const message = {
      id: crypto.randomUUID(),
      role: "user",
      content: cleanContent,
      sources: [],
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      chats: state.chats.map((item) =>
        item.id === chatId
          ? {
              ...item,
              title: nextTitle || item.title,
              updatedAt: message.createdAt,
              messageCount: item.messageCount + 1,
              messages: [...item.messages, message],
              messagesLoaded: true,
            }
          : item
      ),
      error: null,
    }));

    try {
      const messageId = await chatRepository.addMessage(
        uid,
        chatId,
        "user",
        cleanContent,
        [],
        nextTitle
      );

      set((state) => ({
        chats: state.chats.map((item) =>
          item.id === chatId
            ? {
                ...item,
                messages: item.messages.map((storedMessage) =>
                  storedMessage.id === message.id
                    ? {
                        ...storedMessage,
                        id: messageId,
                      }
                    : storedMessage
                ),
              }
            : item
        ),
      }));

      return messageId;
    } catch (error) {
      console.error("Unable to save user message:", error);
      set((state) => ({
        chats: state.chats.map((item) =>
          item.id === chatId
            ? {
                ...item,
                title: chat.title,
                updatedAt: chat.updatedAt,
                messageCount: Math.max(0, item.messageCount - 1),
                messages: item.messages.filter(
                  (storedMessage) => storedMessage.id !== message.id
                ),
              }
            : item
        ),
        error: "Your message could not be saved to the cloud.",
      }));
      return null;
    }
  },

  async addAssistantMessage(
    assistantMessage,
    chatId = get().activeChatId
  ) {
    const { uid } = get();
    const chat = get().chats.find((item) => item.id === chatId);
    const content =
      typeof assistantMessage === "string"
        ? assistantMessage
        : assistantMessage.content;
    const revision =
      typeof assistantMessage === "string"
        ? ""
        : typeof assistantMessage.revision === "string"
        ? assistantMessage.revision
        : "";
    const rawSources =
      typeof assistantMessage === "string"
        ? []
        : Array.isArray(assistantMessage.sources)
        ? assistantMessage.sources
        : [];
    const sources = normalizeSources(rawSources);

    if (!uid || !chat || !content) return null;

    const message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      revision,
      sources,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      chats: state.chats.map((item) =>
        item.id === chatId
          ? {
              ...item,
              updatedAt: message.createdAt,
              messageCount: item.messageCount + 1,
              messages: [...item.messages, message],
              messagesLoaded: true,
            }
          : item
      ),
    }));

    try {
      const messageId = await chatRepository.addMessage(
        uid,
        chatId,
        "assistant",
        content,
        sources,
        null,
        revision
      );

      set((state) => ({
        chats: state.chats.map((item) =>
          item.id === chatId
            ? {
                ...item,
                messages: item.messages.map((storedMessage) =>
                  storedMessage.id === message.id
                    ? {
                        ...storedMessage,
                        id: messageId,
                      }
                    : storedMessage
                ),
              }
            : item
        ),
      }));

      return messageId;
    } catch (error) {
      console.error("Unable to save assistant message:", error);
      set({
        error: "The answer is visible but could not be saved to the cloud.",
      });
      return null;
    }
  },

  startAssistantDraft(chatId = get().activeChatId) {
    const chat = get().chats.find((item) => item.id === chatId);

    if (!chat) return null;

    const message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      revision: "",
      sources: [],
      isStreaming: true,
      localOnly: true,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      chats: state.chats.map((item) =>
        item.id === chatId
          ? {
              ...item,
              updatedAt: message.createdAt,
              messageCount: item.messageCount + 1,
              messages: [...item.messages, message],
              messagesLoaded: true,
            }
          : item
      ),
    }));

    return message.id;
  },

  updateAssistantDraft(chatId, messageId, updates = {}) {
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: chat.messages.map((message) =>
                message.id === messageId
                  ? {
                      ...message,
                      ...updates,
                    }
                  : message
              ),
            }
          : chat
      ),
    }));
  },

  discardAssistantDraft(chatId, messageId) {
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messageCount: chat.messages.some(
                (message) =>
                  message.id === messageId && message.localOnly
              )
                ? Math.max(0, chat.messageCount - 1)
                : chat.messageCount,
              messages: chat.messages.filter(
                (message) =>
                  message.id !== messageId || !message.localOnly
              ),
            }
          : chat
      ),
    }));
  },

  async finalizeAssistantDraft(
    chatId,
    messageId,
    assistantMessage
  ) {
    const { uid } = get();
    const chat = get().chats.find((item) => item.id === chatId);
    const draft = chat?.messages.find(
      (message) => message.id === messageId
    );
    const content = assistantMessage?.content || "No answer returned.";
    const revision =
      typeof assistantMessage?.revision === "string"
        ? assistantMessage.revision
        : "";
    const sources = normalizeSources(
      Array.isArray(assistantMessage?.sources)
        ? assistantMessage.sources
        : []
    );
    const completedAt = new Date().toISOString();

    if (!uid || !chat || !messageId || !draft?.localOnly) {
      return null;
    }

    set((state) => ({
      chats: state.chats.map((item) =>
        item.id === chatId
          ? {
              ...item,
              updatedAt: completedAt,
              messages: item.messages.map((message) =>
                message.id === messageId
                  ? {
                      ...message,
                      content,
                      revision,
                      sources,
                      isStreaming: false,
                      localOnly: false,
                      createdAt: message.createdAt || completedAt,
                    }
                  : message
              ),
            }
          : item
      ),
    }));

    try {
      const savedMessageId = await chatRepository.addMessage(
        uid,
        chatId,
        "assistant",
        content,
        sources,
        null,
        revision
      );

      set((state) => ({
        chats: state.chats.map((item) =>
          item.id === chatId
            ? {
                ...item,
                messages: item.messages.map((message) =>
                  message.id === messageId
                    ? {
                        ...message,
                        id: savedMessageId,
                      }
                    : message
                ),
              }
            : item
        ),
      }));

      return savedMessageId;
    } catch (error) {
      console.error("Unable to save assistant message:", error);
      set({
        error: "The answer is visible but could not be saved to the cloud.",
      });
      return null;
    }
  },

  setLoading(value, chatId = null) {
    set({
      isLoading: value,
      loadingChatId: value ? chatId : null,
    });
  },
}));

export default useChatStore;
