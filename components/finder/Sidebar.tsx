"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloudIcon,
  Cog6ToothIcon,
  FolderIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import { useCloud } from "./CloudContext";
import SignOutDialog from "./SignOutDialog";

type ProviderLink = {
  name: string;
  id: "google" | "onedrive";
  icon: typeof CloudIcon;
  color: string;
};

export default function Sidebar({
  canAccessSettings = true,
}: {
  canAccessSettings?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    provider,
    connectedProviders,
    connectedAccountsByProvider,
    currentLocationAccountId,
    openLocationRoot,
  } = useCloud();
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<"google" | "onedrive" | null>(
    null
  );

  useEffect(() => {
    if (provider === "google" || provider === "onedrive") {
      setExpandedProvider((prev) => prev ?? provider);
    }
  }, [provider]);

  const links = [
    connectedProviders.includes("google")
      ? {
          name: "Google Drive",
          id: "google",
          icon: CloudIcon,
          color: "text-blue-400",
        }
      : null,
    connectedProviders.includes("onedrive")
      ? {
          name: "OneDrive",
          id: "onedrive",
          icon: CloudIcon,
          color: "text-blue-500",
        }
      : null,
  ].filter(Boolean) as ProviderLink[];

  const buildFilesLocationHref = (
    nextProvider: "google" | "onedrive" | null,
    accountId: string | null = null
  ) => {
    if (!nextProvider) {
      return "/files";
    }

    const params = new URLSearchParams({
      provider: nextProvider,
    });
    if (accountId) {
      params.set("accountId", accountId);
    }
    return `/files?${params.toString()}`;
  };

  const openFilesLocation = (
    nextProvider: "google" | "onedrive" | null,
    accountId: string | null = null
  ) => {
    const nextHref = buildFilesLocationHref(nextProvider, accountId);

    if (pathname === "/files") {
      openLocationRoot(nextProvider, accountId);
      router.push(nextHref);
      return;
    }

    router.push(nextHref);
  };

  return (
    <>
      <aside className="motion-enter motion-enter-delay-1 flex h-full w-full flex-col border-r border-border bg-sidebar pt-4 pb-4 sm:w-60">
        <div className="mb-8 px-5">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
            Favorites
          </h2>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => openFilesLocation(null)}
              className={`motion-nav-item flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-left text-sm font-medium transition-colors ${
                pathname === "/files" && !provider
                  ? "bg-blue-500/80 text-white"
                  : "text-muted-foreground hover:bg-hover"
              }`}
            >
              <FolderIcon className="h-4 w-4 text-blue-400" />
              All Files
            </button>
            <Link
              href="/favorites"
              className={`motion-nav-item flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                pathname === "/favorites"
                  ? "bg-blue-500 text-white"
                  : "text-muted-foreground hover:bg-hover"
              }`}
            >
              <StarIcon className="h-4 w-4 text-yellow-400" />
              Favorites
            </Link>
          </div>
        </div>

        <div className="mb-6 px-5">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
            Locations
          </h2>
          <div className="space-y-0.5">
            {links.map((link) => {
              const accounts = connectedAccountsByProvider[link.id];
              const isExpanded = expandedProvider === link.id;
              const providerActive =
                provider === link.id && currentLocationAccountId === null;

              return (
                <div key={link.id} className="space-y-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openFilesLocation(link.id)}
                      className={`motion-nav-item flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-1.5 text-left text-sm font-medium transition-colors ${
                        providerActive
                          ? "bg-hover-strong font-semibold text-foreground"
                          : "text-muted-foreground hover:bg-hover"
                      }`}
                    >
                      <link.icon className={`h-4 w-4 ${link.color}`} />
                      <span className="truncate">{link.name}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`${link.name} accounts`}
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setExpandedProvider((prev) => (prev === link.id ? null : link.id))
                      }
                      className="rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
                    >
                      {isExpanded ? (
                        <ChevronDownIcon className="h-4 w-4" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {isExpanded ? (
                    <div className="ml-6 space-y-0.5 border-l border-border pl-2">
                      {accounts.length > 0 ? (
                        accounts.map((account) => (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => openFilesLocation(link.id, account.id)}
                            className={`flex w-full items-center rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                              provider === link.id &&
                              currentLocationAccountId === account.id
                                ? "bg-hover-strong text-foreground"
                                : "text-muted-foreground hover:bg-hover"
                            }`}
                            title={account.email || "Email unavailable"}
                          >
                            <span className="truncate">
                              {account.email || "Email unavailable"}
                            </span>
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-1.5 text-xs text-muted">
                          No connected account
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {links.length === 0 ? (
              <p className="px-3 py-1.5 text-xs text-muted">No connected platform</p>
            ) : null}
          </div>
        </div>

        <div className="mt-auto px-5 pt-4">
          <div className="space-y-0.5 border-t border-border pt-4">
            {canAccessSettings ? (
              <Link
                href="/settings"
                className="motion-nav-item flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-hover"
              >
                <Cog6ToothIcon className="h-4 w-4 text-muted" />
                Settings
              </Link>
            ) : null}
            <button
              className="motion-nav-item flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-1.5 text-left text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
              onClick={() => {
                setSignOutError(null);
                setSignOutDialogOpen(true);
              }}
              type="button"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <SignOutDialog
        error={signOutError}
        onClose={() => {
          if (signOutPending) {
            return;
          }

          setSignOutError(null);
          setSignOutDialogOpen(false);
        }}
        onErrorChange={setSignOutError}
        onPendingChange={setSignOutPending}
        open={signOutDialogOpen}
        pending={signOutPending}
      />
    </>
  );
}
