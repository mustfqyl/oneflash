"use client";

import { useState, useEffect, useRef, useCallback, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useAnimation } from "framer-motion";

interface PinScreenProps {
  subdomain: string;
  onSuccess: () => void;
}

export default function PinScreen({ subdomain, onSuccess }: PinScreenProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [trustDevice, setTrustDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const controls = useAnimation();
  const inputRef = useRef<HTMLInputElement>(null);

  const focusInput = useCallback(() => {
    if (lockedUntil || loading) {
      return;
    }

    const input = inputRef.current;
    if (!input) {
      return;
    }

    requestAnimationFrame(() => {
      input.focus({ preventScroll: true });
      const cursorPosition = input.value.length;
      input.setSelectionRange(cursorPosition, cursorPosition);
    });
  }, [lockedUntil, loading]);

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  const verifyPin = useCallback(async (currentPin: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/pin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: currentPin,
          subdomain,
          trustDevice,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        onSuccess();
      } else {
        setError(true);
        setPin("");
        controls.start({
          x: [-10, 10, -10, 10, 0],
          transition: { duration: 0.4 },
        });

        if (data.locked || res.status === 429) {
          const nextLockedUntil = Date.now() + (data.remainingMs || 30000);
          setLockedUntil(nextLockedUntil);
          setRemainingSeconds(
            Math.max(0, Math.ceil((nextLockedUntil - Date.now()) / 1000))
          );
        }
      }
    } catch {
      setError(true);
      setPin("");
      controls.start({
        x: [-10, 10, -10, 10, 0],
        transition: { duration: 0.4 },
      });
    } finally {
      setLoading(false);
    }
  }, [subdomain, trustDevice, onSuccess, controls]);

  useEffect(() => {
    // Timer for lockout
    if (!lockedUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setRemainingSeconds(remaining);

      if (Date.now() >= lockedUntil) {
        setLockedUntil(null);
        setRemainingSeconds(0);
        setError(false);
        setPin("");
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const handlePinSurfacePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, label, a")) {
      return;
    }

    focusInput();
  };

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-background font-sans"
      onPointerDown={handlePinSurfacePointerDown}
    >
      {/* Hidden but focusable input to capture numeric entry reliably */}
      <input
        aria-label="PIN input"
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        enterKeyHint="done"
        spellCheck={false}
        className="pointer-events-none absolute left-0 top-0 h-0 w-0 opacity-0"
        value={pin}
        onChange={(e) => {
          const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
          setPin(val);
          setError(false);
          if (val.length === 6 && !lockedUntil && !loading) {
            void verifyPin(val);
          }
        }}
        onBlur={() => {
          focusInput();
        }}
        disabled={!!lockedUntil || loading}
        autoFocus
      />

      <div className="mb-12 flex flex-col items-center">
        <h1 className="mb-2 text-4xl font-[800] tracking-widest uppercase">
          oneflash
        </h1>
        <p className="font-medium text-muted">
          {subdomain}.oneflash.one
        </p>
      </div>

      <motion.div
        animate={controls}
        className="flex gap-4 mb-10 cursor-text"
        onClick={focusInput}
      >
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={`w-14 h-16 rounded-xl border-2 flex items-center justify-center text-3xl font-bold transition-all duration-200
              ${
                error
                  ? "border-red-500 text-red-500 bg-red-500/10"
                  : pin.length > i
                  ? "border-foreground bg-hover-strong text-foreground shadow-[0_0_15px_rgba(59,130,246,0.18)]"
                  : "border-border-strong text-transparent"
              }
            `}
          >
            {pin.length > i ? "•" : ""}
          </div>
        ))}
      </motion.div>

      <div className="h-8">
        {lockedUntil ? (
          <p className="text-red-500 font-medium animate-pulse">
            Locked. Try again in {remainingSeconds}s
          </p>
        ) : error ? (
          <p className="text-red-500 font-medium">Incorrect PIN</p>
        ) : loading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground"></div>
        ) : null}
      </div>

      <label className="mt-12 flex items-center gap-3 cursor-pointer group">
        <div className="relative flex items-center justify-center w-5 h-5">
          <input
            type="checkbox"
            className="peer h-5 w-5 cursor-pointer appearance-none rounded border-2 border-border bg-input transition-colors hover:bg-hover checked:border-foreground checked:bg-foreground"
            checked={trustDevice}
            onChange={(e) => {
              setTrustDevice(e.target.checked);
              focusInput();
            }}
            disabled={!!lockedUntil || loading}
          />
          <div className="pointer-events-none absolute text-background opacity-0 transition-opacity peer-checked:opacity-100">
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 3L4.5 8.5L2 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <span className="font-medium text-muted transition-colors group-hover:text-muted-foreground">
          Trust this device
        </span>
      </label>
    </div>
  );
}
