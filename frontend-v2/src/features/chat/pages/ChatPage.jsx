import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";

import useChatStore from "../../../store/chatStore";

import ChatHeader from "../components/ChatHeader";
import Composer from "../components/Composer";
import MessageBubble from "../components/MessageBubble";
import TypingIndicator from "../components/TypingIndicator";
import WelcomeScreen from "../components/WelcomeScreen";

function StoreRecommendation() {
  return (
    <a
      href="https://www.assamwork.com/"
      target="_blank"
      rel="noopener noreferrer"
      className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white/80 px-4 py-3 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/70 hover:shadow-md"
      aria-label="Explore AssamWork study materials in a new tab"
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900">
          Need complete study materials?
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          Explore AssamWork exam bundles and high-yield PDFs.
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">
        Explore
      </span>
    </a>
  );
}

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
  const messageCount = activeChat?.messages?.length ?? 0;

  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverscroll = document.body.style.overscrollBehavior;
    const originalHtmlOverscroll =
      document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overscrollBehavior = originalBodyOverscroll;
      document.documentElement.style.overscrollBehavior =
        originalHtmlOverscroll;
    };
  }, []);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });
  }, [messageCount, isLoading, loadingChatId]);

  return (
    <div className="flex h-full h-dvh min-h-0 w-full min-w-0 flex-col overflow-hidden bg-slate-50">

      <ChatHeader
        title={activeChat?.title ?? "Ebook-grounded AI tutor"}
        onOpenSidebar={layoutContext?.openSidebar}
      />

      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth">

        <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">

          {chatsLoading || messagesLoading ? (
            <div className="mx-auto max-w-3xl py-6 sm:py-8" aria-live="polite">
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

            <div className="flex min-w-0 flex-col gap-5 pb-2 sm:gap-9">

              {activeChat.messages.map((message, index) => (
                <div key={message.id} className="min-w-0">
                  <MessageBubble message={message} />
                  {message.role === "assistant" &&
                    activeChat.messages.findIndex(
                      (item) => item.role === "assistant"
                    ) === index && (
                      <div className="mt-4">
                        <StoreRecommendation />
                      </div>
                    )}
                </div>
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
