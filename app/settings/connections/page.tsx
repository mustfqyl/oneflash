"use client";

import { useEffect, useState } from "react";

interface ProviderStatus {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
}

interface ConnectionsResponse {
  providers: {
    google: ProviderStatus;
    onedrive: ProviderStatus;
  };
}

export default function CloudConnectionsPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionsResponse["providers"] | null>(null);

  const handleConnect = (provider: string) => {
    setLoading(provider);
    window.location.href = `/api/cloud/${provider}/connect`;
  };

  const fetchConnections = async () => {
    setError(null);
    const res = await fetch("/api/settings/connections", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Connections could not be loaded");
    }
    setConnections(data.providers);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConnections().catch((err: Error) => setError(err.message));
  }, []);

  const handleDisconnect = async (provider: "google" | "onedrive") => {
    setDisconnecting(provider);
    setError(null);
    try {
      const res = await fetch(`/api/cloud/${provider}/disconnect`, { method: "DELETE" });
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
    if (!provider.connected) return "Not connected";
    return provider.email ? `Connected as ${provider.email}` : "Connected";
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-2">Cloud Connections</h2>
      <p className="text-zinc-400 mb-8">
        Connect and manage your cloud storage accounts from oneflash.
      </p>
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-black/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center p-2 text-black font-bold">
              GD
            </div>
            <div>
              <h3 className="font-semibold text-lg">Google Drive</h3>
              <p className="text-sm text-zinc-500">{providerText(connections?.google)}</p>
            </div>
          </div>
          {connections?.google?.connected ? (
            <button
              onClick={() => handleDisconnect("google")}
              disabled={!!disconnecting}
              className="px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-300 font-semibold rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              {disconnecting === "google" ? "Disconnecting..." : "Disconnect"}
            </button>
          ) : (
            <button
              onClick={() => handleConnect("google")}
              disabled={!!loading}
              className="px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {loading === "google" ? "Connecting..." : "Connect"}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-black/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center p-2 text-white font-bold">
              OD
            </div>
            <div>
              <h3 className="font-semibold text-lg">OneDrive</h3>
              <p className="text-sm text-zinc-500">{providerText(connections?.onedrive)}</p>
            </div>
          </div>
          {connections?.onedrive?.connected ? (
            <button
              onClick={() => handleDisconnect("onedrive")}
              disabled={!!disconnecting}
              className="px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-300 font-semibold rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              {disconnecting === "onedrive" ? "Disconnecting..." : "Disconnect"}
            </button>
          ) : (
            <button
              onClick={() => handleConnect("onedrive")}
              disabled={!!loading}
              className="px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {loading === "onedrive" ? "Connecting..." : "Connect"}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-black/50 opacity-60 grayscale">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center p-2 text-zinc-300 font-bold">
              iC
            </div>
            <div>
              <h3 className="font-semibold text-lg">iCloud</h3>
              <p className="text-sm text-zinc-500">Coming soon in MVP v2</p>
            </div>
          </div>
          <button
            disabled
            className="px-4 py-2 bg-zinc-800 text-zinc-500 font-semibold rounded-lg cursor-not-allowed"
          >
            Connect
          </button>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-zinc-800 bg-black/40 p-4">
        <h4 className="text-sm font-semibold mb-3">Connected Accounts</h4>
        <div className="space-y-2 text-sm text-zinc-300">
          {connections?.google?.connected && <p>Google Drive: {connections.google.email || "Connected"}</p>}
          {connections?.onedrive?.connected && <p>OneDrive: {connections.onedrive.email || "Connected"}</p>}
          {!connections?.google?.connected && !connections?.onedrive?.connected && (
            <p className="text-zinc-500">No connected account yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
