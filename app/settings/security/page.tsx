"use client";

import { FormEvent, useState } from "react";

export default function SecurityPage() {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (!/^\d{6}$/.test(currentPin) || !/^\d{6}$/.test(newPin)) {
      setError("Both PIN fields must be exactly 6 digits.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/pin/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "PIN update failed");
      }

      setMessage("PIN successfully updated.");
      setCurrentPin("");
      setNewPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-2">Security & PIN</h2>
      <p className="text-zinc-400 mb-8">
        Update your lock screen PIN to keep shared links and dashboard access secure.
      </p>

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-zinc-800 bg-black/40 p-5">
        <label className="block">
          <span className="mb-1 block text-sm text-zinc-300">Current PIN</span>
          <input
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-blue-500"
            placeholder="******"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-zinc-300">New PIN</span>
          <input
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-blue-500"
            placeholder="******"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && <p className="text-sm text-emerald-400">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-white px-4 py-2 font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50"
        >
          {loading ? "Updating..." : "Update PIN"}
        </button>
      </form>
    </div>
  );
}
