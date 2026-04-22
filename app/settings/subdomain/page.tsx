"use client";

import { FormEvent, useEffect, useState } from "react";

export default function DomainPage() {
  const [subdomain, setSubdomain] = useState("");
  const [current, setCurrent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.user?.username) {
          setCurrent(data.user.username);
          setSubdomain(data.user.username);
        }
      })
      .catch(() => undefined);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/subdomain/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subdomain),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Domain update failed");
      }

      setCurrent(data.subdomain);
      setMessage("Domain updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-2">Domain</h2>
      <p className="text-zinc-400 mb-8">
        Manage your subdomain. This value is used for your public oneflash profile URL.
      </p>

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-zinc-800 bg-black/40 p-5">
        <label className="block">
          <span className="mb-1 block text-sm text-zinc-300">Subdomain</span>
          <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2">
            <input
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
              className="w-full bg-transparent outline-none"
              placeholder="your-name"
            />
            <span className="text-sm text-zinc-500">.oneflash.co</span>
          </div>
        </label>

        {current && <p className="text-sm text-zinc-500">Current: {current}.oneflash.co</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && <p className="text-sm text-emerald-400">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-white px-4 py-2 font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Domain"}
        </button>
      </form>
    </div>
  );
}
