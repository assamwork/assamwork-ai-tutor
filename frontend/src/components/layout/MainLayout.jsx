import { useState } from "react";

import Header from "./Header";
import DesktopSidebar from "./DesktopSidebar";
import MobileSidebar from "./MobileSidebar";

export default function MainLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">

      {/* Desktop Sidebar */}

      <DesktopSidebar />

      {/* Mobile Sidebar */}

      <MobileSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}

      <div className="flex flex-1 flex-col overflow-hidden">

        <Header
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 overflow-hidden">

          {children}

        </main>

      </div>

    </div>
  );
}