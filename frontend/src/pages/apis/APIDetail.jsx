import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Copy,
  RotateCw,
  XCircle,
  Key,
  CheckCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  PageHeader,
  StatusBadge,
  Modal,
  Spinner,
  EmptyState,
  CopyButton,
} from "../../components/ui/index";
import {
  useAPI,
  useAPIKeys,
  useGenerateKey,
  useRevokeKey,
  useRotateKey,
} from "../../hooks/useAPIs";
import {
  formatDate,
  formatRelative,
  formatNumber,
} from "../../utils/formatters";
import toast from "react-hot-toast";

function NewKeyModal({ open, onClose, apiId }) {
  const [form, setForm] = useState({ name: "", description: "" });
  const { mutate: generate, isPending, data: result } = useGenerateKey(apiId);
  const [done, setDone] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    generate(form, {
      onSuccess: () => setDone(true),
    });
  };

  const handleClose = () => {
    setForm({ name: "", description: "" });
    setDone(false);
    setShowKey(false);
    onClose();
  };

  // Show generated key
  if (done && result?.data?.data) {
    const { rawKey, keyPrefix } = result.data.data.key;
    return (
      <Modal open={open} onClose={handleClose} title="API Key Generated ✅">
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-amber-400 text-sm font-medium mb-1">
              ⚠️ Save this key now!
            </p>
            <p className="text-amber-300/70 text-xs">
              This key will never be shown again. Copy it somewhere safe.
            </p>
          </div>

          <div>
            <label className="block text-xs text-surface-400 mb-1.5">
              Your API Key
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 text-brand-300 truncate">
                {showKey ? rawKey : "mf_live_" + "•".repeat(32)}
              </code>
              <button
                onClick={() => setShowKey(!showKey)}
                className="btn-secondary p-2"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <CopyButton text={rawKey} label="Copy" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-surface-400 mb-1.5">
              Key Prefix (for reference)
            </label>
            <code className="text-xs font-mono text-surface-400">
              {keyPrefix}
            </code>
          </div>

          <button onClick={handleClose} className="btn-primary w-full">
            Done — I've saved the key
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Generate API Key">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Key Name
          </label>
          <input
            className="input"
            placeholder="e.g. Production Key"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Description
          </label>
          <input
            className="input"
            placeholder="Optional note about this key"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={handleClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="btn-primary flex items-center gap-2"
          >
            {isPending && <Spinner size={14} />}Generate Key
          </button>
        </div>
      </form>
    </Modal>
  );
}

function KeyCard({ apiKey, apiId }) {
  const { mutate: revoke, isPending: revoking } = useRevokeKey(apiId);
  const {
    mutate: rotate,
    isPending: rotating,
    data: rotateResult,
  } = useRotateKey(apiId);
  const [showRotated, setShowRotated] = useState(false);

  const handleRotate = () => {
    rotate(apiKey._id, {
      onSuccess: (data) => {
        setShowRotated(true);
        toast.success("Key rotated! Save your new key.");
      },
    });
  };

  const newKey = rotateResult?.data?.data?.newKey;

  return (
    <div className="card glass-hover">
      {showRotated && newKey && (
        <div className="mb-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <p className="text-amber-400 text-xs font-medium mb-1.5">
            ⚠️ New Key — Save immediately!
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-brand-300 truncate bg-surface-800 px-2 py-1.5 rounded border border-surface-700">
              {newKey.rawKey}
            </code>
            <CopyButton text={newKey.rawKey} />
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Key size={14} className="text-brand-400 shrink-0" />
            <span className="font-medium text-white text-sm truncate">
              {apiKey.name || "Unnamed Key"}
            </span>
            <StatusBadge status={apiKey.status} />
            <StatusBadge status={apiKey.tier} />
          </div>
          <code className="text-xs font-mono text-surface-400">
            {apiKey.keyPrefix}
          </code>
          <div className="flex items-center gap-4 mt-2 text-xs text-surface-500">
            <span>
              {formatNumber(apiKey.totalRequests || 0)} total requests
            </span>
            <span>
              {formatNumber(apiKey.currentMonthRequests || 0)} this month
            </span>
            {apiKey.lastUsedAt && (
              <span>Last used {formatRelative(apiKey.lastUsedAt)}</span>
            )}
            <span>Created {formatDate(apiKey.createdAt)}</span>
          </div>

          {/* Usage bar */}
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-surface-500 mb-1">
              <span>Monthly usage</span>
              <span>
                {formatNumber(apiKey.currentMonthRequests || 0)} /{" "}
                {formatNumber(apiKey.rateLimit?.requestsPerMonth || 0)}
              </span>
            </div>
            <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, ((apiKey.currentMonthRequests || 0) / (apiKey.rateLimit?.requestsPerMonth || 1)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {apiKey.status === "active" && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRotate}
              disabled={rotating}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              {rotating ? <Spinner size={12} /> : <RotateCw size={12} />}Rotate
            </button>
            <button
              onClick={() => revoke(apiKey._id)}
              disabled={revoking}
              className="btn-danger text-xs flex items-center gap-1.5"
            >
              {revoking ? <Spinner size={12} /> : <XCircle size={12} />}Revoke
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function APIDetail() {
  const { apiId } = useParams();
  const [showNewKey, setShowNewKey] = useState(false);
  const { data: api, isLoading: loadingAPI } = useAPI(apiId);
  const { data: keysData, isLoading: loadingKeys } = useAPIKeys(apiId);
  const keys = keysData?.data || [];

  if (loadingAPI)
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={24} className="text-brand-400" />
      </div>
    );

  if (!api)
    return (
      <div className="text-center py-20 text-surface-400">API not found</div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link
          to="/apis"
          className="text-surface-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <PageHeader
          title={api.name}
          subtitle={api.baseUrl}
          action={
            <button
              onClick={() => setShowNewKey(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} />
              Generate Key
            </button>
          }
        />
      </div>

      {/* API Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Status", value: <StatusBadge status={api.status} /> },
          { label: "Category", value: api.category },
          {
            label: "Total Requests",
            value: formatNumber(api.totalRequests || 0),
          },
          {
            label: "Rate Limit",
            value: `${api.rateLimit?.requestsPerMinute || 60} req/min`,
          },
        ].map(({ label, value }) => (
          <div key={label} className="card text-center">
            <p className="text-xs text-surface-500 mb-1">{label}</p>
            <div className="text-sm font-medium text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* Gateway URL */}
      <div className="card">
        <p className="text-sm font-medium text-surface-300 mb-2">Gateway URL</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs font-mono text-brand-400 bg-brand-500/5 border border-brand-500/10 rounded-lg px-3 py-2.5 truncate">
            {window.location.origin}/gateway/{api._id}/*
          </code>
          <CopyButton text={`${window.location.origin}/gateway/${api._id}`} />
        </div>
        <p className="text-xs text-surface-500 mt-2">
          Consumers call this URL with their API key in{" "}
          <code className="text-brand-400">X-API-Key</code> header
        </p>
      </div>

      {/* Keys */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-white">
            API Keys ({keys.length})
          </h2>
        </div>

        {loadingKeys ? (
          <div className="flex items-center justify-center py-10">
            <Spinner className="text-brand-400" />
          </div>
        ) : keys.length === 0 ? (
          <EmptyState
            icon={Key}
            title="No keys yet"
            desc="Generate your first API key to start using this API through the gateway"
            action={
              <button
                onClick={() => setShowNewKey(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={16} />
                Generate Key
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <KeyCard key={k._id} apiKey={k} apiId={apiId} />
            ))}
          </div>
        )}
      </div>

      <NewKeyModal
        open={showNewKey}
        onClose={() => setShowNewKey(false)}
        apiId={apiId}
      />
    </div>
  );
}
