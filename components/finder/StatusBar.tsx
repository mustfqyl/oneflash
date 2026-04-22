"use client";

import { useCloud } from "./CloudContext";

export default function StatusBar() {
  const { files, selection, searchQuery, folderNames, currentFolderId } = useCloud();

  const visibleCount = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  ).length;

  return (
    <div className="h-7 border-t border-zinc-700/50 bg-[#232325]/70 px-3 text-xs text-zinc-400 flex items-center justify-between">
      <span>{folderNames[currentFolderId] || "Home"} · {visibleCount} items</span>
      <span>{selection.length} selected</span>
    </div>
  );
}
