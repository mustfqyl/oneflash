"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

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

    if (formData.pin.length !== 6 || !/^\d+$/.test(formData.pin)) {
      setError("PIN must be exactly 6 digits");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      // Auto login after register
      await signIn("credentials", {
        email: formData.email,
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
    <div className="min-h-screen bg-black flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center mb-6">
          <h1 className="text-3xl font-[800] text-white tracking-widest uppercase">
            oneflash
          </h1>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-outfit font-bold tracking-tight text-white">
          Claim your subdomain
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-blue-500 hover:text-blue-400"
          >
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#111] py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-zinc-800">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-zinc-300"
              >
                Desired Subdomain
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
                  className="block w-full appearance-none rounded-l-lg border border-zinc-700 bg-[#0a0a0a] px-3 py-2 text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors"
                />
                <span className="inline-flex items-center rounded-r-md border border-l-0 border-zinc-700 bg-zinc-900 px-3 text-zinc-500 sm:text-sm">
                  .oneflash.co
                </span>
              </div>
            </div>

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
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="block w-full appearance-none rounded-lg border border-zinc-700 bg-[#0a0a0a] px-3 py-2 text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors"
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
                  required
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="block w-full appearance-none rounded-lg border border-zinc-700 bg-[#0a0a0a] px-3 py-2 text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="pin"
                className="block text-sm font-medium text-zinc-300"
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
                  className="block w-full appearance-none rounded-lg border border-zinc-700 bg-[#0a0a0a] px-3 py-2 text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-lg tracking-[1em] text-center transition-colors font-mono"
                />
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                You&apos;ll use this PIN to access your files quickly without a password.
              </p>
            </div>

            {error && (
              <div className="text-red-500 text-sm font-medium bg-red-500/10 p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center rounded-lg border border-transparent bg-white py-2.5 px-4 text-sm font-bold text-black hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 transition-all"
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
