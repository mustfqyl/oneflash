"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useAnimation } from "framer-motion";

interface PinScreenProps {
  subdomain: string;
  onSuccess: () => void;
}

export default function PinScreen({ subdomain, onSuccess }: PinScreenProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [trustDevice, setTrustDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const controls = useAnimation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus invisible input on mount and keep it focused
    if (!lockedUntil) {
      inputRef.current?.focus();
    }
  }, [lockedUntil]);

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
          setLockedUntil(Date.now() + (data.remainingMs || 30000));
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
      if (Date.now() >= lockedUntil) {
        setLockedUntil(null);
        setError(false);
        setPin("");
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  useEffect(() => {
    // Auto-submit when 6 digits are entered
    if (pin.length === 6 && !lockedUntil && !loading) {
      verifyPin(pin);
    }
  }, [pin, lockedUntil, loading, verifyPin]);

  // Calculate remaining seconds cleanly without calling Date.now() directly in render if possible, 
  // but since we need it dynamic, we'll store it in state or use the interval. 
  // A simple fix for react-hooks/purity is to use a state for the remaining time.
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!lockedUntil) {
      setRemainingSeconds(0);
      return;
    }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setRemainingSeconds(remaining);
    };
    update();
    const int = setInterval(update, 1000);
    return () => clearInterval(int);
  }, [lockedUntil]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center font-sans">
      {/* Invisible input to capture keystrokes on mobile */}
      <input
        ref={inputRef}
        type="tel"
        className="opacity-0 absolute -z-10"
        value={pin}
        onChange={(e) => {
          const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
          setPin(val);
          setError(false);
        }}
        onBlur={() => {
          // Try to keep focus
          if (!lockedUntil) setTimeout(() => inputRef.current?.focus(), 10);
        }}
        disabled={!!lockedUntil || loading}
        autoFocus
      />

      <div className="mb-12 flex flex-col items-center">
        <h1 className="text-4xl font-[800] text-white tracking-widest uppercase mb-2">
          oneflash
        </h1>
        <p className="text-zinc-500 font-medium">
          {subdomain}.oneflash.co
        </p>
      </div>

      <motion.div
        animate={controls}
        className="flex gap-4 mb-10 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={`w-14 h-16 rounded-xl border-2 flex items-center justify-center text-3xl font-bold transition-all duration-200
              ${
                error
                  ? "border-red-500 text-red-500 bg-red-500/10"
                  : pin.length > i
                  ? "border-white text-white shadow-[0_0_15px_rgba(255,255,255,0.3)] bg-white/10"
                  : "border-zinc-800 text-transparent"
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
          <div className="w-5 h-5 border-2 border-zinc-500 border-t-white rounded-full animate-spin"></div>
        ) : null}
      </div>

      <label className="mt-12 flex items-center gap-3 cursor-pointer group">
        <div className="relative flex items-center justify-center w-5 h-5">
          <input
            type="checkbox"
            className="peer appearance-none w-5 h-5 rounded hover:bg-zinc-800 border-2 border-zinc-700 checked:bg-white checked:border-white transition-colors cursor-pointer"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
            disabled={!!lockedUntil || loading}
          />
          <div className="absolute text-black opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity">
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
        <span className="text-zinc-500 font-medium group-hover:text-zinc-300 transition-colors">
          Trust this device
        </span>
      </label>
    </div>
  );
}
