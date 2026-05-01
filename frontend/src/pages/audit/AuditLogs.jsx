import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Shield,
  Activity,
  Key,
  CreditCard,
  Settings,
  Webhook,
} from "lucide-react";
import { PageHeader, Spinner, EmptyState } from "../../components/ui/index";
import api from "../../services/api.service";
import { formatDateTime } from "../../utils/formatters";
import clsx from "clsx";

const CATEGORIES = [
  { id: "", label: "All", icon: Activity },
  { id: "auth", label: "Auth", icon: Shield },
  { id: "api", label: "APIs", icon: Activity },
  { id: "key", label: "Keys", icon: Key },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "webhook", label: "Webhooks", icon: Webhook },
  { id: "settings", label: "Settings", icon: Settings },
];

const ACTION_COLORS = {
  login: "badge-green",
  logout: "badge-gray",
  register: "badge-blue",
  password_change: "badge-yellow",
  create: "badge-blue",
  update: "badge-yellow",
  delete: "badge-red",
  toggle: "badge-yellow",
  generate: "badge-green",
  revoke: "badge-red",
  rotate: "badge-yellow",
  plan_upgrade: "badge-green",
  invoice_paid: "badge-green",
};

export default function AuditLogs() {
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["audit", category, page],
    queryFn: () =>
      api
        .get("/audit", { params: { category, page, limit: 20 } })
        .then((r) => r.data.data),
  });

  const logs = data?.logs || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        subtitle="Complete history of all actions on your account"
      />

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setCategory(id);
              setPage(1);
            }}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              category === id
                ? "bg-brand-600/20 text-brand-400 border border-brand-600/30"
                : "text-surface-400 hover:text-surface-200 bg-surface-800 border border-surface-700",
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Logs table */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner className="text-brand-400" />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No audit logs"
          desc="Actions will be recorded here as you use MeterFlow"
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700/50">
                  {[
                    "Time",
                    "Category",
                    "Action",
                    "Description",
                    "Status",
                    "IP",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-medium text-surface-400 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/50">
                {logs.map((log) => (
                  <tr
                    key={log._id}
                    className="hover:bg-surface-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs font-mono text-surface-400 whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge badge-gray text-[10px]">
                        {log.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge text-[10px] ${ACTION_COLORS[log.action] || "badge-gray"}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-surface-300 max-w-xs truncate">
                      {log.description}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge text-[10px] ${log.status === "success" ? "badge-green" : "badge-red"}`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-surface-500">
                      {log.ip || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-surface-700/50">
              <p className="text-xs text-surface-400">
                Showing {(page - 1) * 20 + 1}–
                {Math.min(page * 20, pagination.total)} of {pagination.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="btn-secondary text-xs py-1 px-2 disabled:opacity-40"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pagination.totalPages}
                  className="btn-secondary text-xs py-1 px-2 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
