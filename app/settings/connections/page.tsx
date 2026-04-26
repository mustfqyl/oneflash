"use client";

import { useEffect, useState } from "react";

interface ConnectedAccount {
  id: string;
  email: string | null;
  connectedAt: string | null;
  usedBytes: number | null;
  totalBytes: number | null;
  remainingBytes: number | null;
}

interface ProviderStatus {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  accountCount: number;
  limit: number;
  remainingSlots: number;
  accounts: ConnectedAccount[];
}

interface ConnectionsResponse {
  providers: {
    google: ProviderStatus;
    onedrive: ProviderStatus;
  };
}

type ProviderKey = "google" | "onedrive";

const PROVIDER_META: Record<
  ProviderKey,
  { title: string; iconClass: string; labelClass: string; initials: string }
> = {
  google: {
    title: "Google Drive",
    iconClass: "bg-white text-black",
    labelClass: "text-muted",
    initials: "GD",
  },
  onedrive: {
    title: "OneDrive",
    iconClass: "bg-blue-600 text-white",
    labelClass: "text-muted",
    initials: "OD",
  },
};

function renderComingSoonCard({
  cardKey,
  title,
  initials,
  buttonLabel,
}: {
  cardKey: string;
  title: string;
  initials: string;
  buttonLabel: string;
}) {
  return (
    <div
      key={cardKey}
      className="flex items-center justify-between rounded-xl border border-border-strong bg-surface-soft p-4 opacity-60 grayscale"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-input-soft p-2 font-bold text-muted-foreground">
          {initials}
        </div>
        <div>
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-sm text-muted">Coming soon...</p>
        </div>
      </div>
      <button
        disabled
        className="cursor-not-allowed rounded-lg bg-input-soft px-4 py-2 font-semibold text-muted"
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) {
    return "Unavailable";
  }

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${Number(value.toFixed(precision))} ${units[unitIndex]}`;
}

function getStorageProgress(
  storage?: Pick<ConnectedAccount, "usedBytes" | "totalBytes"> | null
): number | null {
  if (!storage || storage.usedBytes === null || storage.totalBytes === null || storage.totalBytes <= 0) {
    return null;
  }

  return Math.min(100, Math.max(0, (storage.usedBytes / storage.totalBytes) * 100));
}

export default function CloudConnectionsPage() {
  const [loading, setLoading] = useState<ProviderKey | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionsResponse["providers"] | null>(null);

  const handleConnect = (provider: ProviderKey) => {
    setLoading(provider);
    window.location.assign(`/api/cloud/${provider}/connect`);
  };

  const fetchConnections = async () => {
    setError(null);
    try {
      const res = await fetch("/api/settings/connections", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Connections could not be loaded");
      }
      setConnections(data.providers);
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConnections().catch((err: Error) => {
      setError(err.message);
      setPageLoading(false);
    });
  }, []);

  const handleDisconnect = async (provider: ProviderKey, accountId: string) => {
    const key = `${provider}:${accountId}`;
    setDisconnecting(key);
    setError(null);
    try {
      const res = await fetch(`/api/cloud/${provider}/disconnect`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Disconnect failed");
      }
      await fetchConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setDisconnecting(null);
    }
  };

  const providerText = (provider: ProviderStatus | undefined) => {
    if (!provider) return "Checking status...";
    if (provider.accountCount === 0) return "Not connected";
    if (provider.accountCount === 1) {
      return provider.email ? `Connected as ${provider.email}` : "1 account connected";
    }
    return `${provider.accountCount} of ${provider.limit} accounts connected`;
  };

  const renderProviderCard = (providerKey: ProviderKey) => {
    const provider = connections?.[providerKey];
    const meta = PROVIDER_META[providerKey];
    const canConnectMore = !provider || provider.accountCount < provider.limit;

    if (providerKey === "onedrive") {
      return renderComingSoonCard({
        cardKey: providerKey,
        title: meta.title,
        initials: meta.initials,
        buttonLabel: "Connect",
      });
    }

    if (pageLoading) {
      return (
        <div key={providerKey} className="rounded-xl border border-border-strong bg-surface-soft p-4 motion-hover-lift">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg opacity-50 ${meta.iconClass}`}>
                {meta.initials}
              </div>
              <div>
                <div className="mb-2 h-5 w-32 animate-pulse rounded bg-foreground/10" />
                <div className="h-4 w-48 animate-pulse rounded bg-foreground/10" />
              </div>
            </div>
            <div className="h-10 w-24 animate-pulse rounded-lg bg-foreground/5" />
          </div>
        </div>
      );
    }

    return (
      <div
        key={providerKey}
        className="rounded-xl border border-border-strong bg-surface-soft p-4 motion-hover-lift"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-lg p-2 font-bold ${meta.iconClass}`}
            >
              {meta.initials}
            </div>
            <div>
              <h3 className="font-semibold text-lg">{meta.title}</h3>
              <p className={`text-sm ${meta.labelClass}`}>{providerText(provider)}</p>
            </div>
          </div>

          {canConnectMore ? (
            <button
              onClick={() => handleConnect(providerKey)}
              disabled={!!loading}
              className="rounded-lg bg-foreground px-4 py-2 font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading === providerKey
                ? "Connecting..."
                : provider?.accountCount
                  ? "Connect another"
                  : "Connect"}
            </button>
          ) : (
            <button
              disabled
              className="cursor-not-allowed rounded-lg bg-input-soft px-4 py-2 font-semibold text-muted"
            >
              Limit reached
            </button>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {provider?.accounts.length ? (
            provider.accounts.map((account) => {
              const disconnectKey = `${providerKey}:${account.id}`;
              const accountStorageProgress = getStorageProgress(account);
              const accountStorageSummary =
                account.usedBytes !== null && account.totalBytes !== null
                  ? `${formatBytes(account.usedBytes)} / ${formatBytes(account.totalBytes)}`
                  : "Storage unavailable";
              return (
                <div
                  key={account.id}
                  className="motion-list-row flex flex-col gap-3 rounded-lg border border-border bg-background/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {account.email || "Email unavailable"}
                      </p>
                      <p className="text-xs text-muted">
                        {account.connectedAt
                          ? `Connected ${new Date(account.connectedAt).toLocaleString()}`
                          : "Connected"}
                      </p>
                    </div>

                    <div className="w-full sm:w-[190px]">
                      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-muted">
                        <span className="truncate">{accountStorageSummary}</span>
                        {accountStorageProgress !== null ? (
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {Math.round(accountStorageProgress)}%
                          </span>
                        ) : null}
                      </div>
                      {accountStorageProgress !== null ? (
                        <div
                          aria-label={`${account.email || `${meta.title} account`} storage usage`}
                          aria-valuemax={100}
                          aria-valuemin={0}
                          aria-valuenow={Math.round(accountStorageProgress)}
                          aria-valuetext={accountStorageSummary}
                          className="h-1.5 w-full overflow-hidden rounded-full bg-input-soft"
                          role="progressbar"
                        >
                          <div
                            className="h-full rounded-full bg-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.28)] animate-pulse"
                            style={{ width: `${accountStorageProgress}%` }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDisconnect(providerKey, account.id)}
                    disabled={disconnecting !== null}
                    className="motion-list-row rounded-lg border border-red-500/50 bg-red-500/20 px-3 py-1.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/30 disabled:opacity-50"
                  >
                    {disconnecting === disconnectKey ? "Disconnecting..." : "Disconnect"}
                  </button>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted">No connected account yet.</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-2">Cloud Connections</h2>
      <p className="mb-8 text-muted-foreground">
        Connect and manage up to five cloud accounts per provider from oneflash.
      </p>
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-4 motion-stagger-children">
        {renderProviderCard("google")}
        {renderProviderCard("onedrive")}
        {renderComingSoonCard({
          cardKey: "icloud",
          title: "iCloud",
          initials: "iC",
          buttonLabel: "Connect",
        })}
      </div>
    </div>
  );
}
