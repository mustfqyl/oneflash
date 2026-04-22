"use client";

import { FormEvent, useEffect, useState } from "react";

interface UserInfo {
  name: string | null;
  username: string;
  email: string;
  plan: string;
  createdAt: string;
}

export default function AccountPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadMe = async () => {
    const res = await fetch("/api/settings/me", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load account");
    setUser(data.user);
    setName(data.user.name || "");
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMe().catch((err: Error) => setError(err.message));
  }, []);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setProfileSaving(true);
    try {
      const res = await fetch("/api/settings/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update profile");

      setMessage("Profile updated.");
      await loadMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setProfileSaving(false);
    }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPasswordSaving(true);
    try {
      const res = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update password");

      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password changed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold mb-2">Account</h2>
      <p className="text-zinc-400 mb-8">Manage your account profile and password settings.</p>

      {error && <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {message && <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">{message}</div>}

      <div className="grid gap-6">
        <form onSubmit={saveProfile} className="rounded-xl border border-zinc-800 bg-black/40 p-5 space-y-4">
          <h3 className="text-lg font-semibold">Profile</h3>
          <label className="block">
            <span className="mb-1 block text-sm text-zinc-300">Display name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-blue-500"
            />
          </label>
          <div className="text-sm text-zinc-400">Email: {user?.email || "-"}</div>
          <div className="text-sm text-zinc-400">Username: {user?.username || "-"}</div>
          <div className="text-sm text-zinc-400">Plan: {user?.plan || "-"}</div>
          <button
            type="submit"
            disabled={profileSaving}
            className="rounded-lg bg-white px-4 py-2 font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50"
          >
            {profileSaving ? "Saving..." : "Save Profile"}
          </button>
        </form>

        <form onSubmit={savePassword} className="rounded-xl border border-zinc-800 bg-black/40 p-5 space-y-4">
          <h3 className="text-lg font-semibold">Password</h3>
          <label className="block">
            <span className="mb-1 block text-sm text-zinc-300">Current password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-blue-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-zinc-300">New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-blue-500"
            />
          </label>
          <button
            type="submit"
            disabled={passwordSaving}
            className="rounded-lg bg-white px-4 py-2 font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50"
          >
            {passwordSaving ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
