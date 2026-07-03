import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { X } from "lucide-react";

import useChatStore from "../../../store/chatStore";

import ChatHeader from "../components/ChatHeader";
import Composer from "../components/Composer";
import MessageBubble from "../components/MessageBubble";
import TypingIndicator from "../components/TypingIndicator";
import WelcomeScreen from "../components/WelcomeScreen";

function StoreRecommendation({ onDismiss }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-2xl border border-blue-100 bg-white/80 px-3 py-2.5 text-left shadow-sm">
      <a
        href="https://www.assamwork.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1"
        aria-label="Explore AssamWork study materials in a new tab"
      >
        <p className="truncate text-sm font-bold text-slate-900">
          Need complete study materials?
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          AssamWork exam bundles and PDFs.
        </p>
      </a>

      <a
        href="https://www.assamwork.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white"
      >
        Explore
      </a>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss study materials recommendation"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <X size={15} />
      </button>
    </div>
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
  const messageScrollRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const [prompt, setPrompt] = useState("");
  const [showStoreRecommendation, setShowStoreRecommendation] =
    useState(true);
  const messagesLoading = Boolean(
    activeChatId && messageLoadingIds[activeChatId]
  );
  const messageCount = activeChat?.messages?.length ?? 0;
  const lastMessageContent =
    activeChat?.messages?.[messageCount - 1]?.content ?? "";
  const hasStreamingAssistant = Boolean(
    activeChat?.messages?.some(
      (message) =>
        message.role === "assistant" && message.isStreaming
    )
  );
  const firstAssistantIndex = activeChat?.messages?.findIndex(
    (item) => item.role === "assistant"
  );

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;

    window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });
  }, [messageCount, lastMessageContent, isLoading, loadingChatId]);

  useEffect(() => {
    setShowStoreRecommendation(true);
    shouldAutoScrollRef.current = true;
  }, [activeChatId]);

  function handleMessageScroll(event) {
    const element = event.currentTarget;
    const distanceFromBottom =
      element.scrollHeight -
      element.scrollTop -
      element.clientHeight;

    shouldAutoScrollRef.current = distanceFromBottom < 120;
  }

  return (
    <div className="chat-page-shell flex h-dvh max-h-dvh min-h-0 w-full min-w-0 flex-col overflow-hidden">

      <ChatHeader
        title={activeChat?.title ?? "Ebook-grounded AI tutor"}
        onOpenSidebar={layoutContext?.openSidebar}
      />

      <main
        ref={messageScrollRef}
        onScroll={handleMessageScroll}
        className="chat-message-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth"
        style={{
          WebkitOverflowScrolling: "touch",
        }}
      >

        <div className="mx-auto min-h-full w-full max-w-5xl px-3 py-3 sm:px-6 sm:py-6 lg:px-8">

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

            <div className="flex min-w-0 flex-col gap-4 pb-3 sm:gap-7">

              {activeChat.messages.map((message, index) => (
                <div key={message.id} className="min-w-0">
                  <MessageBubble message={message} />
                  {showStoreRecommendation &&
                    message.role === "assistant" &&
                    firstAssistantIndex === index &&
                    activeChat.messages.length > 2 && (
                      <div className="mt-4">
                        <StoreRecommendation
                          onDismiss={() =>
                            setShowStoreRecommendation(false)
                          }
                        />
                      </div>
                    )}
                </div>
              ))}

              {isLoading &&
                loadingChatId === activeChatId &&
                !hasStreamingAssistant && (
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
