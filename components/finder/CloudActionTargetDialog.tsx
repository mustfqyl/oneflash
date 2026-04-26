"use client";

import { CloudIcon } from "@heroicons/react/24/outline";
import type {
  CloudActionTarget,
  CloudProviderId,
  ConnectedCloudAccount,
} from "./CloudContext";

export interface CloudActionTargetOption extends CloudActionTarget {
  key: string;
  providerLabel: string;
  accountLabel: string;
}

function getProviderLabel(provider: CloudProviderId) {
  return provider === "google" ? "Google Drive" : "OneDrive";
}

export function buildCloudActionTargetOptions({
  currentLocationProvider,
  connectedProviders,
  connectedAccountsByProvider,
}: {
  currentLocationProvider: CloudProviderId | null;
  connectedProviders: CloudProviderId[];
  connectedAccountsByProvider: Record<CloudProviderId, ConnectedCloudAccount[]>;
}) {
  const candidateProviders = currentLocationProvider
    ? [currentLocationProvider]
    : connectedProviders;

  return candidateProviders.flatMap((provider) => {
    const providerLabel = getProviderLabel(provider);
    const accounts = connectedAccountsByProvider[provider] ?? [];

    return accounts.map((account) => ({
      key: `${provider}:${account.id}`,
      provider,
      accountId: account.id,
      providerLabel,
      accountLabel: account.email || "Email unavailable",
    }));
  });
}

export default function CloudActionTargetDialog({
  open,
  title,
  description,
  options,
  onClose,
  onSelect,
}: {
  open: boolean;
  title: string;
  description: string;
  options: CloudActionTargetOption[];
  onClose: () => void;
  onSelect: (target: CloudActionTarget) => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        aria-modal="true"
        className="w-full max-w-[420px] rounded-xl border border-border bg-surface p-5"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-4 space-y-2">
          {options.length > 0 ? (
            options.map((option) => (
              <button
                key={option.key}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-window-chrome px-3 py-3 text-left transition-colors hover:bg-hover"
                onClick={() =>
                  onSelect({
                    provider: option.provider,
                    accountId: option.accountId,
                  })
                }
                type="button"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-elevated text-blue-400">
                  <CloudIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {option.accountLabel}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {option.providerLabel}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <p className="rounded-lg border border-border bg-window-chrome px-3 py-3 text-sm text-muted-foreground">
              Connect a storage account to continue.
            </p>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            className="inline-flex min-w-[96px] items-center justify-center rounded bg-surface-elevated px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-hover"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
