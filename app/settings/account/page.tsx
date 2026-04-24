"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AtSymbolIcon,
  GlobeAltIcon,
  KeyIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { getPasswordValidationError } from "@/lib/validation";

interface UserInfo {
  username: string;
  email: string;
}

export default function AccountPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const displayUsername = username || user?.username || "your-name";
  const accountInitial = (displayUsername[0] || user?.email?.[0] || "A").toUpperCase();

  const loadMe = async () => {
    try {
      const res = await fetch("/api/settings/me", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load account");
      setUser(data.user);
      setUsername(data.user.username || "");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMe().catch((err: Error) => setError(err.message));
  }, []);

  const saveProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setProfileSaving(true);
    try {
      const res = await fetch("/api/settings/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update profile");

      setUser((currentUser) =>
        currentUser ? { ...currentUser, username } : currentUser
      );
      setUsername(username);
      setMessage("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setProfileSaving(false);
    }
  };

  const savePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPasswordSaving(true);

    const passwordError = getPasswordValidationError(newPassword);
    if (passwordError) {
      setError(passwordError);
      setPasswordSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update password");

      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password changed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="max-w-5xl motion-enter">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="mb-2 text-3xl font-bold tracking-tight">Account</h2>
          <p className="max-w-2xl text-muted-foreground">
            Update the identity attached to your public oneflash address and keep password controls in the same place.
          </p>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {message && <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">{message}</div>}

      <div className="motion-stagger-children grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="motion-enter motion-enter-delay-1 overflow-hidden rounded-[28px] border border-border-strong bg-surface-soft shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
          <div className="relative overflow-hidden px-6 py-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_58%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_50%)]" />
            <div className="relative">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/10 text-2xl font-semibold text-blue-500 shadow-[0_10px_30px_rgba(59,130,246,0.18)]">
                  {loading ? (
                    <div className="h-6 w-6 animate-pulse rounded-full bg-blue-500/30" />
                  ) : (
                    accountInitial
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Primary account</div>
                  <div className="truncate text-xl font-semibold text-foreground">
                    {loading ? (
                      <div className="mt-1 h-6 w-32 animate-pulse rounded bg-foreground/10" />
                    ) : (
                      displayUsername
                    )}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">
                    {loading ? (
                      <div className="mt-2 h-4 w-48 animate-pulse rounded bg-foreground/10" />
                    ) : (
                      user?.email || "Unknown email"
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-background/30 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                    <AtSymbolIcon className="h-4 w-4 text-blue-500" />
                    Sign-in email
                  </div>
                  <div className="break-all text-sm text-muted-foreground">
                    {loading ? (
                      <div className="mt-1 h-4 w-full animate-pulse rounded bg-foreground/10" />
                    ) : (
                      user?.email || "Unknown"
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background/30 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                    <ShieldCheckIcon className="h-4 w-4 text-blue-500" />
                    Security
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Password updates stay on this page so identity and access settings are managed together.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="grid gap-6">
          <section className="motion-enter motion-enter-delay-2 rounded-[28px] border border-border-strong bg-surface-soft p-6 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
            <div className="mb-6 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Profile</div>
                <h3 className="text-xl font-semibold text-foreground">Account Username</h3>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Update your username used for logging in.
                </p>
              </div>
            </div>

            <form onSubmit={saveProfile} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-muted-foreground-strong">Email</span>
                  {loading ? (
                    <div className="h-[48px] w-full animate-pulse rounded-xl bg-foreground/5" />
                  ) : (
                    <input
                      type="email"
                      value={user?.email || ""}
                      readOnly
                      className="w-full rounded-xl border border-border bg-input px-3 py-3 text-muted-foreground outline-none"
                    />
                  )}
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-muted-foreground-strong">Username</span>
                  {loading ? (
                    <div className="h-[48px] w-full animate-pulse rounded-xl bg-foreground/5" />
                  ) : (
                    <div className="flex items-center rounded-xl border border-border bg-input px-3 py-3 focus-within:border-blue-500">
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                        className="w-full bg-transparent outline-none"
                        placeholder="your-name"
                        autoComplete="username"
                      />
                    </div>
                  )}
                </label>
              </div>

              <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/30 p-4 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background motion-hover-lift motion-press transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {profileSaving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          </section>

          <section className="motion-enter motion-enter-delay-3 rounded-[28px] border border-border-strong bg-surface-soft p-6 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
            <div className="mb-6 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Security</div>
                <h3 className="text-xl font-semibold text-foreground">Password</h3>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Change the password used for your dashboard sign-in. The new password must contain at least 8 characters.
                </p>
              </div>
            </div>

            <form onSubmit={savePassword} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-muted-foreground-strong">New password</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-border bg-input px-3 py-3 outline-none focus:border-blue-500"
                  />
                  <span className="mt-1.5 block text-xs text-muted">
                    Use at least 8 characters with uppercase, lowercase, and a number.
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-muted-foreground-strong">Confirm new password</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-border bg-input px-3 py-3 outline-none focus:border-blue-500"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  Keep this password unique from your PIN and other connected accounts.
                </div>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background motion-hover-lift motion-press transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {passwordSaving ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
