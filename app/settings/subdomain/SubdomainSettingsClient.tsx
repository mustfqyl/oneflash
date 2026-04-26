"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { getSubdomainUrl } from "@/lib/subdomain";

interface SubdomainSettingsClientProps {
  rootDomain: string;
}

export default function SubdomainSettingsClient({
  rootDomain,
}: SubdomainSettingsClientProps) {
  const [subdomain, setSubdomain] = useState("");
  const [current, setCurrent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.user?.customDomain) {
          setCurrent(data.user.customDomain);
          setSubdomain(data.user.customDomain);
        }
      })
      .catch(() => undefined)
      .finally(() => setPageLoading(false));
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
      setSubdomain(data.subdomain);
      setMessage("Domain updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl motion-enter">
      <h2 className="mb-2 text-2xl font-bold">Domain</h2>
      <p className="mb-8 text-muted-foreground">
        Manage your subdomain. This value is used for your public oneflash profile URL.
      </p>

      {pageLoading ? (
        <div className="mb-6 h-[88px] animate-pulse rounded-xl bg-foreground/5 motion-enter motion-enter-delay-1" />
      ) : current ? (
        <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 motion-enter motion-enter-delay-1">
          <p className="mb-2 text-sm text-muted-foreground">Your active domain:</p>
          <a
            href={getSubdomainUrl(current, rootDomain)}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 text-lg font-medium text-blue-500 hover:text-blue-400"
          >
            {current}.{rootDomain}
            <ArrowTopRightOnSquareIcon className="h-5 w-5 opacity-70 transition-opacity group-hover:opacity-100" />
          </a>
        </div>
      ) : null}

      <form
        onSubmit={submit}
        className="motion-stagger-children space-y-4 rounded-xl border border-border-strong bg-surface-soft p-5 motion-enter motion-enter-delay-1 motion-hover-lift"
      >
        <label className="block">
          <span className="mb-1 block text-sm text-muted-foreground-strong">Subdomain</span>
          {pageLoading ? (
            <div className="h-[42px] w-full animate-pulse rounded-lg bg-foreground/5" />
          ) : (
            <div className="flex items-center rounded-lg border border-border bg-input px-3 py-2">
              <input
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                className="w-full bg-transparent outline-none"
                placeholder="your-name"
              />
              <span className="text-sm text-muted">.{rootDomain}</span>
            </div>
          )}
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && <p className="text-sm text-emerald-400">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-foreground px-4 py-2 font-semibold text-background motion-hover-lift motion-press transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Domain"}
        </button>
      </form>
    </div>
  );
}
