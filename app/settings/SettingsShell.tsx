"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CloudIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  UserCircleIcon,
  SwatchIcon,
} from "@heroicons/react/24/outline";

export default function SettingsShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    { id: "connections", name: "Cloud Connections", icon: CloudIcon, href: "/settings/connections" },
    { id: "appearance", name: "Appearance", icon: SwatchIcon, href: "/settings/appearance" },
    { id: "security", name: "Security & PIN", icon: ShieldCheckIcon, href: "/settings/security" },
    { id: "subdomain", name: "Domain", icon: GlobeAltIcon, href: "/settings/subdomain" },
    { id: "account", name: "Account", icon: UserCircleIcon, href: "/settings/account" },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background p-6 font-sans text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="motion-ambient absolute left-[-8rem] top-20 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="motion-ambient-slow absolute right-[-7rem] top-1/3 h-80 w-80 rounded-full bg-cyan-400/8 blur-3xl" />
      </div>
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 md:flex-row">
        <aside className="w-full flex-shrink-0 motion-enter md:w-64">
          <div className="mb-8">
            <Link href="/files" className="motion-nav-item flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              ← Back to Files
            </Link>
            <h1 className="text-3xl font-bold mt-4">Settings</h1>
          </div>

          <nav className="space-y-1">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`motion-nav-item flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors ${
                    isActive
                      ? "bg-blue-500/10 text-blue-500"
                      : "text-muted-foreground hover:bg-hover hover:text-foreground"
                  }`}
                >
                  <tab.icon className={`h-5 w-5 ${isActive ? "text-blue-500" : "text-muted"}`} />
                  {tab.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-h-[600px] flex-1 rounded-2xl border border-border-strong bg-surface p-8 shadow-[0_24px_60px_rgba(15,23,42,0.12)] motion-enter motion-enter-delay-2">
          {children}
        </main>
      </div>
    </div>
  );
}
