"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import {
  getPasswordValidationError,
  isValidSixDigitPin,
  normalizeEmail,
} from "@/lib/validation";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    pin: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!isValidSixDigitPin(formData.pin)) {
      setError("PIN must be exactly 6 digits");
      setLoading(false);
      return;
    }

    const passwordError = getPasswordValidationError(formData.password);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }

    try {
      const normalizedEmail = normalizeEmail(formData.email);
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          email: normalizedEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      // Auto login after register
      await signIn("credentials", {
        email: normalizedEmail,
        password: formData.password,
        redirect: false,
      });

      router.push("/files");
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-background py-12 font-sans sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="motion-ambient absolute left-[-6rem] top-20 h-64 w-64 rounded-full bg-blue-500/12 blur-3xl" />
        <div className="motion-ambient-slow absolute right-[-5rem] bottom-12 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 motion-enter sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="mb-6 flex justify-center">
          <h1 className="text-3xl font-[800] tracking-widest uppercase">
            oneflash
          </h1>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-outfit font-bold tracking-tight motion-enter motion-enter-delay-1">
          Create an account
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground motion-enter motion-enter-delay-2">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-blue-500 hover:text-blue-400"
          >
            Sign in
          </Link>
        </p>
      </div>

      <div className="relative z-10 mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="border border-border-strong bg-surface px-4 py-8 shadow-[0_24px_60px_rgba(15,23,42,0.12)] motion-enter motion-enter-delay-3 sm:rounded-2xl sm:px-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-muted-foreground-strong"
              >
                Username
              </label>
              <div className="mt-1 relative flex rounded-lg shadow-sm">
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  placeholder="e.g. ahmet"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      username: e.target.value.toLowerCase().trim(),
                    })
                  }
                  className="block w-full appearance-none rounded-lg border border-border bg-input px-3 py-2 text-foreground placeholder:text-muted focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-muted-foreground-strong"
              >
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value.trim() })
                  }
                  className="block w-full appearance-none rounded-lg border border-border bg-input px-3 py-2 text-foreground placeholder:text-muted focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-muted-foreground-strong"
              >
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="block w-full appearance-none rounded-lg border border-border bg-input px-3 py-2 text-foreground placeholder:text-muted focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors"
                />
              </div>
              <p className="mt-1 text-xs text-muted">
                Use at least 10 characters with uppercase, lowercase, and a number.
              </p>
            </div>

            <div>
              <label
                htmlFor="pin"
                className="block text-sm font-medium text-muted-foreground-strong"
              >
                6-Digit Access PIN
              </label>
              <div className="mt-1">
                <input
                  id="pin"
                  name="pin"
                  type="password"
                  required
                  maxLength={6}
                  placeholder="••••••"
                  value={formData.pin}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pin: e.target.value.replace(/[^0-9]/g, ""),
                    })
                  }
                  className="block w-full appearance-none rounded-lg border border-border bg-input px-3 py-2 text-center font-mono text-foreground placeholder:text-muted focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-lg tracking-[1em] transition-colors"
                />
              </div>
              <p className="mt-1 text-xs text-muted">
                You&apos;ll use this PIN to access your files quickly without a password.
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-red-500/10 p-3 text-sm font-medium text-red-500 motion-enter">
                {error}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center rounded-lg border border-transparent bg-foreground px-4 py-2.5 text-sm font-bold text-background motion-hover-lift motion-press hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Account"}
                {!loading && (
                  <ArrowRightIcon className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
