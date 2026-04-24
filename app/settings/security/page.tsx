"use client";

import { FormEvent, useState } from "react";

export default function SecurityPage() {
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (!/^\d{6}$/.test(newPin) || !/^\d{6}$/.test(confirmPin)) {
      setError("Both PIN fields must be exactly 6 digits.");
      return;
    }

    if (newPin !== confirmPin) {
      setError("PINs do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/pin/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "PIN update failed");
      }

      setMessage("PIN successfully updated.");
      setNewPin("");
      setConfirmPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl motion-enter">
      <h2 className="text-2xl font-bold mb-2">Security & PIN</h2>
      <p className="mb-8 text-muted-foreground">
        Update your lock screen PIN to keep shared links and dashboard access secure.
      </p>

      <form onSubmit={submit} className="motion-stagger-children space-y-4 rounded-xl border border-border-strong bg-surface-soft p-5 motion-enter motion-enter-delay-1 motion-hover-lift">
        <label className="block">
          <span className="mb-1 block text-sm text-muted-foreground-strong">New PIN</span>
          <input
            type="password"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            className="w-full rounded-lg border border-border bg-input px-3 py-2 outline-none focus:border-blue-500"
            placeholder="******"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-muted-foreground-strong">Confirm New PIN</span>
          <input
            type="password"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            className="w-full rounded-lg border border-border bg-input px-3 py-2 outline-none focus:border-blue-500"
            placeholder="******"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && <p className="text-sm text-emerald-400">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-foreground px-4 py-2 font-semibold text-background motion-hover-lift motion-press transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Updating..." : "Update PIN"}
        </button>
      </form>
    </div>
  );
}
