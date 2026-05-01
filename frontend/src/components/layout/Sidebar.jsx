/**
 * @file Sidebar.jsx
 * @description Fully responsive sidebar.
 *
 * Mobile  (<1024px): Hidden. Opens as full-screen overlay drawer on hamburger click.
 * Desktop (>=1024px): Always visible fixed left sidebar.
 */

import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Boxes,
  BarChart3,
  CreditCard,
  Play,
  Settings,
  LogOut,
  Zap,
  Webhook,
  Shield,
  X,
} from "lucide-react";
import clsx from "clsx";
import { useLogout, useMe } from "../../hooks/useAuth";
import useAuthStore from "../../store/authStore";

// ── Nav items ─────────────────────────────────────────────────────────────────
const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/apis", icon: Boxes, label: "My APIs" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/billing", icon: CreditCard, label: "Billing" },
  { to: "/playground", icon: Play, label: "Playground" },
  { to: "/webhooks", icon: Webhook, label: "Webhooks" },
  { to: "/audit", icon: Shield, label: "Audit Logs" },
];

const PLAN_BADGE = {
  free: { label: "FREE PLAN", cls: "badge-gray" },
  pro: { label: "PRO PLAN", cls: "badge-blue" },
  enterprise: { label: "ENTERPRISE PLAN", cls: "badge-green" },
};

// ── Sidebar inner content (shared between mobile + desktop) ───────────────────
function SidebarContent({ onNavClick }) {
  const { mutate: logout, isPending } = useLogout();
  const { user: storeUser } = useAuthStore();
  const { data: freshUser } = useMe();

  const user = freshUser || storeUser;
  const plan = user?.plan || "free";
  const badge = PLAN_BADGE[plan] || PLAN_BADGE.free;

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-surface-800/50 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
            <Zap size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg text-white">
            MeterFlow
          </span>
        </div>
        <div className="mt-3">
          <span className={clsx("badge text-[10px]", badge.cls)}>
            {badge.label}
          </span>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavClick}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                "transition-all duration-150 w-full",
                isActive
                  ? "bg-brand-600/15 text-brand-400 border border-brand-600/20"
                  : "text-surface-400 hover:text-surface-200 hover:bg-surface-800",
              )
            }
          >
            <Icon size={16} className="shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom — settings + logout + user */}
      <div className="p-3 border-t border-surface-800/50 space-y-0.5 shrink-0">
        <NavLink
          to="/settings"
          onClick={onNavClick}
          className={({ isActive }) =>
            clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              isActive
                ? "bg-brand-600/15 text-brand-400 border border-brand-600/20"
                : "text-surface-400 hover:text-surface-200 hover:bg-surface-800",
            )
          }
        >
          <Settings size={16} className="shrink-0" />
          <span>Settings</span>
        </NavLink>

        <button
          onClick={() => logout()}
          disabled={isPending}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut size={16} className="shrink-0" />
          <span>{isPending ? "Logging out..." : "Logout"}</span>
        </button>

        {/* User info */}
        {user && (
          <div className="mt-2 px-3 py-2.5 rounded-lg bg-surface-800/50 border border-surface-700/30">
            <p className="text-sm font-medium text-surface-200 truncate">
              {user.name}
            </p>
            <p className="text-xs text-surface-500 truncate">{user.email}</p>
            <p className="text-xs text-brand-400 mt-0.5 capitalize">
              {plan} plan
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Sidebar({ mobileOpen, onMobileClose }) {
  return (
    <>
      {/* ── Mobile overlay backdrop ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 w-64 bg-surface-900 border-r border-surface-800/50",
          "transform transition-transform duration-300 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Close button */}
        <button
          onClick={onMobileClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-800 transition-all z-10"
        >
          <X size={16} />
        </button>
        <SidebarContent onNavClick={onMobileClose} />
      </aside>

      {/* ── Desktop sidebar (always visible on lg+) ── */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-surface-900 border-r border-surface-800/50 h-screen sticky top-0">
        <SidebarContent />
      </aside>
    </>
  );
}

// import { NavLink, useLocation } from "react-router-dom";
// import {
//   LayoutDashboard,
//   Boxes,
//   BarChart3,
//   CreditCard,
//   Play,
//   Settings,
//   LogOut,
//   Zap,
//   Webhook,
//   Shield,
// } from "lucide-react";
// import clsx from "clsx";
// import { useLogout } from "../../hooks/useAuth";
// import useAuthStore from "../../store/authStore";

// const navItems = [
//   { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
//   { to: "/apis", icon: Boxes, label: "My APIs" },
//   { to: "/analytics", icon: BarChart3, label: "Analytics" },
//   { to: "/billing", icon: CreditCard, label: "Billing" },
//   { to: "/playground", icon: Play, label: "Playground" },
//   { to: "/webhooks", icon: Webhook, label: "Webhooks" },
//   { to: "/audit", icon: Shield, label: "Audit Logs" },
// ];

// export default function Sidebar() {
//   const { mutate: logout, isPending } = useLogout();
//   const { user } = useAuthStore();

//   return (
//     <aside className="w-60 min-h-screen flex flex-col bg-surface-900 border-r border-surface-800/50">
//       {/* Logo */}
//       <div className="p-5 border-b border-surface-800/50">
//         <div className="flex items-center gap-2.5">
//           <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
//             <Zap size={16} className="text-white" />
//           </div>
//           <span className="font-display font-bold text-lg text-white">
//             MeterFlow
//           </span>
//         </div>
//         <div className="mt-3 px-1">
//           <span
//             className={clsx(
//               "badge text-[10px]",
//               user?.plan === "pro"
//                 ? "badge-blue"
//                 : user?.plan === "enterprise"
//                   ? "badge-green"
//                   : "badge-gray",
//             )}
//           >
//             {user?.plan?.toUpperCase() || "FREE"} PLAN
//           </span>
//         </div>
//       </div>

//       {/* Nav */}
//       <nav className="flex-1 p-3 space-y-1">
//         {navItems.map(({ to, icon: Icon, label }) => (
//           <NavLink
//             key={to}
//             to={to}
//             className={({ isActive }) =>
//               clsx(
//                 "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
//                 isActive
//                   ? "bg-brand-600/15 text-brand-400 border border-brand-600/20"
//                   : "text-surface-400 hover:text-surface-200 hover:bg-surface-800",
//               )
//             }
//           >
//             <Icon size={16} />
//             {label}
//           </NavLink>
//         ))}
//       </nav>

//       {/* User + Logout */}
//       <div className="p-3 border-t border-surface-800/50 space-y-1">
//         <NavLink
//           to="/settings"
//           className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-all"
//         >
//           <Settings size={16} />
//           Settings
//         </NavLink>
//         <button
//           onClick={() => logout()}
//           disabled={isPending}
//           className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
//         >
//           <LogOut size={16} />
//           {isPending ? "Logging out..." : "Logout"}
//         </button>

//         {/* User info */}
//         <div className="mt-2 px-3 py-2 rounded-lg bg-surface-800/50">
//           <p className="text-sm font-medium text-surface-200 truncate">
//             {user?.name}
//           </p>
//           <p className="text-xs text-surface-500 truncate">{user?.email}</p>
//         </div>
//       </div>
//     </aside>
//   );
// }

// /**
//  * @file Sidebar.jsx
//  * @description Navigation sidebar.
//  * Reads user plan from BOTH Zustand store AND fresh API query.
//  * This ensures plan badge updates immediately after payment.
//  */
// import { NavLink } from "react-router-dom";
// import {
//   LayoutDashboard,
//   Boxes,
//   BarChart3,
//   CreditCard,
//   Play,
//   Settings,
//   LogOut,
//   Zap,
//   Webhook,
//   Shield,
// } from "lucide-react";
// import clsx from "clsx";
// import { useLogout, useMe } from "../../hooks/useAuth";
// import useAuthStore from "../../store/authStore";

// const navItems = [
//   { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
//   { to: "/apis", icon: Boxes, label: "My APIs" },
//   { to: "/analytics", icon: BarChart3, label: "Analytics" },
//   { to: "/billing", icon: CreditCard, label: "Billing" },
//   { to: "/playground", icon: Play, label: "Playground" },
//   { to: "/webhooks", icon: Webhook, label: "Webhooks" },
//   { to: "/audit", icon: Shield, label: "Audit Logs" },
// ];

// const PLAN_BADGE = {
//   free: { label: "FREE PLAN", class: "badge-gray" },
//   pro: { label: "PRO PLAN", class: "badge-blue" },
//   enterprise: { label: "ENTERPRISE PLAN", class: "badge-green" },
// };

// export default function Sidebar() {
//   const { mutate: logout, isPending } = useLogout();

//   // Get user from BOTH sources
//   // useMe() fetches fresh data from backend every 5 minutes
//   const { user: storeUser } = useAuthStore();
//   const { data: freshUser } = useMe();

//   // Prefer fresh data from API, fallback to store
//   const user = freshUser || storeUser;
//   const plan = user?.plan || "free";
//   const badge = PLAN_BADGE[plan] || PLAN_BADGE.free;

//   return (
//     <aside className="w-60 min-h-screen flex flex-col bg-surface-900 border-r border-surface-800/50">
//       {/* Logo */}
//       <div className="p-5 border-b border-surface-800/50">
//         <div className="flex items-center gap-2.5">
//           <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
//             <Zap size={16} className="text-white" />
//           </div>
//           <span className="font-display font-bold text-lg text-white">
//             MeterFlow
//           </span>
//         </div>
//         {/* Plan badge — updates after payment */}
//         <div className="mt-3 px-1">
//           <span className={clsx("badge text-[10px]", badge.class)}>
//             {badge.label}
//           </span>
//         </div>
//       </div>

//       {/* Nav links */}
//       <nav className="flex-1 p-3 space-y-1">
//         {navItems.map(({ to, icon: Icon, label }) => (
//           <NavLink
//             key={to}
//             to={to}
//             className={({ isActive }) =>
//               clsx(
//                 "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
//                 isActive
//                   ? "bg-brand-600/15 text-brand-400 border border-brand-600/20"
//                   : "text-surface-400 hover:text-surface-200 hover:bg-surface-800",
//               )
//             }
//           >
//             <Icon size={16} />
//             {label}
//           </NavLink>
//         ))}
//       </nav>

//       {/* Bottom — Settings, Logout, User info */}
//       <div className="p-3 border-t border-surface-800/50 space-y-1">
//         <NavLink
//           to="/settings"
//           className={({ isActive }) =>
//             clsx(
//               "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
//               isActive
//                 ? "bg-brand-600/15 text-brand-400 border border-brand-600/20"
//                 : "text-surface-400 hover:text-surface-200 hover:bg-surface-800",
//             )
//           }
//         >
//           <Settings size={16} />
//           Settings
//         </NavLink>

//         <button
//           onClick={() => logout()}
//           disabled={isPending}
//           className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
//         >
//           <LogOut size={16} />
//           {isPending ? "Logging out..." : "Logout"}
//         </button>

//         {/* User info card */}
//         {user && (
//           <div className="mt-2 px-3 py-2.5 rounded-lg bg-surface-800/50 border border-surface-700/30">
//             <p className="text-sm font-medium text-surface-200 truncate">
//               {user.name}
//             </p>
//             <p className="text-xs text-surface-500 truncate">{user.email}</p>
//             {/* Show plan here too for extra clarity */}
//             <p className="text-xs text-brand-400 mt-0.5 font-medium capitalize">
//               {plan} plan
//             </p>
//           </div>
//         )}
//       </div>
//     </aside>
//   );
// }
