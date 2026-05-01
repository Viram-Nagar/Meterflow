import { Routes, Route, Navigate } from "react-router-dom";

// Layouts
import AppLayout from "./components/layout/AppLayout";
import AuthLayout from "./components/layout/AuthLayout";

// Auth pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

// App pages
import Dashboard from "./pages/dashboard/Dashboard";
import APIList from "./pages/apis/APIList";
import APIDetail from "./pages/apis/APIDetail";
import Analytics from "./pages/analytics/Analytics";
import Billing from "./pages/billing/Billing";
import Playground from "./pages/playground/Playground";
import Settings from "./pages/Settings";
import Webhooks from "./pages/webhooks/Webhooks";
import AuditLogs from "./pages/audit/AuditLogs";

export default function App() {
  return (
    <Routes>
      {/* Root → redirect to dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Auth routes — redirect to dashboard if already logged in */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* App routes — redirect to login if not authenticated */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/apis" element={<APIList />} />
        <Route path="/apis/:apiId" element={<APIDetail />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/webhooks" element={<Webhooks />} />
        <Route path="/audit" element={<AuditLogs />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
