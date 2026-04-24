"use client";

import { useCloud } from "./CloudContext";

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1
  );
  const size = value / 1024 ** exponent;
  return `${size >= 10 || exponent === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[exponent]}`;
}

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) {
    return "Estimating...";
  }

  if (seconds < 60) {
    return `${seconds}s left`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s left`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m left`;
}

function formatTransfer(uploadedBytes: number, totalBytes: number) {
  if (totalBytes <= 0) {
    return formatBytes(uploadedBytes);
  }

  return `${formatBytes(uploadedBytes)} / ${formatBytes(totalBytes)}`;
}

export default function StatusBar() {
  const {
    files,
    selection,
    searchQuery,
    folderNames,
    currentFolderId,
    uploadState,
    pauseUploads,
    resumeUploads,
    cancelUploads,
  } = useCloud();

  const visibleCount = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  ).length;

  return (
    <div className="flex h-7 items-center justify-between border-t border-border bg-window-chrome px-3 text-xs text-muted-foreground">
      <span>{folderNames[currentFolderId] || "Home"} · {visibleCount} items</span>
      {uploadState.active ? (
        <div className="flex min-w-0 items-center gap-3">
          <span className="max-w-[18ch] truncate text-[11px] text-muted-foreground-strong">
            Uploading {uploadState.fileCount} file{uploadState.fileCount === 1 ? "" : "s"}
            {uploadState.currentFileName ? ` · ${uploadState.currentFileName}` : ""}
          </span>
          <span className="shrink-0 tabular-nums">{uploadState.progress.toFixed(1)}%</span>
          <span className="shrink-0 tabular-nums">
            {formatTransfer(uploadState.uploadedBytes, uploadState.totalBytes)}
          </span>
          <span className="shrink-0 tabular-nums">
            {uploadState.speedBytesPerSecond > 0
              ? `${formatBytes(uploadState.speedBytesPerSecond)}/s`
              : "Preparing..."}
          </span>
          <span className="shrink-0 tabular-nums">{formatDuration(uploadState.remainingSeconds)}</span>
          {uploadState.status === "running" ? (
            <button
              className="rounded px-2 py-0.5 text-[11px] text-foreground transition-colors hover:bg-hover"
              onClick={pauseUploads}
              type="button"
            >
              Pause
            </button>
          ) : (
            <button
              className="rounded px-2 py-0.5 text-[11px] text-foreground transition-colors hover:bg-hover"
              onClick={resumeUploads}
              type="button"
            >
              Resume
            </button>
          )}
          <button
            className="rounded px-2 py-0.5 text-[11px] text-red-400 transition-colors hover:bg-red-500/10"
            onClick={cancelUploads}
            type="button"
          >
            Cancel
          </button>
        </div>
      ) : (
        <span>{selection.length} selected</span>
      )}
    </div>
  );
}
