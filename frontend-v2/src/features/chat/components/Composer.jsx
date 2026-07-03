import { useEffect, useRef } from "react";
import useChatStore from "../../../store/chatStore";
import ChatInputBar from "./ChatInputBar";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getFriendlyChatError(error) {
  if (error?.name === "AbortError") {
    return "Generation stopped.";
  }

  if (error?.message === "Unable to get an answer right now.") {
    return error.message;
  }

  return "Unable to reach AssamWork AI. Please check your connection and try again.";
}

function parseSseEvent(rawEvent) {
  const lines = rawEvent.split("\n");
  let event = "message";
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (!dataLines.length) {
    return {
      event,
      data: {},
    };
  }

  try {
    return {
      event,
      data: JSON.parse(dataLines.join("\n")),
    };
  } catch {
    return {
      event,
      data: {},
    };
  }
}

function getRecentChatHistory(chats, chatId) {
  const chat = chats.find((item) => item.id === chatId);

  if (!chat?.messages?.length) return [];

  return chat.messages
    .filter(
      (message) =>
        ["user", "assistant"].includes(message.role) &&
        message.content?.trim() &&
        !message.localOnly &&
        !message.isStreaming
    )
    .slice(-5)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 1200),
    }));
}

async function streamAnswer({
  question,
  history,
  signal,
  onChunk,
  onMetadata,
}) {
  const response = await fetch(`${API_URL}/ask/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      question,
      history,
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error("Streaming endpoint unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      buffer += decoder.decode();
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
      if (!rawEvent.trim()) continue;

      const { event, data } = parseSseEvent(rawEvent);

      if (event === "chunk") {
        onChunk(data.text || "");
      } else if (event === "metadata") {
        onMetadata(data);
      } else if (event === "error") {
        throw new Error(
          data.message || "Unable to get an answer right now."
        );
      }
    }
  }

  if (buffer.trim()) {
    const { event, data } = parseSseEvent(buffer);

    if (event === "chunk") {
      onChunk(data.text || "");
    } else if (event === "metadata") {
      onMetadata(data);
    }
  }
}

async function fetchFallbackAnswer(question, history, signal) {
  const response = await fetch(`${API_URL}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,
      history,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error("Unable to get an answer right now.");
  }

  return response.json();
}

export default function Composer({
  prompt,
  setPrompt,
}) {
  const sendingRef = useRef(false);
  const abortControllerRef = useRef(null);

  const {
    addUserMessage,
    addAssistantMessage,
    discardAssistantDraft,
    finalizeAssistantDraft,
    startAssistantDraft,
    updateAssistantDraft,
    createChat,
    chats,
    activeChatId,
    isLoading,
    setLoading,
  } = useChatStore();

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  function stopGenerating() {
    abortControllerRef.current?.abort();
  }

  async function sendMessage() {
    if (!prompt.trim() || isLoading || sendingRef.current) return;

    const question = prompt.trim();
    sendingRef.current = true;
    let targetChatId = activeChatId;
    let draftMessageId = null;
    let streamedAnswer = "";
    let metadata = {
      sources: [],
      revision: "",
      confidence: null,
    };
    let shouldFallback = false;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      targetChatId = targetChatId || (await createChat());

      if (!targetChatId) return;

      const history = getRecentChatHistory(chats, targetChatId);

      setLoading(true, targetChatId);

      const savedUserMessageId = await addUserMessage(
        question,
        targetChatId
      );

      if (!savedUserMessageId) return;

      setPrompt("");
      draftMessageId = startAssistantDraft(targetChatId);

      if (!draftMessageId) return;

      try {
        await streamAnswer({
          question,
          history,
          signal: abortController.signal,
          onChunk: (chunk) => {
            if (!chunk) return;

            streamedAnswer += chunk;
            updateAssistantDraft(targetChatId, draftMessageId, {
              content: streamedAnswer,
              isStreaming: true,
            });
          },
          onMetadata: (nextMetadata) => {
            metadata = {
              sources: nextMetadata.sources ?? [],
              revision: nextMetadata.revision ?? "",
              confidence: nextMetadata.confidence ?? null,
            };
            updateAssistantDraft(targetChatId, draftMessageId, {
              revision: metadata.revision,
              sources: metadata.sources,
            });
          },
        });
      } catch (streamError) {
        if (streamError?.name === "AbortError") {
          updateAssistantDraft(targetChatId, draftMessageId, {
            content: streamedAnswer || "Generation stopped.",
            isStreaming: false,
            localOnly: true,
          });
          return;
        }

        shouldFallback =
          streamError?.message === "Streaming endpoint unavailable." ||
          streamError instanceof TypeError;

        if (!shouldFallback) {
          throw streamError;
        }
      }

      if (shouldFallback) {
        const data = await fetchFallbackAnswer(
          question,
          history,
          abortController.signal
        );
        streamedAnswer = data.answer ?? "No answer returned.";
        metadata = {
          sources: data.sources ?? [],
          revision: data.revision ?? "",
          confidence: data.confidence ?? null,
        };
        updateAssistantDraft(targetChatId, draftMessageId, {
          content: streamedAnswer,
          revision: metadata.revision,
          sources: metadata.sources,
          isStreaming: false,
        });
      }

      await finalizeAssistantDraft(
        targetChatId,
        draftMessageId,
        {
          content:
            streamedAnswer.trim() ||
            "No answer returned.",
          revision: metadata.revision,
          sources: metadata.sources,
        }
      );
    } catch (err) {
      if (targetChatId) {
        const errorMessage = getFriendlyChatError(err);

        if (draftMessageId) {
          await finalizeAssistantDraft(
            targetChatId,
            draftMessageId,
            {
              content: errorMessage,
              revision: "",
              sources: [],
            }
          );
        } else {
          await addAssistantMessage(
            {
              content: errorMessage,
              sources: [],
            },
            targetChatId
          );
        }
      } else if (draftMessageId) {
        discardAssistantDraft(targetChatId, draftMessageId);
      }
    } finally {
      sendingRef.current = false;
      abortControllerRef.current = null;
      setLoading(false);
    }
  }

  return (
    <div className="composer-shell relative z-20 flex-none shrink-0 border-t px-2.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:px-6 sm:py-3">
      <div className="mx-auto max-w-3xl">
        <ChatInputBar
          value={prompt}
          setValue={setPrompt}
          onSubmit={sendMessage}
          onStop={stopGenerating}
          isLoading={isLoading}
          placeholder="Ask from AssamWork study materials..."
          ariaLabel="Ask from AssamWork study materials"
          helperText="Answers are grounded in AssamWork study materials. Verify important information."
        />
      </div>
    </div>
  );
}
