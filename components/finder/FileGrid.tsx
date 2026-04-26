"use client";
/* eslint-disable @next/next/no-img-element -- Finder previews rely on blob, data, and provider-hosted URLs that do not map cleanly to next/image. */

import { strFromU8, unzipSync } from "fflate";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import {
  useCallback,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowPathIcon,
  DocumentIcon,
  FolderIcon,
  PlayIcon,
  StarIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import CloudActionTargetDialog, {
  buildCloudActionTargetOptions,
} from "./CloudActionTargetDialog";
import { type CloudActionTarget, type CloudFile, useCloud } from "./CloudContext";
import FileTypeIcon from "./FileTypeIcon";
import {
  CLOUD_PREVIEW_SW_READY_EVENT,
  isOffloadedPreviewUrl,
  requiresCloudPreviewServiceWorker,
} from "@/lib/cloud-preview";

interface ContextMenuState {
  x: number;
  y: number;
  fileId: string | null;
}

interface SelectionBoxState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

type NavigationDirection = "left" | "right" | "up" | "down";

interface TablePreview {
  kind: "table";
  headers: string[];
  rows: string[][];
}

interface TextPreview {
  kind: "text";
  text: string;
  language: "plain" | "json" | "markdown" | "xml" | "code";
}

interface HtmlPreview {
  kind: "html";
  html: string;
}

interface ArchivePreview {
  kind: "archive";
  entries: string[];
}

type RichPreview = TablePreview | TextPreview | HtmlPreview | ArchivePreview;

interface ExternalUploadItem {
  file: File;
  relativePath?: string;
}

interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath?: string;
}

interface FileSystemFileEntryLike extends FileSystemEntryLike {
  file: (
    successCallback: (file: File) => void,
    errorCallback?: (error: DOMException) => void
  ) => void;
}

interface FileSystemDirectoryReaderLike {
  readEntries: (
    successCallback: (entries: FileSystemEntryLike[]) => void,
    errorCallback?: (error: DOMException) => void
  ) => void;
}

interface FileSystemDirectoryEntryLike extends FileSystemEntryLike {
  createReader: () => FileSystemDirectoryReaderLike;
}

type DragDataItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntryLike | null;
};

const SIZE_STYLES = {
  compact: {
    grid: {
      tight: "grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-9",
      normal: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-8",
      airy: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7",
    },
    gridIconBox: "h-14 w-14",
    gridPreviewBox: "h-12 w-12 rounded-md",
    gridFolderIcon: "h-14 w-14",
    gridDocumentIcon: "h-12 w-14",
    gridFileIcon: "h-9 w-9",
    gridLabel: "text-[11px]",
    listIconBox: "h-7 w-7",
    listPreviewBox: "h-7 w-7 rounded",
    listFolderIcon: "h-7 w-7",
    listDocumentIcon: "h-6 w-7",
    listFileIcon: "h-5 w-5",
    favoriteGrid: "h-4 w-4 -bottom-0.5 -right-0.5",
    favoriteGridIcon: "h-2.5 w-2.5",
    favoriteList: "h-3 w-3 -bottom-0.5 -right-0.5",
    favoriteListIcon: "h-2 w-2",
  },
  comfortable: {
    grid: {
      tight: "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7",
      normal: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6",
      airy: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5",
    },
    gridIconBox: "h-16 w-16",
    gridPreviewBox: "h-14 w-14 rounded-md",
    gridFolderIcon: "h-16 w-16",
    gridDocumentIcon: "h-14 w-16",
    gridFileIcon: "h-10 w-10",
    gridLabel: "text-xs",
    listIconBox: "h-8 w-8",
    listPreviewBox: "h-8 w-8 rounded",
    listFolderIcon: "h-8 w-8",
    listDocumentIcon: "h-7 w-8",
    listFileIcon: "h-6 w-6",
    favoriteGrid: "h-5 w-5 -bottom-0.5 -right-0.5",
    favoriteGridIcon: "h-3 w-3",
    favoriteList: "h-3.5 w-3.5 -bottom-1 -right-1",
    favoriteListIcon: "h-2.5 w-2.5",
  },
  large: {
    grid: {
      tight: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
      normal: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
      airy: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    },
    gridIconBox: "h-20 w-20",
    gridPreviewBox: "h-[4.5rem] w-[4.5rem] rounded-lg",
    gridFolderIcon: "h-20 w-20",
    gridDocumentIcon: "h-[4.5rem] w-[4rem]",
    gridFileIcon: "h-11 w-11",
    gridLabel: "text-sm",
    listIconBox: "h-9 w-9",
    listPreviewBox: "h-9 w-9 rounded-md",
    listFolderIcon: "h-9 w-9",
    listDocumentIcon: "h-8 w-9",
    listFileIcon: "h-7 w-7",
    favoriteGrid: "h-5 w-5 -bottom-0.5 -right-0.5",
    favoriteGridIcon: "h-3 w-3",
    favoriteList: "h-4 w-4 -bottom-1 -right-1",
    favoriteListIcon: "h-2.5 w-2.5",
  },
} as const;

const DENSITY_STYLES = {
  tight: {
    gridGap: "gap-x-2 gap-y-2.5",
    listGap: "gap-0.5",
    gridItem: "gap-1.5 rounded-lg px-1.5 py-1.5",
    listItem: "gap-1.5 rounded-md px-1.5 py-1",
    rootPadding: "p-3",
  },
  normal: {
    gridGap: "gap-x-3.5 gap-y-4",
    listGap: "gap-1",
    gridItem: "gap-2 rounded-xl px-2 py-2.5",
    listItem: "gap-2 rounded-lg px-2 py-1.5",
    rootPadding: "p-4",
  },
  airy: {
    gridGap: "gap-x-5 gap-y-5.5",
    listGap: "gap-1.5",
    gridItem: "gap-2.5 rounded-2xl px-3 py-3",
    listItem: "gap-2.5 rounded-xl px-2.5 py-2",
    rootPadding: "p-5",
  },
} as const;

const BACKGROUND_CACHE_CONCURRENCY = 4;
const BACKGROUND_CACHE_DELAY_MS = 900;
const BACKGROUND_CACHE_MAX_FILE_BYTES = 100 * 1024 * 1024;
const BACKGROUND_CACHE_TOTAL_BYTES = 300 * 1024 * 1024;
const ON_DEMAND_PREVIEW_CACHE_MAX_FILE_BYTES = 100 * 1024 * 1024;
const TARGETED_VIDEO_WARM_DELAY_MS = 140;
const VIDEO_THUMBNAIL_SEEK_SECONDS = 0.35;
const VIDEO_THUMBNAIL_REVEAL_TIMEOUT_MS = 320;
const TEXT_PREVIEW_MAX_BYTES = 2 * 1024 * 1024;
const ZIP_PREVIEW_MAX_BYTES = 12 * 1024 * 1024;
const ENABLE_BACKGROUND_PREVIEW_WARMING = false;

const TEXT_FILE_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "jsonl",
  "csv",
  "tsv",
  "log",
  "xml",
  "yml",
  "yaml",
  "toml",
  "ini",
  "conf",
  "env",
  "html",
  "htm",
  "css",
  "js",
  "jsx",
  "ts",
  "tsx",
  "mjs",
  "cjs",
  "py",
  "java",
  "go",
  "rs",
  "php",
  "rb",
  "sh",
  "bash",
  "zsh",
  "sql",
  "c",
  "cc",
  "cpp",
  "h",
  "hpp",
  "swift",
  "kt",
  "dart",
]);

function isPreviewableMimeType(mimeType: string) {
  return (
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("audio/") ||
    mimeType === "application/pdf"
  );
}

function getFileExtensionFromName(name: string) {
  const trimmed = name.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return "";
  }
  return trimmed.slice(lastDot + 1).toLowerCase();
}

function isTextualMimeType(mimeType: string, fileName: string) {
  if (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("xml") ||
    mimeType.includes("javascript") ||
    mimeType.includes("typescript") ||
    mimeType.includes("yaml")
  ) {
    return true;
  }

  return TEXT_FILE_EXTENSIONS.has(getFileExtensionFromName(fileName));
}

function isCsvLikeFile(mimeType: string, fileName: string) {
  const extension = getFileExtensionFromName(fileName);
  return (
    mimeType === "text/csv" ||
    mimeType === "text/tab-separated-values" ||
    extension === "csv" ||
    extension === "tsv"
  );
}

function isHtmlLikeFile(mimeType: string, fileName: string) {
  const extension = getFileExtensionFromName(fileName);
  return mimeType === "text/html" || extension === "html" || extension === "htm";
}

function isZipLikeFile(mimeType: string, fileName: string) {
  const extension = getFileExtensionFromName(fileName);
  return (
    mimeType === "application/zip" ||
    mimeType === "application/x-zip-compressed" ||
    extension === "zip" ||
    extension === "docx" ||
    extension === "xlsx" ||
    extension === "pptx"
  );
}

function stripXmlTags(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDocxPreview(entries: Record<string, Uint8Array>) {
  const documentXml = entries["word/document.xml"];
  if (!documentXml) {
    return null;
  }

  const text = strFromU8(documentXml)
    .split(/<\/w:p>/)
    .map(stripXmlTags)
    .filter(Boolean)
    .join("\n\n");

  return text || null;
}

function extractPptxPreview(entries: Record<string, Uint8Array>) {
  const slideNames = Object.keys(entries)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  if (slideNames.length === 0) {
    return null;
  }

  const slides = slideNames
    .map((slideName, index) => {
      const text = stripXmlTags(strFromU8(entries[slideName]!));
      return text ? `Slide ${index + 1}\n${text}` : `Slide ${index + 1}`;
    })
    .join("\n\n");

  return slides || null;
}

function decodeExcelColumn(column: string) {
  return column.split("").reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0);
}

function extractXlsxPreview(entries: Record<string, Uint8Array>) {
  const workbookXml = entries["xl/workbook.xml"];
  const firstSheetXml = entries["xl/worksheets/sheet1.xml"];
  if (!workbookXml || !firstSheetXml) {
    return null;
  }

  const workbookText = strFromU8(workbookXml);

  const sharedStringsXml = entries["xl/sharedStrings.xml"];
  const sharedStrings = sharedStringsXml
    ? Array.from(strFromU8(sharedStringsXml).matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map(
        (match) => stripXmlTags(match[1] || "")
      )
    : [];

  const rowMatches = Array.from(
    strFromU8(firstSheetXml).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)
  );
  const rows: string[][] = rowMatches.slice(0, 30).map((rowMatch) => {
    const cells = Array.from(
      rowMatch[1].matchAll(/<c[^>]*r="([A-Z]+)\d+"[^>]*?(?:t="([^"]+)")?[^>]*>([\s\S]*?)<\/c>/g)
    );
    const row: string[] = [];

    for (const [, columnLetters, type, cellBody] of cells) {
      const index = decodeExcelColumn(columnLetters) - 1;
      const rawValue =
        cellBody.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] ||
        cellBody.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ||
        "";
      const value =
        type === "s"
          ? sharedStrings[Number(rawValue)] || ""
          : stripXmlTags(rawValue);

      row[index] = value;
    }

    return row;
  });

  const headers = rows[0] || [];
  const bodyRows = rows.slice(1).filter((row) => row.some(Boolean));
  const sheetName =
    workbookText.match(/<sheet[^>]*name="([^"]+)"/)?.[1] || "Sheet 1";

  return {
    kind: "table" as const,
    headers: headers.length > 0 ? headers : [`${sheetName} Column 1`],
    rows: bodyRows.length > 0 ? bodyRows : rows,
  };
}

function parseDelimitedText(text: string, delimiter: string) {
  const rows = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(0, 100)
    .map((line) => line.split(delimiter).map((cell) => cell.trim()));

  if (rows.length === 0) {
    return null;
  }

  return {
    kind: "table" as const,
    headers: rows[0] || [],
    rows: rows.slice(1),
  };
}

async function buildRichPreview(file: CloudFile, blob: Blob): Promise<RichPreview | null> {
  const extension = getFileExtensionFromName(file.name);

  if (isCsvLikeFile(file.mimeType, file.name) && blob.size <= TEXT_PREVIEW_MAX_BYTES) {
    const text = await blob.text();
    return parseDelimitedText(text, extension === "tsv" ? "\t" : ",");
  }

  if (isHtmlLikeFile(file.mimeType, file.name) && blob.size <= TEXT_PREVIEW_MAX_BYTES) {
    return {
      kind: "html",
      html: await blob.text(),
    };
  }

  if (isTextualMimeType(file.mimeType, file.name) && blob.size <= TEXT_PREVIEW_MAX_BYTES) {
    const text = await blob.text();
    let normalizedText = text;
    let language: TextPreview["language"] = "plain";

    if (file.mimeType.includes("json") || extension === "json") {
      language = "json";
      try {
        normalizedText = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        normalizedText = text;
      }
    } else if (extension === "md" || extension === "markdown") {
      language = "markdown";
    } else if (file.mimeType.includes("xml") || extension === "xml") {
      language = "xml";
    } else if (extension && extension !== "txt") {
      language = "code";
    }

    return {
      kind: "text",
      text: normalizedText,
      language,
    };
  }

  if (isZipLikeFile(file.mimeType, file.name) && blob.size <= ZIP_PREVIEW_MAX_BYTES) {
    const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()));

    if (extension === "docx") {
      const text = extractDocxPreview(entries);
      if (text) {
        return { kind: "text", text, language: "plain" };
      }
    }

    if (extension === "pptx") {
      const text = extractPptxPreview(entries);
      if (text) {
        return { kind: "text", text, language: "plain" };
      }
    }

    if (extension === "xlsx") {
      const tablePreview = extractXlsxPreview(entries);
      if (tablePreview) {
        return tablePreview;
      }
    }

    return {
      kind: "archive",
      entries: Object.keys(entries).sort().slice(0, 200),
    };
  }

  return null;
}

function getPreviewWarmPriority(mimeType: string) {
  if (mimeType.startsWith("video/")) return 0;
  if (mimeType.startsWith("audio/")) return 1;
  if (mimeType === "application/pdf") return 2;
  if (mimeType.startsWith("image/")) return 3;
  return 4;
}

function getNameParts(file: CloudFile) {
  if (file.isFolder) {
    return { main: file.name, extension: "" };
  }

  const lastDot = file.name.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === file.name.length - 1) {
    return { main: file.name, extension: "" };
  }

  return {
    main: file.name.slice(0, lastDot),
    extension: file.name.slice(lastDot + 1),
  };
}

function getSelectionBounds(box: SelectionBoxState) {
  return {
    left: Math.min(box.startX, box.currentX),
    top: Math.min(box.startY, box.currentY),
    width: Math.abs(box.currentX - box.startX),
    height: Math.abs(box.currentY - box.startY),
  };
}

function isInteractiveKeyboardTarget(
  target: EventTarget | null,
  currentTarget: HTMLElement | null
) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (currentTarget && target === currentTarget) {
    return false;
  }

  if (target.isContentEditable || target.closest("[contenteditable='true']")) {
    return true;
  }

  return Boolean(
    target.closest("input, textarea, select, button, a, [role='button'], [role='dialog']")
  );
}

function getKeyboardItemId(fileId: string) {
  return `finder-item-${fileId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function normalizeDroppedRelativePath(path?: string) {
  return (path || "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

function readDroppedFile(entry: FileSystemFileEntryLike) {
  return new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

async function readAllDirectoryEntries(entry: FileSystemDirectoryEntryLike) {
  const reader = entry.createReader();
  const entries: FileSystemEntryLike[] = [];

  while (true) {
    const batch = await new Promise<FileSystemEntryLike[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });

    if (batch.length === 0) {
      return entries;
    }

    entries.push(...batch);
  }
}

async function collectDroppedEntryItems(
  entry: FileSystemEntryLike,
  parentSegments: string[] = []
): Promise<ExternalUploadItem[]> {
  if (entry.isFile) {
    const file = await readDroppedFile(entry as FileSystemFileEntryLike);
    const relativePath = normalizeDroppedRelativePath(
      [...parentSegments, file.name].join("/")
    );
    return [{ file, relativePath }];
  }

  if (!entry.isDirectory) {
    return [];
  }

  const childEntries = await readAllDirectoryEntries(entry as FileSystemDirectoryEntryLike);
  const nestedItems = await Promise.all(
    childEntries.map((childEntry) =>
      collectDroppedEntryItems(childEntry, [...parentSegments, entry.name])
    )
  );
  return nestedItems.flat();
}

async function collectExternalUploadItems(dataTransfer: DataTransfer) {
  const entryItems = await Promise.all(
    Array.from(dataTransfer.items || []).map(async (item) => {
      const maybeEntry = (item as DragDataItemWithEntry).webkitGetAsEntry?.();
      if (!maybeEntry) {
        const file = item.getAsFile();
        if (!file) {
          return [];
        }
        return [{ file }];
      }
      return collectDroppedEntryItems(maybeEntry);
    })
  );

  const flattened = entryItems.flat().filter((item) => item.file.size >= 0);
  if (flattened.length > 0) {
    return flattened;
  }

  return Array.from(dataTransfer.files || []).map((file) => ({
    file,
    relativePath: normalizeDroppedRelativePath(
      (file as File & { webkitRelativePath?: string }).webkitRelativePath
    ),
  }));
}

function formatInfoSize(size?: string) {
  const value = Number(size);
  if (!Number.isFinite(value) || value < 0) {
    return "-";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(Math.max(value, 1)) / Math.log(1024)),
    units.length - 1
  );
  const normalized = value / 1024 ** exponent;
  const precision = normalized >= 10 || exponent === 0 ? 0 : 1;
  return `${normalized.toFixed(precision)} ${units[exponent]}`;
}

function ImageThumbnail({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = Boolean(src && failedSrc === src);

  if (failed || !src) {
    return <DocumentIcon className={className} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      decoding="async"
      loading="lazy"
      onError={() => setFailedSrc(src)}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
    />
  );
}

function VideoThumbnail({
  src,
  className,
  iconClassName,
}: {
  src: string | null;
  className: string;
  iconClassName: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const seekPendingRef = useRef(false);
  const failed = Boolean(src && failedSrc === src);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const revealFrame = useCallback(() => {
    seekPendingRef.current = false;
    clearRevealTimer();
    setFrameReady(true);
  }, [clearRevealTimer]);

  useEffect(() => () => clearRevealTimer(), [clearRevealTimer]);

  useEffect(() => {
    if (shouldLoad || !src || typeof IntersectionObserver === "undefined") {
      return;
    }

    const node = containerRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldLoad, src]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const targetTime =
      duration > VIDEO_THUMBNAIL_SEEK_SECONDS
        ? Math.min(VIDEO_THUMBNAIL_SEEK_SECONDS, Math.max(duration * 0.12, 0.1))
        : 0;

    if (targetTime <= 0) {
      revealFrame();
      return;
    }

    try {
      if (Math.abs(video.currentTime - targetTime) < 0.01) {
        revealFrame();
        return;
      }
      seekPendingRef.current = true;
      video.currentTime = targetTime;
      clearRevealTimer();
      revealTimerRef.current = window.setTimeout(() => {
        revealTimerRef.current = null;
        revealFrame();
      }, VIDEO_THUMBNAIL_REVEAL_TIMEOUT_MS);
    } catch {
      revealFrame();
    }
  }, [clearRevealTimer, revealFrame]);

  const handleSeeked = useCallback(() => {
    revealFrame();
  }, [revealFrame]);

  const handleLoadedData = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      revealFrame();
      return;
    }

    if (!seekPendingRef.current || video.currentTime > 0.01) {
      revealFrame();
    }
  }, [revealFrame]);

  const handleCanPlay = useCallback(() => {
    if (!seekPendingRef.current) {
      revealFrame();
    }
  }, [revealFrame]);

  const handleError = useCallback(() => {
    seekPendingRef.current = false;
    clearRevealTimer();
    setFailedSrc(src);
  }, [clearRevealTimer, src]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-surface-elevated"
      data-media-thumbnail="video"
    >
      {(shouldLoad || typeof IntersectionObserver === "undefined") &&
      src &&
      !failed ? (
        <>
          <video
            ref={videoRef}
            aria-hidden="true"
            className={`${className} pointer-events-none transition-opacity duration-150 ${
              frameReady ? "opacity-100" : "opacity-0"
            }`}
            disablePictureInPicture
            muted
            onCanPlay={handleCanPlay}
            onError={handleError}
            onLoadedData={handleLoadedData}
            onLoadedMetadata={handleLoadedMetadata}
            onSeeked={handleSeeked}
            playsInline
            preload="metadata"
            src={src}
            crossOrigin="anonymous"
          />
          {!frameReady ? (
            <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900/70 via-slate-800/70 to-slate-950/80 text-white/75">
              <PlayIcon className={iconClassName} />
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900/70 via-slate-800/70 to-slate-950/80 text-white/75">
          <PlayIcon className={iconClassName} />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-white/10" />
      <div className="pointer-events-none absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white shadow-md">
        <PlayIcon className="h-2.5 w-2.5" />
      </div>
    </div>
  );
}

function VideoPreviewPlayer({
  primarySrc,
  fallbackSrc,
  className,
}: {
  primarySrc: string | null;
  fallbackSrc: string | null;
  className: string;
}) {
  const [activeSrc, setActiveSrc] = useState<string | null>(
    primarySrc || fallbackSrc
  );

  const handleError = useCallback(() => {
    setActiveSrc((current) => {
      if (!fallbackSrc || current === fallbackSrc) {
        return current;
      }
      return fallbackSrc;
    });
  }, [fallbackSrc]);

  if (!activeSrc) {
    return null;
  }

  return (
    <video
      key={activeSrc}
      src={activeSrc}
      controls
      autoPlay
      playsInline
      preload="auto"
      onError={handleError}
      className={className}
    />
  );
}

function AudioPreviewPlayer({
  primarySrc,
  fallbackSrc,
  className,
}: {
  primarySrc: string | null;
  fallbackSrc: string | null;
  className: string;
}) {
  const [activeSrc, setActiveSrc] = useState<string | null>(
    primarySrc || fallbackSrc
  );

  const handleError = useCallback(() => {
    setActiveSrc((current) => {
      if (!fallbackSrc || current === fallbackSrc) {
        return current;
      }
      return fallbackSrc;
    });
  }, [fallbackSrc]);

  if (!activeSrc) {
    return null;
  }

  return (
    <audio
      key={activeSrc}
      src={activeSrc}
      controls
      autoPlay
      preload="auto"
      onError={handleError}
      className={className}
    />
  );
}

export default function FileGrid() {
  const shouldReduceMotion = useReducedMotion();
  const pathname = usePathname();
  const {
    currentLocationProvider,
    currentLocationAccountId,
    files,
    loading,
    error,
    selection,
    setSelection,
    navigateToFolder,
    clearSelection,
    searchQuery,
    viewMode,
    itemScale,
    itemDensity,
    renameFile,
    duplicateFile,
    deleteSelected,
    deleteFiles,
    createFolder,
    uploadFiles,
    copySelection,
    pasteIntoCurrentFolder,
    hasClipboard,
    previewFile,
    showPreview,
    infoFile,
    showInfo,
    openInNewTab,
    selectedFiles,
    connectedProviders,
    connectedAccountsByProvider,
    currentFolderId,
    isFavorite,
    navigateBack,
    navigateForward,
    setViewMode,
    activeTabId,
    sortBy,
    sortDirection,
  } = useCloud();
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [renameDialog, setRenameDialog] = useState<{ open: boolean; fileId: string; name: string } | null>(null);
  const [renameSubmitting, setRenameSubmitting] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [targetDialogAction, setTargetDialogAction] = useState<"folder" | "file" | "upload" | null>(null);
  const [pendingFolderTarget, setPendingFolderTarget] = useState<CloudActionTarget | null>(null);
  const [pendingFileTarget, setPendingFileTarget] = useState<CloudActionTarget | null>(null);
  const [pendingUploadTarget, setPendingUploadTarget] = useState<CloudActionTarget | null>(null);
  const [pendingDroppedItems, setPendingDroppedItems] = useState<ExternalUploadItem[] | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[] | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [selectionBox, setSelectionBox] = useState<SelectionBoxState | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [cachedPreviewUrls, setCachedPreviewUrls] = useState<Record<string, string>>({});
  const [cloudPreviewTransportReady, setCloudPreviewTransportReady] = useState(false);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  const [richPreview, setRichPreview] = useState<RichPreview | null>(null);
  const [richPreviewLoading, setRichPreviewLoading] = useState(false);
  const [richPreviewError, setRichPreviewError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragDepthRef = useRef(0);
  const dragSelectionBaseRef = useRef<string[]>([]);
  const dragSelectionAdditiveRef = useRef(false);
  const dragSelectionMovedRef = useRef(false);
  const selectionAnchorIdRef = useRef<string | null>(null);
  const suppressClearClickRef = useRef(false);
  const cachedPreviewUrlsRef = useRef<Record<string, string>>({});
  const previewWarmAbortRef = useRef<AbortController | null>(null);
  const onDemandPreviewCacheAbortRef = useRef<AbortController | null>(null);
  const targetedVideoWarmRef = useRef<{ key: string | null; element: HTMLVideoElement | null }>({
    key: null,
    element: null,
  });
  const targetedVideoWarmTimerRef = useRef<number | null>(null);
  const showInitialLoading = loading && files.length === 0;
  const showBackgroundRefreshing = loading && files.length > 0;
  const favoritesView = pathname === "/favorites";
  const sizeStyles = SIZE_STYLES[itemScale];
  const densityStyles = DENSITY_STYLES[itemDensity];
  const gridColumns = sizeStyles.grid[itemDensity];
  const actionTargetOptions = buildCloudActionTargetOptions({
    currentLocationProvider,
    connectedProviders,
    connectedAccountsByProvider,
  });
  const implicitUploadTarget =
    !currentLocationAccountId && actionTargetOptions.length === 1
      ? actionTargetOptions[0]
      : null;
  const canStartCloudWriteAction =
    Boolean(currentLocationAccountId) || actionTargetOptions.length > 0;
  const canAcceptExternalUpload = canStartCloudWriteAction;
  const focusGrid = () => {
    gridRef.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const currentWindow = window as Window & {
      __oneflashCloudPreviewWorkerReady__?: boolean;
    };
    const syncReadyState = () => {
      setCloudPreviewTransportReady(
        Boolean(currentWindow.__oneflashCloudPreviewWorkerReady__)
      );
    };

    syncReadyState();
    window.addEventListener(CLOUD_PREVIEW_SW_READY_EVENT, syncReadyState);
    return () => {
      window.removeEventListener(CLOUD_PREVIEW_SW_READY_EVENT, syncReadyState);
    };
  }, []);
  const dialogButtonBaseClass =
    "inline-flex min-w-[96px] items-center justify-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 active:scale-[0.98] disabled:cursor-not-allowed";
  const dialogSecondaryButtonClass = `${dialogButtonBaseClass} bg-surface-elevated text-foreground hover:bg-hover disabled:opacity-50`;
  const dialogPrimaryButtonClass = `${dialogButtonBaseClass} bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-80`;
  const dialogDangerButtonClass = `${dialogButtonBaseClass} bg-red-600 text-white hover:bg-red-500 disabled:opacity-80`;
  const modalOverlayClass =
    "fixed inset-0 z-[80] flex items-center justify-center bg-overlay px-4 backdrop-blur-sm";
  const modalOverlayStrongClass =
    "fixed inset-0 z-[80] flex items-center justify-center bg-overlay-strong backdrop-blur-sm";
  const pendingFolderTargetLabel =
    pendingFolderTarget &&
    actionTargetOptions.find(
      (option) =>
        option.provider === pendingFolderTarget.provider &&
        option.accountId === pendingFolderTarget.accountId
    );
  const pendingFileTargetLabel =
    pendingFileTarget &&
    actionTargetOptions.find(
      (option) =>
        option.provider === pendingFileTarget.provider &&
        option.accountId === pendingFileTarget.accountId
    );

  const isExternalFileDrag = (event: DragEvent | ReactDragEvent) =>
    Array.from(event.dataTransfer?.types || []).includes("Files");

  const startFolderFlow = () => {
    setMenu(null);

    if (currentLocationAccountId) {
      setPendingFolderTarget(null);
      setFolderDialogOpen(true);
      return;
    }

    if (actionTargetOptions.length === 1) {
      setPendingFolderTarget(actionTargetOptions[0]);
      setFolderDialogOpen(true);
      return;
    }

    if (actionTargetOptions.length > 1) {
      setTargetDialogAction("folder");
    }
  };

  const startFileFlow = () => {
    setMenu(null);

    if (currentLocationAccountId) {
      setPendingFileTarget(null);
      setFileDialogOpen(true);
      return;
    }

    if (actionTargetOptions.length === 1) {
      setPendingFileTarget(actionTargetOptions[0]);
      setFileDialogOpen(true);
      return;
    }

    if (actionTargetOptions.length > 1) {
      setTargetDialogAction("file");
    }
  };

  const startUploadFlow = () => {
    setMenu(null);
    setPendingDroppedItems(null);

    if (currentLocationAccountId) {
      setPendingUploadTarget(null);
      uploadInputRef.current?.click();
      return;
    }

    if (actionTargetOptions.length === 1) {
      setPendingUploadTarget(actionTargetOptions[0]);
      uploadInputRef.current?.click();
      return;
    }

    if (actionTargetOptions.length > 1) {
      setTargetDialogAction("upload");
    }
  };

  const handleDroppedUpload = async (items: ExternalUploadItem[]) => {
    if (items.length === 0) {
      return;
    }

    if (currentLocationAccountId || implicitUploadTarget) {
      await uploadFiles(items, implicitUploadTarget || undefined);
      return;
    }

    setPendingDroppedItems(items);
    setTargetDialogAction("upload");
  };

  const handleTargetSelect = useCallback(
    (target: CloudActionTarget) => {
      setTargetDialogAction(null);

      if (targetDialogAction === "folder") {
        setPendingFolderTarget(target);
        setFolderDialogOpen(true);
        return;
      }

      if (targetDialogAction === "file") {
        setPendingFileTarget(target);
        setFileDialogOpen(true);
        return;
      }

      if (pendingDroppedItems) {
        setPendingDroppedItems(null);
        void uploadFiles(pendingDroppedItems, target);
        return;
      }

      setPendingUploadTarget(target);
      uploadInputRef.current?.click();
    },
    [pendingDroppedItems, targetDialogAction, uploadFiles]
  );

  const providerForFile = useCallback(
    (fileProvider?: "google" | "onedrive" | null) =>
      fileProvider || currentLocationProvider,
    [currentLocationProvider]
  );

  const isOptimisticUploadId = (fileId: string) => fileId.startsWith("temp-upload-");

  const getPreviewCacheKey = useCallback(
    (fileId: string, fileProvider?: "google" | "onedrive" | null) => {
      const resolvedProvider = providerForFile(fileProvider);
      return resolvedProvider ? `${resolvedProvider}:${fileId}` : fileId;
    },
    [providerForFile]
  );

  const buildDownloadUrlForFile = useCallback(
    (
      fileId: string,
      fileProvider?: "google" | "onedrive" | null,
      fileName?: string,
      mimeType?: string,
      downloadUrl?: string | null,
      directUrl?: string | null
    ) =>
      !isOptimisticUploadId(fileId)
        ? downloadUrl ||
          directUrl ||
          (providerForFile(fileProvider)
            ? `${window.location.origin}/api/cloud/${providerForFile(fileProvider)}/open?fileId=${encodeURIComponent(fileId)}&download=1${fileName ? `&name=${encodeURIComponent(fileName)}` : ""}${mimeType ? `&mimeType=${encodeURIComponent(mimeType)}` : ""}`
            : null)
        : null,
    [providerForFile]
  );

  const buildFolderDownloadUrl = useCallback(
    (
      folderId: string,
      folderProvider?: "google" | "onedrive" | null,
      folderName?: string
    ) =>
      !isOptimisticUploadId(folderId) && providerForFile(folderProvider)
        ? `${window.location.origin}/api/cloud/${providerForFile(folderProvider)}/download-folder?folderId=${encodeURIComponent(folderId)}${folderName ? `&name=${encodeURIComponent(folderName)}` : ""}`
        : null,
    [providerForFile]
  );
  const buildAppPreviewUrl = useCallback(
    (
      fileId: string,
      fileProvider?: "google" | "onedrive" | null,
      accountId?: string | null,
      fileName?: string,
      mimeType?: string
    ) =>
      !isOptimisticUploadId(fileId) && providerForFile(fileProvider)
        ? `/api/cloud/${providerForFile(fileProvider)}/open?fileId=${encodeURIComponent(fileId)}${accountId ? `&accountId=${encodeURIComponent(accountId)}` : ""}${fileName ? `&name=${encodeURIComponent(fileName)}` : ""}${mimeType ? `&mimeType=${encodeURIComponent(mimeType)}` : ""}`
        : null,
    [providerForFile]
  );
  const shouldForceSameOriginMediaPreview = useCallback(
    (mimeType?: string | null) =>
      Boolean(
        mimeType &&
          (mimeType.startsWith("video/") || mimeType.startsWith("audio/"))
      ),
    []
  );
  const shouldForceSameOriginDocumentPreview = useCallback(
    (fileName?: string, mimeType?: string | null) => {
      const resolvedMimeType = mimeType || "";
      return (
        resolvedMimeType === "application/pdf" ||
        isCsvLikeFile(resolvedMimeType, fileName || "") ||
        isHtmlLikeFile(resolvedMimeType, fileName || "") ||
        isZipLikeFile(resolvedMimeType, fileName || "") ||
        isTextualMimeType(resolvedMimeType, fileName || "")
      );
    },
    []
  );

  const buildPreviewUrl = useCallback(
    (
      fileId: string,
      fileProvider?: "google" | "onedrive" | null,
      accountId?: string | null,
      fileName?: string,
      mimeType?: string,
      previewUrl?: string | null,
      directUrl?: string | null
    ) => {
      if (isOptimisticUploadId(fileId)) {
        return null;
      }

      const appPreviewUrl = buildAppPreviewUrl(
        fileId,
        fileProvider,
        accountId,
        fileName,
        mimeType
      );
      if (shouldForceSameOriginMediaPreview(mimeType)) {
        return appPreviewUrl;
      }
      if (shouldForceSameOriginDocumentPreview(fileName, mimeType)) {
        return appPreviewUrl;
      }

      return (
        (previewUrl &&
          (!requiresCloudPreviewServiceWorker(previewUrl) ||
            cloudPreviewTransportReady)
          ? previewUrl
          : null) ||
        directUrl ||
        appPreviewUrl
      );
    },
    [
      buildAppPreviewUrl,
      cloudPreviewTransportReady,
      shouldForceSameOriginDocumentPreview,
      shouldForceSameOriginMediaPreview,
    ]
  );
  const getPreviewMimeType = useCallback(
    (file: Pick<CloudFile, "mimeType" | "previewMimeType">) =>
      file.previewMimeType || file.mimeType,
    []
  );
  const getOffloadedPreviewUrl = useCallback(
    (
      file: Pick<
        CloudFile,
        "previewUrl" | "directUrl"
      >
    ) => {
      if (
        file.previewUrl &&
        (!requiresCloudPreviewServiceWorker(file.previewUrl) ||
          cloudPreviewTransportReady)
      ) {
        return file.previewUrl;
      }

      if (file.directUrl && isOffloadedPreviewUrl(file.directUrl)) {
        return file.directUrl;
      }

      return null;
    },
    [cloudPreviewTransportReady]
  );

  const isImageFile = (mimeType: string) => mimeType.startsWith("image/");
  const isVideoFile = (mimeType: string) => mimeType.startsWith("video/");
  const isAudioFile = (mimeType: string) => mimeType.startsWith("audio/");
  const isPdfFile = (mimeType: string) => mimeType === "application/pdf";
  const canWarmVideoWithoutProxy = useCallback(
    (
      file: Pick<
        CloudFile,
        "id" | "mimeType" | "previewMimeType" | "previewUrl" | "directUrl" | "provider" | "accountId"
      >
    ) =>
      isVideoFile(getPreviewMimeType(file)) &&
      Boolean(getOffloadedPreviewUrl(file)) &&
      Boolean(providerForFile(file.provider)),
    [getOffloadedPreviewUrl, getPreviewMimeType, providerForFile]
  );
  const getVideoPointerWarmUrl = useCallback(
    (
      file: Pick<
        CloudFile,
        "id" | "name" | "mimeType" | "previewMimeType" | "previewUrl" | "directUrl" | "provider" | "accountId"
      >
    ) => {
      if (
        !isVideoFile(getPreviewMimeType(file)) ||
        !providerForFile(file.provider)
      ) {
        return null;
      }

      return (
        getOffloadedPreviewUrl(file) ||
        buildAppPreviewUrl(
          file.id,
          file.provider,
          file.accountId,
          file.name,
          getPreviewMimeType(file)
        )
      );
    },
    [buildAppPreviewUrl, getOffloadedPreviewUrl, getPreviewMimeType, providerForFile]
  );
  const clearTargetedVideoWarmTimer = useCallback(() => {
    if (targetedVideoWarmTimerRef.current !== null) {
      window.clearTimeout(targetedVideoWarmTimerRef.current);
      targetedVideoWarmTimerRef.current = null;
    }
  }, []);
  const releaseTargetedVideoWarm = useCallback(
    (preserveKey?: string) => {
      clearTargetedVideoWarmTimer();

      const current = targetedVideoWarmRef.current;
      if (!current.element || (preserveKey && current.key === preserveKey)) {
        return;
      }

      current.element.removeAttribute("src");
      current.element.load();
      targetedVideoWarmRef.current = { key: null, element: null };
    },
    [clearTargetedVideoWarmTimer]
  );
  const warmVideoForPlayback = useCallback(
    (
      file: Pick<
        CloudFile,
        "id" | "name" | "mimeType" | "previewMimeType" | "previewUrl" | "directUrl" | "provider" | "accountId"
      >,
      options?: {
        allowProxyFallback?: boolean;
      }
    ) => {
      const warmUrl = options?.allowProxyFallback
        ? getVideoPointerWarmUrl(file)
        : getOffloadedPreviewUrl(file);
      const canWarm = options?.allowProxyFallback
        ? Boolean(warmUrl)
        : canWarmVideoWithoutProxy(file);
      if (!canWarm || !warmUrl) {
        releaseTargetedVideoWarm();
        return;
      }

      const cacheKey = getPreviewCacheKey(file.id, file.provider);
      if (targetedVideoWarmRef.current.key === cacheKey) {
        return;
      }

      releaseTargetedVideoWarm(cacheKey);

      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.disablePictureInPicture = true;
      video.src = warmUrl;
      video.load();

      targetedVideoWarmRef.current = { key: cacheKey, element: video };
    },
    [
      canWarmVideoWithoutProxy,
      getOffloadedPreviewUrl,
      getPreviewCacheKey,
      getVideoPointerWarmUrl,
      releaseTargetedVideoWarm,
    ]
  );
  const warmVideoOnPointerDown = useCallback(
    (
      file: Pick<
        CloudFile,
        "id" | "name" | "mimeType" | "previewMimeType" | "previewUrl" | "directUrl" | "provider" | "accountId"
      >
    ) => {
      warmVideoForPlayback(file, { allowProxyFallback: true });
    },
    [warmVideoForPlayback]
  );
  const scheduleVideoWarm = useCallback(
    (
      file: Pick<
        CloudFile,
        "id" | "name" | "mimeType" | "previewMimeType" | "previewUrl" | "directUrl" | "provider" | "accountId"
      >
    ) => {
      if (!canWarmVideoWithoutProxy(file)) {
        clearTargetedVideoWarmTimer();
        return;
      }

      const cacheKey = getPreviewCacheKey(file.id, file.provider);
      if (targetedVideoWarmRef.current.key === cacheKey) {
        return;
      }

      clearTargetedVideoWarmTimer();
      targetedVideoWarmTimerRef.current = window.setTimeout(() => {
        targetedVideoWarmTimerRef.current = null;
        warmVideoForPlayback(file);
      }, TARGETED_VIDEO_WARM_DELAY_MS);
    },
    [
      canWarmVideoWithoutProxy,
      clearTargetedVideoWarmTimer,
      getPreviewCacheKey,
      warmVideoForPlayback,
    ]
  );
  const resolvePreviewUrl = useCallback(
    (
      fileId: string,
      fileProvider?: "google" | "onedrive" | null,
      accountId?: string | null,
      fileName?: string,
      mimeType?: string,
      previewUrl?: string | null,
      directUrl?: string | null
    ) => {
      const cachedUrl = cachedPreviewUrls[getPreviewCacheKey(fileId, fileProvider)];
      return (
        cachedUrl ||
        buildPreviewUrl(
          fileId,
          fileProvider,
          accountId,
          fileName,
          mimeType,
          previewUrl,
          directUrl
        )
      );
    },
    [buildPreviewUrl, cachedPreviewUrls, getPreviewCacheKey]
  );
  const previewCacheKey = previewFile
    ? getPreviewCacheKey(previewFile.id, previewFile.provider)
    : null;
  const previewUrl = previewFile
    ? resolvePreviewUrl(
        previewFile.id,
        previewFile.provider,
        previewFile.accountId,
        previewFile.name,
        previewFile.mimeType,
        previewFile.previewUrl,
        previewFile.directUrl
      )
    : null;
  const previewMimeType = previewFile
    ? previewFile.previewMimeType || previewFile.mimeType
    : null;
  const previewIsCachedBlob = Boolean(previewUrl?.startsWith("blob:"));
  const previewPlaybackPrimaryUrl =
    previewFile && previewMimeType && !previewIsCachedBlob
      ? getOffloadedPreviewUrl({
          previewUrl: previewFile.previewUrl,
          directUrl: previewFile.directUrl,
        })
      : null;
  const previewDownloadUrl = previewFile
    ? buildDownloadUrlForFile(
        previewFile.id,
        previewFile.provider,
        previewFile.name,
        previewFile.mimeType,
        previewFile.downloadUrl,
        previewFile.directUrl
      )
    : null;
  const resolvedDocumentPreviewUrl =
    previewMimeType && isPdfFile(previewMimeType)
      ? previewUrl
      : previewUrl;

  useEffect(() => {
    let cancelled = false;
    let nextDocumentPreviewUrl: string | null = null;

    const loadRichPreview = async () => {
      setDocumentPreviewUrl(null);
      setRichPreview(null);
      setRichPreviewError(null);

      if (
        !previewFile ||
        !previewUrl ||
        !previewMimeType ||
        isImageFile(previewMimeType) ||
        isVideoFile(previewMimeType) ||
        isAudioFile(previewMimeType) ||
        isPdfFile(previewMimeType)
      ) {
        setRichPreviewLoading(false);
        return;
      }

      setRichPreviewLoading(true);

      try {
        const response = await fetch(previewUrl, { 
          cache: "force-cache",
          credentials: "same-origin"
        });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error("Access denied. Please check your connection.");
          }
          throw new Error("The file could not be loaded for preview.");
        }

        const blob = await response.blob();
        if (cancelled) {
          return;
        }

        if (isPdfFile(previewMimeType)) {
          // PDFs are now handled directly by the proxy URL in the iframe for better reliability
          return;
        }

        const nextPreview = await buildRichPreview(
          previewMimeType === previewFile.mimeType
            ? previewFile
            : {
                ...previewFile,
                mimeType: previewMimeType,
              },
          blob
        );

        if (cancelled) {
          return;
        }

        if (nextPreview) {
          setRichPreview(nextPreview);
        } else {
          setRichPreviewError("This file type cannot be previewed here yet.");
        }
      } catch (error) {
        if (!cancelled) {
          setRichPreviewError(
            error instanceof Error ? error.message : "Preview could not be loaded"
          );
        }
      } finally {
        if (!cancelled) {
          setRichPreviewLoading(false);
        }
      }
    };

    void loadRichPreview();

    return () => {
      cancelled = true;
      if (nextDocumentPreviewUrl) {
        URL.revokeObjectURL(nextDocumentPreviewUrl);
      }
    };
  }, [previewFile, previewMimeType, previewUrl]);

  const buildTabDragPayload = (fileId: string) =>
    JSON.stringify({
      ids:
        selection.includes(fileId) && selection.length > 0
          ? selection
          : [fileId],
      sourceFolderId: currentFolderId,
      sourceProvider: currentLocationProvider,
      sourceTabId: activeTabId,
    });

  const getRelativePoint = (clientX: number, clientY: number) => {
    const container = gridRef.current;
    if (!container) {
      return { x: 0, y: 0 };
    }

    const bounds = container.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(
          clientX - bounds.left + container.scrollLeft,
          container.scrollWidth
        )
      ),
      y: Math.max(
        0,
        Math.min(
          clientY - bounds.top + container.scrollTop,
          container.scrollHeight
        )
      ),
    };
  };

  const updateSelectionFromBox = (nextBox: SelectionBoxState) => {
    const container = gridRef.current;
    if (!container) return;

    const containerBounds = container.getBoundingClientRect();
    const selectionBounds = getSelectionBounds(nextBox);
    const nextSelection = filteredFiles
      .filter((file) => {
        const node = itemRefs.current[file.id];
        if (!node) return false;

        const fileBounds = node.getBoundingClientRect();
        const left = fileBounds.left - containerBounds.left + container.scrollLeft;
        const top = fileBounds.top - containerBounds.top + container.scrollTop;
        const right = left + fileBounds.width;
        const bottom = top + fileBounds.height;

        return !(
          right < selectionBounds.left ||
          left > selectionBounds.left + selectionBounds.width ||
          bottom < selectionBounds.top ||
          top > selectionBounds.top + selectionBounds.height
        );
      })
      .map((file) => file.id);

    setSelection(
      dragSelectionAdditiveRef.current
        ? Array.from(new Set([...dragSelectionBaseRef.current, ...nextSelection]))
        : nextSelection
    );
  };

  useEffect(() => {
    cachedPreviewUrlsRef.current = cachedPreviewUrls;
  }, [cachedPreviewUrls]);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (menuRef.current && event.target instanceof Node && !menuRef.current.contains(event.target)) {
        setMenu(null);
      }
    };
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    return () => {
      previewWarmAbortRef.current?.abort();
      onDemandPreviewCacheAbortRef.current?.abort();
      Object.values(cachedPreviewUrlsRef.current).forEach((objectUrl) => {
        URL.revokeObjectURL(objectUrl);
      });
      releaseTargetedVideoWarm();
    };
  }, [releaseTargetedVideoWarm]);

  useEffect(() => {
    onDemandPreviewCacheAbortRef.current?.abort();

    if (
      !previewFile ||
      !previewCacheKey ||
      !previewUrl ||
      !previewMimeType ||
      cachedPreviewUrlsRef.current[previewCacheKey] ||
      previewUrl.startsWith("blob:")
    ) {
      return;
    }

    const fileSize =
      typeof previewFile.size === "string" || typeof previewFile.size === "number"
        ? Number(previewFile.size)
        : NaN;
    if (
      Number.isFinite(fileSize) &&
      fileSize > ON_DEMAND_PREVIEW_CACHE_MAX_FILE_BYTES
    ) {
      return;
    }

    const controller = new AbortController();
    onDemandPreviewCacheAbortRef.current = controller;

    void (async () => {
      try {
        const response = await fetch(previewUrl, {
          cache: "force-cache",
          signal: controller.signal,
        });
        if (!response.ok) {
          return;
        }

        const blob = await response.blob();
        if (
          controller.signal.aborted ||
          blob.size === 0 ||
          blob.size > ON_DEMAND_PREVIEW_CACHE_MAX_FILE_BYTES
        ) {
          return;
        }

        const objectUrl = URL.createObjectURL(blob);
        setCachedPreviewUrls((prev) => {
          if (prev[previewCacheKey]) {
            URL.revokeObjectURL(objectUrl);
            return prev;
          }

          const next = {
            ...prev,
            [previewCacheKey]: objectUrl,
          };
          cachedPreviewUrlsRef.current = next;
          return next;
        });
      } catch {
        if (!controller.signal.aborted) {
          return;
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [previewCacheKey, previewFile, previewMimeType, previewUrl]);

  useEffect(() => {
    const selectedFile = selectedFiles[0];
    if (!selectedFile) {
      releaseTargetedVideoWarm();
      return;
    }

    if (canWarmVideoWithoutProxy(selectedFile)) {
      scheduleVideoWarm(selectedFile);
      return;
    }

    releaseTargetedVideoWarm();
  }, [
    canWarmVideoWithoutProxy,
    releaseTargetedVideoWarm,
    scheduleVideoWarm,
    selectedFiles,
  ]);

  useEffect(() => {
    previewWarmAbortRef.current?.abort();
    const previousUrls = Object.values(cachedPreviewUrlsRef.current);
    if (previousUrls.length > 0) {
      previousUrls.forEach((objectUrl) => {
        URL.revokeObjectURL(objectUrl);
      });
      cachedPreviewUrlsRef.current = {};
      setCachedPreviewUrls({});
    }

    if (!ENABLE_BACKGROUND_PREVIEW_WARMING || loading || error || files.length === 0) {
      return;
    }

    const candidates = files
      .filter((file) => {
        const previewUrlForFile = buildPreviewUrl(
          file.id,
          file.provider,
          file.accountId,
          file.name,
          file.mimeType,
          file.previewUrl,
          file.directUrl
        );
        const fileSize = file.size ? Number(file.size) : 0;
        return (
          !file.isFolder &&
          Boolean(previewUrlForFile) &&
          isPreviewableMimeType(file.mimeType) &&
          Number.isFinite(fileSize) &&
          fileSize > 0 &&
          fileSize <= BACKGROUND_CACHE_MAX_FILE_BYTES
        );
      })
      .sort((left, right) => {
        const priorityDiff =
          getPreviewWarmPriority(left.mimeType) - getPreviewWarmPriority(right.mimeType);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        return (Number(left.size) || 0) - (Number(right.size) || 0);
      });

    if (candidates.length === 0) {
      return;
    }

    const controller = new AbortController();
    previewWarmAbortRef.current = controller;

    const timer = window.setTimeout(() => {
      let nextIndex = 0;
      let cachedBytes = 0;

      const worker = async () => {
        while (!controller.signal.aborted) {
          const file = candidates[nextIndex];
          nextIndex += 1;
          if (!file) {
            return;
          }

          const previewUrlForFile = buildPreviewUrl(
            file.id,
            file.provider,
            file.accountId,
            file.name,
            file.mimeType,
            file.previewUrl,
            file.directUrl
          );
          const fileSize = Number(file.size) || 0;
          const cacheKey = getPreviewCacheKey(file.id, file.provider);

          if (
            !previewUrlForFile ||
            cachedPreviewUrlsRef.current[cacheKey] ||
            cachedBytes + fileSize > BACKGROUND_CACHE_TOTAL_BYTES
          ) {
            continue;
          }

          try {
            const response = await fetch(previewUrlForFile, {
              cache: "force-cache",
              signal: controller.signal,
            });
            if (!response.ok) {
              continue;
            }

            const blob = await response.blob();
            if (controller.signal.aborted || blob.size === 0) {
              return;
            }

            if (
              blob.size > BACKGROUND_CACHE_MAX_FILE_BYTES ||
              cachedBytes + blob.size > BACKGROUND_CACHE_TOTAL_BYTES
            ) {
              continue;
            }

            const objectUrl = URL.createObjectURL(blob);
            cachedBytes += blob.size;

            setCachedPreviewUrls((prev) => {
              if (prev[cacheKey]) {
                URL.revokeObjectURL(objectUrl);
                return prev;
              }
              const next = {
                ...prev,
                [cacheKey]: objectUrl,
              };
              cachedPreviewUrlsRef.current = next;
              return next;
            });
          } catch {
            if (controller.signal.aborted) {
              return;
            }
          }
        }
      };

      void Promise.all(
        Array.from(
          { length: Math.min(BACKGROUND_CACHE_CONCURRENCY, candidates.length) },
          () => worker()
        )
      );
    }, BACKGROUND_CACHE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    activeTabId,
    buildPreviewUrl,
    currentFolderId,
    currentLocationProvider,
    error,
    files,
    getPreviewCacheKey,
    loading,
  ]);

  const filteredFiles = files
    .filter((file) =>
      file.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    )
    .sort((a, b) => {
      // Folders always come first
      if (a.isFolder !== b.isFolder) {
        return a.isFolder ? -1 : 1;
      }

      const dir = sortDirection === "asc" ? 1 : -1;

      switch (sortBy) {
        case "name":
          return dir * a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
        case "dateModified": {
          const aTime = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0;
          const bTime = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0;
          const diff = aTime - bTime;
          return dir * (Number.isNaN(diff) ? 0 : diff);
        }
        case "size": {
          const aSize = a.size ? parseInt(a.size, 10) : 0;
          const bSize = b.size ? parseInt(b.size, 10) : 0;
          return dir * (aSize - bSize);
        }
        case "kind": {
          const getKind = (item: typeof a) => {
            if (item.isFolder) return "folder";
            const ext = item.name.includes(".") ? item.name.split(".").pop()?.toLowerCase() : "";
            return ext || item.mimeType || "unknown";
          };
          return dir * getKind(a).localeCompare(getKind(b), undefined, { sensitivity: "base" });
        }
        default:
          return dir * a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      }
    });

  const visibleFileIds = filteredFiles.map((file) => file.id);
  const visibleFileIdSet = new Set(visibleFileIds);
  const resolvedActiveFileId =
    activeFileId && visibleFileIdSet.has(activeFileId)
      ? activeFileId
      : [...selection]
          .reverse()
          .find((fileId) => visibleFileIdSet.has(fileId)) ||
        filteredFiles[0]?.id ||
        null;

  const scrollFileIntoView = (fileId: string) => {
    const node = itemRefs.current[fileId];
    if (typeof node?.scrollIntoView !== "function") {
      return;
    }

    node.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  };

  const getFallbackActiveFileId = () => {
    return resolvedActiveFileId;
  };

  const getFallbackActiveFile = () => {
    const fallbackId = getFallbackActiveFileId();
    return (
      filteredFiles.find((file) => file.id === fallbackId) || null
    );
  };

  const selectSingleFile = (fileId: string) => {
    selectionAnchorIdRef.current = fileId;
    setActiveFileId(fileId);
    setSelection([fileId]);
    scrollFileIntoView(fileId);
  };

  const selectFileRange = (targetId: string) => {
    const targetIndex = visibleFileIds.indexOf(targetId);
    if (targetIndex < 0) {
      return;
    }

    const anchorId =
      selectionAnchorIdRef.current && visibleFileIdSet.has(selectionAnchorIdRef.current)
        ? selectionAnchorIdRef.current
        : getFallbackActiveFileId() || targetId;
    const anchorIndex = visibleFileIds.indexOf(anchorId);
    const rangeStart = Math.min(anchorIndex, targetIndex);
    const rangeEnd = Math.max(anchorIndex, targetIndex);

    selectionAnchorIdRef.current = anchorId;
    setActiveFileId(targetId);
    setSelection(visibleFileIds.slice(rangeStart, rangeEnd + 1));
    scrollFileIntoView(targetId);
  };

  const getKeyboardActiveIndex = () => {
    const fallbackActiveId = getFallbackActiveFileId();
    return fallbackActiveId ? visibleFileIds.indexOf(fallbackActiveId) : -1;
  };

  const getKeyboardColumnCount = () => {
    if (viewMode !== "grid" || filteredFiles.length <= 1) {
      return 1;
    }

    const firstNode = itemRefs.current[filteredFiles[0]?.id || ""];
    if (!firstNode) {
      return 1;
    }

    const firstTop = firstNode.getBoundingClientRect().top;
    let columnCount = 0;

    for (const file of filteredFiles) {
      const node = itemRefs.current[file.id];
      if (!node) {
        break;
      }

      const top = node.getBoundingClientRect().top;
      if (Math.abs(top - firstTop) > 6) {
        break;
      }

      columnCount += 1;
    }

    return Math.max(columnCount, 1);
  };

  const moveActiveSelection = (
    direction: NavigationDirection,
    extendSelection = false
  ) => {
    if (filteredFiles.length === 0) {
      return;
    }

    const currentIndex = Math.max(getKeyboardActiveIndex(), 0);
    const step =
      direction === "up" || direction === "down"
        ? getKeyboardColumnCount()
        : 1;
    let nextIndex = currentIndex;

    if (direction === "left" || direction === "up") {
      nextIndex = Math.max(0, currentIndex - step);
    } else {
      nextIndex = Math.min(filteredFiles.length - 1, currentIndex + step);
    }

    const targetId = filteredFiles[nextIndex]?.id;
    if (!targetId) {
      return;
    }

    if (extendSelection) {
      selectFileRange(targetId);
    } else {
      selectSingleFile(targetId);
    }
  };

  const activateFile = (file: CloudFile) => {
    setMenu(null);

    if (file.isFolder && !favoritesView) {
      navigateToFolder(file.id, file.provider);
      clearSelection();
      selectionAnchorIdRef.current = null;
      return;
    }

    openInNewTab(file.id);
  };

  const handleGridKeyDown = async (
    event: ReactKeyboardEvent<HTMLDivElement>
  ) => {
    const meta = event.metaKey || event.ctrlKey;
    const keyboardUiOpen = Boolean(
      menu ||
        previewFile ||
        infoFile ||
        renameDialog?.open ||
        folderDialogOpen ||
        deleteDialogOpen ||
        targetDialogAction
    );

    if (event.key === "Escape") {
      if (menu) {
        event.preventDefault();
        setMenu(null);
        return;
      }

      if (previewFile) {
        event.preventDefault();
        showPreview(null);
        return;
      }

      if (infoFile) {
        event.preventDefault();
        showInfo(null);
        return;
      }

      if (renameDialog?.open || folderDialogOpen || deleteDialogOpen || targetDialogAction) {
        return;
      }

      if (selection.length > 0) {
        event.preventDefault();
        clearSelection();
      }
      return;
    }

    if (event.key === " " && previewFile) {
      event.preventDefault();
      showPreview(null);
      return;
    }

    if (isInteractiveKeyboardTarget(event.target, gridRef.current)) {
      return;
    }

    if (keyboardUiOpen) {
      return;
    }

    if (meta && event.key.toLowerCase() === "a") {
      event.preventDefault();
      if (visibleFileIds.length > 0) {
        const anchorId = getFallbackActiveFileId() || visibleFileIds[0];
        selectionAnchorIdRef.current = anchorId;
        setActiveFileId(anchorId);
        setSelection(visibleFileIds);
        scrollFileIntoView(anchorId);
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveActiveSelection("left", event.shiftKey);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveActiveSelection("right", event.shiftKey);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveSelection("up", event.shiftKey);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveSelection("down", event.shiftKey);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      const firstFileId = filteredFiles[0]?.id;
      if (firstFileId) {
        if (event.shiftKey) {
          selectFileRange(firstFileId);
        } else {
          selectSingleFile(firstFileId);
        }
      }
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      const lastFileId = filteredFiles[filteredFiles.length - 1]?.id;
      if (lastFileId) {
        if (event.shiftKey) {
          selectFileRange(lastFileId);
        } else {
          selectSingleFile(lastFileId);
        }
      }
      return;
    }

    if (event.key === "Enter") {
      const targetFile = getFallbackActiveFile();
      if (!targetFile) {
        return;
      }

      event.preventDefault();
      if (!selection.includes(targetFile.id)) {
        setSelection([targetFile.id]);
      }
      selectionAnchorIdRef.current = targetFile.id;
      setActiveFileId(targetFile.id);
      activateFile(targetFile);
      return;
    }

    if (event.key === "Delete" || (!meta && event.key === "Backspace")) {
      if (selection.length > 0) {
        event.preventDefault();
        setDeleteTargetIds(null);
        setDeleteDialogOpen(true);
      }
      return;
    }

    if (meta && event.key === "1") {
      event.preventDefault();
      setViewMode("grid");
    } else if (meta && event.key === "2") {
      event.preventDefault();
      setViewMode("list");
    } else if (meta && event.key === "[") {
      event.preventDefault();
      navigateBack();
    } else if (meta && event.key === "]") {
      event.preventDefault();
      navigateForward();
    } else if (meta && event.shiftKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      startFolderFlow();
    } else if (meta && event.key.toLowerCase() === "i") {
      event.preventDefault();
      const targetFile = getFallbackActiveFile();
      if (targetFile) {
        showInfo(targetFile);
      }
    } else if (event.key === " ") {
      const targetFile = getFallbackActiveFile();
      if (previewFile || targetFile) {
        event.preventDefault();
      }
      if (previewFile) {
        showPreview(null);
      } else if (targetFile) {
        openInNewTab(targetFile.id);
      }
    } else if (meta && event.key.toLowerCase() === "d") {
      event.preventDefault();
      const targets = selection.length > 0 ? selectedFiles : [];
      for (const item of targets) {
        await duplicateFile(item.id);
      }
    } else if (meta && event.key.toLowerCase() === "c") {
      event.preventDefault();
      copySelection();
    } else if (meta && event.key.toLowerCase() === "v") {
      event.preventDefault();
      await pasteIntoCurrentFolder();
    } else if (meta && event.key === "Backspace") {
      if (selection.length > 0) {
        event.preventDefault();
        setDeleteTargetIds(null);
        setDeleteDialogOpen(true);
      }
    }
  };

  if (showInitialLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center p-12 text-muted-foreground">
        <div className="animate-pulse flex flex-col items-center">
          <FolderIcon className="w-12 h-12 mb-4 opacity-50" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-1 items-center justify-center p-12 text-center text-muted-foreground">
        <div className="flex flex-col items-center justify-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <span className="text-red-500 text-xl font-bold">!</span>
          </div>
          <p className="text-red-400 font-medium mb-2">{error}</p>
          {!currentLocationProvider && <p className="text-sm">Select a provider-connected folder to manage files.</p>}
        </div>
      </div>
    );
  }

  if (filteredFiles.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 h-full">
        <div className="text-sm text-muted">
          {searchQuery
            ? "Search result is empty."
            : currentLocationProvider
              ? "This folder is empty."
              : connectedProviders.length === 0
                ? "Connect a storage provider to get started."
                : "No files found across connected providers."}
        </div>
      </div>
    );
  }

  const handleSelect = (id: string, isCtrl: boolean, isShift: boolean) => {
    focusGrid();

    if (isShift) {
      selectFileRange(id);
      return;
    }

    if (isCtrl) {
      selectionAnchorIdRef.current = id;
      setActiveFileId(id);
      setSelection(
        selection.includes(id)
          ? selection.filter((selectedId) => selectedId !== id)
          : [...selection, id]
      );
      scrollFileIntoView(id);
      return;
    }

    selectSingleFile(id);
  };

  const selectedOrTarget = (targetId: string | null) => {
    if (!targetId) return selectedFiles;
    return selectedFiles.some((f) => f.id === targetId)
      ? selectedFiles
      : files.filter((f) => f.id === targetId);
  };

  const handleRename = async (targetId: string | null) => {
    const item = selectedOrTarget(targetId)[0];
    if (!item) return;
    setRenameDialog({ open: true, fileId: item.id, name: item.name });
    setMenu(null);
  };

  const handleDuplicate = async (targetId: string | null) => {
    const targets = selectedOrTarget(targetId);
    for (const item of targets) {
      await duplicateFile(item.id);
    }
    setMenu(null);
  };

  const handleInfo = (targetId: string | null) => {
    const item = selectedOrTarget(targetId)[0];
    if (item) {
      showInfo(item);
    }
    setMenu(null);
  };

  const handleCanvasMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (!(event.target instanceof HTMLElement)) return;
    if (
      event.target.closest("[data-file-item='true']") ||
      event.target.closest("[data-ignore-drag-select='true']")
    ) {
      return;
    }

    const origin = getRelativePoint(event.clientX, event.clientY);
    const isAdditive = event.metaKey || event.ctrlKey;
    dragSelectionBaseRef.current = isAdditive ? selection : [];
    dragSelectionAdditiveRef.current = isAdditive;
    dragSelectionMovedRef.current = false;
    suppressClearClickRef.current = false;
    setMenu(null);
    setSelectionBox({
      startX: origin.x,
      startY: origin.y,
      currentX: origin.x,
      currentY: origin.y,
    });
    if (!isAdditive) {
      setSelection([]);
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextPoint = getRelativePoint(moveEvent.clientX, moveEvent.clientY);
      const nextBox = {
        startX: origin.x,
        startY: origin.y,
        currentX: nextPoint.x,
        currentY: nextPoint.y,
      };

      if (
        Math.abs(nextPoint.x - origin.x) > 3 ||
        Math.abs(nextPoint.y - origin.y) > 3
      ) {
        dragSelectionMovedRef.current = true;
      }

      setSelectionBox(nextBox);
      updateSelectionFromBox(nextBox);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      suppressClearClickRef.current = dragSelectionMovedRef.current;
      setSelectionBox(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const menuTarget = menu?.fileId ? selectedOrTarget(menu.fileId)[0] : null;
  const menuWidth = 224;
  const menuHeight = menu?.fileId
    ? menuTarget?.isFolder
      ? 264
      : 232
    : 152;
  const menuLeft = menu
    ? Math.max(12, Math.min(menu.x, window.innerWidth - menuWidth - 12))
    : 0;
  const menuTop = menu
    ? Math.max(12, Math.min(menu.y, window.innerHeight - menuHeight - 12))
    : 0;
  const overlayTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const };
  const panelTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div
      ref={gridRef}
      aria-activedescendant={
        resolvedActiveFileId ? getKeyboardItemId(resolvedActiveFileId) : undefined
      }
      aria-label="Files"
      aria-multiselectable="true"
      className={`${densityStyles.rootPadding} min-h-full relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-inset`}
      onFocus={(event) => {
        if (event.target !== gridRef.current || filteredFiles.length === 0) {
          return;
        }

        const fallbackActiveId =
          getFallbackActiveFileId() || filteredFiles[0]?.id;
        if (fallbackActiveId) {
          setActiveFileId(fallbackActiveId);
        }
      }}
      onClick={(event) => {
        if (
          event.target instanceof HTMLElement &&
          !event.target.closest("[role='dialog']")
        ) {
          focusGrid();
        }
        if (suppressClearClickRef.current) {
          suppressClearClickRef.current = false;
          return;
        }
        clearSelection();
        setMenu(null);
      }}
      onMouseDown={handleCanvasMouseDown}
      onKeyDown={handleGridKeyDown}
      onDragEnter={(e) => {
        if (!canAcceptExternalUpload || !isExternalFileDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        dragDepthRef.current += 1;
        setDropActive(true);
      }}
      onDragOver={(e) => {
        if (!canAcceptExternalUpload || !isExternalFileDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropActive(true);
      }}
      onDragLeave={(e) => {
        if (!canAcceptExternalUpload || !isExternalFileDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) {
          setDropActive(false);
        }
      }}
      onDrop={async (e) => {
        if (!canAcceptExternalUpload || !isExternalFileDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        dragDepthRef.current = 0;
        setDropActive(false);
        const droppedItems = await collectExternalUploadItems(e.dataTransfer);
        if (droppedItems.length > 0) {
          await handleDroppedUpload(droppedItems);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        focusGrid();
        setMenu({ x: e.clientX, y: e.clientY, fileId: null });
      }}
      role="listbox"
      tabIndex={0}
    >
      {dropActive && (
        <div
          data-ignore-drag-select="true"
          className="pointer-events-none absolute inset-4 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-blue-400/70 bg-blue-500/10 backdrop-blur-sm"
        >
          <div className="rounded-2xl border border-border bg-surface px-6 py-4 text-center shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
            <p className="text-lg font-semibold text-foreground">Drop files here</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {currentLocationAccountId || implicitUploadTarget
                ? "They will be uploaded to the current folder"
                : "You will choose the destination account after dropping"}
            </p>
          </div>
        </div>
      )}
      {showBackgroundRefreshing && (
        <div className="pointer-events-none absolute bottom-4 right-4 z-20">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-lg backdrop-blur-sm">
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
          </div>
        </div>
      )}
      {selectionBox && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-blue-400/70 bg-blue-400/12 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
          style={{
            left: getSelectionBounds(selectionBox).left,
            top: getSelectionBounds(selectionBox).top,
            width: getSelectionBounds(selectionBox).width,
            height: getSelectionBounds(selectionBox).height,
          }}
        />
      )}
      <div
        className={
          viewMode === "grid"
            ? `motion-stagger-children grid ${gridColumns} ${densityStyles.gridGap}`
            : `motion-stagger-children flex flex-col ${densityStyles.listGap}`
        }
      >
        {filteredFiles.map((file) => {
          const isSelected = selection.includes(file.id);
          const isActive = resolvedActiveFileId === file.id;
          const favorite = isFavorite(file.id, file.provider);
          const nameParts = getNameParts(file);
          return (
            <div 
              key={file.id} 
              ref={(node) => {
                itemRefs.current[file.id] = node;
              }}
              data-file-item="true"
              id={getKeyboardItemId(file.id)}
              aria-selected={isSelected}
              data-selected={isSelected ? "true" : "false"}
              draggable={!file.isFolder}
              className={`motion-file-item cursor-default transition-colors group select-none ${
                viewMode === "grid"
                  ? `flex flex-col items-center ${densityStyles.gridItem}`
                  : `flex items-center ${densityStyles.listItem}`
              } ${
                isSelected
                  ? "bg-blue-500/20 ring-1 ring-blue-500/50"
                  : "hover:bg-hover"
              } ${
                isActive
                  ? "shadow-[0_0_0_1px_rgba(191,219,254,0.55)]"
                  : ""
              }`}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(file.id, e.ctrlKey || e.metaKey, e.shiftKey);
              }}
              onPointerDown={() => {
                if (!file.isFolder) {
                  warmVideoOnPointerDown(file);
                }
              }}
              onMouseEnter={() => {
                if (!file.isFolder) {
                  scheduleVideoWarm(file);
                }
              }}
              onDragStart={(e) => {
                if (file.isFolder || !currentLocationProvider) {
                  e.preventDefault();
                  return;
                }
                e.dataTransfer.effectAllowed = "copyMove";
                e.dataTransfer.setData(
                  "application/x-oneflash-files",
                  buildTabDragPayload(file.id)
                );
                const downloadUrl = buildDownloadUrlForFile(
                  file.id,
                  file.provider,
                  file.name,
                  file.mimeType,
                  file.downloadUrl,
                  file.directUrl
                );
                if (downloadUrl) {
                  e.dataTransfer.setData(
                    "DownloadURL",
                    `${file.mimeType || "application/octet-stream"}:${file.name}:${downloadUrl}`
                  );
                  e.dataTransfer.setData("text/uri-list", downloadUrl);
                }
                e.dataTransfer.setData("text/plain", file.name);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                activateFile(file);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                focusGrid();
                selectionAnchorIdRef.current = file.id;
                setActiveFileId(file.id);
                if (!selection.includes(file.id)) {
                  setSelection([file.id]);
                }
                setMenu({ x: e.clientX, y: e.clientY, fileId: file.id });
              }}
              role="option"
            >
              <div
                className={`relative flex items-center justify-center ${
                  viewMode === "grid"
                    ? sizeStyles.gridIconBox
                    : sizeStyles.listIconBox
                }`}
              >
                {file.isFolder ? (
                  <FolderIcon
                    className={`text-blue-400 drop-shadow-md ${
                      viewMode === "grid"
                        ? sizeStyles.gridFolderIcon
                        : sizeStyles.listFolderIcon
                    }`}
                  />
                ) : (
                  <div className="relative">
                    {isImageFile(file.mimeType) && providerForFile(file.provider) ? (
                      <div
                        className={`overflow-hidden border border-border bg-surface-elevated shadow-md ${
                          viewMode === "grid"
                            ? sizeStyles.gridPreviewBox
                            : sizeStyles.listPreviewBox
                        }`}
                      >
                        <ImageThumbnail
                          src={resolvePreviewUrl(
                            file.id,
                            file.provider,
                            file.accountId,
                            file.name,
                            file.mimeType,
                            file.previewUrl,
                            file.directUrl
                          )}
                          alt={file.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : isVideoFile(file.mimeType) && providerForFile(file.provider) ? (
                      <div
                        className={`overflow-hidden border border-border bg-surface-elevated shadow-md ${
                          viewMode === "grid"
                            ? sizeStyles.gridPreviewBox
                            : sizeStyles.listPreviewBox
                        }`}
                      >
                        <VideoThumbnail
                          key={
                            resolvePreviewUrl(
                              file.id,
                              file.provider,
                              file.accountId,
                              file.name,
                              file.mimeType,
                              file.previewUrl,
                              file.directUrl
                            ) ?? file.id
                          }
                          src={resolvePreviewUrl(
                            file.id,
                            file.provider,
                            file.accountId,
                            file.name,
                            file.mimeType,
                            file.previewUrl,
                            file.directUrl
                          )}
                          className="h-full w-full object-cover"
                          iconClassName={
                            viewMode === "grid" ? "h-6 w-6" : "h-4 w-4"
                          }
                        />
                      </div>
                    ) : (
                      <>
                        <FileTypeIcon
                          file={file}
                          className={`drop-shadow-md ${
                            viewMode === "grid"
                              ? sizeStyles.gridDocumentIcon
                              : sizeStyles.listDocumentIcon
                          }`}
                        />
                        {viewMode === "grid" && (
                          <>
                            <div className="absolute inset-0 rounded-sm bg-gradient-to-tr from-slate-900/10 to-transparent" />
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
                {favorite && (
                  <div
                    className={`absolute flex items-center justify-center rounded-full border border-amber-300/70 bg-amber-400 text-[#3b2c00] shadow-md ${
                      viewMode === "grid"
                        ? sizeStyles.favoriteGrid
                        : sizeStyles.favoriteList
                    }`}
                  >
                    <StarIcon
                      className={
                        viewMode === "grid"
                          ? sizeStyles.favoriteGridIcon
                          : sizeStyles.favoriteListIcon
                      }
                    />
                  </div>
                )}
              </div>
              <div
                className={`min-w-0 ${
                  viewMode === "grid"
                    ? "flex w-full flex-col items-center px-1 text-center"
                    : "flex min-w-0 items-baseline gap-1.5"
                }`}
              >
                <span
                  className={`font-medium break-words ${
                    viewMode === "grid"
                      ? `${sizeStyles.gridLabel} line-clamp-2 w-full`
                      : "truncate text-sm"
                  } ${
                    isSelected
                      ? "text-foreground"
                      : "text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  {nameParts.main}
                </span>
                {nameParts.extension && (
                  <span
                    className={`shrink-0 uppercase tracking-[0.16em] ${
                      viewMode === "grid"
                        ? "mt-1 text-[10px] text-muted"
                        : "text-[10px] text-muted"
                    } ${isSelected ? "text-muted-foreground" : ""}`}
                  >
                    .{nameParts.extension}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {menu && (
        <div
          ref={menuRef}
          className="fixed z-50 w-56 rounded-xl border border-border bg-window-chrome p-1.5 text-sm shadow-2xl backdrop-blur-3xl"
          style={{ left: menuLeft, top: menuTop }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {menu.fileId ? (
            <>
              {(() => {
                const target = selectedOrTarget(menu.fileId)[0];
                return (
                  <>
              <button
                className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-hover"
                onClick={() => openInNewTab(menu.fileId || currentFolderId)}
              >
                Open
              </button>
                  {target?.isFolder && (
                    <button
                      className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-hover"
                      onClick={() => openInNewTab(menu.fileId || currentFolderId)}
                    >
                      Open in New Tab
                    </button>
                  )}
                  </>
                );
              })()}
              {(() => {
                const target = selectedOrTarget(menu.fileId)[0];
                return (
              <button
                className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-hover"
                onClick={() => {
                  const target = selectedOrTarget(menu.fileId)[0];
                  if (!target) return;
                  const downloadUrl = target.isFolder
                    ? buildFolderDownloadUrl(target.id, target.provider, target.name)
                    : buildDownloadUrlForFile(
                        target.id,
                        target.provider,
                        target.name,
                        target.mimeType,
                        target.downloadUrl,
                        target.directUrl
                      );
                  if (!downloadUrl) return;
                  window.open(
                    target.isFolder
                      ? downloadUrl
                      : downloadUrl,
                    "_blank",
                    "noopener,noreferrer"
                  );
                  setMenu(null);
                }}
              >
                {target?.isFolder ? "Download Folder" : "Download"}
              </button>
                );
              })()}
              <div className="mx-2 my-1 h-px bg-border" />
              <button className="w-full rounded-lg px-3 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-hover" onClick={() => handleRename(menu.fileId)}>
                Rename
              </button>
              <button className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-hover" onClick={() => handleDuplicate(menu.fileId)}>
                Duplicate
              </button>
              <button className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-hover" onClick={() => { copySelection(); setMenu(null); }}>
                Copy
              </button>
              <button
                className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!hasClipboard}
                onClick={async () => {
                  await pasteIntoCurrentFolder();
                  setMenu(null);
                }}
              >
                Paste
              </button>
              <div className="mx-2 my-1 h-px bg-border" />
              <button className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-hover" onClick={() => handleInfo(menu.fileId)}>
                Get Info
              </button>
              <button className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-red-300 transition-colors hover:bg-red-500/15" onClick={() => {
                setDeleteTargetIds(selectedOrTarget(menu.fileId).map((item) => item.id));
                setDeleteDialogOpen(true);
              }}>
                Delete
              </button>
            </>
          ) : (
            <>
                <button
                  className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-hover"
                  onClick={startFileFlow}
                >
                  New File
                </button>
                <button
                  className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-hover"
                  onClick={startFolderFlow}
                >
                  New Folder
                </button>
                <button
                  className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!hasClipboard}
                  onClick={async () => {
                    await pasteIntoCurrentFolder();
                    setMenu(null);
                  }}
                >
                  Paste
                </button>
                <button
                  className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!canStartCloudWriteAction}
                  onClick={startUploadFlow}
                >
                  Upload
                </button>
              </>
          )}
        </div>
      )}
      <input
        ref={uploadInputRef}
        className="hidden"
        type="file"
        multiple
        onChange={async (event) => {
          const input = event.currentTarget;
          const { files } = input;
          if (files) {
            await uploadFiles(files, pendingUploadTarget || undefined);
            setPendingUploadTarget(null);
            input.value = "";
          }
        }}
      />
      <AnimatePresence initial={false}>
        {previewFile && providerForFile(previewFile.provider) ? (
          <motion.div
            animate={{ opacity: 1 }}
            className={modalOverlayStrongClass}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={() => showPreview(null)}
            transition={overlayTransition}
          >
            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              aria-describedby="finder-preview-file-type"
              aria-labelledby="finder-preview-file-name"
              aria-modal="true"
              className="relative flex h-[86vh] w-[88vw] max-w-6xl min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
              exit={{ opacity: 0, scale: 0.985, y: 20 }}
              initial={{ opacity: 0, scale: 0.96, y: 28 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              transition={panelTransition}
            >
            <div className="flex items-center justify-between border-b border-border bg-window-chrome px-4 py-3">
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-semibold text-foreground"
                  id="finder-preview-file-name"
                >
                  {previewFile.name}
                </p>
                <p className="truncate text-xs text-muted" id="finder-preview-file-type">
                  {previewFile.mimeType}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {previewDownloadUrl ? (
                  <a
                    href={previewDownloadUrl}
                    className="rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-hover"
                    download={previewFile.name}
                    referrerPolicy="no-referrer"
                  >
                    Download
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => showPreview(null)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-window-pane p-4">
              {previewMimeType && isImageFile(previewMimeType) && previewUrl ? (
                <div className="flex max-h-full max-w-full items-center justify-center overflow-hidden">
                  <img
                    src={previewUrl}
                    alt={previewFile.name}
                    className="h-auto max-h-[calc(86vh-6rem)] w-auto max-w-[calc(88vw-2rem)] rounded-lg object-contain shadow-2xl"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : previewMimeType && isVideoFile(previewMimeType) && previewUrl ? (
                <div className="flex max-h-full max-w-full items-center justify-center overflow-hidden">
                  <VideoPreviewPlayer
                    key={`${previewPlaybackPrimaryUrl ?? ""}|${previewUrl ?? ""}`}
                    primarySrc={previewPlaybackPrimaryUrl}
                    fallbackSrc={previewUrl}
                    className="h-auto max-h-[calc(86vh-6rem)] w-auto max-w-[calc(88vw-2rem)] rounded-lg bg-surface-elevated object-contain shadow-2xl"
                  />
                </div>
              ) : previewMimeType && isAudioFile(previewMimeType) && previewUrl ? (
                <AudioPreviewPlayer
                  key={`${previewPlaybackPrimaryUrl ?? ""}|${previewUrl ?? ""}`}
                  primarySrc={previewPlaybackPrimaryUrl}
                  fallbackSrc={previewUrl}
                  className="w-full max-w-2xl"
                />
              ) : previewMimeType && isPdfFile(previewMimeType) && resolvedDocumentPreviewUrl ? (
                <iframe
                  src={resolvedDocumentPreviewUrl}
                  className="h-full max-h-full w-full max-w-full rounded-lg border border-border bg-white"
                  title={previewFile.name}
                  referrerPolicy="no-referrer"
                />
              ) : richPreviewLoading ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <ArrowPathIcon className="h-8 w-8 animate-spin text-muted" />
                  <p className="text-sm text-muted">Preparing preview…</p>
                </div>
              ) : richPreview?.kind === "html" ? (
                <iframe
                  sandbox=""
                  srcDoc={richPreview.html}
                  className="h-full max-h-full w-full max-w-full rounded-lg border border-border bg-white"
                  title={previewFile.name}
                />
              ) : richPreview?.kind === "table" ? (
                <div className="h-full w-full overflow-auto rounded-lg border border-border bg-window-chrome">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="sticky top-0 bg-surface-elevated">
                      <tr>
                        {richPreview.headers.map((header, index) => (
                          <th
                            key={`${header}-${index}`}
                            className="border-b border-border px-3 py-2 font-medium text-foreground"
                          >
                            {header || `Column ${index + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {richPreview.rows.map((row, rowIndex) => (
                        <tr key={`row-${rowIndex}`} className="odd:bg-surface/40">
                          {Array.from(
                            { length: Math.max(richPreview.headers.length, row.length) },
                            (_, columnIndex) => (
                              <td
                                key={`cell-${rowIndex}-${columnIndex}`}
                                className="border-b border-border px-3 py-2 align-top text-muted-foreground"
                              >
                                {row[columnIndex] || ""}
                              </td>
                            )
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : richPreview?.kind === "archive" ? (
                <div className="h-full w-full max-w-3xl overflow-auto rounded-lg border border-border bg-window-chrome p-4 text-left">
                  <p className="mb-3 text-sm font-medium text-foreground">
                    Archive contents
                  </p>
                  <div className="space-y-1 font-mono text-xs text-muted-foreground">
                    {richPreview.entries.map((entry) => (
                      <p key={entry}>{entry}</p>
                    ))}
                  </div>
                </div>
              ) : richPreview?.kind === "text" ? (
                <div className="h-full w-full overflow-auto rounded-lg border border-border bg-window-chrome scrollbar-thin scrollbar-thumb-muted">
                  {richPreview.language === "markdown" ? (
                    <div className="mx-auto max-w-3xl p-8 sm:p-12">
                      <div className="prose prose-invert prose-neutral max-w-none">
                        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-foreground/90">
                          {richPreview.text}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 font-mono text-[13px] leading-6">
                      <pre className="whitespace-pre break-all text-foreground/80">
                  {richPreview.text}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6 px-4 py-12 text-center">
                  <div className="relative">
                    <DocumentIcon className="h-20 w-20 text-muted/20" />
                    <div className="absolute -bottom-1 -right-1 rounded-full bg-background p-1">
                      <div className="rounded-full bg-red-500/10 p-1.5">
                        <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="max-w-xs">
                    <p className="text-base font-semibold text-foreground">
                      {richPreviewError || "Preview unavailable"}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      We couldn't generate a preview for this file. You can still download it to view it locally.
                    </p>
                  </div>
                  {previewDownloadUrl ? (
                    <a
                      href={previewDownloadUrl}
                      className="inline-flex items-center gap-2 rounded-lg bg-foreground px-6 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-95"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                      </svg>
                      Download File
                    </a>
                  ) : null}
                </div>
              )}
            </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {infoFile ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-overlay"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={() => showInfo(null)}
            transition={overlayTransition}
          >
            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-[480px] rounded-xl border border-border bg-surface p-5"
              exit={{ opacity: 0, scale: 0.985, y: 16 }}
              initial={{ opacity: 0, scale: 0.96, y: 22 }}
              onClick={(e) => e.stopPropagation()}
              transition={panelTransition}
            >
            <h3 className="text-lg font-semibold mb-2">Info</h3>
            <div className="space-y-1 text-sm">
              <p>Name: {infoFile.name}</p>
              <p>Type: {infoFile.mimeType || "unknown"}</p>
              <p>Modified: {infoFile.modifiedTime || "-"}</p>
              <p>Size: {formatInfoSize(infoFile.size)}</p>
            </div>
              <button className="mt-4 cursor-pointer rounded bg-foreground px-3 py-1.5 text-sm text-background" onClick={() => showInfo(null)}>
                Close
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {renameDialog?.open ? (
          <motion.div
            animate={{ opacity: 1 }}
            className={modalOverlayClass}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={overlayTransition}
          >
            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              aria-busy={renameSubmitting}
              aria-modal="true"
              className="w-full max-w-[420px] rounded-xl border border-border bg-surface p-5"
              exit={{ opacity: 0, scale: 0.985, y: 16 }}
              initial={{ opacity: 0, scale: 0.96, y: 22 }}
              role="dialog"
              transition={panelTransition}
            >
            <h3 className="mb-3 text-lg font-semibold">Rename Item</h3>
            <input
              value={renameDialog.name}
              onChange={(e) => setRenameDialog({ ...renameDialog, name: e.target.value })}
              disabled={renameSubmitting}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                className={dialogSecondaryButtonClass}
                disabled={renameSubmitting}
                onClick={() => setRenameDialog(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                disabled={renameSubmitting}
                className={dialogPrimaryButtonClass}
                onClick={async () => {
                  if (renameSubmitting) return;
                  setRenameSubmitting(true);
                  try {
                    await renameFile(renameDialog.fileId, renameDialog.name);
                    setRenameDialog(null);
                  } finally {
                    setRenameSubmitting(false);
                  }
                }}
                type="button"
              >
                {renameSubmitting ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
                {renameSubmitting ? "Renaming..." : "Rename"}
              </button>
            </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {folderDialogOpen ? (
          <motion.div
            animate={{ opacity: 1 }}
            className={modalOverlayClass}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={overlayTransition}
          >
            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              aria-busy={createSubmitting}
              aria-modal="true"
              className="w-full max-w-[420px] rounded-xl border border-border bg-surface p-5"
              exit={{ opacity: 0, scale: 0.985, y: 16 }}
              initial={{ opacity: 0, scale: 0.96, y: 22 }}
              role="dialog"
              transition={panelTransition}
            >
            <h3 className="mb-3 text-lg font-semibold">Create Folder</h3>
            {pendingFolderTargetLabel ? (
              <p className="mb-3 text-sm text-muted-foreground">
                Create in {pendingFolderTargetLabel.providerLabel} / {pendingFolderTargetLabel.accountLabel}
              </p>
            ) : null}
            <input
              value={newFolderName}
              disabled={createSubmitting}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
              placeholder="Folder name"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                className={dialogSecondaryButtonClass}
                disabled={createSubmitting}
                onClick={() => {
                  setFolderDialogOpen(false);
                  setPendingFolderTarget(null);
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className={dialogPrimaryButtonClass}
                disabled={createSubmitting}
                onClick={async () => {
                  if (createSubmitting) return;
                  setCreateSubmitting(true);
                  try {
                    await createFolder(
                      newFolderName || "New Folder",
                      pendingFolderTarget || undefined
                    );
                    setFolderDialogOpen(false);
                    setNewFolderName("");
                    setPendingFolderTarget(null);
                  } finally {
                    setCreateSubmitting(false);
                  }
                }}
                type="button"
              >
                {createSubmitting ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
                {createSubmitting ? "Creating..." : "Create"}
              </button>
            </div>
            </motion.div>
          </motion.div>
        ) : null}
        {fileDialogOpen ? (
          <motion.div
            animate={{ opacity: 1 }}
            className={modalOverlayClass}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={overlayTransition}
          >
            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              aria-busy={createSubmitting}
              aria-modal="true"
              className="w-full max-w-[420px] rounded-xl border border-border bg-surface p-5"
              exit={{ opacity: 0, scale: 0.985, y: 16 }}
              initial={{ opacity: 0, scale: 0.96, y: 22 }}
              role="dialog"
              transition={panelTransition}
            >
            <h3 className="mb-3 text-lg font-semibold">Create File</h3>
            {pendingFileTargetLabel ? (
              <p className="mb-3 text-sm text-muted-foreground">
                Create in {pendingFileTargetLabel.providerLabel} / {pendingFileTargetLabel.accountLabel}
              </p>
            ) : null}
            <input
              value={newFileName}
              disabled={createSubmitting}
              onChange={(e) => setNewFileName(e.target.value)}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
              placeholder="File name (e.g. note.txt)"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                className={dialogSecondaryButtonClass}
                disabled={createSubmitting}
                onClick={() => {
                  setFileDialogOpen(false);
                  setPendingFileTarget(null);
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className={dialogPrimaryButtonClass}
                disabled={createSubmitting}
                onClick={async () => {
                  if (createSubmitting) return;
                  setCreateSubmitting(true);
                  try {
                    const name = newFileName || "New File.txt";
                    const blob = new Blob([""], { type: "text/plain" });
                    const file = new File([blob], name, { type: "text/plain" });
                    
                    await uploadFiles([file], pendingFileTarget || undefined);
                    
                    setFileDialogOpen(false);
                    setNewFileName("");
                    setPendingFileTarget(null);
                  } finally {
                    setCreateSubmitting(false);
                  }
                }}
                type="button"
              >
                {createSubmitting ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
                {createSubmitting ? "Creating..." : "Create"}
              </button>
            </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <CloudActionTargetDialog
        open={targetDialogAction !== null}
        title={
          targetDialogAction === "folder"
            ? "Choose Folder Destination"
            : targetDialogAction === "file"
              ? "Choose File Destination"
              : "Choose Upload Destination"
        }
        description={
          targetDialogAction === "folder"
            ? "Pick which connected account should receive the new folder."
            : targetDialogAction === "file"
              ? "Pick which connected account should receive the new file."
              : "Pick which connected account should receive the uploaded files."
        }
        options={actionTargetOptions}
        onClose={() => {
          setTargetDialogAction(null);
          setPendingDroppedItems(null);
        }}
        onSelect={handleTargetSelect}
      />
      <AnimatePresence initial={false}>
        {deleteDialogOpen ? (
          <motion.div
            animate={{ opacity: 1 }}
            className={modalOverlayClass}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={overlayTransition}
          >
            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              aria-busy={deleteSubmitting}
              aria-modal="true"
              className="w-full max-w-[420px] rounded-xl border border-border bg-surface p-5"
              exit={{ opacity: 0, scale: 0.985, y: 16 }}
              initial={{ opacity: 0, scale: 0.96, y: 22 }}
              role="dialog"
              transition={panelTransition}
            >
            <h3 className="mb-2 text-lg font-semibold">Delete</h3>
            <p className="text-sm text-muted-foreground">Selected items will be removed from current storage.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className={dialogSecondaryButtonClass}
                disabled={deleteSubmitting}
                onClick={() => setDeleteDialogOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={dialogDangerButtonClass}
                disabled={deleteSubmitting}
                onClick={async () => {
                  if (deleteSubmitting) return;
                  setDeleteSubmitting(true);
                  try {
                    if (deleteTargetIds && deleteTargetIds.length > 0) {
                      await deleteFiles(deleteTargetIds);
                    } else {
                      await deleteSelected();
                    }
                    setDeleteDialogOpen(false);
                    setDeleteTargetIds(null);
                    setMenu(null);
                  } finally {
                    setDeleteSubmitting(false);
                  }
                }}
                type="button"
              >
                {deleteSubmitting ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
                {deleteSubmitting ? "Deleting..." : "Delete"}
              </button>
            </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
