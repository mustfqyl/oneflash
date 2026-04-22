"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  CloudIcon, 
  ShieldCheckIcon, 
  GlobeAltIcon, 
  UserCircleIcon 
} from "@heroicons/react/24/outline";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    { id: "connections", name: "Cloud Connections", icon: CloudIcon, href: "/settings/connections" },
    { id: "security", name: "Security & PIN", icon: ShieldCheckIcon, href: "/settings/security" },
    { id: "subdomain", name: "Domain", icon: GlobeAltIcon, href: "/settings/subdomain" },
    { id: "account", name: "Account", icon: UserCircleIcon, href: "/settings/account" },
  ];

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="mb-8">
            <Link href="/files" className="text-zinc-400 hover:text-white transition-colors text-sm font-medium flex items-center gap-2">
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
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                    isActive
                      ? "bg-blue-500/10 text-blue-500"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  <tab.icon className={`w-5 h-5 ${isActive ? "text-blue-500" : "text-zinc-500"}`} />
                  {tab.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 bg-[#111] border border-zinc-800 rounded-2xl p-8 min-h-[600px]">
          {children}
        </main>
      </div>
    </div>
  );
}
