const MIME_BY_EXTENSION: Record<string, string> = {
  aac: "audio/aac",
  avi: "video/x-msvideo",
  css: "text/css",
  csv: "text/csv",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  htm: "text/html",
  html: "text/html",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "text/javascript",
  json: "application/json",
  m4a: "audio/mp4",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  ogv: "video/ogg",
  pdf: "application/pdf",
  png: "image/png",
  svg: "image/svg+xml",
  txt: "text/plain",
  wav: "audio/wav",
  weba: "audio/webm",
  webm: "video/webm",
  webp: "image/webp",
  xml: "application/xml",
  zip: "application/zip",
};

const EXTENSION_BY_MIME: Record<string, string> = {
  "application/json": "json",
  "application/pdf": "pdf",
  "application/xml": "xml",
  "application/zip": "zip",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "weba",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "text/css": "css",
  "text/csv": "csv",
  "text/html": "html",
  "text/javascript": "js",
  "text/plain": "txt",
  "video/mp4": "mp4",
  "video/mpeg": "mpeg",
  "video/ogg": "ogv",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-msvideo": "avi",
};

const GENERIC_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream",
  "application/x-binary",
  "application/x-download",
  "application/force-download",
]);

const ZIP_LIKE_MIME_TYPES = new Set([
  "application/zip",
  "application/x-zip",
  "application/x-zip-compressed",
]);

function getExtension(name: string) {
  const trimmed = name.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot < 0 || lastDot === trimmed.length - 1) {
    return "";
  }

  return trimmed.slice(lastDot + 1).toLowerCase();
}

export function hasFileExtension(name: string) {
  return getExtension(name).length > 0;
}

export function inferMimeTypeFromName(name: string) {
  const extension = getExtension(name);
  return extension ? MIME_BY_EXTENSION[extension] || null : null;
}

export function inferExtensionFromMimeType(mimeType?: string | null) {
  const normalizedMimeType = (mimeType || "").trim().toLowerCase();
  return normalizedMimeType ? EXTENSION_BY_MIME[normalizedMimeType] || null : null;
}

export function resolveFileMimeType(name: string, mimeType?: string | null) {
  const normalizedMimeType = (mimeType || "").trim().toLowerCase();
  const inferredMimeType = inferMimeTypeFromName(name);

  if (!inferredMimeType) {
    return normalizedMimeType || "application/octet-stream";
  }

  if (!normalizedMimeType || GENERIC_MIME_TYPES.has(normalizedMimeType)) {
    return inferredMimeType;
  }

  if (
    ZIP_LIKE_MIME_TYPES.has(normalizedMimeType) &&
    !ZIP_LIKE_MIME_TYPES.has(inferredMimeType)
  ) {
    return inferredMimeType;
  }

  return normalizedMimeType;
}

export async function sniffMimeTypeFromFile(file: Blob) {
  const header = new Uint8Array(
    await new Response(file.slice(0, 32)).arrayBuffer()
  );

  if (
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47
  ) {
    return "image/png";
  }

  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    header[0] === 0x47 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x38
  ) {
    return "image/gif";
  }

  if (
    header[0] === 0x52 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x46 &&
    header[8] === 0x57 &&
    header[9] === 0x45 &&
    header[10] === 0x42 &&
    header[11] === 0x50
  ) {
    return "image/webp";
  }

  if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
    return "application/pdf";
  }

  if (
    header[4] === 0x66 &&
    header[5] === 0x74 &&
    header[6] === 0x79 &&
    header[7] === 0x70
  ) {
    const brand = String.fromCharCode(...header.slice(8, 12));
    if (brand.startsWith("qt")) {
      return "video/quicktime";
    }
    if (brand === "heic" || brand === "heix" || brand === "hevc" || brand === "hevx") {
      return "image/heic";
    }
    if (brand === "mif1" || brand === "msf1") {
      return "image/heif";
    }
    return "video/mp4";
  }

  if (header[0] === 0x50 && header[1] === 0x4b && (header[2] === 0x03 || header[2] === 0x05 || header[2] === 0x07)) {
    return "application/zip";
  }

  return null;
}
