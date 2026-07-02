import { X, Plus, MessageSquare, Trash2 } from "lucide-react";
import useChat from "../../hooks/useChat";

export default function MobileSidebar({ open, onClose }) {
  const {
    conversations,
    activeChat,
    setActiveChat,
    createChat,
    deleteChat,
  } = useChat();

  return (
    <>
      {/* Backdrop */}

      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-all duration-300 ${
          open
            ? "opacity-100 visible"
            : "opacity-0 invisible"
        }`}
      />

      {/* Drawer */}

      <aside
        className={`fixed left-0 top-0 z-50 h-full w-80 max-w-[85vw] bg-slate-950 text-white transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}

        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-5">

          <div>

            <h2 className="text-xl font-bold">

              AssamWork AI

            </h2>

            <p className="text-sm text-slate-400">

              AI Tutor

            </p>

          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-slate-800"
          >
            <X size={20} />
          </button>

        </div>

        {/* New Chat */}

        <div className="p-4">

          <button
            onClick={() => {
              createChat();
              onClose();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-medium hover:bg-blue-700"
          >
            <Plus size={18} />

            New Chat

          </button>

        </div>

        {/* Conversations */}

        <div className="flex-1 overflow-y-auto px-3">

          <p className="px-3 py-2 text-xs uppercase tracking-wider text-slate-500">

            Conversations

          </p>

          <div className="space-y-2">

            {conversations.map((chat) => (

              <div
                key={chat.id}
                onClick={() => {
                  setActiveChat(chat.id);
                  onClose();
                }}
                className={`group flex cursor-pointer items-center justify-between rounded-xl px-3 py-3 transition ${
                  activeChat === chat.id
                    ? "bg-slate-800"
                    : "hover:bg-slate-900"
                }`}
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
                    className="opacity-0 transition group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>

                )}

              </div>

            ))}

          </div>

        </div>

      </aside>
    </>
  );
}