import { useState } from "react";
import { User, Lock, Loader2 } from "lucide-react";
import { PageHeader } from "../components/ui/index";
import api from "../services/api.service";
import useAuthStore from "../store/authStore";
import toast from "react-hot-toast";

export default function Settings() {
  const { user, updateUser } = useAuthStore();
  const [profile, setProfile] = useState({
    name: user?.name || "",
    company: user?.company || "",
  });
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await api.patch("/auth/me", profile);
      updateUser(data.data.user);
      toast.success("Profile updated!");
    } catch {
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setSavingPwd(true);
    try {
      await api.patch("/auth/change-password", passwords);
      toast.success("Password changed! Please log in again.");
      setPasswords({ currentPassword: "", newPassword: "" });
    } catch {
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Settings" subtitle="Manage your account preferences" />

      {/* Profile */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <User size={16} className="text-brand-400" />
          <h2 className="font-display font-semibold text-white">Profile</h2>
        </div>
        <form onSubmit={saveProfile} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-surface-400 mb-1.5">
                Full Name
              </label>
              <input
                className="input"
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1.5">
                Company
              </label>
              <input
                className="input"
                value={profile.company}
                onChange={(e) =>
                  setProfile({ ...profile, company: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-surface-400 mb-1.5">
              Email
            </label>
            <input
              className="input opacity-60 cursor-not-allowed"
              value={user?.email}
              disabled
            />
          </div>
          <div>
            <label className="block text-xs text-surface-400 mb-1.5">
              Plan
            </label>
            <input
              className="input opacity-60 cursor-not-allowed"
              value={user?.plan?.toUpperCase()}
              disabled
            />
          </div>
          <button
            type="submit"
            disabled={savingProfile}
            className="btn-primary flex items-center gap-2"
          >
            {savingProfile && <Loader2 size={14} className="animate-spin" />}
            Save Profile
          </button>
        </form>
      </div>

      {/* Password */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={16} className="text-brand-400" />
          <h2 className="font-display font-semibold text-white">
            Change Password
          </h2>
        </div>
        <form onSubmit={savePassword} className="space-y-3">
          <div>
            <label className="block text-xs text-surface-400 mb-1.5">
              Current Password
            </label>
            <input
              type="password"
              className="input"
              value={passwords.currentPassword}
              onChange={(e) =>
                setPasswords({ ...passwords, currentPassword: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-xs text-surface-400 mb-1.5">
              New Password
            </label>
            <input
              type="password"
              className="input"
              placeholder="Min 8 chars, uppercase + number"
              value={passwords.newPassword}
              onChange={(e) =>
                setPasswords({ ...passwords, newPassword: e.target.value })
              }
            />
          </div>
          <button
            type="submit"
            disabled={savingPwd}
            className="btn-primary flex items-center gap-2"
          >
            {savingPwd && <Loader2 size={14} className="animate-spin" />}Change
            Password
          </button>
        </form>
      </div>
    </div>
  );
}
