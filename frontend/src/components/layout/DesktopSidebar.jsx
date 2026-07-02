import {
  GraduationCap,
  MessageSquare,
  Plus,
  Trash2,
  Settings,
} from "lucide-react";

import useChat from "../../hooks/useChat";

export default function DesktopSidebar() {
  const {
    conversations,
    activeChat,
    setActiveChat,
    createChat,
    deleteChat,
  } = useChat();

  function groupChats() {
    const today = [];
    const yesterday = [];
    const previous = [];

    const now = new Date();

    conversations.forEach((chat) => {
      const date = new Date(chat.id);

      const diff = Math.floor(
        (now - date) / (1000 * 60 * 60 * 24)
      );

      if (diff === 0) today.push(chat);
      else if (diff === 1) yesterday.push(chat);
      else previous.push(chat);
    });

    return { today, yesterday, previous };
  }

  const { today, yesterday, previous } = groupChats();

  function Section(title, data) {
    if (!data.length) return null;

    return (
      <div className="mb-8">

        <h3 className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">

          {title}

        </h3>

        <div className="space-y-1">

          {data.map((chat) => (

            <button
              key={chat.id}
              onClick={() => setActiveChat(chat.id)}
              className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                activeChat === chat.id
                  ? "bg-blue-50"
                  : "hover:bg-slate-100"
              }`}
            >

              <div className="flex items-center gap-3 overflow-hidden">

                <MessageSquare
                  size={16}
                  className="text-slate-500"
                />

                <span className="truncate text-sm">

                  {chat.title}

                </span>

              </div>

              {conversations.length > 1 && (

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(chat.id);
                  }}
                  className="opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                >

                  <Trash2 size={15} />

                </button>

              )}

            </button>

          ))}

        </div>

      </div>
    );
  }

  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">

      {/* Logo */}

      <div className="border-b border-slate-200 px-6 py-5">

        <div className="flex items-center gap-3">

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white">

            <GraduationCap size={22} />

          </div>

          <div>

            <h1 className="text-lg font-bold">

              AssamWork AI

            </h1>

            <p className="text-sm text-slate-500">

              Personal Tutor

            </p>

          </div>

        </div>

      </div>

      {/* New Chat */}

      <div className="p-4">

        <button
          onClick={createChat}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-white transition hover:bg-blue-700"
        >

          <Plus size={18} />

          New Chat

        </button>

      </div>

      {/* History */}

      <div className="flex-1 overflow-y-auto px-3 pb-5">

        {Section("Today", today)}

        {Section("Yesterday", yesterday)}

        {Section("Previous", previous)}

      </div>

      {/* Footer */}

      <div className="border-t border-slate-200 p-4">

        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-slate-600 transition hover:bg-slate-100">

          <Settings size={18} />

          Settings

        </button>

      </div>

    </aside>
  );
}