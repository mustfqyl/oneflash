"use client";

import { ReactNode } from "react";

interface FinderWindowProps {
  children: ReactNode;
}

export default function FinderWindow({ children }: FinderWindowProps) {
  return (
    <div className="motion-window relative flex h-screen w-full flex-col overflow-hidden bg-window p-2 font-sans text-foreground">
      <div className="pointer-events-none absolute inset-x-10 top-[-3rem] h-24 rounded-full bg-white/6 blur-3xl" />
      <div className="flex h-9 items-center justify-between rounded-t-xl border border-border border-b-0 bg-window-chrome px-4">
        <div className="w-14" />
        <p className="text-xs font-medium text-muted-foreground">oneflash.one</p>
        <div className="w-14" />
      </div>
      <div className="ring-ring-soft flex w-full flex-1 flex-col overflow-hidden rounded-b-xl border border-border bg-window-chrome shadow-2xl ring-1 backdrop-blur-3xl sm:flex-row">
        {children}
      </div>
    </div>
  );
}
