import { Outlet, Navigate } from "react-router-dom";
import { Zap } from "lucide-react";
import useAuthStore from "../../store/authStore";

export default function AuthLayout() {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-surface-950 flex">
      {/* Left — Form (full width on mobile, half on desktop) */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-8 min-w-0">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <span className="font-display font-bold text-xl text-white">
              MeterFlow
            </span>
          </div>

          {/* Page content */}
          <Outlet />
        </div>
      </div>

      {/* Right — Decorative panel (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-brand-900/30 via-surface-900 to-surface-950 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-600/10 via-transparent to-transparent" />
        <div className="relative z-10 text-center px-12 max-w-md">
          <h2 className="font-display text-4xl font-bold text-white mb-4">
            API Billing,
            <br />
            <span className="gradient-text">Simplified.</span>
          </h2>
          <p className="text-surface-400 text-lg leading-relaxed mb-10">
            Track usage, apply rate limits, and charge customers based on
            exactly what they use.
          </p>
          <div className="grid grid-cols-2 gap-3 text-left">
            {[
              "Gateway Layer",
              "Rate Limiting",
              "Usage Analytics",
              "Auto Billing",
              "Webhooks",
              "Audit Logs",
            ].map((f) => (
              <div key={f} className="glass rounded-xl p-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mb-1.5" />
                <p className="text-sm font-medium text-surface-200">{f}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
