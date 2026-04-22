"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  CloudIcon, 
  FolderIcon, 
  StarIcon, 
  Cog6ToothIcon, 
  ArrowRightOnRectangleIcon 
} from "@heroicons/react/24/outline";
import { useCloud } from "./CloudContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { provider, connectedProviders } = useCloud();

  const links = [
    connectedProviders.includes("google")
      ? { name: "Google Drive", id: "google", icon: CloudIcon, href: "/files?provider=google", color: "text-blue-400" }
      : null,
    connectedProviders.includes("onedrive")
      ? { name: "OneDrive", id: "onedrive", icon: CloudIcon, href: "/files?provider=onedrive", color: "text-blue-500" }
      : null,
  ].filter(Boolean) as { name: string; id: string; icon: typeof CloudIcon; href: string; color: string }[];

  return (
    <aside className="flex h-full w-full flex-col border-r border-zinc-700/60 bg-[#2a2a2d]/90 pt-4 pb-4 sm:w-60">
      <div className="px-5 mb-8">
        <h2 className="text-xs font-bold text-zinc-500 tracking-wider uppercase mb-3">
          Favorites
        </h2>
        <div className="space-y-0.5">
          <Link href="/files" className={`flex items-center gap-3 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${pathname === '/files' && !provider ? 'bg-blue-500/80 text-white' : 'text-zinc-300 hover:bg-white/5'}`}>
            <FolderIcon className="w-4 h-4 text-blue-400" />
            All Files
          </Link>
          <Link href="/favorites" className={`flex items-center gap-3 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${pathname === '/favorites' ? 'bg-blue-500 text-white' : 'text-zinc-300 hover:bg-white/5'}`}>
            <StarIcon className="w-4 h-4 text-yellow-400" />
            Favorites
          </Link>
        </div>
      </div>

      <div className="px-5 mb-6">
        <h2 className="text-xs font-bold text-zinc-500 tracking-wider uppercase mb-3">
          Locations
        </h2>
        <div className="space-y-0.5">
          {links.map((link) => (
            <Link 
              key={link.name} 
              href={link.href}
              className={`flex items-center gap-3 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${provider === link.id ? 'bg-white/10 text-white font-semibold' : 'text-zinc-300 hover:bg-white/5'}`}
            >
              <link.icon className={`w-4 h-4 ${link.color}`} />
              {link.name}
            </Link>
          ))}
          {links.length === 0 && (
            <p className="px-3 py-1.5 text-xs text-zinc-500">No connected platform</p>
          )}
        </div>
      </div>

      <div className="mt-auto px-5 pt-4">
        <div className="space-y-0.5 border-t border-zinc-700/60 pt-4">
          <Link href="/settings" className="flex items-center gap-3 px-3 py-1.5 rounded-md text-sm font-medium text-zinc-300 hover:bg-white/5 transition-colors">
            <Cog6ToothIcon className="w-4 h-4 text-zinc-400" />
            Settings
          </Link>
          <Link href="/api/auth/signout" className="flex items-center gap-3 px-3 py-1.5 rounded-md text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors">
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            Sign Out
          </Link>
        </div>
      </div>
    </aside>
  );
}
