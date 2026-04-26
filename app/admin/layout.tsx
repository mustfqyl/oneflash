import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  ChartBarSquareIcon,
  ArrowLeftIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { authOptions, isAdminEmail } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!isAdminEmail(session?.user?.email)) {
    redirect("/files");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background font-sans text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="motion-ambient absolute left-[-8rem] top-16 h-72 w-72 rounded-full bg-blue-500/14 blur-3xl" />
        <div className="motion-ambient-slow absolute right-[-7rem] top-1/3 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-6 py-8 lg:px-8">
        <header className="motion-enter overflow-hidden rounded-[30px] border border-white/8 bg-surface-soft shadow-[0_24px_80px_rgba(2,8,23,0.34)] backdrop-blur-xl">
          <div className="border-b border-white/8 px-6 py-4 sm:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 p-3 text-blue-300">
                  <ChartBarSquareIcon className="h-7 w-7" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-blue-300">
                    Admin Control
                  </div>
                  <h1 className="mt-4 font-outfit text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    oneflash intelligence panel
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-white/68 sm:text-base">
                    Inspect platform growth, connection health, access behavior, and detailed user records from one place.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:items-end">
                <div className="rounded-2xl border border-white/8 bg-black/25 px-4 py-3 text-sm text-white/72">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
                    Signed in admin
                  </div>
                  <div className="mt-1 font-medium text-white">
                    {session?.user?.email || "Unknown admin"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/files"
                    className="motion-hover-lift motion-press inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Back to Files
                  </Link>
                  <Link
                    href="/settings"
                    className="motion-hover-lift motion-press inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/12 px-4 py-2 text-sm font-semibold text-blue-200 transition-colors hover:bg-blue-500/20"
                  >
                    <Cog6ToothIcon className="h-4 w-4" />
                    Settings
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 px-6 py-4 sm:px-8">
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              Live runtime data
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              Secrets hidden by design
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              App theme aligned
            </div>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}
