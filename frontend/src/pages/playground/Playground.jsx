// import { useState } from "react";
// import { Play, Send, Clock, CheckCircle, XCircle, Copy } from "lucide-react";
// import { PageHeader, Spinner } from "../../components/ui/index";
// import { useAPIs } from "../../hooks/useAPIs";
// import { useAPIKeys } from "../../hooks/useAPIs";
// import axios from "axios";
// import { formatLatency } from "../../utils/formatters";
// import toast from "react-hot-toast";

// const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

// const SAMPLE_APIS = [
//   { label: "JSONPlaceholder — Posts", path: "/posts/1", method: "GET" },
//   { label: "JSONPlaceholder — Users", path: "/users/1", method: "GET" },
//   { label: "JSONPlaceholder — Todos", path: "/todos/1", method: "GET" },
//   { label: "PokeAPI — Pikachu", path: "/pokemon/pikachu", method: "GET" },
// ];

// export default function Playground() {
//   const [selectedAPI, setSelectedAPI] = useState("");
//   const [selectedKey, setSelectedKey] = useState("");
//   const [method, setMethod] = useState("GET");
//   const [path, setPath] = useState("/");
//   const [body, setBody] = useState("");
//   const [response, setResponse] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [reqHeaders, setReqHeaders] = useState([]);

//   const { data: apisData } = useAPIs();
//   const { data: keysData } = useAPIKeys(selectedAPI);

//   const apis = apisData?.data?.filter((a) => a.status === "active") || [];
//   const keys = keysData?.data?.filter((k) => k.status === "active") || [];

//   const handleSend = async () => {
//     if (!selectedAPI || !selectedKey) {
//       toast.error("Select an API and API key first");
//       return;
//     }

//     setLoading(true);
//     setResponse(null);
//     const start = Date.now();

//     try {
//       const result = await axios({
//         method,
//         url: `/gateway/${selectedAPI}${path}`,
//         headers: {
//           "X-API-Key": keys.find((k) => k._id === selectedKey)?.keyPrefix || "",
//         },
//         data: body && method !== "GET" ? JSON.parse(body) : undefined,
//         validateStatus: () => true,
//       });

//       setResponse({
//         status: result.status,
//         data: result.data,
//         headers: result.headers,
//         latency: Date.now() - start,
//         isSuccess: result.status >= 200 && result.status < 400,
//       });
//     } catch (err) {
//       setResponse({
//         status: 0,
//         data: { error: err.message },
//         latency: Date.now() - start,
//         isSuccess: false,
//       });
//     } finally {
//       setLoading(false);
//     }
//   };

//   const loadSample = (sample) => {
//     setPath(sample.path);
//     setMethod(sample.method);
//   };

//   return (
//     <div className="space-y-6">
//       <PageHeader
//         title="API Playground"
//         subtitle="Test your APIs through the MeterFlow gateway in real-time"
//       />

//       <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
//         {/* Left — Config */}
//         <div className="lg:col-span-2 space-y-4">
//           {/* API + Key Selection */}
//           <div className="card space-y-3">
//             <h3 className="text-sm font-semibold text-surface-200">
//               Configuration
//             </h3>
//             <div>
//               <label className="block text-xs text-surface-400 mb-1.5">
//                 Select API
//               </label>
//               <select
//                 className="input text-sm"
//                 value={selectedAPI}
//                 onChange={(e) => {
//                   setSelectedAPI(e.target.value);
//                   setSelectedKey("");
//                 }}
//               >
//                 <option value="">— Choose an API —</option>
//                 {apis.map((a) => (
//                   <option key={a._id} value={a._id}>
//                     {a.name}
//                   </option>
//                 ))}
//               </select>
//             </div>
//             <div>
//               <label className="block text-xs text-surface-400 mb-1.5">
//                 API Key
//               </label>
//               <select
//                 className="input text-sm"
//                 value={selectedKey}
//                 onChange={(e) => setSelectedKey(e.target.value)}
//                 disabled={!selectedAPI || keys.length === 0}
//               >
//                 <option value="">
//                   —{" "}
//                   {!selectedAPI
//                     ? "Select API first"
//                     : keys.length === 0
//                       ? "No active keys"
//                       : "Choose a key"}{" "}
//                   —
//                 </option>
//                 {keys.map((k) => (
//                   <option key={k._id} value={k._id}>
//                     {k.name} ({k.keyPrefix})
//                   </option>
//                 ))}
//               </select>
//             </div>
//           </div>

//           {/* Sample Requests */}
//           <div className="card">
//             <h3 className="text-sm font-semibold text-surface-200 mb-3">
//               Sample Paths
//             </h3>
//             <div className="space-y-2">
//               {SAMPLE_APIS.map((s) => (
//                 <button
//                   key={s.label}
//                   onClick={() => loadSample(s)}
//                   className="w-full text-left px-3 py-2 rounded-lg bg-surface-800 hover:bg-surface-700 border border-surface-700/50 transition-all"
//                 >
//                   <p className="text-xs font-medium text-surface-300">
//                     {s.label}
//                   </p>
//                   <p className="text-xs font-mono text-brand-400">
//                     {s.method} {s.path}
//                   </p>
//                 </button>
//               ))}
//             </div>
//           </div>
//         </div>

//         {/* Right — Request + Response */}
//         <div className="lg:col-span-3 space-y-4">
//           {/* Request Builder */}
//           <div className="card space-y-3">
//             <h3 className="text-sm font-semibold text-surface-200">Request</h3>

//             {/* Method + Path */}
//             <div className="flex gap-2">
//               <select
//                 className="input w-28 text-sm font-mono font-bold"
//                 value={method}
//                 onChange={(e) => setMethod(e.target.value)}
//               >
//                 {METHODS.map((m) => (
//                   <option key={m}>{m}</option>
//                 ))}
//               </select>
//               <input
//                 className="input flex-1 font-mono text-sm"
//                 placeholder="/endpoint/path"
//                 value={path}
//                 onChange={(e) => setPath(e.target.value)}
//               />
//             </div>

//             {/* Gateway URL Preview */}
//             {selectedAPI && (
//               <div className="text-xs font-mono text-surface-500 bg-surface-800/50 rounded px-3 py-2 truncate">
//                 → {window.location.origin}/gateway/{selectedAPI}
//                 {path}
//               </div>
//             )}

//             {/* Body */}
//             {method !== "GET" && (
//               <div>
//                 <label className="block text-xs text-surface-400 mb-1.5">
//                   Request Body (JSON)
//                 </label>
//                 <textarea
//                   className="input font-mono text-xs resize-none"
//                   rows={4}
//                   placeholder='{"key": "value"}'
//                   value={body}
//                   onChange={(e) => setBody(e.target.value)}
//                 />
//               </div>
//             )}

//             <button
//               onClick={handleSend}
//               disabled={loading || !selectedAPI || !selectedKey}
//               className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
//             >
//               {loading ? <Spinner size={16} /> : <Send size={15} />}
//               {loading ? "Sending..." : "Send Request"}
//             </button>
//           </div>

//           {/* Response */}
//           {response && (
//             <div className="card animate-slide-up space-y-3">
//               <div className="flex items-center justify-between">
//                 <h3 className="text-sm font-semibold text-surface-200">
//                   Response
//                 </h3>
//                 <div className="flex items-center gap-3">
//                   <div className="flex items-center gap-1.5 text-xs">
//                     <Clock size={12} className="text-surface-400" />
//                     <span className="font-mono text-surface-400">
//                       {formatLatency(response.latency)}
//                     </span>
//                   </div>
//                   <div
//                     className={`flex items-center gap-1.5 text-xs font-medium ${response.isSuccess ? "text-emerald-400" : "text-red-400"}`}
//                   >
//                     {response.isSuccess ? (
//                       <CheckCircle size={13} />
//                     ) : (
//                       <XCircle size={13} />
//                     )}
//                     {response.status}
//                   </div>
//                   <button
//                     onClick={() => {
//                       navigator.clipboard.writeText(
//                         JSON.stringify(response.data, null, 2),
//                       );
//                       toast.success("Copied!");
//                     }}
//                     className="text-surface-400 hover:text-white transition-colors"
//                   >
//                     <Copy size={14} />
//                   </button>
//                 </div>
//               </div>

//               <pre className="text-xs font-mono bg-surface-800/50 border border-surface-700/50 rounded-lg p-4 overflow-auto max-h-96 text-surface-300 leading-relaxed">
//                 {JSON.stringify(response.data, null, 2)}
//               </pre>

//               {/* Rate limit headers */}
//               {response.headers && (
//                 <div className="grid grid-cols-3 gap-2">
//                   {[
//                     { label: "Rate Limit", key: "x-ratelimit-limit" },
//                     { label: "Remaining", key: "x-ratelimit-remaining" },
//                     { label: "Latency", key: "x-meterflow-latency" },
//                   ].map(
//                     ({ label, key }) =>
//                       response.headers[key] && (
//                         <div
//                           key={key}
//                           className="bg-surface-800/50 rounded-lg p-2 text-center"
//                         >
//                           <p className="text-[10px] text-surface-500">
//                             {label}
//                           </p>
//                           <p className="text-xs font-mono text-brand-400">
//                             {response.headers[key]}
//                           </p>
//                         </div>
//                       ),
//                   )}
//                 </div>
//               )}
//             </div>
//           )}

//           {!response && !loading && (
//             <div className="card flex flex-col items-center justify-center py-12 text-surface-600">
//               <Play size={32} className="mb-3 opacity-30" />
//               <p className="text-sm">Configure your request and hit Send</p>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

/**
 * @file Playground.jsx
 * @description Live API tester through MeterFlow gateway.
 *
 * Key design decision:
 * The full API key is NEVER stored in DB (only the hash + prefix).
 * So the playground asks the user to PASTE their full key manually.
 * This is the same approach used by Stripe, OpenAI etc.
 */

import { useState } from "react";
import {
  Play,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Copy,
  Key,
  Info,
} from "lucide-react";
import { PageHeader, Spinner } from "../../components/ui/index";
import { useAPIs } from "../../hooks/useAPIs";
import axios from "axios";
import { formatLatency } from "../../utils/formatters";
import toast from "react-hot-toast";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

// Sample paths for each API type
const SAMPLE_PATHS = [
  { label: "Pokemon — Pikachu", path: "/pokemon/pikachu", method: "GET" },
  { label: "Pokemon — Charizard", path: "/pokemon/charizard", method: "GET" },
  { label: "Pokemon — List", path: "/pokemon?limit=10", method: "GET" },
  { label: "Posts — Get one", path: "/posts/1", method: "GET" },
  { label: "Posts — All", path: "/posts", method: "GET" },
  { label: "Users — Get one", path: "/users/1", method: "GET" },
  { label: "Todos — Get one", path: "/todos/1", method: "GET" },
];

export default function Playground() {
  const [selectedAPI, setSelectedAPI] = useState("");
  const [apiKey, setApiKey] = useState(""); // User pastes full key here
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/");
  const [body, setBody] = useState("");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showKeyHelp, setShowKeyHelp] = useState(false);

  const { data: apisData } = useAPIs();
  const apis = apisData?.data?.filter((a) => a.status === "active") || [];

  const selectedAPIObj = apis.find((a) => a._id === selectedAPI);

  const handleSend = async () => {
    if (!selectedAPI) {
      toast.error("Please select an API first");
      return;
    }
    if (!apiKey || !apiKey.startsWith("mf_live_")) {
      toast.error("Please paste your full API key (starts with mf_live_)");
      return;
    }
    if (apiKey.endsWith("...")) {
      toast.error("That is just the key prefix. Paste your full API key.");
      return;
    }
    if (apiKey.length < 30) {
      toast.error("API key is too short. The full key is 70+ characters.");
      return;
    }

    setLoading(true);
    setResponse(null);
    const start = Date.now();

    try {
      const result = await axios({
        method,
        url: `/gateway/${selectedAPI}${path}`,
        headers: { "X-API-Key": apiKey.trim() },
        data: body && method !== "GET" ? JSON.parse(body) : undefined,
        validateStatus: () => true,
      });

      setResponse({
        status: result.status,
        data: result.data,
        headers: result.headers,
        latency: Date.now() - start,
        isSuccess: result.status >= 200 && result.status < 400,
      });
    } catch (err) {
      setResponse({
        status: 0,
        data: { error: err.message },
        latency: Date.now() - start,
        isSuccess: false,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Playground"
        subtitle="Test your APIs through the MeterFlow gateway in real-time"
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* ── Left Panel ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* API Selection */}
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-surface-200">
              Configuration
            </h3>

            {/* Step 1 — Select API */}
            <div>
              <label className="block text-xs text-surface-400 mb-1.5">
                Step 1 — Select API
              </label>
              <select
                className="input text-sm"
                value={selectedAPI}
                onChange={(e) => setSelectedAPI(e.target.value)}
              >
                <option value="">— Choose an API —</option>
                {apis.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {selectedAPIObj && (
                <p className="text-xs text-surface-500 mt-1 font-mono truncate">
                  → {selectedAPIObj.baseUrl}
                </p>
              )}
            </div>

            {/* Step 2 — Paste API Key */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs text-surface-400">
                  Step 2 — Paste Full API Key
                </label>
                <button
                  onClick={() => setShowKeyHelp(!showKeyHelp)}
                  className="text-brand-400 hover:text-brand-300"
                >
                  <Info size={13} />
                </button>
              </div>

              {/* Help box */}
              {showKeyHelp && (
                <div className="bg-brand-500/10 border border-brand-500/20 rounded-lg p-3 mb-2 animate-fade-in">
                  <p className="text-xs text-brand-300 font-medium mb-1">
                    Where to get your key:
                  </p>
                  <ol className="text-xs text-surface-400 space-y-1 list-decimal list-inside">
                    <li>Go to My APIs page</li>
                    <li>Click on your API</li>
                    <li>Click "Generate Key"</li>
                    <li>Click the 👁 eye icon to reveal</li>
                    <li>Copy the full key (70+ chars)</li>
                    <li>Paste it here</li>
                  </ol>
                  <p className="text-xs text-amber-400 mt-2">
                    ⚠️ The key is only shown once at generation time. If you
                    didn't save it, generate a new one.
                  </p>
                </div>
              )}

              <div className="relative">
                <Key
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500"
                />
                <input
                  className="input pl-8 font-mono text-xs"
                  placeholder="mf_live_xxxxxxxxxxxxxxxxxxxx..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              {/* Key validation feedback */}
              {apiKey && (
                <div className="mt-1">
                  {apiKey.endsWith("...") ? (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <XCircle size={11} />
                      This is just the prefix — paste the full key
                    </p>
                  ) : apiKey.length < 30 ? (
                    <p className="text-xs text-amber-400 flex items-center gap-1">
                      <XCircle size={11} />
                      Key too short — full key is 70+ characters
                    </p>
                  ) : !apiKey.startsWith("mf_live_") ? (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <XCircle size={11} />
                      Key must start with mf_live_
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle size={11} />
                      Key looks valid ({apiKey.length} chars)
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sample Paths */}
          <div className="card">
            <h3 className="text-sm font-semibold text-surface-200 mb-3">
              Sample Paths
              <span className="text-xs text-surface-500 font-normal ml-2">
                click to use
              </span>
            </h3>
            <div className="space-y-1.5">
              {SAMPLE_PATHS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => {
                    setPath(s.path);
                    setMethod(s.method);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg bg-surface-800 hover:bg-surface-700 border border-surface-700/50 hover:border-brand-500/30 transition-all"
                >
                  <p className="text-xs font-medium text-surface-300">
                    {s.label}
                  </p>
                  <p className="text-xs font-mono text-brand-400">
                    <span className="text-emerald-400">{s.method}</span>{" "}
                    {s.path}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Request Builder */}
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-surface-200">Request</h3>

            {/* Method + Path */}
            <div className="flex gap-2">
              <select
                className="input w-28 text-sm font-mono font-bold"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <input
                className="input flex-1 font-mono text-sm"
                placeholder="/pokemon/pikachu"
                value={path}
                onChange={(e) => setPath(e.target.value)}
              />
            </div>

            {/* Full URL preview */}
            {selectedAPI && (
              <div className="bg-surface-800/50 rounded-lg px-3 py-2 border border-surface-700/30">
                <p className="text-[10px] text-surface-500 mb-0.5">
                  Gateway URL
                </p>
                <p className="text-xs font-mono text-brand-400 truncate">
                  {window.location.origin}/gateway/{selectedAPI}
                  {/* https://meterflow-rt2f.onrender.com */}
                  {path}
                </p>
              </div>
            )}

            {/* Request Body */}
            {method !== "GET" && method !== "DELETE" && (
              <div>
                <label className="block text-xs text-surface-400 mb-1.5">
                  Request Body (JSON)
                </label>
                <textarea
                  className="input font-mono text-xs resize-none"
                  rows={4}
                  placeholder='{"key": "value"}'
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
            )}

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={loading || !selectedAPI || !apiKey}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
            >
              {loading ? <Spinner size={16} /> : <Send size={15} />}
              {loading ? "Sending..." : "Send Request"}
            </button>
          </div>

          {/* Response Panel */}
          {response && (
            <div className="card animate-slide-up space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-surface-200">
                  Response
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Clock size={12} className="text-surface-400" />
                    <span className="font-mono text-surface-400">
                      {formatLatency(response.latency)}
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 text-xs font-medium ${
                      response.isSuccess ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {response.isSuccess ? (
                      <CheckCircle size={13} />
                    ) : (
                      <XCircle size={13} />
                    )}
                    {response.status}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        JSON.stringify(response.data, null, 2),
                      );
                      toast.success("Copied!");
                    }}
                    className="text-surface-400 hover:text-white transition-colors"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              {/* Response body */}
              <pre className="text-xs font-mono bg-surface-800/50 border border-surface-700/50 rounded-lg p-4 overflow-auto max-h-96 text-surface-300 leading-relaxed">
                {JSON.stringify(response.data, null, 2)}
              </pre>

              {/* Rate limit headers */}
              {response.headers && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Rate Limit", key: "x-ratelimit-limit" },
                    { label: "Remaining", key: "x-ratelimit-remaining" },
                    { label: "Latency", key: "x-meterflow-latency" },
                  ].map(({ label, key }) =>
                    response.headers[key] ? (
                      <div
                        key={key}
                        className="bg-surface-800/50 rounded-lg p-2 text-center"
                      >
                        <p className="text-[10px] text-surface-500">{label}</p>
                        <p className="text-xs font-mono text-brand-400">
                          {response.headers[key]}
                        </p>
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!response && !loading && (
            <div className="card flex flex-col items-center justify-center py-12 text-surface-600">
              <Play size={32} className="mb-3 opacity-30" />
              <p className="text-sm">Configure your request and hit Send</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
