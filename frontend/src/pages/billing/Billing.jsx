import { useState } from "react";
import {
  CreditCard,
  TrendingUp,
  Zap,
  CheckCircle,
  ArrowRight,
  Receipt,
} from "lucide-react";
import { PageHeader, StatCard, Spinner } from "../../components/ui/index";
import PaymentModal from "../../components/ui/PaymentModal";
import {
  useCurrentBilling,
  useBillingHistory,
  usePlans,
  useCalculateBill,
} from "../../hooks/useBilling";
import {
  useUpgradePlan,
  usePayInvoice,
  usePaymentHistory,
} from "../../hooks/usePayments";
import {
  formatCurrency,
  formatNumber,
  formatDate,
} from "../../utils/formatters";
import useAuthStore from "../../store/authStore";

// ── Bill Calculator ───────────────────────────────────────────────────────────
function BillingCalculator() {
  const [requests, setRequests] = useState(10000);
  const [plan, setPlan] = useState("pro");
  const { mutate: calculate, data: result, isPending } = useCalculateBill();

  return (
    <div className="card">
      <h2 className="font-display font-semibold text-white mb-4">
        Bill Calculator
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-xs text-surface-400 mb-1.5">Plan</label>
          <select
            className="input text-sm"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          >
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-surface-400 mb-1.5">
            Requests / Month
          </label>
          <input
            type="number"
            className="input text-sm font-mono"
            value={requests}
            min={0}
            onChange={(e) => setRequests(parseInt(e.target.value) || 0)}
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={() => calculate({ requests, plan })}
            disabled={isPending}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {isPending && <Spinner size={14} />}Calculate
          </button>
        </div>
      </div>
      {result && (
        <div className="bg-surface-800/50 rounded-xl p-4 border border-surface-700/50 space-y-2 animate-fade-in">
          {[
            {
              label: "Free Requests",
              value: formatNumber(result.breakdown?.freeRequests || 0),
            },
            {
              label: "Billable Requests",
              value: formatNumber(result.breakdown?.billableRequests || 0),
            },
            {
              label: "Rate",
              value: `₹${result.breakdown?.pricePerHundred}/100 req`,
            },
            {
              label: "Subtotal",
              value: formatCurrency(result.pricing?.subtotal || 0),
            },
            {
              label: `GST (${result.pricing?.gstRate})`,
              value: formatCurrency(result.pricing?.gst || 0),
            },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-surface-400">{label}</span>
              <span className="text-surface-200 font-mono">{value}</span>
            </div>
          ))}
          <div className="flex justify-between text-base font-semibold pt-2 border-t border-surface-700/50">
            <span className="text-white">Total Due</span>
            <span className="text-brand-400 font-mono">
              {formatCurrency(result.pricing?.total || 0)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Plan Card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan }) {
  const [showPayment, setShowPayment] = useState(false);
  const { mutate: upgrade, isPending } = useUpgradePlan();

  const handlePay = async (paymentDetails) => {
    return new Promise((resolve, reject) => {
      upgrade(
        { plan: plan.id, paymentDetails },
        {
          onSuccess: (data) => {
            setShowPayment(false);
            resolve(data);
          },
          onError: (err) => reject(err),
        },
      );
    });
  };

  return (
    <>
      <div
        className={`card relative ${plan.isPopular ? "border-brand-500/40" : ""} ${plan.isCurrent ? "ring-1 ring-brand-500/30" : ""}`}
      >
        {plan.isPopular && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="badge badge-blue text-[10px] px-3 py-1">
              MOST POPULAR
            </span>
          </div>
        )}
        {plan.isCurrent && (
          <div className="absolute top-3 right-3">
            <span className="badge badge-green text-[10px]">CURRENT</span>
          </div>
        )}

        <h3 className="font-display font-bold text-lg text-white mb-1">
          {plan.name}
        </h3>
        <p className="text-surface-400 text-xs mb-3">{plan.description}</p>

        <div className="mb-4">
          <span className="text-2xl font-bold font-mono text-white">
            {plan.price === 0
              ? "Free"
              : formatCurrency(plan.price, plan.currency)}
          </span>
          {plan.price > 0 && (
            <span className="text-surface-400 text-xs">/month</span>
          )}
        </div>

        <div className="mb-4 text-xs text-surface-400 space-y-0.5">
          <p className="font-mono">
            {formatNumber(plan.freeQuota)} free requests
          </p>
          {plan.pricePerHundred > 0 && (
            <p className="font-mono text-surface-500">
              + ₹{plan.pricePerHundred}/100 after
            </p>
          )}
        </div>

        <ul className="space-y-1.5 mb-5">
          {plan.features.map((f) => (
            <li
              key={f}
              className="flex items-start gap-2 text-xs text-surface-300"
            >
              <CheckCircle
                size={12}
                className="text-emerald-400 mt-0.5 shrink-0"
              />
              {f}
            </li>
          ))}
        </ul>

        <button
          disabled={plan.isCurrent || plan.id === "free"}
          onClick={() =>
            !plan.isCurrent && plan.id !== "free" && setShowPayment(true)
          }
          className={`w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2
            ${
              plan.isCurrent || plan.id === "free"
                ? "bg-surface-700 text-surface-400 cursor-default"
                : "btn-primary"
            }`}
        >
          {plan.isCurrent ? (
            "Current Plan"
          ) : plan.id === "free" ? (
            "Free Plan"
          ) : (
            <>
              Upgrade <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>

      <PaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        amount={plan.price}
        currency={plan.currency}
        title={`Upgrade to ${plan.name}`}
        onPay={handlePay}
        isPending={isPending}
      />
    </>
  );
}

// ── Payment History ───────────────────────────────────────────────────────────
function PaymentHistory() {
  const { data, isLoading } = usePaymentHistory();
  const payments = data?.history || [];

  if (isLoading || !payments.length) return null;

  return (
    <div className="card">
      <h2 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
        <Receipt size={16} className="text-brand-400" />
        Payment History
      </h2>
      <div className="space-y-2">
        {payments.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center justify-between py-2.5 border-b border-surface-800/50 last:border-0"
          >
            <div>
              <p className="text-xs font-mono text-surface-400">
                {tx.order_id}
              </p>
              <p className="text-xs text-surface-500">
                {formatDate(tx.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`badge text-[10px] ${
                  tx.status === "captured"
                    ? "badge-green"
                    : tx.status === "failed"
                      ? "badge-red"
                      : "badge-yellow"
                }`}
              >
                {tx.status}
              </span>
              <span className="text-sm font-mono font-medium text-white">
                {formatCurrency(tx.amount, tx.currency)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Billing Page ─────────────────────────────────────────────────────────
export default function Billing() {
  const { user } = useAuthStore();
  const [showInvoicePayment, setShowInvoicePayment] = useState(false);
  const { data: billing, isLoading } = useCurrentBilling();
  const { data: history } = useBillingHistory();
  const { data: plansData } = usePlans();
  const { mutate: payInvoice, isPending: paying } = usePayInvoice();

  const plans = plansData?.plans || [];
  const historyList = history?.history || [];
  const amountDue = billing?.billing?.total || 0;

  const handleInvoicePay = async (paymentDetails) => {
    return new Promise((resolve, reject) => {
      payInvoice(
        { cycleId: billing?.invoice?.cycleId, paymentDetails },
        {
          onSuccess: (data) => {
            setShowInvoicePayment(false);
            resolve(data);
          },
          onError: (err) => reject(err),
        },
      );
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        subtitle="Manage your plan, usage and invoices"
      />

      {/* Stats */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner className="text-brand-400" />
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Current Plan"
            icon={Zap}
            color="brand"
            value={user?.plan?.toUpperCase()}
            sub="Active"
          />
          <StatCard
            label="Total Requests"
            icon={TrendingUp}
            color="emerald"
            value={formatNumber(billing?.usage?.totalRequests || 0)}
            sub={`${formatNumber(billing?.usage?.freeQuota || 0)} free`}
          />
          <StatCard
            label="Billable Requests"
            icon={CreditCard}
            color="amber"
            value={formatNumber(billing?.usage?.billableRequests || 0)}
          />
          <StatCard
            label="Amount Due"
            icon={CreditCard}
            color="red"
            value={formatCurrency(amountDue)}
            sub={
              billing?.invoice
                ? `Due ${formatDate(billing.invoice.periodEnd)}`
                : "No charges"
            }
          />
        </div>
      )}

      {/* Current Invoice */}
      {billing?.billing && (
        <div className="card">
          <h2 className="font-display font-semibold text-white mb-4">
            Current Invoice
          </h2>
          <div className="space-y-2">
            {[
              {
                label: "Period",
                value: billing.invoice
                  ? `${formatDate(billing.invoice.periodStart)} – ${formatDate(billing.invoice.periodEnd)}`
                  : "—",
              },
              {
                label: "Total Requests",
                value: formatNumber(billing.usage?.totalRequests || 0),
              },
              {
                label: "Free Quota",
                value: formatNumber(billing.pricing?.freeQuota || 0),
              },
              {
                label: "Billable Requests",
                value: formatNumber(billing.usage?.billableRequests || 0),
              },
              {
                label: "Rate",
                value: `₹${billing.pricing?.pricePerHundred || 0} per 100 req`,
              },
              {
                label: "Subtotal",
                value: formatCurrency(billing.billing.subtotal || 0),
              },
              {
                label: `GST (${billing.billing.taxRate || "18%"})`,
                value: formatCurrency(billing.billing.tax || 0),
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex justify-between py-2 border-b border-surface-800/50 last:border-0 text-sm"
              >
                <span className="text-surface-400">{label}</span>
                <span className="text-surface-200 font-mono">{value}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 font-semibold text-base">
              <span className="text-white">Total Due</span>
              <span className="text-brand-400 font-mono text-lg">
                {formatCurrency(amountDue)}
              </span>
            </div>
          </div>

          {amountDue > 0 && (
            <button
              onClick={() => setShowInvoicePayment(true)}
              className="btn-primary w-full mt-4 py-2.5 flex items-center justify-center gap-2"
            >
              <CreditCard size={16} />
              Pay Now — {formatCurrency(amountDue)}
            </button>
          )}
        </div>
      )}

      {/* Invoice Payment Modal */}
      <PaymentModal
        open={showInvoicePayment}
        onClose={() => setShowInvoicePayment(false)}
        amount={amountDue}
        title="Pay Invoice"
        onPay={handleInvoicePay}
        isPending={paying}
      />

      {/* Calculator */}
      <BillingCalculator />

      {/* Payment History */}
      <PaymentHistory />

      {/* Billing History */}
      {historyList.length > 0 && (
        <div className="card">
          <h2 className="font-display font-semibold text-white mb-4">
            Invoice History
          </h2>
          <div className="space-y-2">
            {historyList.map((cycle) => (
              <div
                key={cycle.id}
                className="flex items-center justify-between py-2.5 border-b border-surface-800/50 last:border-0"
              >
                <div>
                  <p className="text-sm text-surface-200">
                    {formatDate(cycle.period_start)} –{" "}
                    {formatDate(cycle.period_end)}
                  </p>
                  <p className="text-xs text-surface-500">
                    {formatNumber(cycle.total_requests || 0)} requests
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-white">
                    {formatCurrency(cycle.amount_due || 0)}
                  </p>
                  <span
                    className={`badge text-[10px] ${cycle.status === "paid" ? "badge-green" : cycle.status === "active" ? "badge-blue" : "badge-gray"}`}
                  >
                    {cycle.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plans */}
      <div>
        <h2 className="font-display font-semibold text-white mb-4">
          Available Plans
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </div>
    </div>
  );
}
