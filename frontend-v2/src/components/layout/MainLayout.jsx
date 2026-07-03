import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isChatRoute = location.pathname === "/chat";

  useEffect(() => {
    document.documentElement.classList.toggle(
      "chat-route-lock",
      isChatRoute
    );

    return () => {
      document.documentElement.classList.remove("chat-route-lock");
    };
  }, [isChatRoute]);

  function openSidebar() {
    setSidebarOpen(true);
  }

  return (
    <div
      className={`app-shell flex overflow-hidden bg-slate-50 ${
        isChatRoute ? "chat-layout-shell" : "h-screen h-dvh"
      }`}
    >

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main
        className={`relative min-w-0 flex-1 overflow-hidden ${
          isChatRoute ? "chat-layout-main" : ""
        }`}
      >
        {!isChatRoute && (
          <button
            type="button"
            onClick={openSidebar}
            aria-label="Open navigation menu"
            className="main-menu-button absolute left-4 top-[max(0.75rem,env(safe-area-inset-top))] z-30 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 lg:hidden"
          >
            <Menu size={22} />
          </button>
        )}

        <Outlet
          context={{
            openSidebar,
          }}
        />
      </main>

    </div>
  );
}
