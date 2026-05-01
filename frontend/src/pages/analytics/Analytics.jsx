import { useState } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { Activity, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import { PageHeader, StatCard, Spinner } from "../../components/ui/index";
import {
  useAnalyticsOverview, useUsageOverTime,
  useLatencyStats, useTopEndpoints,
} from "../../hooks/useBilling";
import { formatNumber, formatLatency } from "../../utils/formatters";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg p-3 text-xs border border-surface-700">
      <p className="text-surface-400 mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {formatNumber(p.value)}
        </p>
      ))}
    </div>
  );
};

const GROUP_OPTIONS = [
  { label: "Hourly", value: "hour" },
  { label: "Daily", value: "day" },
  { label: "Monthly", value: "month" },
];

export default function Analytics() {
  const [groupBy, setGroupBy] = useState("day");
  const { data: overview, isLoading: loadingOverview } = useAnalyticsOverview();
  const { data: usageData, isLoading: loadingUsage } = useUsageOverTime({ groupBy });
  const { data: latency } = useLatencyStats();
  const { data: topEndpoints } = useTopEndpoints({ limit: 8 });

  const chartData = usageData?.data || [];
  const endpoints = topEndpoints?.data || [];

  // Build pie data from endpoints
  const pieData = endpoints.slice(0, 5).map((e, i) => ({
    name: `${e.method} ${e.endpoint}`,
    value: e.totalRequests,
    color: COLORS[i],
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Deep dive into your API performance" />

      {/* Overview Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Requests" icon={Activity} color="brand"
          value={loadingOverview ? "—" : formatNumber(overview?.totalRequests || 0)} />
        <StatCard label="Success Rate" icon={TrendingUp} color="emerald"
          value={loadingOverview ? "—" : `${overview?.successRate || 100}%`} />
        <StatCard label="Avg Latency" icon={Clock} color="violet"
          value={loadingOverview ? "—" : formatLatency(overview?.avgLatency || 0)} />
        <StatCard label="Error Rate" icon={AlertTriangle} color="red"
          value={loadingOverview ? "—" : `${overview?.errorRate || 0}%`}
          sub={`${formatNumber(overview?.failedRequests || 0)} failed`} />
      </div>

      {/* Usage Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display font-semibold text-white">Request Volume</h2>
            <p className="text-surface-400 text-xs mt-0.5">Requests over time</p>
          </div>
          <div className="flex rounded-lg overflow-hidden border border-surface-700">
            {GROUP_OPTIONS.map((opt) => (
              <button key={opt.value}
                onClick={() => setGroupBy(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-all ${
                  groupBy === opt.value
                    ? "bg-brand-600 text-white"
                    : "text-surface-400 hover:text-surface-200"
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loadingUsage ? (
          <div className="h-56 flex items-center justify-center"><Spinner className="text-brand-400" /></div>
        ) : chartData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-surface-500 text-sm">
            No data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gFail" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="requests" name="Total" stroke="#6366f1"
                fill="url(#gReq)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="failed" name="Failed" stroke="#ef4444"
                fill="url(#gFail)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Latency Percentiles */}
        <div className="card">
          <h2 className="font-display font-semibold text-white mb-4">Latency Percentiles</h2>
          {latency ? (
            <>
              <div className="space-y-3 mb-4">
                {[
                  { label: "p50 (Median)", value: latency.p50, color: "#10b981" },
                  { label: "p75", value: latency.p75, color: "#6366f1" },
                  { label: "p95", value: latency.p95, color: "#f59e0b" },
                  { label: "p99 (Worst)", value: latency.p99, color: "#ef4444" },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-surface-400">{label}</span>
                      <span className="font-mono" style={{ color }}>{formatLatency(value || 0)}</span>
                    </div>
                    <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, ((value || 0) / (latency.max || 1)) * 100)}%`, background: color }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-surface-700/50">
                <div className="text-center">
                  <p className="text-xs text-surface-500">Min</p>
                  <p className="text-sm font-mono text-emerald-400">{formatLatency(latency.min || 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-surface-500">Max</p>
                  <p className="text-sm font-mono text-red-400">{formatLatency(latency.max || 0)}</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-surface-500 text-sm">No latency data yet</p>
          )}
        </div>

        {/* Top Endpoints */}
        <div className="card">
          <h2 className="font-display font-semibold text-white mb-4">Top Endpoints</h2>
          {endpoints.length === 0 ? (
            <p className="text-surface-500 text-sm">No endpoint data yet</p>
          ) : (
            <div className="space-y-2">
              {endpoints.slice(0, 6).map((ep, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                    ep.method === "GET" ? "text-emerald-400 bg-emerald-500/10"
                    : ep.method === "POST" ? "text-brand-400 bg-brand-500/10"
                    : "text-amber-400 bg-amber-500/10"
                  }`}>{ep.method}</span>
                  <span className="text-xs font-mono text-surface-300 flex-1 truncate">{ep.endpoint}</span>
                  <span className="text-xs text-surface-400 font-mono">{formatNumber(ep.totalRequests)}</span>
                  <span className={`text-xs ${ep.successRate > 95 ? "text-emerald-400" : "text-red-400"}`}>
                    {ep.successRate}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Endpoints Bar Chart */}
      {endpoints.length > 0 && (
        <div className="card">
          <h2 className="font-display font-semibold text-white mb-5">Endpoint Request Distribution</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={endpoints.slice(0, 8)} margin={{ top: 0, right: 5, bottom: 20, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="endpoint" tick={{ fontSize: 10, fill: "#64748b" }}
                tickLine={false} angle={-20} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="totalRequests" name="Requests" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
