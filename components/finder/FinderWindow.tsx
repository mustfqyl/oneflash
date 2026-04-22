"use client";

import { ReactNode } from "react";

interface FinderWindowProps {
  children: ReactNode;
}

export default function FinderWindow({ children }: FinderWindowProps) {
  return (
    <div className="flex h-screen w-full bg-[#1a1a1d] text-white p-2 font-sans flex-col">
      <div className="h-9 border border-zinc-700/60 border-b-0 rounded-t-xl bg-[#2f2f32] flex items-center justify-between px-4">
        <div className="w-14" />
        <p className="text-xs text-zinc-300 font-medium">oneflash.co</p>
        <div className="w-14" />
      </div>
      <div className="flex-1 w-full rounded-b-xl border border-zinc-700/60 flex overflow-hidden shadow-2xl bg-[#2b2b2f]/90 backdrop-blur-3xl ring-1 ring-white/10 flex-col sm:flex-row">
        {children}
      </div>
    </div>
  );
}
