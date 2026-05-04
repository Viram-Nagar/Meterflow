import { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import useAuthStore from "../../store/authStore";

export default function AppLayout() {
  const { isAuthenticated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950">
      {/* Sidebar — handles its own responsive behavior */}
      <Sidebar
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <MobileTopBar onMenuClick={() => setSidebarOpen(true)} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-4 md:p-6 max-w-7xl mx-auto w-full animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Mobile Top Bar ────────────────────────────────────────────────────────────
import { Menu, Zap } from "lucide-react";

function MobileTopBar({ onMenuClick }) {
  return (
    <div className="lg:hidden flex items-center gap-3 px-4 h-14 bg-surface-900 border-b border-surface-800/50 shrink-0">
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg text-surface-400 hover:text-white hover:bg-surface-800 transition-all"
      >
        <Menu size={20} />
      </button>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <span className="font-display font-bold text-white text-base">
          MeterFlow
        </span>
      </div>
    </div>
  );
}
