import { useEffect, useRef, useState } from "react";

import useChatStore from "../../../store/chatStore";

import ChatHeader from "../components/ChatHeader";
import Composer from "../components/Composer";
import MessageBubble from "../components/MessageBubble";
import TypingIndicator from "../components/TypingIndicator";
import WelcomeScreen from "../components/WelcomeScreen";

export default function ChatPage() {
  const {
    chats,
    activeChatId,
    isLoading,
    loadingChatId,
    chatsLoading,
    messageLoadingIds,
  } = useChatStore();

  const activeChat = chats.find(
    (chat) => chat.id === activeChatId
  );

  const bottomRef = useRef(null);
  const [prompt, setPrompt] = useState("");
  const messagesLoading = Boolean(
    activeChatId && messageLoadingIds[activeChatId]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [activeChat?.messages, isLoading]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">

      <ChatHeader
        title={activeChat?.title ?? "New Chat"}
      />

      <main className="min-h-0 flex-1 overflow-y-auto">

        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

          {chatsLoading || messagesLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                <p className="mt-3 text-sm font-medium text-slate-500">
                  {chatsLoading
                    ? "Loading cloud chats..."
                    : "Loading messages..."}
                </p>
              </div>
            </div>
          ) : activeChat?.messages.length ? (

            <div className="flex flex-col gap-7 sm:gap-9">

              {activeChat.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                />
              ))}

              {isLoading && loadingChatId === activeChatId && (
                <TypingIndicator />
              )}

              <div ref={bottomRef} />

            </div>

          ) : (

            <WelcomeScreen
              onSelectPrompt={setPrompt}
            />

          )}

        </div>

      </main>

      <Composer
        prompt={prompt}
        setPrompt={setPrompt}
      />

    </div>
  );
}
