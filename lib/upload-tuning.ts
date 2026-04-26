const KIB = 1024;
const MIB = 1024 * KIB;

const GOOGLE_SLOW_CHUNK_SIZE = 8 * MIB;
const GOOGLE_MEDIUM_CHUNK_SIZE = 16 * MIB;
const GOOGLE_BALANCED_CHUNK_SIZE = 32 * MIB;
const GOOGLE_FAST_CHUNK_SIZE = 64 * MIB;

const ONEDRIVE_CHUNK_MULTIPLE = 320 * KIB;
const ONEDRIVE_SLOW_CHUNK_SIZE = ONEDRIVE_CHUNK_MULTIPLE * 16;
const ONEDRIVE_MEDIUM_CHUNK_SIZE = ONEDRIVE_CHUNK_MULTIPLE * 64;
const ONEDRIVE_BALANCED_CHUNK_SIZE = ONEDRIVE_CHUNK_MULTIPLE * 128;
const ONEDRIVE_FAST_CHUNK_SIZE = ONEDRIVE_CHUNK_MULTIPLE * 160;

type UploadEffectiveType = "slow-2g" | "2g" | "3g" | "4g";

interface BrowserNetworkInformation {
  downlink?: number;
  effectiveType?: UploadEffectiveType;
  saveData?: boolean;
}

interface BrowserWithConnection extends Navigator {
  connection?: BrowserNetworkInformation;
  mozConnection?: BrowserNetworkInformation;
  webkitConnection?: BrowserNetworkInformation;
}

export interface UploadTuningEnvironment {
  effectiveType?: UploadEffectiveType | null;
  downlinkMbps?: number | null;
  hardwareConcurrency?: number | null;
  saveData?: boolean | null;
}

export interface UploadTuning {
  googleChunkSize: number;
  onedriveChunkSize: number;
  maxParallelUploads: number;
  sessionPrewarmLimit: number;
  sessionBatchSize: number;
}

export function getUploadTuning(
  fileCount: number,
  environment: UploadTuningEnvironment = {}
): UploadTuning {
  const normalizedFileCount = Math.max(0, Math.floor(fileCount));
  const effectiveType = environment.effectiveType ?? null;
  const downlinkMbps = environment.downlinkMbps ?? null;
  const hardwareConcurrency = environment.hardwareConcurrency ?? null;
  const saveData = environment.saveData ?? false;

  let googleChunkSize = GOOGLE_BALANCED_CHUNK_SIZE;
  let onedriveChunkSize = ONEDRIVE_BALANCED_CHUNK_SIZE;
  let maxParallelUploads = 4;
  let sessionPrewarmLimit = 0;

  if (saveData || effectiveType === "slow-2g" || effectiveType === "2g") {
    googleChunkSize = GOOGLE_SLOW_CHUNK_SIZE;
    onedriveChunkSize = ONEDRIVE_SLOW_CHUNK_SIZE;
    maxParallelUploads = 2;
  } else if (effectiveType === "3g" || (downlinkMbps !== null && downlinkMbps < 10)) {
    googleChunkSize = GOOGLE_MEDIUM_CHUNK_SIZE;
    onedriveChunkSize = ONEDRIVE_MEDIUM_CHUNK_SIZE;
    maxParallelUploads = 3;
  } else if (downlinkMbps !== null && downlinkMbps >= 20) {
    googleChunkSize = GOOGLE_FAST_CHUNK_SIZE;
    onedriveChunkSize = ONEDRIVE_FAST_CHUNK_SIZE;
    maxParallelUploads = hardwareConcurrency !== null && hardwareConcurrency >= 8 ? 6 : 5;
  }

  if (hardwareConcurrency !== null && hardwareConcurrency <= 4) {
    maxParallelUploads = Math.min(maxParallelUploads, 3);
  }

  if (normalizedFileCount > 0) {
    maxParallelUploads = Math.min(maxParallelUploads, normalizedFileCount);
  }

  if (normalizedFileCount > 0) {
    if (saveData || effectiveType === "slow-2g" || effectiveType === "2g") {
      sessionPrewarmLimit = maxParallelUploads;
    } else if (effectiveType === "3g" || (downlinkMbps !== null && downlinkMbps < 10)) {
      sessionPrewarmLimit = maxParallelUploads + 2;
    } else {
      sessionPrewarmLimit = maxParallelUploads * 2;
    }

    sessionPrewarmLimit = Math.min(normalizedFileCount, Math.max(sessionPrewarmLimit, 2));
  }

  const sessionBatchSize =
    normalizedFileCount === 0 ? 0 : Math.min(normalizedFileCount, sessionPrewarmLimit);

  return {
    googleChunkSize,
    onedriveChunkSize,
    maxParallelUploads: Math.max(1, maxParallelUploads),
    sessionPrewarmLimit: Math.max(0, sessionPrewarmLimit),
    sessionBatchSize,
  };
}

export function getBrowserUploadTuning(fileCount: number) {
  if (typeof navigator === "undefined") {
    return getUploadTuning(fileCount);
  }

  const browserNavigator = navigator as BrowserWithConnection;
  const connection =
    browserNavigator.connection ||
    browserNavigator.mozConnection ||
    browserNavigator.webkitConnection;

  return getUploadTuning(fileCount, {
    effectiveType: connection?.effectiveType ?? null,
    downlinkMbps: connection?.downlink ?? null,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    saveData: connection?.saveData ?? null,
  });
}
