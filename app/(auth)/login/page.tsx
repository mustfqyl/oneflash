"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push("/files");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center mb-6">
          <h1 className="text-3xl font-[800] text-white tracking-widest uppercase">
            oneflash
          </h1>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-outfit font-bold tracking-tight text-white">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Or{" "}
          <Link
            href="/register"
            className="font-medium text-blue-500 hover:text-blue-400"
          >
            create a new account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#111] py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-zinc-800">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-300"
              >
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full appearance-none rounded-lg border border-zinc-700 bg-[#0a0a0a] px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-300"
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
                  className="block w-full appearance-none rounded-lg border border-zinc-700 bg-[#0a0a0a] px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm font-medium bg-red-500/10 p-3 rounded-md">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center rounded-lg border border-transparent bg-blue-600 py-2.5 px-4 text-sm font-bold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 transition-all"
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
