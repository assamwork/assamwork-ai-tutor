import { useState, useEffect, useRef } from "react";
import { Menu, MessageSquarePlus, LogOut, Settings, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { auth } from "../../lib/firebase";
import { logout } from "../../services/auth";
import useChat from "../../hooks/useChat";

export default function Header({ onMenuClick }) {
  const navigate = useNavigate();

  const { currentChat, createChat } = useChat();

  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);

  const menuRef = useRef(null);

  useEffect(() => {
    setUser(auth.currentUser);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error(err);
      alert("Logout failed");
    }
  }

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-slate-200 bg-white/80 backdrop-blur-xl">

      <div className="flex h-full items-center justify-between px-4 lg:px-6">

        {/* Left */}

        <div className="flex items-center gap-3">

          <button
            onClick={onMenuClick}
            className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100"
          >
            <Menu size={20} />
          </button>

          <div>

            <h1 className="text-lg font-semibold">
              {currentChat?.title || "New Chat"}
            </h1>

            <p className="text-xs text-slate-500">
              AssamWork AI Tutor
            </p>

          </div>

        </div>

        {/* Right */}

        <div className="flex items-center gap-3">

          <button
            onClick={createChat}
            className="hidden md:flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 hover:bg-slate-100"
          >
            <MessageSquarePlus size={17} />
            New Chat
          </button>

          <div className="relative" ref={menuRef}>

            <button
              onClick={() => setOpen(!open)}
              className="overflow-hidden rounded-full"
            >

              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Profile"
                  className="h-10 w-10 rounded-full"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white">
                  <User size={18} />
                </div>
              )}

            </button>

            {open && (
              <div className="absolute right-0 mt-3 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">

                <div className="border-b border-slate-100 p-3">

                  <p className="font-semibold">
                    {user?.displayName || "Student"}
                  </p>

                  <p className="truncate text-sm text-slate-500">
                    {user?.email}
                  </p>

                </div>

                <button
                  className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 hover:bg-slate-100"
                >
                  <Settings size={18} />
                  Settings
                </button>

                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-red-600 hover:bg-red-50"
                >
                  <LogOut size={18} />
                  Logout
                </button>

              </div>
            )}

          </div>

        </div>

      </div>

    </header>
  );
}