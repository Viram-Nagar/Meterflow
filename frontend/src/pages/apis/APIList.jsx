import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Boxes,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Key,
  Copy,
} from "lucide-react";
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  Modal,
  Spinner,
} from "../../components/ui/index";
import {
  useAPIs,
  useCreateAPI,
  useDeleteAPI,
  useToggleAPI,
} from "../../hooks/useAPIs";
import { formatNumber, formatDate } from "../../utils/formatters";
import toast from "react-hot-toast";

const CATEGORIES = [
  "other",
  "weather",
  "finance",
  "crypto",
  "ai",
  "maps",
  "social",
  "ecommerce",
  "health",
  "sports",
  "news",
  "utilities",
];

function CreateAPIModal({ open, onClose }) {
  const [form, setForm] = useState({
    name: "",
    baseUrl: "",
    description: "",
    category: "other",
  });
  const { mutate: create, isPending } = useCreateAPI();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    create(form, { onSuccess: onClose });
  };

  return (
    <Modal open={open} onClose={onClose} title="Register New API">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            API Name *
          </label>
          <input
            required
            className="input"
            placeholder="My Weather API"
            value={form.name}
            onChange={set("name")}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Base URL *
          </label>
          <input
            required
            type="url"
            className="input font-mono text-sm"
            placeholder="https://api.example.com"
            value={form.baseUrl}
            onChange={set("baseUrl")}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Category
          </label>
          <select
            className="input"
            value={form.category}
            onChange={set("category")}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Description
          </label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="What does this API do?"
            value={form.description}
            onChange={set("description")}
          />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="btn-primary flex items-center gap-2"
          >
            {isPending && <Spinner size={14} />}Register API
          </button>
        </div>
      </form>
    </Modal>
  );
}

function APICard({ api, onDelete }) {
  const { mutate: toggle } = useToggleAPI(api._id);
  const gatewayUrl = `${window.location.protocol}//${window.location.hostname}:5000/gateway/${api._id}`;

  const copyGatewayUrl = () => {
    navigator.clipboard.writeText(gatewayUrl);
    toast.success("Gateway URL copied!");
  };

  return (
    <div className="card glass-hover">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="font-semibold text-white text-sm md:text-base truncate">
              {api.name}
            </h3>
            <StatusBadge status={api.status} />
            <span className="badge badge-gray">{api.category}</span>
          </div>
          <p className="text-xs font-mono text-surface-500 truncate mb-1">
            {api.baseUrl}
          </p>
          {api.description && (
            <p className="text-xs text-surface-400 line-clamp-1 hidden sm:block">
              {api.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-surface-500">
            <span>{formatNumber(api.totalRequests || 0)} requests</span>
            <span>{api.totalKeys || 0} keys</span>
            <span className="hidden sm:inline">
              Created {formatDate(api.createdAt)}
            </span>
          </div>
        </div>

        {/* Actions — stack on mobile */}
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
          <Link
            to={`/apis/${api._id}`}
            className="btn-secondary text-xs flex items-center gap-1.5 whitespace-nowrap"
          >
            <Key size={13} />
            Keys
          </Link>
          <button
            onClick={() => toggle()}
            className="btn-secondary text-xs flex items-center gap-1.5 whitespace-nowrap"
          >
            {api.status === "active" ? (
              <ToggleRight size={14} className="text-emerald-400" />
            ) : (
              <ToggleLeft size={14} />
            )}
            <span className="hidden sm:inline">
              {api.status === "active" ? "Active" : "Inactive"}
            </span>
          </button>
          <button onClick={onDelete} className="btn-danger text-xs p-2">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Gateway URL */}
      <div className="mt-3 pt-3 border-t border-surface-800/50">
        <p className="text-xs text-surface-500 mb-1">Gateway URL</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs font-mono text-brand-400 bg-brand-500/5 px-2 py-1.5 rounded border border-brand-500/10 truncate">
            {gatewayUrl}/*
          </code>
          <button
            onClick={copyGatewayUrl}
            className="shrink-0 p-1.5 rounded-lg text-surface-400 hover:text-brand-400 hover:bg-brand-500/10 transition-all"
          >
            <Copy size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function APIList() {
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading } = useAPIs();
  const { mutate: deleteAPI } = useDeleteAPI();
  const apis = data?.data || [];

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="My APIs"
        subtitle="Register and manage your APIs"
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Register API</span>
            <span className="sm:hidden">Add</span>
          </button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size={24} className="text-brand-400" />
        </div>
      ) : apis.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No APIs yet"
          desc="Register your first API to start tracking usage and billing"
          action={
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} />
              Register API
            </button>
          }
        />
      ) : (
        <div className="space-y-3 md:space-y-4">
          {apis.map((api) => (
            <APICard
              key={api._id}
              api={api}
              onDelete={() => deleteAPI(api._id)}
            />
          ))}
        </div>
      )}

      <CreateAPIModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
