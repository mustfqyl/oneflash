import { deflate, inflate } from "fflate";

// MIME types that are already compressed — skip compression
const SKIP_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/gzip",
  "application/pdf",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
]);

export function shouldCompress(mimeType: string): boolean {
  return !SKIP_MIME_TYPES.has(mimeType);
}

export function compressData(data: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    deflate(data, { level: 6 }, (err, compressed) => {
      if (err) reject(err);
      else resolve(compressed);
    });
  });
}

export function decompressData(data: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    inflate(data, (err, decompressed) => {
      if (err) reject(err);
      else resolve(decompressed);
    });
  });
}
