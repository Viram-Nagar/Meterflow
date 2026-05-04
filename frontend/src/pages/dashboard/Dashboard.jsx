import { Activity, Boxes, CreditCard, TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { StatCard, PageHeader, Spinner } from "../../components/ui/index";
import {
  useAnalyticsOverview,
  useUsageOverTime,
  useCurrentBilling,
} from "../../hooks/useBilling";
import { useAPIs } from "../../hooks/useAPIs";
import {
  formatNumber,
  formatCurrency,
  formatDate,
} from "../../utils/formatters";
import useAuthStore from "../../store/authStore";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg p-3 text-xs border border-surface-700">
      <p className="text-surface-400 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {formatNumber(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const { data: overview, isLoading: loadingOverview } = useAnalyticsOverview();
  const { data: usageData, isLoading: loadingUsage } = useUsageOverTime({
    groupBy: "day",
  });
  const { data: billing } = useCurrentBilling();
  const { data: apisData } = useAPIs();

  const chartData = usageData?.data || [];

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}, ${user?.name?.split(" ")[0]} 👋`}
        subtitle="Here's what's happening with your APIs today"
      />

      {/* Stat Cards — 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Total Requests"
          icon={Activity}
          color="brand"
          value={
            loadingOverview ? "—" : formatNumber(overview?.totalRequests || 0)
          }
          sub="This billing cycle"
        />
        <StatCard
          label="Success Rate"
          icon={TrendingUp}
          color="emerald"
          value={loadingOverview ? "—" : `${overview?.successRate || 100}%`}
          sub={`${formatNumber(overview?.successRequests || 0)} ok`}
        />
        <StatCard
          label="Active APIs"
          icon={Boxes}
          color="violet"
          value={
            apisData?.data?.filter((a) => a.status === "active").length || 0
          }
          sub={`${apisData?.data?.length || 0} total`}
        />
        <StatCard
          label="Amount Due"
          icon={CreditCard}
          color="amber"
          value={
            billing?.billing ? formatCurrency(billing.billing.total) : "₹0.00"
          }
          sub="Current cycle"
        />
      </div>

      {/* Usage Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display font-semibold text-white text-sm md:text-base">
              Request Volume
            </h2>
            <p className="text-surface-400 text-xs mt-0.5">
              Daily requests this month
            </p>
          </div>
        </div>
        {loadingUsage ? (
          <div className="h-40 md:h-48 flex items-center justify-center">
            <Spinner className="text-brand-400" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-40 md:h-48 flex flex-col items-center justify-center text-surface-500">
            <Activity size={24} className="mb-2 opacity-40" />
            <p className="text-sm text-center">
              No data yet. Make some API calls first.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 5, bottom: 0, left: -20 }}
            >
              <defs>
                <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#64748b" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="requests"
                name="Requests"
                stroke="#6366f1"
                fill="url(#gReq)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom row — stacks on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-display font-semibold text-white mb-3 text-sm md:text-base">
            Performance
          </h2>
          <div className="space-y-2">
            {[
              {
                label: "Avg Latency",
                value: overview
                  ? `${Math.round(overview.avgLatency || 0)}ms`
                  : "—",
              },
              {
                label: "Min Latency",
                value: overview ? `${overview.minLatency || 0}ms` : "—",
              },
              {
                label: "Max Latency",
                value: overview ? `${overview.maxLatency || 0}ms` : "—",
              },
              {
                label: "Error Rate",
                value: overview ? `${overview.errorRate || 0}%` : "—",
                warn: (overview?.errorRate || 0) > 5,
              },
            ].map(({ label, value, warn }) => (
              <div
                key={label}
                className="flex justify-between py-2 border-b border-surface-800/50 last:border-0"
              >
                <span className="text-xs md:text-sm text-surface-400">
                  {label}
                </span>
                <span
                  className={`text-xs md:text-sm font-medium font-mono ${warn ? "text-red-400" : "text-surface-200"}`}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="font-display font-semibold text-white mb-3 text-sm md:text-base">
            Billing Summary
          </h2>
          <div className="space-y-2">
            {[
              { label: "Plan", value: user?.plan?.toUpperCase() },
              {
                label: "Total Requests",
                value: formatNumber(billing?.usage?.totalRequests || 0),
              },
              {
                label: "Free Quota",
                value: formatNumber(billing?.usage?.freeQuota || 0),
              },
              {
                label: "Billable Requests",
                value: formatNumber(billing?.usage?.billableRequests || 0),
              },
              {
                label: "Amount Due",
                value: formatCurrency(billing?.billing?.total || 0),
                highlight: true,
              },
            ].map(({ label, value, highlight }) => (
              <div
                key={label}
                className="flex justify-between py-2 border-b border-surface-800/50 last:border-0"
              >
                <span className="text-xs md:text-sm text-surface-400">
                  {label}
                </span>
                <span
                  className={`text-xs md:text-sm font-medium ${highlight ? "text-brand-400 font-mono" : "text-surface-200"}`}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
