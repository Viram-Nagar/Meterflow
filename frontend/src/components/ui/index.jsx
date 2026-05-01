import { Loader2 } from "lucide-react";
import clsx from "clsx";
import React from "react";

export const Spinner = ({ size = 16, className = "" }) => (
  <Loader2 size={size} className={clsx("animate-spin", className)} />
);

export const Badge = ({ children, variant = "gray" }) => (
  <span className={`badge badge-${variant}`}>{children}</span>
);

export const StatusBadge = ({ status }) => {
  const map = {
    active: "green",
    inactive: "yellow",
    suspended: "red",
    revoked: "red",
    expired: "gray",
    free: "gray",
    pro: "blue",
    enterprise: "green",
  };
  return <Badge variant={map[status] || "gray"}>{status}</Badge>;
};

export const StatCard = ({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  color = "brand",
}) => (
  <div className="card glass-hover">
    <div className="flex items-start justify-between mb-2 md:mb-3">
      <div className={`p-1.5 md:p-2 rounded-lg bg-${color}-500/10 shrink-0`}>
        <Icon size={15} className={`text-${color}-400`} />
      </div>
      {trend !== undefined && (
        <span
          className={clsx(
            "text-xs font-medium",
            trend >= 0 ? "text-emerald-400" : "text-red-400",
          )}
        >
          {trend >= 0 ? "+" : ""}
          {trend}%
        </span>
      )}
    </div>
    <p className="text-lg md:text-2xl font-display font-bold text-white mb-0.5 truncate">
      {value}
    </p>
    <p className="text-xs text-surface-400">{label}</p>
    {sub && (
      <p className="text-xs text-surface-500 mt-0.5 truncate hidden sm:block">
        {sub}
      </p>
    )}
  </div>
);

export const EmptyState = ({ icon: Icon, title, desc, action }) => (
  <div className="flex flex-col items-center justify-center py-12 md:py-16 text-center px-4">
    <div className="p-4 rounded-2xl bg-surface-800/50 mb-4">
      <Icon size={28} className="text-surface-500" />
    </div>
    <h3 className="text-base md:text-lg font-semibold text-surface-200 mb-1">
      {title}
    </h3>
    <p className="text-surface-400 text-sm mb-4 max-w-xs">{desc}</p>
    {action}
  </div>
);

export const Modal = ({ open, onClose, title, children, size = "md" }) => {
  if (!open) return null;
  const sizes = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={clsx(
          "relative glass w-full shadow-2xl animate-slide-up",
          "rounded-t-2xl sm:rounded-2xl",
          "max-h-[90vh] overflow-y-auto",
          sizes[size],
        )}
      >
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-surface-700/50 sticky top-0 glass z-10">
          <h2 className="text-base md:text-lg font-semibold font-display text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-white transition-colors p-1"
          >
            ✕
          </button>
        </div>
        <div className="p-4 md:p-5">{children}</div>
      </div>
    </div>
  );
};

export const CopyButton = ({ text, label = "Copy" }) => {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="btn-secondary text-xs py-1 px-2 shrink-0">
      {copied ? "✓ Copied" : label}
    </button>
  );
};

export const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-surface-950">
    <div className="text-center">
      <div className="w-12 h-12 rounded-xl bg-brand-600/20 flex items-center justify-center mx-auto mb-4 animate-pulse-soft">
        <span className="text-2xl font-display font-bold gradient-text">M</span>
      </div>
      <Spinner size={20} className="text-brand-400 mx-auto" />
    </div>
  </div>
);

export const PageHeader = ({ title, subtitle, action }) => (
  <div className="flex items-start justify-between gap-3 mb-4 md:mb-6">
    <div className="min-w-0">
      <h1 className="text-xl md:text-2xl font-display font-bold text-white truncate">
        {title}
      </h1>
      {subtitle && (
        <p className="text-surface-400 text-xs md:text-sm mt-0.5 hidden sm:block">
          {subtitle}
        </p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

// import { Loader2 } from "lucide-react";
// import clsx from "clsx";

// export const Spinner = ({ size = 16, className = "" }) => (
//   <Loader2 size={size} className={clsx("animate-spin", className)} />
// );

// export const Badge = ({ children, variant = "gray" }) => (
//   <span className={`badge badge-${variant}`}>{children}</span>
// );

// export const StatusBadge = ({ status }) => {
//   const map = {
//     active: "green",
//     inactive: "yellow",
//     suspended: "red",
//     revoked: "red",
//     expired: "gray",
//     free: "blue",
//     pro: "blue",
//     enterprise: "blue",
//   };
//   return <Badge variant={map[status] || "gray"}>{status}</Badge>;
// };

// export const StatCard = ({
//   label,
//   value,
//   sub,
//   icon: Icon,
//   trend,
//   color = "brand",
// }) => (
//   <div className="card glass-hover">
//     <div className="flex items-start justify-between mb-3">
//       <div className={`p-2 rounded-lg bg-${color}-500/10`}>
//         <Icon size={18} className={`text-${color}-400`} />
//       </div>
//       {trend !== undefined && (
//         <span
//           className={clsx(
//             "text-xs font-medium",
//             trend >= 0 ? "text-emerald-400" : "text-red-400",
//           )}
//         >
//           {trend >= 0 ? "+" : ""}
//           {trend}%
//         </span>
//       )}
//     </div>
//     <p className="text-2xl font-display font-bold text-white mb-0.5">{value}</p>
//     <p className="text-sm text-surface-400">{label}</p>
//     {sub && <p className="text-xs text-surface-500 mt-1">{sub}</p>}
//   </div>
// );

// export const EmptyState = ({ icon: Icon, title, desc, action }) => (
//   <div className="flex flex-col items-center justify-center py-16 text-center">
//     <div className="p-4 rounded-2xl bg-surface-800/50 mb-4">
//       <Icon size={32} className="text-surface-500" />
//     </div>
//     <h3 className="text-lg font-semibold text-surface-200 mb-1">{title}</h3>
//     <p className="text-surface-400 text-sm mb-4 max-w-xs">{desc}</p>
//     {action}
//   </div>
// );

// export const Modal = ({ open, onClose, title, children, size = "md" }) => {
//   if (!open) return null;
//   const sizes = {
//     sm: "max-w-sm",
//     md: "max-w-lg",
//     lg: "max-w-2xl",
//     xl: "max-w-4xl",
//   };
//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
//       <div
//         className="absolute inset-0 bg-black/60 backdrop-blur-sm"
//         onClick={onClose}
//       />
//       <div
//         className={clsx(
//           "relative glass rounded-2xl w-full shadow-2xl animate-slide-up",
//           sizes[size],
//         )}
//       >
//         <div className="flex items-center justify-between p-5 border-b border-surface-700/50">
//           <h2 className="text-lg font-semibold font-display text-white">
//             {title}
//           </h2>
//           <button
//             onClick={onClose}
//             className="text-surface-400 hover:text-white transition-colors"
//           >
//             ✕
//           </button>
//         </div>
//         <div className="p-5">{children}</div>
//       </div>
//     </div>
//   );
// };

// export const CopyButton = ({ text, label = "Copy" }) => {
//   const [copied, setCopied] = React.useState(false);
//   const copy = () => {
//     navigator.clipboard.writeText(text);
//     setCopied(true);
//     setTimeout(() => setCopied(false), 2000);
//   };
//   return (
//     <button onClick={copy} className="btn-secondary text-xs py-1 px-2">
//       {copied ? "✓ Copied" : label}
//     </button>
//   );
// };

// import React from "react";

// export const LoadingScreen = () => (
//   <div className="min-h-screen flex items-center justify-center bg-surface-950">
//     <div className="text-center">
//       <div className="w-12 h-12 rounded-xl bg-brand-600/20 flex items-center justify-center mx-auto mb-4 animate-pulse-soft">
//         <span className="text-2xl font-display font-bold gradient-text">M</span>
//       </div>
//       <Spinner size={20} className="text-brand-400 mx-auto" />
//     </div>
//   </div>
// );

// export const PageHeader = ({ title, subtitle, action }) => (
//   <div className="flex items-start justify-between mb-6">
//     <div>
//       <h1 className="text-2xl font-display font-bold text-white">{title}</h1>
//       {subtitle && <p className="text-surface-400 text-sm mt-1">{subtitle}</p>}
//     </div>
//     {action && <div>{action}</div>}
//   </div>
// );
