import { useState } from "react";
import {
  CreditCard,
  Smartphone,
  Building,
  Lock,
  CheckCircle,
  XCircle,
  Loader2,
  Shield,
} from "lucide-react";
import { formatCurrency } from "../../utils/formatters";

const PAYMENT_METHODS = [
  { id: "card", label: "Card", icon: CreditCard },
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "netbanking", label: "Net Banking", icon: Building },
];

// Test card numbers (shown as hints)
const TEST_CARDS = [
  {
    number: "4111 1111 1111 1111",
    label: "Success",
    color: "text-emerald-400",
  },
  { number: "4000 0000 0000 0002", label: "Decline", color: "text-red-400" },
];

const UPI_IDS = ["success@meterflow", "test@upi"];

function formatCardNumber(value) {
  return value
    .replace(/\D/g, "")
    .substring(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, "").substring(0, 4);
  return digits.length >= 3
    ? `${digits.substring(0, 2)}/${digits.substring(2)}`
    : digits;
}

export default function PaymentModal({
  open,
  onClose,
  amount,
  currency = "INR",
  title,
  onPay,
  isPending,
}) {
  const [method, setMethod] = useState("card");
  const [card, setCard] = useState({
    number: "",
    expiry: "",
    cvv: "",
    name: "",
  });
  const [upiId, setUpiId] = useState("");
  const [bank, setBank] = useState("sbi");
  const [step, setStep] = useState("form"); // form | processing | success | failed
  const [result, setResult] = useState(null);

  if (!open) return null;

  const handlePay = async () => {
    setStep("processing");
    try {
      let paymentDetails = { method };
      if (method === "card") {
        paymentDetails.cardNumber = card.number.replace(/\s/g, "");
        paymentDetails.expiry = card.expiry;
        paymentDetails.cvv = card.cvv;
      } else if (method === "upi") {
        paymentDetails.upiId = upiId;
      } else {
        paymentDetails.bank = bank;
      }

      const res = await onPay(paymentDetails);
      setResult(res);
      setStep("success");
    } catch (err) {
      setStep("failed");
    }
  };

  const reset = () => {
    setStep("form");
    setCard({ number: "", expiry: "", cvv: "", name: "" });
    setUpiId("");
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={step === "form" ? handleClose : undefined}
      />

      <div className="relative w-full max-w-md glass rounded-2xl shadow-2xl animate-slide-up overflow-hidden">
        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-brand-900/80 to-brand-800/60 px-5 py-4 border-b border-brand-700/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">⚡</span>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">
                  MeterFlow Payments
                </p>
                <p className="text-brand-300 text-xs">
                  {title || "Secure Checkout"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white font-bold font-mono text-lg">
                {formatCurrency(amount, currency)}
              </p>
              <div className="flex items-center gap-1 text-brand-300 text-xs justify-end">
                <Lock size={10} />
                <span>Secured</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5">
          {/* ── Processing State ── */}
          {step === "processing" && (
            <div className="flex flex-col items-center py-10 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-brand-500/20 flex items-center justify-center mb-4">
                <Loader2 size={28} className="text-brand-400 animate-spin" />
              </div>
              <p className="text-white font-semibold mb-1">
                Processing Payment
              </p>
              <p className="text-surface-400 text-sm">
                Please wait, do not close this window...
              </p>
            </div>
          )}

          {/* ── Success State ── */}
          {step === "success" && (
            <div className="flex flex-col items-center py-8 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                <CheckCircle size={32} className="text-emerald-400" />
              </div>
              <p className="text-white font-bold text-lg mb-1">
                Payment Successful!
              </p>
              <p className="text-surface-400 text-sm mb-4">
                {formatCurrency(amount, currency)} paid successfully
              </p>
              {result?.paymentId && (
                <code className="text-xs font-mono text-surface-400 bg-surface-800 px-3 py-1.5 rounded-lg mb-6">
                  ID: {result.paymentId}
                </code>
              )}
              <button
                onClick={handleClose}
                className="btn-primary w-full py-2.5"
              >
                Done
              </button>
            </div>
          )}

          {/* ── Failed State ── */}
          {step === "failed" && (
            <div className="flex flex-col items-center py-8 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <XCircle size={32} className="text-red-400" />
              </div>
              <p className="text-white font-bold text-lg mb-1">
                Payment Failed
              </p>
              <p className="text-surface-400 text-sm mb-6">
                Your card was declined. Try a different card.
              </p>
              <div className="flex gap-3 w-full">
                <button onClick={handleClose} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button onClick={reset} className="btn-primary flex-1">
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* ── Form State ── */}
          {step === "form" && (
            <div className="animate-fade-in">
              {/* Method tabs */}
              <div className="flex rounded-xl overflow-hidden border border-surface-700 mb-5">
                {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setMethod(id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all
                      ${
                        method === id
                          ? "bg-brand-600 text-white"
                          : "text-surface-400 hover:text-surface-200"
                      }`}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                ))}
              </div>

              {/* ── Card Form ── */}
              {method === "card" && (
                <div className="space-y-3">
                  {/* Test card hints */}
                  <div className="bg-surface-800/50 rounded-lg px-3 py-2 border border-surface-700/50">
                    <p className="text-[10px] text-surface-500 mb-1.5 font-medium uppercase tracking-wider">
                      Test Cards
                    </p>
                    <div className="space-y-1">
                      {TEST_CARDS.map((c) => (
                        <button
                          key={c.number}
                          onClick={() => setCard({ ...card, number: c.number })}
                          className="w-full flex justify-between text-xs hover:opacity-80 transition-opacity"
                        >
                          <code className="font-mono text-surface-300">
                            {c.number}
                          </code>
                          <span className={c.color}>{c.label}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-surface-600 mt-1.5">
                      Any CVV, any future expiry
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs text-surface-400 mb-1.5">
                      Card Number
                    </label>
                    <div className="relative">
                      <input
                        className="input font-mono pr-10"
                        placeholder="1234 5678 9012 3456"
                        value={card.number}
                        onChange={(e) =>
                          setCard({
                            ...card,
                            number: formatCardNumber(e.target.value),
                          })
                        }
                      />
                      <CreditCard
                        size={16}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-surface-400 mb-1.5">
                      Cardholder Name
                    </label>
                    <input
                      className="input"
                      placeholder="Name on card"
                      value={card.name}
                      onChange={(e) =>
                        setCard({ ...card, name: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-surface-400 mb-1.5">
                        Expiry
                      </label>
                      <input
                        className="input font-mono"
                        placeholder="MM/YY"
                        value={card.expiry}
                        onChange={(e) =>
                          setCard({
                            ...card,
                            expiry: formatExpiry(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-surface-400 mb-1.5">
                        CVV
                      </label>
                      <input
                        className="input font-mono"
                        placeholder="•••"
                        maxLength={4}
                        type="password"
                        value={card.cvv}
                        onChange={(e) =>
                          setCard({
                            ...card,
                            cvv: e.target.value
                              .replace(/\D/g, "")
                              .substring(0, 4),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── UPI Form ── */}
              {method === "upi" && (
                <div className="space-y-3">
                  <div className="bg-surface-800/50 rounded-lg px-3 py-2 border border-surface-700/50">
                    <p className="text-[10px] text-surface-500 mb-1.5 font-medium uppercase tracking-wider">
                      Test UPI IDs
                    </p>
                    <div className="space-y-1">
                      {UPI_IDS.map((id) => (
                        <button
                          key={id}
                          onClick={() => setUpiId(id)}
                          className="w-full text-left text-xs font-mono text-brand-400 hover:opacity-80"
                        >
                          {id}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-surface-400 mb-1.5">
                      UPI ID / VPA
                    </label>
                    <input
                      className="input font-mono"
                      placeholder="yourname@upi"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-surface-500">
                    A payment request will be sent to your UPI app
                  </p>
                </div>
              )}

              {/* ── Net Banking Form ── */}
              {method === "netbanking" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-surface-400 mb-1.5">
                      Select Bank
                    </label>
                    <select
                      className="input"
                      value={bank}
                      onChange={(e) => setBank(e.target.value)}
                    >
                      <option value="sbi">State Bank of India</option>
                      <option value="hdfc">HDFC Bank</option>
                      <option value="icici">ICICI Bank</option>
                      <option value="axis">Axis Bank</option>
                      <option value="kotak">Kotak Mahindra Bank</option>
                      <option value="bob">Bank of Baroda</option>
                      <option value="pnb">Punjab National Bank</option>
                    </select>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <p className="text-amber-400 text-xs">
                      You will be redirected to your bank's secure portal to
                      complete the payment.
                    </p>
                  </div>
                </div>
              )}

              {/* Pay button */}
              <button
                onClick={handlePay}
                disabled={
                  (method === "card" &&
                    (!card.number || !card.expiry || !card.cvv)) ||
                  (method === "upi" && !upiId)
                }
                className="btn-primary w-full mt-5 py-3 flex items-center justify-center gap-2 text-base"
              >
                <Lock size={15} />
                Pay {formatCurrency(amount, currency)}
              </button>

              {/* Security footer */}
              <div className="flex items-center justify-center gap-4 mt-3">
                <div className="flex items-center gap-1 text-surface-600 text-[10px]">
                  <Shield size={10} />
                  <span>256-bit SSL</span>
                </div>
                <div className="flex items-center gap-1 text-surface-600 text-[10px]">
                  <Lock size={10} />
                  <span>PCI DSS Compliant</span>
                </div>
                <div className="text-surface-600 text-[10px]">
                  🔒 Powered by MeterFlow
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
