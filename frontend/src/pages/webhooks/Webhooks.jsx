import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Webhook,
  Trash2,
  Play,
  CheckCircle,
  XCircle,
  Copy,
} from "lucide-react";
import {
  PageHeader,
  StatusBadge,
  Modal,
  Spinner,
  EmptyState,
  CopyButton,
} from "../../components/ui/index";
import api from "../../services/api.service";
import { formatDate, formatRelative } from "../../utils/formatters";
import toast from "react-hot-toast";

const ALL_EVENTS = [
  {
    id: "limit.warning",
    label: "Quota Warning (80%)",
    desc: "Fired when 80% of monthly quota is used",
  },
  {
    id: "limit.exceeded",
    label: "Quota Exceeded (100%)",
    desc: "Fired when monthly quota is fully used",
  },
  {
    id: "payment.success",
    label: "Payment Success",
    desc: "Fired after successful payment",
  },
  {
    id: "payment.failed",
    label: "Payment Failed",
    desc: "Fired when a payment fails",
  },
  {
    id: "key.revoked",
    label: "Key Revoked",
    desc: "Fired when an API key is revoked",
  },
  {
    id: "api.error_spike",
    label: "Error Rate Spike",
    desc: "Fired when error rate exceeds 10%",
  },
];

function CreateWebhookModal({ open, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    url: "",
    events: ["limit.warning", "limit.exceeded"],
  });
  const [createdSecret, setCreatedSecret] = useState(null);

  const { mutate: create, isPending } = useMutation({
    mutationFn: (data) => api.post("/webhooks", data),
    onSuccess: ({ data }) => {
      setCreatedSecret(data.data.webhook.secret);
      qc.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });

  const toggleEvent = (eventId) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(eventId)
        ? f.events.filter((e) => e !== eventId)
        : [...f.events, eventId],
    }));
  };

  const handleClose = () => {
    setForm({ name: "", url: "", events: ["limit.warning", "limit.exceeded"] });
    setCreatedSecret(null);
    onClose();
  };

  if (createdSecret) {
    return (
      <Modal open={open} onClose={handleClose} title="Webhook Created ✅">
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-amber-400 text-sm font-medium mb-1">
              ⚠️ Save this secret now!
            </p>
            <p className="text-amber-300/70 text-xs">
              This secret is used to verify webhook payloads. It won't be shown
              again.
            </p>
          </div>
          <div>
            <label className="block text-xs text-surface-400 mb-1.5">
              Webhook Secret
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 text-brand-300 truncate">
                {createdSecret}
              </code>
              <CopyButton text={createdSecret} />
            </div>
          </div>
          <p className="text-xs text-surface-400">
            Verify incoming webhooks by checking the{" "}
            <code className="text-brand-400">X-MeterFlow-Signature</code>{" "}
            header:
            <code className="block mt-1 text-xs bg-surface-800 px-2 py-1.5 rounded font-mono text-surface-300">
              HMAC-SHA256(secret, payload)
            </code>
          </p>
          <button onClick={handleClose} className="btn-primary w-full">
            Done — I've saved the secret
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create Webhook">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Webhook Name *
          </label>
          <input
            className="input"
            placeholder="My Webhook"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Endpoint URL *
          </label>
          <input
            className="input font-mono text-sm"
            placeholder="https://yourapp.com/webhooks/meterflow"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-2">
            Events to listen
          </label>
          <div className="space-y-2">
            {ALL_EVENTS.map((event) => (
              <label
                key={event.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-surface-800/50 border border-surface-700/50 cursor-pointer hover:border-brand-500/30 transition-all"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 accent-brand-500"
                  checked={form.events.includes(event.id)}
                  onChange={() => toggleEvent(event.id)}
                />
                <div>
                  <p className="text-sm font-medium text-surface-200">
                    {event.label}
                  </p>
                  <p className="text-xs text-surface-500">{event.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={handleClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={() => create(form)}
            disabled={
              isPending || !form.name || !form.url || !form.events.length
            }
            className="btn-primary flex items-center gap-2"
          >
            {isPending && <Spinner size={14} />}Create Webhook
          </button>
        </div>
      </div>
    </Modal>
  );
}

function WebhookCard({ webhook }) {
  const qc = useQueryClient();

  const { mutate: deleteWh, isPending: deleting } = useMutation({
    mutationFn: () => api.delete(`/webhooks/${webhook._id}`),
    onSuccess: () => {
      toast.success("Webhook deleted");
      qc.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });

  const { mutate: test, isPending: testing } = useMutation({
    mutationFn: () => api.post(`/webhooks/${webhook._id}/test`),
    onSuccess: ({ data }) => {
      if (data.data.success) toast.success("Test webhook delivered! ✅");
      else toast.error(`Test failed: ${data.data.error}`);
    },
  });

  return (
    <div className="card glass-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Webhook size={14} className="text-brand-400 shrink-0" />
            <h3 className="font-semibold text-white text-sm">{webhook.name}</h3>
            <span
              className={`badge text-[10px] ${webhook.isActive ? "badge-green" : "badge-gray"}`}
            >
              {webhook.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="text-xs font-mono text-surface-400 truncate mb-2">
            {webhook.url}
          </p>

          {/* Events */}
          <div className="flex flex-wrap gap-1 mb-2">
            {webhook.events.map((e) => (
              <span key={e} className="badge badge-blue text-[10px]">
                {e}
              </span>
            ))}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-surface-500">
            <span className="flex items-center gap-1">
              <CheckCircle size={11} className="text-emerald-400" />
              {webhook.successDeliveries} success
            </span>
            <span className="flex items-center gap-1">
              <XCircle size={11} className="text-red-400" />
              {webhook.failedDeliveries} failed
            </span>
            {webhook.lastDeliveredAt && (
              <span>Last: {formatRelative(webhook.lastDeliveredAt)}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => test()}
            disabled={testing}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            {testing ? <Spinner size={12} /> : <Play size={12} />}Test
          </button>
          <button
            onClick={() => deleteWh()}
            disabled={deleting}
            className="btn-danger text-xs flex items-center gap-1"
          >
            {deleting ? <Spinner size={12} /> : <Trash2 size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Webhooks() {
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: () => api.get("/webhooks").then((r) => r.data.data),
  });

  const webhooks = data?.webhooks || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhooks"
        subtitle="Get notified when important events happen"
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            Add Webhook
          </button>
        }
      />

      {/* Webhook format info */}
      <div className="card bg-brand-500/5 border-brand-500/20">
        <h3 className="text-sm font-semibold text-brand-300 mb-2">
          Webhook Payload Format
        </h3>
        <pre className="text-xs font-mono text-surface-300 overflow-auto">{`POST https://your-endpoint.com/webhook
Headers:
  X-MeterFlow-Signature: sha256=<hmac_signature>
  X-MeterFlow-Event: limit.warning
  Content-Type: application/json

Body:
{
  "event": "limit.warning",
  "timestamp": "2025-04-19T10:45:00Z",
  "deliveryId": "uuid-here",
  "data": {
    "used": 800,
    "limit": 1000,
    "percentUsed": 80
  }
}`}</pre>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner className="text-brand-400" />
        </div>
      ) : webhooks.length === 0 ? (
        <EmptyState
          icon={Webhook}
          title="No webhooks yet"
          desc="Create a webhook to get real-time notifications for events like quota warnings and payments"
          action={
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} />
              Add Webhook
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <WebhookCard key={wh._id} webhook={wh} />
          ))}
        </div>
      )}

      <CreateWebhookModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </div>
  );
}
