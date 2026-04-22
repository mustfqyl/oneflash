"use client";

import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { DragEvent, KeyboardEvent } from "react";
import { useCloud } from "./CloudContext";

interface DragPayload {
  ids: string[];
  sourceFolderId: string;
  sourceProvider: "google" | "onedrive" | null;
}

export default function TabsBar() {
  const {
    tabs,
    activeTabId,
    activateTab,
    closeTab,
    openTab,
    provider,
    moveFilesToTab,
  } = useCloud();

  if (tabs.length < 2) {
    return null;
  }

  const handleDropOnTab = async (
    event: DragEvent<HTMLButtonElement>,
    targetTabId: string
  ) => {
    const raw = event.dataTransfer.getData("application/x-oneflash-files");
    if (!raw) return;
    event.preventDefault();
    try {
      const payload = JSON.parse(raw) as DragPayload;
      await moveFilesToTab(
        payload.ids,
        targetTabId,
        payload.sourceFolderId,
        payload.sourceProvider
      );
      activateTab(targetTabId);
    } catch {
      // Ignore malformed drag payloads.
    }
  };

  return (
    <div className="flex items-end border-b border-[#2e2e2e] bg-[#2d2d2d]">
      <div className="flex min-w-0 flex-1 items-end">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => activateTab(tab.id)}
              onDragOver={(e) => {
                if (Array.from(e.dataTransfer.types).includes("application/x-oneflash-files")) {
                  e.preventDefault();
                }
              }}
              onDrop={(e) => void handleDropOnTab(e, tab.id)}
              className={`group relative flex h-10 min-w-0 flex-1 items-center gap-2 border-r border-b-0 px-3 text-sm ${
                active
                  ? "border-[#4a4a4a] bg-[#1e1e1e] text-[#f0f0f0]"
                  : "border-[#3d3d3d] bg-[#252525] text-[#b9b9b9]"
              }`}
            >
              {tabs.length > 1 && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      closeTab(tab.id);
                    }
                  }}
                  className="rounded p-0.5 text-[#8a8a8a] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#383838] hover:text-[#f0f0f0]"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </span>
              )}
              <span className="truncate flex-1 text-center font-medium">
                {tab.title}
              </span>
              <span className="w-4 shrink-0" />
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => openTab("root", provider)}
        className="flex h-10 w-10 items-center justify-center border-l border-[#3d3d3d] text-[#c8c8c8] transition-colors hover:bg-[#383838] hover:text-[#f0f0f0]"
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
