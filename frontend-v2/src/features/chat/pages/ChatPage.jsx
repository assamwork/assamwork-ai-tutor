import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";

import useChatStore from "../../../store/chatStore";

import ChatHeader from "../components/ChatHeader";
import Composer from "../components/Composer";
import MessageBubble from "../components/MessageBubble";
import TypingIndicator from "../components/TypingIndicator";
import WelcomeScreen from "../components/WelcomeScreen";

export default function ChatPage() {
  const layoutContext = useOutletContext();
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-50">

      <ChatHeader
        title={activeChat?.title ?? "AssamWork AI"}
        onOpenSidebar={layoutContext?.openSidebar}
      />

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth">

        <div className="mx-auto w-full max-w-5xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">

          {chatsLoading || messagesLoading ? (
            <div className="mx-auto max-w-3xl py-8" aria-live="polite">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                <p className="mt-4 text-sm font-bold text-slate-800">
                  {chatsLoading
                    ? "Loading cloud chats..."
                    : "Loading messages..."}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Preparing your ebook-grounded study workspace.
                </p>
                <div className="mt-6 space-y-3 text-left">
                  {[0, 1, 2].map((item) => (
                    <div
                      key={item}
                      className="h-14 animate-pulse rounded-2xl bg-slate-100"
                    />
                  ))}
                </div>
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
