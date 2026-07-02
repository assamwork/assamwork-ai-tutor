import {
  Plus,
  MessageSquare,
  Trash2,
  Settings,
  GraduationCap,
} from "lucide-react";

import useChat from "../../hooks/useChat";

export default function Sidebar() {
  const {
    conversations,
    activeChat,
    setActiveChat,
    createChat,
    deleteChat,
  } = useChat();

  return (
    <aside className="hidden lg:flex w-72 bg-slate-950 text-white flex-col">

      {/* Logo */}

      <div className="px-6 py-7 border-b border-slate-800">

        <div className="flex items-center gap-3">

          <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center">

            <GraduationCap size={22} />

          </div>

          <div>

            <h1 className="text-xl font-bold">

              AssamWork AI

            </h1>

            <p className="text-slate-400 text-sm">

              AI Tutor

            </p>

          </div>

        </div>

      </div>

      {/* New Chat */}

      <div className="p-4">

        <button
          onClick={createChat}
          className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl py-3 flex items-center justify-center gap-2 transition"
        >
          <Plus size={18} />

          New Chat
        </button>

      </div>

      {/* Chats */}

      <div className="flex-1 overflow-y-auto px-3">

        <p className="text-xs uppercase text-slate-500 tracking-widest px-3 py-2">

          Conversations

        </p>

        <div className="space-y-2">

          {conversations.map((chat) => (

            <div
              key={chat.id}
              className={`group flex items-center justify-between rounded-xl px-3 py-3 cursor-pointer transition ${
                activeChat === chat.id
                  ? "bg-slate-800"
                  : "hover:bg-slate-900"
              }`}
              onClick={() => setActiveChat(chat.id)}
            >

              <div className="flex items-center gap-3 overflow-hidden">

                <MessageSquare size={17} />

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
                  className="opacity-0 group-hover:opacity-100 transition"
                >

                  <Trash2 size={16} />

                </button>

              )}

            </div>

          ))}

        </div>

      </div>

      {/* Footer */}

      <div className="border-t border-slate-800 p-4">

        <button className="flex items-center gap-3 text-slate-300 hover:text-white">

          <Settings size={18} />

          Settings

        </button>

      </div>

    </aside>
  );
}