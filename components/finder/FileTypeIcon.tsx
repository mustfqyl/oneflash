"use client";

import {
  ArchiveBoxIcon,
  CircleStackIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  MusicalNoteIcon,
  PaintBrushIcon,
  PhotoIcon,
  PlayIcon,
  PresentationChartBarIcon,
  TableCellsIcon,
} from "@heroicons/react/24/solid";
import type { CloudFile } from "./CloudContext";

type FileIconKind =
  | "pdf"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "archive"
  | "audio"
  | "video"
  | "code"
  | "text"
  | "database"
  | "design"
  | "image"
  | "font"
  | "app"
  | "model"
  | "default";

interface FileIconPreset {
  kind: FileIconKind;
  badge: string;
  badgeClassName: string;
  bodyAccentClassName: string;
  glyphClassName: string;
}

const CODE_EXTENSIONS = new Set([
  "js",
  "jsx",
  "ts",
  "tsx",
  "mjs",
  "cjs",
  "html",
  "css",
  "scss",
  "sass",
  "json",
  "jsonl",
  "xml",
  "yaml",
  "yml",
  "toml",
  "ini",
  "env",
  "py",
  "rb",
  "php",
  "java",
  "kt",
  "swift",
  "go",
  "rs",
  "sh",
  "zsh",
  "bash",
  "sql",
  "c",
  "cc",
  "cpp",
  "h",
  "hpp",
]);

const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "rtf", "log"]);
const DATABASE_EXTENSIONS = new Set(["db", "sqlite", "sqlite3", "mdb", "accdb"]);
const DESIGN_EXTENSIONS = new Set(["fig", "sketch", "xd", "psd", "ai"]);
const FONT_EXTENSIONS = new Set(["ttf", "otf", "woff", "woff2"]);
const APP_EXTENSIONS = new Set(["app", "exe", "apk", "ipa", "pkg", "dmg"]);
const MODEL_EXTENSIONS = new Set(["obj", "stl", "blend", "fbx", "gltf", "glb", "usd", "usdz"]);
const ARCHIVE_EXTENSIONS = new Set([
  "zip",
  "rar",
  "7z",
  "tar",
  "gz",
  "tgz",
  "bz2",
  "xz",
  "iso",
]);
const DOCUMENT_EXTENSIONS = new Set(["doc", "docx", "docm", "pages", "odt"]);
const SPREADSHEET_EXTENSIONS = new Set(["xls", "xlsx", "xlsm", "numbers", "ods", "csv", "tsv"]);
const PRESENTATION_EXTENSIONS = new Set(["ppt", "pptx", "pptm", "key", "odp"]);

function getExtension(fileName: string) {
  const trimmed = fileName.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return "";
  }
  return trimmed.slice(lastDot + 1).toLowerCase();
}

function getBadge(fileName: string, fallback: string) {
  const extension = getExtension(fileName);
  return (extension || fallback).slice(0, 4).toUpperCase();
}

function getFileIconPreset(file: Pick<CloudFile, "name" | "mimeType">): FileIconPreset {
  const extension = getExtension(file.name);
  const mimeType = file.mimeType || "";

  if (mimeType === "application/pdf" || extension === "pdf") {
    return {
      kind: "pdf",
      badge: "PDF",
      badgeClassName: "bg-[#ff6257] text-white",
      bodyAccentClassName: "from-[#ffe5e2] to-[#ffc5be]",
      glyphClassName: "text-[#ff6257]",
    };
  }

  if (
    mimeType === "application/vnd.google-apps.document" ||
    DOCUMENT_EXTENSIONS.has(extension)
  ) {
    return {
      kind: "document",
      badge: "DOC",
      badgeClassName: "bg-[#4e8df7] text-white",
      bodyAccentClassName: "from-[#ddecff] to-[#bfd9ff]",
      glyphClassName: "text-[#4e8df7]",
    };
  }

  if (
    mimeType === "application/vnd.google-apps.spreadsheet" ||
    SPREADSHEET_EXTENSIONS.has(extension)
  ) {
    return {
      kind: "spreadsheet",
      badge: extension === "csv" || extension === "tsv" ? "CSV" : "XLS",
      badgeClassName: "bg-[#2fb15d] text-white",
      bodyAccentClassName: "from-[#dff8e9] to-[#bfeecf]",
      glyphClassName: "text-[#2fb15d]",
    };
  }

  if (
    mimeType === "application/vnd.google-apps.presentation" ||
    PRESENTATION_EXTENSIONS.has(extension)
  ) {
    return {
      kind: "presentation",
      badge: "PPT",
      badgeClassName: "bg-[#f39a3d] text-white",
      bodyAccentClassName: "from-[#ffe7cf] to-[#ffd3ab]",
      glyphClassName: "text-[#f39a3d]",
    };
  }

  if (ARCHIVE_EXTENSIONS.has(extension) || mimeType.includes("zip") || mimeType.includes("tar")) {
    return {
      kind: "archive",
      badge: getBadge(file.name, "ZIP"),
      badgeClassName: "bg-[#f1b43d] text-[#332100]",
      bodyAccentClassName: "from-[#fff0ca] to-[#ffe2a0]",
      glyphClassName: "text-[#e29b15]",
    };
  }

  if (mimeType.startsWith("audio/")) {
    return {
      kind: "audio",
      badge: getBadge(file.name, "AUD"),
      badgeClassName: "bg-[#d261ff] text-white",
      bodyAccentClassName: "from-[#f4ddff] to-[#e8bcff]",
      glyphClassName: "text-[#c03bff]",
    };
  }

  if (mimeType.startsWith("video/")) {
    return {
      kind: "video",
      badge: getBadge(file.name, "VID"),
      badgeClassName: "bg-[#8f68ff] text-white",
      bodyAccentClassName: "from-[#ebe3ff] to-[#d5c2ff]",
      glyphClassName: "text-[#7c4dff]",
    };
  }

  if (DATABASE_EXTENSIONS.has(extension)) {
    return {
      kind: "database",
      badge: "DB",
      badgeClassName: "bg-[#3aa0ff] text-white",
      bodyAccentClassName: "from-[#def0ff] to-[#bde0ff]",
      glyphClassName: "text-[#248cff]",
    };
  }

  if (DESIGN_EXTENSIONS.has(extension) || mimeType.includes("photoshop") || mimeType.includes("illustrator")) {
    return {
      kind: "design",
      badge: getBadge(file.name, "DES"),
      badgeClassName: "bg-[#ff6bb2] text-white",
      bodyAccentClassName: "from-[#ffe0ef] to-[#ffc4df]",
      glyphClassName: "text-[#ff4f9f]",
    };
  }

  if (FONT_EXTENSIONS.has(extension) || mimeType.includes("font")) {
    return {
      kind: "font",
      badge: "FONT",
      badgeClassName: "bg-[#2ec5b6] text-white",
      bodyAccentClassName: "from-[#daf8f4] to-[#b6efe7]",
      glyphClassName: "text-[#11b4a4]",
    };
  }

  if (APP_EXTENSIONS.has(extension)) {
    return {
      kind: "app",
      badge: getBadge(file.name, "APP"),
      badgeClassName: "bg-[#343a46] text-white",
      bodyAccentClassName: "from-[#e3e6eb] to-[#cdd3db]",
      glyphClassName: "text-[#343a46]",
    };
  }

  if (MODEL_EXTENSIONS.has(extension)) {
    return {
      kind: "model",
      badge: "3D",
      badgeClassName: "bg-[#49a6d9] text-white",
      bodyAccentClassName: "from-[#def2fb] to-[#bfe5f8]",
      glyphClassName: "text-[#2b95ce]",
    };
  }

  if (mimeType.startsWith("image/")) {
    return {
      kind: "image",
      badge: getBadge(file.name, "IMG"),
      badgeClassName: "bg-[#51b86c] text-white",
      bodyAccentClassName: "from-[#e0f7e6] to-[#c5efcf]",
      glyphClassName: "text-[#40a55b]",
    };
  }

  if (
    mimeType === "application/vnd.google-apps.script" ||
    CODE_EXTENSIONS.has(extension) ||
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("javascript") ||
    mimeType.includes("xml")
  ) {
    return {
      kind: "code",
      badge: getBadge(file.name, "CODE"),
      badgeClassName: "bg-[#252935] text-white",
      bodyAccentClassName: "from-[#e7eaf0] to-[#d4d9e2]",
      glyphClassName: "text-[#252935]",
    };
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    return {
      kind: "text",
      badge: getBadge(file.name, "TXT"),
      badgeClassName: "bg-[#7d8592] text-white",
      bodyAccentClassName: "from-[#f1f3f6] to-[#e0e5ec]",
      glyphClassName: "text-[#717987]",
    };
  }

  return {
    kind: "default",
    badge: getBadge(file.name, "FILE"),
    badgeClassName: "bg-[#a0a7b4] text-white",
    bodyAccentClassName: "from-[#f1f3f7] to-[#dfe4eb]",
    glyphClassName: "text-[#8f97a5]",
  };
}

function FileTypeGlyph({
  kind,
  className,
}: {
  kind: FileIconKind;
  className: string;
}) {
  if (kind === "document" || kind === "pdf" || kind === "text") {
    return <DocumentTextIcon className={className} />;
  }
  if (kind === "spreadsheet") {
    return <TableCellsIcon className={className} />;
  }
  if (kind === "presentation") {
    return <PresentationChartBarIcon className={className} />;
  }
  if (kind === "archive") {
    return <ArchiveBoxIcon className={className} />;
  }
  if (kind === "audio") {
    return <MusicalNoteIcon className={className} />;
  }
  if (kind === "video") {
    return <PlayIcon className={className} />;
  }
  if (kind === "database" || kind === "app" || kind === "model") {
    return <CircleStackIcon className={className} />;
  }
  if (kind === "design") {
    return <PaintBrushIcon className={className} />;
  }
  if (kind === "image") {
    return <PhotoIcon className={className} />;
  }
  return <CodeBracketIcon className={className} />;
}

export default function FileTypeIcon({
  file,
  className,
}: {
  file: Pick<CloudFile, "name" | "mimeType">;
  className: string;
}) {
  const preset = getFileIconPreset(file);

  return (
    <div className={`relative ${className}`}>
      <div
        className={`absolute inset-0 overflow-hidden rounded-[22%] border border-[#ccd3dc]/70 bg-gradient-to-b ${preset.bodyAccentClassName} shadow-[0_10px_24px_rgba(15,23,42,0.16)]`}
        style={{
          clipPath: "polygon(0 0, 76% 0, 100% 24%, 100% 100%, 0 100%)",
        }}
      />
      <div
        className="absolute right-0 top-0 h-[28%] w-[28%] border-b border-l border-[#d7dde5]/80 bg-[#f8fafc]"
        style={{
          clipPath: "polygon(0 0, 100% 0, 100% 100%)",
        }}
      />
      <div className="absolute inset-[16%] rounded-[18%] bg-white/78" />
      <div className="absolute left-[22%] top-[18%] h-[24%] w-[24%]">
        <FileTypeGlyph kind={preset.kind} className={`h-full w-full ${preset.glyphClassName}`} />
      </div>
      <div className="absolute left-[18%] right-[18%] top-[50%] h-[16%] space-y-[12%]">
        <div className="h-[22%] rounded-full bg-black/7" />
        <div className="h-[22%] rounded-full bg-black/7" />
        <div className="h-[22%] w-[72%] rounded-full bg-black/7" />
      </div>
      <div
        className={`absolute bottom-[8%] left-[12%] right-[12%] rounded-[999px] px-[8%] py-[6%] text-center text-[7px] font-bold tracking-[0.18em] shadow-sm ${preset.badgeClassName}`}
      >
        {preset.badge}
      </div>
    </div>
  );
}
