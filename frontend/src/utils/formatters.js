import { format, formatDistanceToNow } from "date-fns";

export const formatDate = (date) => format(new Date(date), "MMM d, yyyy");
export const formatDateTime = (date) =>
  format(new Date(date), "MMM d, yyyy HH:mm");
export const formatRelative = (date) =>
  formatDistanceToNow(new Date(date), { addSuffix: true });
export const formatNumber = (n) => new Intl.NumberFormat("en-IN").format(n);
export const formatCurrency = (amount, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
export const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
export const formatLatency = (ms) =>
  ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
export const truncateKey = (key) =>
  key?.length > 20 ? `${key.substring(0, 20)}...` : key;
