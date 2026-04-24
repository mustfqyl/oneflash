"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { normalizeEmail } from "@/lib/validation";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email: normalizeEmail(identifier),
      password,
      redirect: false,
    });

    if (res?.error) {
      setError(
        res.error.toLowerCase().includes("too many")
          ? res.error
          : "Invalid email/username or password"
      );
      setLoading(false);
    } else {
      router.push("/files");
      router.refresh();
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-background py-12 font-sans sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="motion-ambient absolute left-[-6rem] top-20 h-64 w-64 rounded-full bg-blue-500/12 blur-3xl" />
        <div className="motion-ambient-slow absolute right-[-5rem] bottom-16 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 motion-enter sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="mb-6 flex justify-center">
          <h1 className="text-3xl font-[800] tracking-widest uppercase">
            oneflash
          </h1>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-outfit font-bold tracking-tight motion-enter motion-enter-delay-1">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground motion-enter motion-enter-delay-2">
          Or{" "}
          <Link
            href="/register"
            className="font-medium text-blue-500 hover:text-blue-400"
          >
            create a new account
          </Link>
        </p>
      </div>

      <div className="relative z-10 mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="border border-border-strong bg-surface px-4 py-8 shadow-[0_24px_60px_rgba(15,23,42,0.12)] motion-enter motion-enter-delay-3 sm:rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="identifier"
                className="block text-sm font-medium text-muted-foreground-strong"
              >
                Email address or Username
              </label>
              <div className="mt-1">
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value.trim())}
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
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full appearance-none rounded-lg border border-border bg-input px-3 py-2 text-foreground placeholder:text-muted focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-500/10 p-3 text-sm font-medium text-red-500 motion-enter">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center rounded-lg border border-transparent bg-blue-600 px-4 py-2.5 text-sm font-bold text-white motion-hover-lift motion-press hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign in"}
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
