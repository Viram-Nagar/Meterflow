import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRegister } from "../../hooks/useAuth";

export default function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    company: "",
  });
  const [showPwd, setShowPwd] = useState(false);
  const { mutate: register, isPending, error } = useRegister();

  const handleSubmit = (e) => {
    e.preventDefault();
    register(form);
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="animate-slide-up">
      <h1 className="text-3xl font-display font-bold text-white mb-1">
        Get started
      </h1>
      <p className="text-surface-400 mb-8">Create your MeterFlow account</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Full name
            </label>
            <input
              type="text"
              required
              className="input"
              placeholder="John Doe"
              value={form.name}
              onChange={set("name")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Company
            </label>
            <input
              type="text"
              className="input"
              placeholder="Optional"
              value={form.company}
              onChange={set("company")}
            />
          </div>
        </div>
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
            onChange={set("email")}
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
              placeholder="Min 8 chars, uppercase, number"
              value={form.password}
              onChange={set("password")}
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
            {error.response?.data?.error?.message || "Registration failed"}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
        >
          {isPending && <Loader2 size={16} className="animate-spin" />}
          {isPending ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm text-surface-400 mt-6">
        Already have an account?{" "}
        <Link
          to="/login"
          className="text-brand-400 hover:text-brand-300 font-medium"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
