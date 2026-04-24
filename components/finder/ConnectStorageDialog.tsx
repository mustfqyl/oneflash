"use client";

import { useRouter } from "next/navigation";
import { CloudIcon } from "@heroicons/react/24/outline";
import { useCloud } from "./CloudContext";

export default function ConnectStorageDialog() {
  const router = useRouter();
  const { connectedProviders, connectionsLoaded } = useCloud();

  if (!connectionsLoaded || connectedProviders.length > 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-overlay px-4 backdrop-blur-sm">
      <div
        aria-describedby="connect-storage-dialog-description"
        aria-labelledby="connect-storage-dialog-title"
        aria-modal="true"
        className="relative w-full max-w-[420px] rounded-xl border border-border bg-surface p-5"
        role="dialog"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
            <CloudIcon className="h-5 w-5" />
          </div>

          <div>
            <h3
              className="mb-2 text-lg font-semibold"
              id="connect-storage-dialog-title"
            >
              Connect Cloud Storage
            </h3>
            <p
              className="text-sm leading-6 text-muted-foreground"
              id="connect-storage-dialog-description"
            >
              No cloud storage is linked to this account yet. Connect Google
              Drive or OneDrive from settings to start using Finder.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm text-blue-600">
          You need at least one connected provider to continue.
        </div>

        <div className="mt-4 flex justify-end">
          <button
            className="cursor-pointer rounded bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-500"
            onClick={() => router.push("/settings/connections")}
            type="button"
          >
            Open Cloud Connections
          </button>
        </div>
      </div>
    </div>
  );
}
