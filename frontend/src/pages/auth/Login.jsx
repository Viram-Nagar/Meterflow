import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useLogin } from "../../hooks/useAuth";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const { mutate: login, isPending, error } = useLogin();

  const handleSubmit = (e) => {
    e.preventDefault();
    login(form);
  };

  return (
    <div className="animate-slide-up">
      <h1 className="text-3xl font-display font-bold text-white mb-1">
        Welcome back
      </h1>
      <p className="text-surface-400 mb-8">Sign in to your MeterFlow account</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Email
          </label>
          <input
            type="email"
            required
            className="input"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              required
              className="input pr-10"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200"
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error.response?.data?.error?.message || "Login failed"}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
        >
          {isPending && <Loader2 size={16} className="animate-spin" />}
          {isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-surface-400 mt-6">
        Don't have an account?{" "}
        <Link
          to="/register"
          className="text-brand-400 hover:text-brand-300 font-medium"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
