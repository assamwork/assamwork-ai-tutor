import {
  MessageSquare,
  BookOpen,
  User,
  Settings,
  Plus,
  LogOut,
  Search,
  Pencil,
  Trash2,
  X,
  LibraryBig,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import useChatStore from "../../store/chatStore";
import useAuthStore from "../../store/authStore";
import { isAdmin } from "../../features/admin/services/adminAccess";

export default function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [logoutError, setLogoutError] = useState("");

  const {
    chats,
    activeChatId,
    createChat,
    setActiveChat,
    renameChat,
    deleteChat,
    chatsLoading,
    error,
    clearError,
    retryChats,
  } = useChatStore();

  const { user, logout } = useAuthStore();
  const hasAdminAccess = isAdmin(user);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleEscape(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  const menu = [
    { icon: MessageSquare, label: "Chat", path: "/chat" },
    { icon: BookOpen, label: "Study", path: "/study" },
    { icon: User, label: "Profile", path: "/profile" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  function goTo(path) {
    navigate(path);
    onClose();
  }

  async function handleCreateChat() {
    const chatId = await createChat();

    if (chatId) {
      goTo("/chat");
    }
  }

  function handleOpenChat(chatId) {
    setActiveChat(chatId);
    goTo("/chat");
  }

  function startRenaming(chat) {
    setEditingChatId(chat.id);
    setEditingTitle(chat.title);
  }

  async function finishRenaming() {
    if (editingChatId && editingTitle.trim()) {
      await renameChat(editingChatId, editingTitle);
    }

    setEditingChatId(null);
    setEditingTitle("");
  }

  function handleRenameKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      finishRenaming();
    }

    if (event.key === "Escape") {
      setEditingChatId(null);
      setEditingTitle("");
    }
  }

  async function handleDeleteChat(chatId) {
    const confirmed = window.confirm(
      "Delete this chat? This action cannot be undone."
    );

    if (!confirmed) return;

    await deleteChat(chatId);

    if (editingChatId === chatId) {
      setEditingChatId(null);
      setEditingTitle("");
    }
  }

  async function handleLogout() {
    try {
      setLogoutError("");
      await logout();
      navigate("/login", { replace: true });
      onClose();
    } catch {
      setLogoutError("Logout failed. Please try again.");
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px] transition-opacity lg:hidden ${
          isOpen
            ? "visible opacity-100"
            : "invisible opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col border-r border-slate-200 bg-white shadow-2xl shadow-slate-950/10 transition-transform duration-200 lg:static lg:z-auto lg:w-72 lg:translate-x-0 lg:shadow-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >

      {/* Logo */}

      <div className="border-b border-slate-200 p-6">

        <div className="flex items-center gap-3">

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white text-xl font-bold">
            ⚡
          </div>

          <div>
            <h1 className="text-lg font-bold">
              AssamWork AI
            </h1>

            <p className="text-sm text-slate-500">
              AI Tutor
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <X size={20} />
          </button>

        </div>

        <button
          onClick={handleCreateChat}
          className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700"
        >
          <Plus size={18} />
          New Chat
        </button>

      </div>

      {/* Chats */}

      <div className="flex-1 overflow-y-auto p-4">

        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Chats
        </h3>

        <label className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50">
          <Search size={17} className="shrink-0 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear chat search"
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={14} />
            </button>
          )}
        </label>

        <div className="space-y-2">

          {chatsLoading && (
            <div className="space-y-2 py-1" aria-label="Loading chats">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-11 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          )}

          {!chatsLoading && filteredChats.map((chat) => (
            <div
              key={chat.id}
              className={`group flex items-center gap-1 rounded-xl px-2 py-1 transition ${
                activeChatId === chat.id
                  ? "bg-blue-50 text-blue-700 shadow-sm shadow-blue-100/70"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {editingChatId === chat.id ? (
                <input
                  autoFocus
                  value={editingTitle}
                  onChange={(event) => setEditingTitle(event.target.value)}
                  onBlur={finishRenaming}
                  onKeyDown={handleRenameKeyDown}
                  aria-label="Rename chat"
                  className="min-w-0 flex-1 rounded-lg border border-blue-300 bg-white px-2 py-2 text-sm outline-none focus:ring-4 focus:ring-blue-50"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => handleOpenChat(chat.id)}
                  className="min-h-10 min-w-0 flex-1 truncate px-2 py-2 text-left text-sm font-medium"
                  title={chat.title}
                >
                  {chat.title}
                </button>
              )}

              {editingChatId !== chat.id && (
                <>
                  <button
                    type="button"
                    onClick={() => startRenaming(chat)}
                    aria-label={`Rename ${chat.title}`}
                    className="rounded-lg p-2 text-slate-400 opacity-100 transition hover:bg-white hover:text-blue-600 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
                  >
                    <Pencil size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteChat(chat.id)}
                    aria-label={`Delete ${chat.title}`}
                    className="rounded-lg p-2 text-slate-400 opacity-100 transition hover:bg-white hover:text-red-600 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          ))}

          {!chatsLoading && filteredChats.length === 0 && (
            <p className="px-2 py-3 text-sm text-slate-500">
              {searchQuery.trim()
                ? "No chats found."
                : "No cloud chats yet."}
            </p>
          )}

        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void retryChats()}
              className="mt-2 font-bold text-red-800 hover:underline"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={clearError}
              className="ml-3 mt-2 font-bold text-red-800 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <h3 className="mt-8 mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Navigation
        </h3>

        <div className="space-y-2">

          {menu.map(({ icon: Icon, label, path }) => (
            <button
              key={label}
              type="button"
              onClick={() => goTo(path)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition ${
                location.pathname === path
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Icon size={20} className="shrink-0" />
              <span>{label}</span>
            </button>
          ))}

        </div>

        {hasAdminAccess && (
          <>
            <h3 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Admin
            </h3>

            <button
              type="button"
              onClick={() => goTo("/admin/library")}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition ${
                location.pathname === "/admin/library"
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <LibraryBig size={20} className="shrink-0" />
              <span>Ebook Library</span>
            </button>
          </>
        )}

      </div>

      {/* Footer */}

      <div className="border-t border-slate-200 p-5">

        <div className="flex items-center gap-3">

          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white font-bold">
            {user?.displayName?.charAt(0) ||
              user?.email?.charAt(0)?.toUpperCase() ||
              "U"}
          </div>

          <div className="min-w-0 flex-1">

            <h3 className="truncate font-semibold">
              {user?.displayName || "User"}
            </h3>

            <p className="text-sm text-slate-500 truncate">
              {user?.email}
            </p>

          </div>

        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-3 font-semibold text-red-600 transition hover:bg-red-50"
        >
          <LogOut size={18} />
          Logout
        </button>

        {logoutError && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {logoutError}
          </p>
        )}

      </div>

      </aside>
    </>
  );
}
