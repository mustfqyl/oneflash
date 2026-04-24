"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";

interface SignOutDialogProps {
  open: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onPendingChange: (pending: boolean) => void;
  onErrorChange: (error: string | null) => void;
}

export default function SignOutDialog({
  open,
  pending,
  error,
  onClose,
  onPendingChange,
  onErrorChange,
}: SignOutDialogProps) {
  const router = useRouter();
  const buttonBaseClass =
    "inline-flex min-w-[110px] items-center justify-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 active:scale-[0.98] disabled:cursor-not-allowed";
  const secondaryButtonClass = `${buttonBaseClass} bg-surface-elevated text-foreground hover:bg-hover disabled:opacity-50`;
  const primaryButtonClass = `${buttonBaseClass} bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-80`;

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, pending]);

  if (!open) {
    return null;
  }

  const handleSignOut = async () => {
    if (pending) {
      return;
    }

    onPendingChange(true);
    onErrorChange(null);

    try {
      const [, signOutResult] = await Promise.allSettled([
        fetch("/api/auth/device", {
          method: "POST",
        }),
        signOut({ redirect: false }),
      ]);

      if (signOutResult.status === "rejected") {
        throw signOutResult.reason;
      }

      router.replace("/login");
    } catch {
      onErrorChange("Sign out failed. Please try again.");
      onPendingChange(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay px-4 backdrop-blur-sm">
      <button
        aria-label="Close sign out dialog"
        className="absolute inset-0 cursor-default"
        disabled={pending}
        onClick={onClose}
        type="button"
      />

      <div
        aria-describedby="sign-out-dialog-description"
        aria-labelledby="sign-out-dialog-title"
        aria-busy={pending}
        aria-modal="true"
        className="motion-window relative w-full max-w-[420px] rounded-xl border border-border bg-surface p-5"
        role="dialog"
      >
        <h3 className="mb-2 text-lg font-semibold" id="sign-out-dialog-title">
          Sign Out
        </h3>
        <p className="text-sm text-muted-foreground" id="sign-out-dialog-description">
          Are you sure you want to sign out?
        </p>

        {error ? (
          <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            className={secondaryButtonClass}
            disabled={pending}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>

          <button
            className={primaryButtonClass}
            disabled={pending}
            onClick={handleSignOut}
            type="button"
          >
            {pending ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
            )}
            {pending ? "Signing out..." : "Sign Out"}
          </button>
        </div>
      </div>
    </div>
  );
}
