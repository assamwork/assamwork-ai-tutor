import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isChatRoute = location.pathname === "/chat";

  function openSidebar() {
    setSidebarOpen(true);
  }

  return (
    <div className="flex h-screen h-dvh overflow-hidden bg-slate-50">

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="relative min-w-0 flex-1 overflow-hidden">
        {!isChatRoute && (
          <button
            type="button"
            onClick={openSidebar}
            aria-label="Open navigation menu"
            className="absolute left-4 top-3 z-30 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 lg:hidden"
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
