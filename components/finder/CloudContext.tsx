"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
  useCallback,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  encodeScopedCloudItemId,
  getScopedCloudAccountId,
} from "@/lib/cloud-item-id";
import {
  hasFileExtension,
  inferExtensionFromMimeType,
  resolveFileMimeType,
  sniffMimeTypeFromFile,
} from "@/lib/file-mime";
import { getBrowserUploadTuning } from "@/lib/upload-tuning";

export type CloudProviderId = "google" | "onedrive";

export interface ConnectedCloudAccount {
  id: string;
  email: string | null;
  connectedAt: string | null;
}

type ConnectedAccountsByProvider = Record<CloudProviderId, ConnectedCloudAccount[]>;

export interface CloudActionTarget {
  provider: CloudProviderId;
  accountId?: string | null;
  folderId?: string;
}

export interface CloudFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  isFolder: boolean;
  iconLink?: string;
  provider?: CloudProviderId | null;
  accountId?: string | null;
  accountEmail?: string | null;
}

interface ProviderApiFile {
  id: string;
  name: string;
  mimeType?: string;
  size?: string | number;
  modifiedTime?: string;
  lastModifiedDateTime?: string;
  file?: { mimeType?: string };
  folder?: unknown;
  iconLink?: string;
  accountId?: string | null;
  accountEmail?: string | null;
}

interface FetchFilesOptions {
  silent?: boolean;
  preserveSelection?: boolean;
  targetTabId?: string;
  targetProvider?: CloudProviderId | null;
  targetFolderId?: string;
}

interface FolderHistoryEntry {
  folderId: string;
  path: string[];
}

interface FinderTabState {
  id: string;
  provider: CloudProviderId | null;
  folderHistory: FolderHistoryEntry[];
  historyIndex: number;
}

export interface FinderTab {
  id: string;
  provider: CloudProviderId | null;
  currentFolderId: string;
  title: string;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
}

interface FavoriteStorageMap {
  [key: string]: CloudFile;
}

export type FinderItemScale = "compact" | "comfortable" | "large";
export type FinderItemDensity = "tight" | "normal" | "airy";
export type SortBy = "name" | "dateModified" | "size" | "kind";
export type SortDirection = "asc" | "desc";
type UploadStatus = "idle" | "running" | "paused";

interface UploadState {
  active: boolean;
  status: UploadStatus;
  provider: CloudProviderId | null;
  fileCount: number;
  currentFileName: string | null;
  uploadedBytes: number;
  totalBytes: number;
  progress: number;
  speedBytesPerSecond: number;
  remainingSeconds: number | null;
}

interface UploadSessionPayload {
  uploadUrl: string;
  expirationDateTime?: string | null;
}

interface UploadSourceItem {
  file: File;
  relativePath?: string;
}

interface DirectUploadTask {
  optimisticId: string | null;
  file: File;
  provider: CloudProviderId;
  targetFolderId: string;
  committedBytes: number;
  inflightBytes: number;
  uploadUrl: string | null;
  sessionPromise: Promise<UploadSessionPayload> | null;
  chunkSize: number;
  status: "pending" | "running" | "completed";
}

interface DirectUploadManager {
  status: UploadStatus | "canceled";
  provider: CloudProviderId;
  refreshProvider: CloudProviderId | null;
  tabId: string;
  folderId: string;
  tasks: DirectUploadTask[];
  activeXhrs: Map<string, XMLHttpRequest>;
  isProcessing: boolean;
  resumeRequested: boolean;
  lastSampleTime: number;
  lastSampleBytes: number;
  smoothedSpeed: number;
  maxParallelUploads: number;
  sessionPrewarmLimit: number;
}

interface CloudContextType {
  provider: CloudProviderId | null;
  currentLocationProvider: CloudProviderId | null;
  currentLocationAccountId: string | null;
  files: CloudFile[];
  loading: boolean;
  error: string | null;
  currentFolderId: string;
  breadcrumbItems: BreadcrumbItem[];
  selection: string[];
  setSelection: (ids: string[]) => void;
  navigateToBreadcrumb: (index: number) => void;
  navigateUp: () => void;
  folderHistory: string[];
  refreshFiles: () => Promise<void>;
  createFolder: (name: string, target?: CloudActionTarget) => Promise<void>;
  deleteSelected: () => Promise<void>;
  deleteFiles: (ids: string[]) => Promise<void>;
  clearSelection: () => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  viewMode: "grid" | "list";
  setViewMode: (value: "grid" | "list") => void;
  itemScale: FinderItemScale;
  setItemScale: (value: FinderItemScale) => void;
  itemDensity: FinderItemDensity;
  setItemDensity: (value: FinderItemDensity) => void;
  sortBy: SortBy;
  setSortBy: (value: SortBy) => void;
  sortDirection: SortDirection;
  setSortDirection: (value: SortDirection) => void;
  folderNames: Record<string, string>;
  navigateBack: () => void;
  navigateForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  renameFile: (id: string, newName: string) => Promise<void>;
  duplicateFile: (id: string, nameOverride?: string) => Promise<void>;
  uploadFiles: (
    files: FileList | File[] | UploadSourceItem[],
    target?: CloudActionTarget
  ) => Promise<void>;
  copySelection: () => void;
  pasteIntoCurrentFolder: () => Promise<void>;
  hasClipboard: boolean;
  previewFile: CloudFile | null;
  infoFile: CloudFile | null;
  showPreview: (file: CloudFile | null) => void;
  showInfo: (file: CloudFile | null) => void;
  openInNewTab: (id: string) => void;
  selectedFiles: CloudFile[];
  connectedProviders: CloudProviderId[];
  connectedAccountsByProvider: ConnectedAccountsByProvider;
  connectionsLoaded: boolean;
  toggleFavorite: (file: CloudFile) => void;
  isFavorite: (id: string, fileProvider?: CloudProviderId | null) => boolean;
  tabs: FinderTab[];
  activeTabId: string;
  openTab: (folderId?: string, tabProvider?: CloudProviderId | null) => void;
  activateTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  openLocationRoot: (
    provider: CloudProviderId | null,
    accountId?: string | null
  ) => void;
  navigateToFolder: (folderId: string, folderProvider?: CloudProviderId | null) => void;
  moveFilesToTab: (
    fileIds: string[],
    targetTabId: string,
    sourceFolderId: string,
    sourceProvider: CloudProviderId | null
  ) => Promise<void>;
  uploadState: UploadState;
  pauseUploads: () => void;
  resumeUploads: () => void;
  cancelUploads: () => void;
}

const CloudContext = createContext<CloudContextType | undefined>(undefined);
const EMPTY_FILES: CloudFile[] = [];
const XHR_ABORTED = "__UPLOAD_ABORTED__";
const IDLE_UPLOAD_STATE: UploadState = {
  active: false,
  status: "idle",
  provider: null,
  fileCount: 0,
  currentFileName: null,
  uploadedBytes: 0,
  totalBytes: 0,
  progress: 0,
  speedBytesPerSecond: 0,
  remainingSeconds: null,
};

const IMAGE_FORMATS = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

function isCloudProvider(value: string | null | undefined): value is CloudProviderId {
  return value === "google" || value === "onedrive";
}

function getScopedFolderId(
  folderId: string,
  folderProvider?: CloudProviderId | null
) {
  if (!folderProvider || folderId === "root") {
    return folderId;
  }
  return `${folderProvider}:${folderId}`;
}

function getFolderProviderFromId(folderId: string): CloudProviderId | null {
  const separatorIndex = folderId.indexOf(":");
  if (separatorIndex <= 0) {
    return null;
  }
  const maybeProvider = folderId.slice(0, separatorIndex);
  return isCloudProvider(maybeProvider) ? maybeProvider : null;
}

function getRawFolderId(folderId: string) {
  const scopedProvider = getFolderProviderFromId(folderId);
  if (!scopedProvider) {
    return folderId;
  }
  return folderId.slice(scopedProvider.length + 1) || "root";
}

function getFolderNameKey(
  folderId: string,
  folderProvider?: CloudProviderId | null
) {
  return folderProvider ? `${folderProvider}:${folderId}` : folderId;
}

function isRootFolderId(folderId: string) {
  return getRawFolderId(folderId) === "root";
}

function getRootFolderIdForAccount(accountId?: string | null) {
  return accountId ? encodeScopedCloudItemId(accountId, "root") : "root";
}

function areConnectedAccountsEqual(
  left: ConnectedCloudAccount[],
  right: ConnectedCloudAccount[]
) {
  return (
    left.length === right.length &&
    left.every((account, index) => {
      const nextAccount = right[index];
      return (
        nextAccount &&
        account.id === nextAccount.id &&
        account.email === nextAccount.email &&
        account.connectedAt === nextAccount.connectedAt
      );
    })
  );
}

function getFileExtension(name: string) {
  const trimmed = name.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return "";
  }
  return trimmed.slice(lastDot + 1).toLowerCase();
}

function normalizeUploadRelativePath(path?: string) {
  if (!path) {
    return "";
  }

  return path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

function getUploadSourceFile(entry: File | UploadSourceItem) {
  return entry instanceof File ? entry : entry.file;
}

function getUploadSourceRelativePath(entry: File | UploadSourceItem) {
  if (entry instanceof File) {
    return normalizeUploadRelativePath(
      (entry as File & { webkitRelativePath?: string }).webkitRelativePath
    );
  }

  return normalizeUploadRelativePath(
    entry.relativePath ||
      ((entry.file as File & { webkitRelativePath?: string }).webkitRelativePath ?? "")
  );
}

function persistFavorites(
  nextFavorites: string[],
  nextFavoriteItems: FavoriteStorageMap
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("finder_favorites", JSON.stringify(nextFavorites));
  window.localStorage.setItem(
    "finder_favorite_items",
    JSON.stringify(nextFavoriteItems)
  );
}

async function loadImageFromBlob(blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () =>
        reject(new Error("Failed to decode the source image"));
      nextImage.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to generate the converted file"));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

function parseRawResponseHeaders(rawHeaders: string) {
  const headers = new Map<string, string>();
  rawHeaders
    .trim()
    .split(/[\r\n]+/)
    .forEach((line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex <= 0) {
        return;
      }
      const key = line.slice(0, separatorIndex).trim().toLowerCase();
      const value = line.slice(separatorIndex + 1).trim();
      headers.set(key, value);
    });
  return headers;
}

function uploadChunkWithXhr({
  uploadUrl,
  chunk,
  headers,
  onProgress,
  onXhrReady,
}: {
  uploadUrl: string;
  chunk: Blob;
  headers: Record<string, string>;
  onProgress: (loaded: number) => void;
  onXhrReady: (xhr: XMLHttpRequest | null) => void;
}) {
  return new Promise<{
    status: number;
    bodyText: string;
    headers: Map<string, string>;
  }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    onXhrReady(xhr);
    xhr.open("PUT", uploadUrl, true);
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded);
      }
    };
    xhr.onload = () => {
      onXhrReady(null);
      resolve({
        status: xhr.status,
        bodyText: xhr.responseText,
        headers: parseRawResponseHeaders(xhr.getAllResponseHeaders()),
      });
    };
    xhr.onerror = () => {
      onXhrReady(null);
      reject(new Error("Upload request failed"));
    };
    xhr.onabort = () => {
      onXhrReady(null);
      reject(new Error(XHR_ABORTED));
    };
    xhr.send(chunk);
  });
}

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function parseGoogleCommittedBytes(rangeHeader: string | null | undefined) {
  if (!rangeHeader) {
    return 0;
  }

  const match = rangeHeader.match(/bytes=0-(\d+)$/i);
  if (!match) {
    return 0;
  }

  return Number(match[1]) + 1;
}

function parseNextExpectedRangeStart(nextExpectedRange: string | undefined) {
  if (!nextExpectedRange) {
    return 0;
  }

  const [start] = nextExpectedRange.split("-");
  const parsed = Number(start);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function CloudProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const providerQuery = searchParams.get("provider");
  const initialProvider: CloudProviderId | null = isCloudProvider(providerQuery)
    ? providerQuery
    : null;
  const initialAccountId = searchParams.get("accountId");
  const initialFolderIdParam = searchParams.get("folderId") || "root";
  const initialFolderId =
    initialProvider && initialAccountId && initialFolderIdParam === "root"
      ? getRootFolderIdForAccount(initialAccountId)
      : initialFolderIdParam;
  const initialFolderName = searchParams.get("folderName");
  
  const [tabFiles, setTabFiles] = useState<Record<string, CloudFile[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [itemScale, setItemScale] = useState<FinderItemScale>("comfortable");
  const [itemDensity, setItemDensity] = useState<FinderItemDensity>("normal");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [folderNames, setFolderNames] = useState<Record<string, string>>(() => ({
    root: "oneflash.one",
    ...(initialFolderId !== "root" && initialFolderName && initialProvider
      ? { [getFolderNameKey(initialFolderId, initialProvider)]: initialFolderName }
      : {}),
  }));
  const [tabsState, setTabsState] = useState<FinderTabState[]>(() => [
    {
      id: "tab-root",
      provider: initialProvider,
      folderHistory: [{ folderId: initialFolderId, path: [initialFolderId] }],
      historyIndex: 0,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState("tab-root");
  const [clipboard, setClipboard] = useState<CloudFile[]>([]);
  const [previewFile, setPreviewFile] = useState<CloudFile | null>(null);
  const [infoFile, setInfoFile] = useState<CloudFile | null>(null);
  const [connectedProviders, setConnectedProviders] = useState<CloudProviderId[]>([]);
  const [connectedAccountsByProvider, setConnectedAccountsByProvider] =
    useState<ConnectedAccountsByProvider>({
      google: [],
      onedrive: [],
    });
  const [connectionsLoaded, setConnectionsLoaded] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteStorageMap>({});
  const [uploadState, setUploadState] = useState<UploadState>(IDLE_UPLOAD_STATE);
  const uploadManagerRef = useRef<DirectUploadManager | null>(null);
  const fetchRequestSequenceRef = useRef(0);
  const latestFetchTokenByTabRef = useRef<Record<string, string>>({});
  const visibleLoadingTokenRef = useRef<string | null>(null);
  const runDirectUploadQueueRef = useRef<
    ((manager: DirectUploadManager) => Promise<void>) | null
  >(null);
  const activeTab =
    tabsState.find((tab) => tab.id === activeTabId) || tabsState[0];
  const provider = activeTab?.provider ?? initialProvider;
  const currentHistoryEntry =
    activeTab?.folderHistory[activeTab.historyIndex] || {
      folderId: "root",
      path: ["root"],
    };
  const currentFolderId = currentHistoryEntry.folderId;
  const currentLocationProvider =
    provider || getFolderProviderFromId(currentFolderId);
  const currentLocationAccountId = getScopedCloudAccountId(
    getRawFolderId(currentFolderId)
  );
  const breadcrumbItems: BreadcrumbItem[] = currentHistoryEntry.path.map(
    (folderId, index) => ({
      id: folderId,
      name:
        index === 0
          ? "oneflash.one"
          : folderNames[
              getFolderNameKey(
                getRawFolderId(folderId),
                getFolderProviderFromId(folderId) || provider
              )
            ] || "Folder",
    })
  );
  const files = tabFiles[activeTabId] ?? EMPTY_FILES;
  const favoritesView = pathname === "/favorites";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedItemScale = window.localStorage.getItem("finder_item_scale");
    if (
      storedItemScale === "compact" ||
      storedItemScale === "comfortable" ||
      storedItemScale === "large"
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItemScale(storedItemScale);
    }

    const storedItemDensity = window.localStorage.getItem("finder_item_density");
    if (
      storedItemDensity === "tight" ||
      storedItemDensity === "normal" ||
      storedItemDensity === "airy"
    ) {
      setItemDensity(storedItemDensity);
    }

    const storedSortBy = window.localStorage.getItem("finder_sort_by");
    if (
      storedSortBy === "name" ||
      storedSortBy === "dateModified" ||
      storedSortBy === "size" ||
      storedSortBy === "kind"
    ) {
      setSortBy(storedSortBy as SortBy);
    }

    const storedSortDirection = window.localStorage.getItem("finder_sort_direction");
    if (storedSortDirection === "asc" || storedSortDirection === "desc") {
      setSortDirection(storedSortDirection as SortDirection);
    }

    const rawFavorites = window.localStorage.getItem("finder_favorites");
    if (rawFavorites) {
      try {
        setFavorites(JSON.parse(rawFavorites) as string[]);
      } catch {
        setFavorites([]);
      }
    }

    const rawFavoriteItems = window.localStorage.getItem("finder_favorite_items");
    if (rawFavoriteItems) {
      try {
        setFavoriteItems(JSON.parse(rawFavoriteItems) as FavoriteStorageMap);
      } catch {
        setFavoriteItems({});
      }
    }

    setPreferencesHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !preferencesHydrated) return;
    window.localStorage.setItem("finder_item_scale", itemScale);
  }, [itemScale, preferencesHydrated]);

  useEffect(() => {
    if (typeof window === "undefined" || !preferencesHydrated) return;
    window.localStorage.setItem("finder_item_density", itemDensity);
  }, [itemDensity, preferencesHydrated]);

  useEffect(() => {
    if (typeof window === "undefined" || !preferencesHydrated) return;
    window.localStorage.setItem("finder_sort_by", sortBy);
  }, [sortBy, preferencesHydrated]);

  useEffect(() => {
    if (typeof window === "undefined" || !preferencesHydrated) return;
    window.localStorage.setItem("finder_sort_direction", sortDirection);
  }, [sortDirection, preferencesHydrated]);

  const normalizeProviderFile = useCallback(
    (f: ProviderApiFile, sourceProvider: CloudProviderId): CloudFile => ({
      id: f.id,
      name: f.name,
      mimeType: resolveFileMimeType(
        f.name,
        f.mimeType || f.file?.mimeType || "application/octet-stream"
      ),
      size: typeof f.size === "number" ? String(f.size) : f.size,
      modifiedTime: f.modifiedTime || f.lastModifiedDateTime,
      provider: sourceProvider,
      accountId: f.accountId ?? getScopedCloudAccountId(f.id),
      accountEmail: f.accountEmail ?? null,
      isFolder:
        sourceProvider === "google"
          ? f.mimeType === "application/vnd.google-apps.folder"
          : !!f.folder,
      iconLink: f.iconLink,
    }),
    []
  );

  const syncUploadState = useCallback((manager: DirectUploadManager | null) => {
    if (!manager || manager.status === "canceled") {
      setUploadState(IDLE_UPLOAD_STATE);
      return;
    }

    const totalBytes = manager.tasks.reduce((sum, task) => sum + task.file.size, 0);
    const committedBytes = manager.tasks.reduce(
      (sum, task) => sum + task.committedBytes,
      0
    );
    const inflightBytes = manager.tasks.reduce(
      (sum, task) => sum + task.inflightBytes,
      0
    );
    const currentFileName =
      manager.tasks.find((task) => task.status === "running")?.file.name ||
      manager.tasks.find((task) => task.status === "pending")?.file.name ||
      null;
    const uploadedBytes = Math.min(totalBytes, committedBytes + inflightBytes);
    const progress = totalBytes > 0 ? (uploadedBytes / totalBytes) * 100 : 0;
    const remainingSeconds =
      manager.smoothedSpeed > 0 && uploadedBytes < totalBytes
        ? Math.max(0, Math.ceil((totalBytes - uploadedBytes) / manager.smoothedSpeed))
        : null;

    setUploadState({
      active: true,
      status: manager.status === "paused" ? "paused" : "running",
      provider: manager.provider,
      fileCount: manager.tasks.length,
      currentFileName,
      uploadedBytes,
      totalBytes,
      progress,
      speedBytesPerSecond: manager.smoothedSpeed,
      remainingSeconds,
    });
  }, []);

  const updateUploadMetrics = useCallback(
    (manager: DirectUploadManager) => {
      const aggregateUploaded = manager.tasks.reduce(
        (sum, task) => sum + task.committedBytes + task.inflightBytes,
        0
      );
      const now = performance.now();

      if (manager.lastSampleTime === 0) {
        manager.lastSampleTime = now;
      }

      const elapsedSeconds = (now - manager.lastSampleTime) / 1000;
      const deltaBytes = aggregateUploaded - manager.lastSampleBytes;
      const shouldRefreshSample =
        elapsedSeconds >= 0.2 || (deltaBytes > 0 && manager.smoothedSpeed === 0);

      if (shouldRefreshSample && elapsedSeconds > 0) {
        const instantSpeed = Math.max(0, deltaBytes / elapsedSeconds);
        manager.smoothedSpeed =
          manager.smoothedSpeed > 0
            ? manager.smoothedSpeed * 0.7 + instantSpeed * 0.3
            : instantSpeed;
        manager.lastSampleTime = now;
        manager.lastSampleBytes = aggregateUploaded;
      }

      syncUploadState(manager);
    },
    [syncUploadState]
  );

  const resetUploadSpeedSample = useCallback((manager: DirectUploadManager) => {
    manager.lastSampleTime = performance.now();
    manager.lastSampleBytes = manager.tasks.reduce(
      (sum, task) => sum + task.committedBytes + task.inflightBytes,
      0
    );
    manager.smoothedSpeed = 0;
  }, []);

  const registerFolderNames = useCallback((entries: CloudFile[]) => {
    setFolderNames((prev) => ({
      ...prev,
      ...Object.fromEntries(
        entries
          .filter((file) => file.isFolder)
          .map((file) => [getFolderNameKey(file.id, file.provider), file.name])
      ),
    }));
  }, []);

  const setFilesForTab = useCallback(
    (
      tabId: string,
      value: CloudFile[] | ((prev: CloudFile[]) => CloudFile[])
    ) => {
      setTabFiles((prev) => {
        const current = prev[tabId] || [];
        const nextValue =
          typeof value === "function"
            ? (value as (prev: CloudFile[]) => CloudFile[])(current)
            : value;

        return {
          ...prev,
          [tabId]: nextValue,
        };
      });
    },
    []
  );

  const beginTabFolderTransition = useCallback(
    (tabId: string) => {
      const transitionToken = `transition-${++fetchRequestSequenceRef.current}`;
      latestFetchTokenByTabRef.current[tabId] = transitionToken;
      visibleLoadingTokenRef.current = transitionToken;
      setLoading(true);
      setError(null);
      setSelection([]);
      setFilesForTab(tabId, []);
    },
    [setFilesForTab]
  );

  const favoriteFiles = favorites
    .map((favoriteKey) => {
      const stored = favoriteItems[favoriteKey];
      if (stored) {
        return stored;
      }

      const separatorIndex = favoriteKey.indexOf(":");
      const favoriteProvider = favoriteKey.slice(0, separatorIndex) as
        | "google"
        | "onedrive"
        | "all";
      const favoriteId = favoriteKey.slice(separatorIndex + 1);

      for (const [tabId, entries] of Object.entries(tabFiles)) {
        const tabProvider =
          tabsState.find((tab) => tab.id === tabId)?.provider || null;
        if (favoriteProvider !== "all" && tabProvider !== favoriteProvider) {
          continue;
        }

        const match = entries.find((file) => file.id === favoriteId);
        if (match) {
          return {
            ...match,
            provider: match.provider || tabProvider,
          };
        }
      }

      return null;
    })
    .filter((file): file is CloudFile => file !== null);

  const filesToShow = favoritesView
    ? favoriteFiles.filter(
        (file, index, list) =>
          list.findIndex(
            (entry) =>
              entry.id === file.id && entry.provider === file.provider
          ) === index
      )
    : files;

  const selectedFiles = filesToShow.filter((file) => selection.includes(file.id));

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/connections", { cache: "no-store" });
      if (!res.ok) return [] as CloudProviderId[];
      const data = await res.json();
      const list: CloudProviderId[] = [];
      if (data?.providers?.google?.connected) list.push("google");
      if (data?.providers?.onedrive?.connected) list.push("onedrive");
      setConnectedProviders((prev) =>
        prev.length === list.length &&
        prev.every((entry, index) => entry === list[index])
          ? prev
          : list
      );
      const nextAccountsByProvider: ConnectedAccountsByProvider = {
        google: Array.isArray(data?.providers?.google?.accounts)
          ? (data.providers.google.accounts as ConnectedCloudAccount[])
          : [],
        onedrive: Array.isArray(data?.providers?.onedrive?.accounts)
          ? (data.providers.onedrive.accounts as ConnectedCloudAccount[])
          : [],
      };
      setConnectedAccountsByProvider((prev) =>
        areConnectedAccountsEqual(prev.google, nextAccountsByProvider.google) &&
        areConnectedAccountsEqual(prev.onedrive, nextAccountsByProvider.onedrive)
          ? prev
          : nextAccountsByProvider
      );
      setConnectionsLoaded(true);
      return list;
    } catch {
      return [] as CloudProviderId[];
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConnections();
  }, [fetchConnections]);

  const fetchFiles = useCallback(async (options?: FetchFilesOptions) => {
    const {
      silent = false,
      preserveSelection = false,
      targetTabId = activeTabId,
      targetProvider,
      targetFolderId = currentFolderId,
    } = options || {};
    const scopedProvider = getFolderProviderFromId(targetFolderId);
    const hasExplicitTargetProvider =
      options !== undefined &&
      Object.prototype.hasOwnProperty.call(options, "targetProvider");
    const resolvedProvider = hasExplicitTargetProvider
      ? targetProvider ?? null
      : provider ?? scopedProvider;
    const resolvedFolderId = getRawFolderId(targetFolderId);
    const requestToken = `fetch-${++fetchRequestSequenceRef.current}`;
    latestFetchTokenByTabRef.current[targetTabId] = requestToken;
    const isCurrentRequest = () =>
      latestFetchTokenByTabRef.current[targetTabId] === requestToken;

    if (!silent) {
      visibleLoadingTokenRef.current = requestToken;
      setLoading(true);
    }
    setError(null);
    try {
      if (!resolvedProvider && resolvedFolderId === "root") {
        const latestConnections =
          connectedProviders.length > 0 ? connectedProviders : await fetchConnections();

        if (!isCurrentRequest()) {
          return;
        }

        if (latestConnections.length === 0) {
          if (!isCurrentRequest()) {
            return;
          }
          setFilesForTab(targetTabId, []);
          if (!preserveSelection && targetTabId === activeTabId) {
            setSelection([]);
          }
          return;
        }

        const providerResponses = await Promise.all(
          latestConnections.map(async (entryProvider) => {
            const res = await fetch(`/api/cloud/${entryProvider}/files?folderId=root`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              const message = String(data?.error || "Failed to fetch files");
              const isNotConnected =
                res.status === 400 &&
                message.toLowerCase().includes("not connected");
              if (isNotConnected) {
                return [] as CloudFile[];
              }
              throw new Error(message);
            }
            return (data.files as ProviderApiFile[]).map((file) =>
              normalizeProviderFile(file, entryProvider)
            );
          })
        );

        const mergedFiles = providerResponses
          .flat()
          .sort((left, right) => {
            if (left.isFolder !== right.isFolder) {
              return left.isFolder ? -1 : 1;
            }
            return left.name.localeCompare(right.name);
          });
        if (!isCurrentRequest()) {
          return;
        }
        setFilesForTab(targetTabId, mergedFiles);
        if (!preserveSelection && targetTabId === activeTabId) {
          setSelection([]);
        }
        registerFolderNames(mergedFiles);
        return;
      }

      if (!resolvedProvider) {
        if (!isCurrentRequest()) {
          return;
        }
        setFilesForTab(targetTabId, []);
        return;
      }

      const res = await fetch(
        `/api/cloud/${resolvedProvider}/files?folderId=${encodeURIComponent(
          resolvedFolderId
        )}`
      );
      const data = await res.json();

      if (!res.ok) {
        const message = String(data?.error || "Failed to fetch files");
        const isNotConnected =
          res.status === 400 &&
          (message.toLowerCase().includes("not connected") ||
            message.toLowerCase().includes("google drive not connected") ||
            message.toLowerCase().includes("onedrive not connected"));

        if (isNotConnected) {
          setFilesForTab(targetTabId, []);
          setError(null);
          if (!preserveSelection && targetTabId === activeTabId) setSelection([]);
          return;
        }

        throw new Error(message);
      }

      const formattedFiles: CloudFile[] = (data.files as ProviderApiFile[]).map((file) =>
        normalizeProviderFile(file, resolvedProvider)
      );

      if (!isCurrentRequest()) {
        return;
      }
      setFilesForTab(targetTabId, formattedFiles);
      if (!preserveSelection && targetTabId === activeTabId) {
        setSelection([]);
      }
      registerFolderNames(formattedFiles);
    } catch (err: unknown) {
      if (!isCurrentRequest()) {
        return;
      }
      setError(err instanceof Error ? err.message : "An error occurred");
      if (!silent) {
        setFilesForTab(targetTabId, []);
      }
    } finally {
      if (!silent && visibleLoadingTokenRef.current === requestToken) {
        setLoading(false);
      }
    }
  }, [
    activeTabId,
    provider,
    currentFolderId,
    fetchConnections,
    connectedProviders,
    normalizeProviderFile,
    registerFolderNames,
    setFilesForTab,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFiles();
  }, [fetchFiles]);

  const navigateToFolder = (
    folderId: string,
    folderProvider?: CloudProviderId | null
  ) => {
    const nextFolderId =
      !provider && folderProvider
        ? getScopedFolderId(folderId, folderProvider)
        : folderId;
    if (nextFolderId === currentHistoryEntry.folderId) {
      return;
    }
    beginTabFolderTransition(activeTabId);
    setTabsState((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        const currentEntry = tab.folderHistory[tab.historyIndex] || {
          folderId: "root",
          path: ["root"],
        };
        const nextPath =
          nextFolderId === "root"
            ? ["root"]
            : [...currentEntry.path, nextFolderId];
        const nextEntry = { folderId: nextFolderId, path: nextPath };
        const next = [
          ...tab.folderHistory.slice(0, tab.historyIndex + 1),
          nextEntry,
        ];
        return {
          ...tab,
          folderHistory: next,
          historyIndex: next.length - 1,
        };
      })
    );
  };

  const openLocationRoot = useCallback(
    (
      nextProvider: CloudProviderId | null,
      nextAccountId: string | null = null
    ) => {
      const nextFolderId =
        nextProvider === null ? "root" : getRootFolderIdForAccount(nextAccountId);

      if (
        nextProvider === provider &&
        nextFolderId === currentHistoryEntry.folderId &&
        currentHistoryEntry.path.length === 1
      ) {
        return;
      }

      beginTabFolderTransition(activeTabId);
      setTabsState((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId
            ? {
                ...tab,
                provider: nextProvider,
                folderHistory: [
                  {
                    folderId: nextFolderId,
                    path: [nextFolderId],
                  },
                ],
                historyIndex: 0,
              }
            : tab
        )
      );
      setPreviewFile(null);
      setInfoFile(null);
    },
    [
      activeTabId,
      beginTabFolderTransition,
      currentHistoryEntry.folderId,
      currentHistoryEntry.path.length,
      provider,
    ]
  );

  const navigateToBreadcrumb = (index: number) => {
    const nextPath = currentHistoryEntry.path.slice(0, index + 1);
    const nextFolderId = nextPath[nextPath.length - 1] || "root";
    if (nextFolderId === currentHistoryEntry.folderId) {
      return;
    }
    beginTabFolderTransition(activeTabId);
    setTabsState((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        const nextEntry = {
          folderId: nextFolderId,
          path: nextPath,
        };
        return {
          ...tab,
          folderHistory: [
            ...tab.folderHistory.slice(0, tab.historyIndex + 1),
            nextEntry,
          ],
          historyIndex: tab.historyIndex + 1,
        };
      })
    );
  };

  const navigateBack = () => {
    if (!activeTab || activeTab.historyIndex === 0) {
      return;
    }
    beginTabFolderTransition(activeTabId);
    setTabsState((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId
          ? { ...tab, historyIndex: Math.max(0, tab.historyIndex - 1) }
          : tab
      )
    );
  };
  const navigateForward = () => {
    if (!activeTab || activeTab.historyIndex >= activeTab.folderHistory.length - 1) {
      return;
    }
    beginTabFolderTransition(activeTabId);
    setTabsState((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId
          ? {
              ...tab,
              historyIndex: Math.min(tab.folderHistory.length - 1, tab.historyIndex + 1),
            }
          : tab
      )
    );
  };
  const navigateUp = () => {
    if (currentHistoryEntry.path.length <= 1) return;
    navigateToBreadcrumb(currentHistoryEntry.path.length - 2);
  };

  const clearSelection = () => setSelection([]);

  const resolveActionTarget = useCallback(
    (target?: CloudActionTarget) => {
      const targetProvider = target?.provider ?? currentLocationProvider;
      if (!targetProvider) {
        return null;
      }

      const targetFolderId =
        target?.folderId ??
        (target?.accountId && getRawFolderId(currentFolderId) === "root"
          ? getRootFolderIdForAccount(target.accountId)
          : getRawFolderId(currentFolderId));
      const targetAccountId =
        target?.accountId ?? getScopedCloudAccountId(targetFolderId);

      return {
        provider: targetProvider,
        folderId: targetFolderId,
        accountId: targetAccountId ?? null,
      };
    },
    [currentFolderId, currentLocationProvider]
  );

  const createFolder = async (name: string, target?: CloudActionTarget) => {
    const resolvedTarget = resolveActionTarget(target);
    if (!resolvedTarget) return;
    const {
      provider: targetProvider,
      folderId: targetFolderId,
      accountId: targetAccountId,
    } = resolvedTarget;
    const trimmed = name.trim() || "New Folder";
    const tempId = `temp-folder-${Date.now()}`;
    const optimisticFolder: CloudFile = {
      id: tempId,
      name: trimmed,
      mimeType:
        targetProvider === "google"
          ? "application/vnd.google-apps.folder"
          : "application/vnd.oneflash.folder",
      provider: targetProvider,
      accountId: targetAccountId,
      isFolder: true,
      modifiedTime: new Date().toISOString(),
    };

    setFilesForTab(activeTabId, (prev) => [optimisticFolder, ...prev]);
    registerFolderNames([optimisticFolder]);
    try {
      const res = await fetch(`/api/cloud/${targetProvider}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          parentId: targetFolderId === "root" ? undefined : targetFolderId,
          accountId: targetAccountId ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create folder");

      const createdFolder = normalizeProviderFile(
        data.folder as ProviderApiFile,
        targetProvider
      );
      setFilesForTab(activeTabId, (prev) =>
        prev.map((file) => (file.id === tempId ? createdFolder : file))
      );
      registerFolderNames([createdFolder]);
      void fetchFiles({ silent: true, preserveSelection: true });
    } catch (err: unknown) {
      setFilesForTab(activeTabId, (prev) =>
        prev.filter((file) => file.id !== tempId)
      );
      setError(err instanceof Error ? err.message : "Failed to create folder");
    }
  };

  const deleteFiles = useCallback(async (ids: string[]) => {
    if (!currentLocationProvider || ids.length === 0) return;
    const idsToDelete = [...ids];
    const previousFiles = files;
    setFilesForTab(activeTabId, (prev) =>
      prev.filter((file) => !idsToDelete.includes(file.id))
    );
    setSelection([]);
    try {
      for (const fileId of idsToDelete) {
        const res = await fetch(`/api/cloud/${currentLocationProvider}/files`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId }),
        });
        if (!res.ok) throw new Error("Failed to delete some files");
      }
      void fetchFiles({ silent: true, preserveSelection: true });
    } catch (err: unknown) {
      setFilesForTab(activeTabId, previousFiles);
      setSelection(idsToDelete);
      setError(err instanceof Error ? err.message : "Failed to delete files");
    }
  }, [currentLocationProvider, files, activeTabId, setFilesForTab, fetchFiles]);

  const deleteSelected = async () => {
    if (selection.length === 0) return;
    await deleteFiles(selection);
  };

  const syncFavoriteItem = (
    previousFile: CloudFile,
    nextFile: CloudFile,
    nextProvider: CloudProviderId | null
  ) => {
    if (!nextProvider) return;

    const previousKey = `${nextProvider}:${previousFile.id}`;
    if (!favorites.includes(previousKey)) {
      return;
    }

    const nextKey = `${nextProvider}:${nextFile.id}`;
    const nextFavorites = favorites.map((key) =>
      key === previousKey ? nextKey : key
    );
    const nextFavoriteItems = { ...favoriteItems };
    delete nextFavoriteItems[previousKey];
    nextFavoriteItems[nextKey] = {
      ...nextFile,
      provider: nextProvider,
    };

    setFavorites(nextFavorites);
    setFavoriteItems(nextFavoriteItems);
    persistFavorites(nextFavorites, nextFavoriteItems);
  };

  const deleteRemoteFile = async (
    targetProvider: CloudProviderId,
    fileId: string
  ) => {
    const response = await fetch(`/api/cloud/${targetProvider}/files`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || "Delete failed");
    }
  };

  const uploadFileViaAppRoute = useCallback(async (
    targetProvider: CloudProviderId,
    file: File,
    targetFolderId: string
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folderId", targetFolderId);

    const response = await fetch(`/api/cloud/${targetProvider}/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Upload failed");
    }

    return normalizeProviderFile(data.file as ProviderApiFile, targetProvider);
  }, [normalizeProviderFile]);

  const createDirectUploadSession = useCallback(async (
    targetProvider: CloudProviderId,
    file: File,
    folderId: string
  ) => {
    const response = await fetch(`/api/cloud/${targetProvider}/upload-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        mimeType: resolveFileMimeType(file.name, file.type),
        size: file.size,
        folderId,
        accountId: getScopedCloudAccountId(folderId),
      }),
    });
    const data = (await response.json().catch(() => null)) as
      | UploadSessionPayload
      | { error?: string }
      | null;

    if (!response.ok || !data || !("uploadUrl" in data) || !data.uploadUrl) {
      throw new Error(
        (data && "error" in data && data.error) || "Failed to create upload session"
      );
    }

    return data;
  }, []);

  const ensureDirectUploadSession = useCallback(async (task: DirectUploadTask) => {
    if (task.uploadUrl) {
      return task.uploadUrl;
    }

    if (!task.sessionPromise) {
      task.sessionPromise = createDirectUploadSession(
        task.provider,
        task.file,
        task.targetFolderId
      )
        .then((session) => {
          task.uploadUrl = session.uploadUrl;
          return session;
        })
        .catch((error) => {
          task.sessionPromise = null;
          throw error;
        });
    }

    const session = await task.sessionPromise;
    return session.uploadUrl;
  }, [createDirectUploadSession]);

  const warmUploadSessions = useCallback((manager: DirectUploadManager) => {
    if (manager.status !== "running" || manager.sessionPrewarmLimit <= 0) {
      return;
    }

    let warmedTaskCount = manager.tasks.filter(
      (task) =>
        task.file.size > 0 &&
        task.status !== "completed" &&
        (task.uploadUrl || task.sessionPromise)
    ).length;

    if (warmedTaskCount >= manager.sessionPrewarmLimit) {
      return;
    }

    for (const task of manager.tasks) {
      if (manager.status !== "running" || warmedTaskCount >= manager.sessionPrewarmLimit) {
        return;
      }

      if (
        task.file.size === 0 ||
        task.status === "completed" ||
        task.uploadUrl ||
        task.sessionPromise
      ) {
        continue;
      }

      warmedTaskCount += 1;
      void ensureDirectUploadSession(task).catch(() => {
        // The worker will surface the real error when it reaches this task.
      });
    }
  }, [ensureDirectUploadSession]);

  const verifyUploadedFileInFolder = useCallback(async (
    targetProvider: CloudProviderId,
    folderId: string,
    file: File
  ) => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(
        `/api/cloud/${targetProvider}/files?folderId=${encodeURIComponent(folderId)}`,
        { cache: "no-store" }
      );
      const data = (await response.json().catch(() => null)) as
        | { files?: ProviderApiFile[] }
        | null;

      if (response.ok && Array.isArray(data?.files)) {
        const matchingFiles = data.files
          .map((entry) => normalizeProviderFile(entry, targetProvider))
          .filter((entry) => {
            const entrySize = entry.size ? Number(entry.size) : 0;
            return (
              !entry.isFolder &&
              entry.name === file.name &&
              entrySize === file.size
            );
          })
          .sort((left, right) => {
            const leftTime = left.modifiedTime ? Date.parse(left.modifiedTime) : 0;
            const rightTime = right.modifiedTime ? Date.parse(right.modifiedTime) : 0;
            return rightTime - leftTime;
          });

        if (matchingFiles[0]) {
          return matchingFiles[0];
        }
      }

      await delay(350 * (attempt + 1));
    }

    return null;
  }, [normalizeProviderFile]);

  const ensureUploadFolderPath = useCallback(async (
    targetProvider: CloudProviderId,
    rootFolderId: string,
    folderSegments: string[]
  ) => {
    let currentFolderId = rootFolderId;

    for (const segment of folderSegments) {
      const response = await fetch(
        `/api/cloud/${targetProvider}/files?folderId=${encodeURIComponent(currentFolderId)}`,
        { cache: "no-store" }
      );
      const data = (await response.json().catch(() => null)) as
        | { files?: ProviderApiFile[]; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to inspect upload folder");
      }

      const existingFolder = (data?.files || [])
        .map((entry) => normalizeProviderFile(entry, targetProvider))
        .find((entry) => entry.isFolder && entry.name === segment);

      if (existingFolder) {
        currentFolderId = existingFolder.id;
        continue;
      }

      const createResponse = await fetch(`/api/cloud/${targetProvider}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: segment,
          parentId: currentFolderId === "root" ? undefined : currentFolderId,
        }),
      });
      const createData = (await createResponse.json().catch(() => null)) as
        | { folder?: ProviderApiFile; error?: string }
        | null;

      if (!createResponse.ok || !createData?.folder) {
        throw new Error(createData?.error || "Failed to create upload folder");
      }

      currentFolderId = normalizeProviderFile(createData.folder, targetProvider).id;
    }

    return currentFolderId;
  }, [normalizeProviderFile]);

  const syncTaskProgressFromSession = useCallback(async (
    task: DirectUploadTask,
    folderId: string
  ) => {
    if (!task.uploadUrl || task.status === "completed") {
      return null;
    }

    if (task.provider === "google") {
      const response = await fetch(task.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Range": `bytes */${task.file.size}`,
        },
      });

      if (response.status === 308) {
        task.committedBytes = parseGoogleCommittedBytes(
          response.headers.get("Range")
        );
        return null;
      }

      if (response.status === 200 || response.status === 201) {
        const bodyText = await response.text();
        const uploadedFile = bodyText.trim()
          ? normalizeProviderFile(
              JSON.parse(bodyText) as ProviderApiFile,
              task.provider
            )
          : await verifyUploadedFileInFolder(task.provider, folderId, task.file);
        if (uploadedFile) {
          task.committedBytes = task.file.size;
          task.status = "completed";
          return uploadedFile;
        }
      }

      return null;
    }

    const response = await fetch(task.uploadUrl, {
      method: "GET",
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json().catch(() => null)) as
      | { nextExpectedRanges?: string[] }
      | null;

    const nextExpectedRange = data?.nextExpectedRanges?.[0];
    task.committedBytes = parseNextExpectedRangeStart(nextExpectedRange);

    if (task.committedBytes >= task.file.size) {
      const uploadedFile = await verifyUploadedFileInFolder(
        task.provider,
        folderId,
        task.file
      );
      if (uploadedFile) {
        task.committedBytes = task.file.size;
        task.status = "completed";
        return uploadedFile;
      }
    }

    return null;
  }, [normalizeProviderFile, verifyUploadedFileInFolder]);

  const runDirectUploadQueue = useCallback(async (manager: DirectUploadManager) => {
    if (manager.isProcessing || manager.status !== "running") {
      return;
    }

    uploadManagerRef.current = manager;
    manager.isProcessing = true;
    syncUploadState(manager);
    warmUploadSessions(manager);

    try {
      const getNextTask = () => {
        const nextTask = manager.tasks.find((task) => task.status === "pending");
        if (!nextTask) {
          return null;
        }
        nextTask.status = "running";
        return nextTask;
      };

      const runTask = async (task: DirectUploadTask) => {
        syncUploadState(manager);

        const completeTask = (uploadedFile: CloudFile) => {
          task.committedBytes = task.file.size;
          task.inflightBytes = 0;
          task.status = "completed";
          if (task.optimisticId) {
            setFilesForTab(manager.tabId, (prev) =>
              prev.map((entry) => (entry.id === task.optimisticId ? uploadedFile : entry))
            );
          }
          updateUploadMetrics(manager);
        };

        if (task.file.size === 0) {
          const uploadedFile = await uploadFileViaAppRoute(
            task.provider,
            task.file,
            task.targetFolderId
          );
          completeTask(uploadedFile);
          return;
        }

        await ensureDirectUploadSession(task);
        warmUploadSessions(manager);

        while (task.committedBytes < task.file.size) {
          if (manager.status !== "running" || !task.uploadUrl) {
            syncUploadState(manager);
            return;
          }

          const chunkStart = task.committedBytes;
          const chunkEndExclusive = Math.min(
            chunkStart + task.chunkSize,
            task.file.size
          );
          const chunk = task.file.slice(chunkStart, chunkEndExclusive);

          task.inflightBytes = 0;
          updateUploadMetrics(manager);

          let response: {
            status: number;
            bodyText: string;
            headers: Map<string, string>;
          };
          try {
            response = await uploadChunkWithXhr({
              uploadUrl: task.uploadUrl,
              chunk,
              headers: {
                "Content-Type": task.file.type || "application/octet-stream",
                "Content-Range": `bytes ${chunkStart}-${chunkEndExclusive - 1}/${task.file.size}`,
              },
              onProgress: (loaded) => {
                task.inflightBytes = loaded;
                updateUploadMetrics(manager);
              },
              onXhrReady: (xhr) => {
                if (xhr && task.optimisticId) {
                  manager.activeXhrs.set(task.optimisticId, xhr);
                } else if (task.optimisticId) {
                  manager.activeXhrs.delete(task.optimisticId);
                }
              },
            });
          } catch (error) {
            if (task.optimisticId) {
              manager.activeXhrs.delete(task.optimisticId);
            }
            task.inflightBytes = 0;
            const currentStatus = uploadManagerRef.current?.status;
            if (
              error instanceof Error &&
              error.message === XHR_ABORTED &&
              (currentStatus === "paused" || currentStatus === "canceled")
            ) {
              task.status = currentStatus === "paused" ? "pending" : task.status;
              updateUploadMetrics(manager);
              return;
            }

            const isFinalChunk = chunkEndExclusive >= task.file.size;
            if (isFinalChunk) {
              const recoveredFile = await verifyUploadedFileInFolder(
                task.provider,
                task.targetFolderId,
                task.file
              );
              if (recoveredFile) {
                completeTask(recoveredFile);
                return;
              }
            }

            throw error;
          }

          if (task.optimisticId) {
            manager.activeXhrs.delete(task.optimisticId);
          }
          task.inflightBytes = 0;

          if (task.provider === "google") {
            if (response.status === 308) {
              task.committedBytes = chunkEndExclusive;
              updateUploadMetrics(manager);
              continue;
            }

            if (response.status === 200 || response.status === 201) {
              const uploadedFile = response.bodyText.trim()
                ? normalizeProviderFile(
                    JSON.parse(response.bodyText) as ProviderApiFile,
                    task.provider
                  )
                : await verifyUploadedFileInFolder(
                  task.provider,
                  task.targetFolderId,
                  task.file
                );
              if (!uploadedFile) {
                throw new Error("Upload completed but the file metadata could not be confirmed");
              }
              completeTask(uploadedFile);
              return;
            }
          } else {
            if (response.status === 202) {
              task.committedBytes = chunkEndExclusive;
              updateUploadMetrics(manager);
              continue;
            }

            if (response.status === 200 || response.status === 201) {
              const uploadedFile = response.bodyText.trim()
                ? normalizeProviderFile(
                    JSON.parse(response.bodyText) as ProviderApiFile,
                    task.provider
                  )
                : await verifyUploadedFileInFolder(
                  task.provider,
                  task.targetFolderId,
                  task.file
                );
              if (!uploadedFile) {
                throw new Error("Upload completed but the file metadata could not be confirmed");
              }
              completeTask(uploadedFile);
              return;
            }
          }

          let message = "Upload failed";
          try {
            const parsed = JSON.parse(response.bodyText) as { error?: { message?: string } };
            message = parsed.error?.message || message;
          } catch {
            if (response.bodyText.trim()) {
              message = response.bodyText;
            }
          }
          throw new Error(message);
        }
      };

      const workerCount = Math.min(manager.maxParallelUploads, manager.tasks.length);
      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (manager.status === "running") {
            const task = getNextTask();
            if (!task) {
              return;
            }
            await runTask(task);
          }
        })
      );

      manager.isProcessing = false;
      const currentStatus = uploadManagerRef.current?.status ?? manager.status;

      if (currentStatus === "canceled") {
        uploadManagerRef.current = null;
        setUploadState(IDLE_UPLOAD_STATE);
        return;
      }

      if (currentStatus === "paused") {
        syncUploadState(manager);
        if (manager.resumeRequested) {
          manager.resumeRequested = false;
          manager.status = "running";
          resetUploadSpeedSample(manager);
          syncUploadState(manager);
          void runDirectUploadQueueRef.current?.(manager);
        }
        return;
      }

      const allCompleted = manager.tasks.every((task) => task.status === "completed");
      if (!allCompleted) {
        syncUploadState(manager);
        return;
      }

      uploadManagerRef.current = null;
      setUploadState(IDLE_UPLOAD_STATE);
      void fetchFiles({
        silent: true,
        preserveSelection: true,
        targetTabId: manager.tabId,
        targetProvider: manager.refreshProvider,
        targetFolderId: manager.folderId,
      });
    } catch (err: unknown) {
      manager.isProcessing = false;
      manager.status = "canceled";
      manager.activeXhrs.forEach((xhr) => xhr.abort());
      manager.activeXhrs.clear();
      const optimisticIds = manager.tasks
        .map((task) => task.optimisticId)
        .filter((value): value is string => Boolean(value));
      setFilesForTab(manager.tabId, (prev) =>
        prev.filter((file) => !optimisticIds.includes(file.id))
      );
      uploadManagerRef.current = null;
      setUploadState(IDLE_UPLOAD_STATE);
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }, [
    fetchFiles,
    normalizeProviderFile,
    resetUploadSpeedSample,
    setFilesForTab,
    syncUploadState,
    updateUploadMetrics,
    ensureDirectUploadSession,
    uploadFileViaAppRoute,
    verifyUploadedFileInFolder,
    warmUploadSessions,
  ]);

  useEffect(() => {
    runDirectUploadQueueRef.current = runDirectUploadQueue;
  }, [runDirectUploadQueue]);

  const pauseUploads = useCallback(() => {
    const manager = uploadManagerRef.current;
    if (!manager || manager.status !== "running") {
      return;
    }

    manager.status = "paused";
    manager.activeXhrs.forEach((xhr) => xhr.abort());
    manager.activeXhrs.clear();
    const tasksToSync = manager.tasks.filter(
      (task) => task.uploadUrl && task.status !== "completed"
    );
    manager.tasks.forEach((task) => {
      task.inflightBytes = 0;
      if (task.status === "running") {
        task.status = "pending";
      }
    });

    void Promise.all(
      tasksToSync.map(async (task) => {
        try {
          const uploadedFile = await syncTaskProgressFromSession(
            task,
            task.targetFolderId
          );
          if (uploadedFile && task.optimisticId) {
            setFilesForTab(manager.tabId, (prev) =>
              prev.map((entry) =>
                entry.id === task.optimisticId ? uploadedFile : entry
              )
            );
          }
        } catch {
          // Best-effort sync. Resume can still continue from the last confirmed chunk.
        }
      })
    ).finally(() => {
      updateUploadMetrics(manager);
      syncUploadState(manager);
    });
  }, [setFilesForTab, syncTaskProgressFromSession, syncUploadState, updateUploadMetrics]);

  const resumeUploads = useCallback(() => {
    const manager = uploadManagerRef.current;
    if (!manager || manager.status !== "paused") {
      return;
    }

    if (manager.isProcessing) {
      manager.resumeRequested = true;
      return;
    }

    manager.status = "running";
    resetUploadSpeedSample(manager);
    syncUploadState(manager);
    void runDirectUploadQueue(manager);
  }, [resetUploadSpeedSample, runDirectUploadQueue, syncUploadState]);

  const cancelUploads = useCallback(() => {
    const manager = uploadManagerRef.current;
    if (!manager) {
      return;
    }

    manager.status = "canceled";
    manager.activeXhrs.forEach((xhr) => xhr.abort());
    manager.activeXhrs.clear();
    manager.tasks.forEach((task) => {
      task.inflightBytes = 0;
    });

    const optimisticIds = manager.tasks
      .map((task) => task.optimisticId)
      .filter((value): value is string => Boolean(value));
    setFilesForTab(manager.tabId, (prev) =>
      prev.filter((file) => !optimisticIds.includes(file.id))
    );
    uploadManagerRef.current = null;
    setUploadState(IDLE_UPLOAD_STATE);
  }, [setFilesForTab]);

  const convertImageRename = async (
    sourceFile: CloudFile,
    nextName: string,
    targetProvider: CloudProviderId
  ) => {
    if (favoritesView) {
      throw new Error("Open the file from its folder before converting its format");
    }

    const targetExtension = getFileExtension(nextName);
    const targetMimeType = IMAGE_FORMATS[targetExtension as keyof typeof IMAGE_FORMATS];
    if (!targetMimeType) {
      throw new Error("Only JPG, PNG and WEBP conversions are supported");
    }

    const response = await fetch(
      `/api/cloud/${targetProvider}/open?fileId=${encodeURIComponent(sourceFile.id)}`
    );
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || "Failed to read the source file");
    }

    const sourceBlob = await response.blob();
    const decodedImage = await loadImageFromBlob(sourceBlob);
    const canvas = document.createElement("canvas");
    canvas.width = decodedImage.naturalWidth;
    canvas.height = decodedImage.naturalHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas is not available in this browser");
    }

    if (targetMimeType === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.drawImage(decodedImage, 0, 0, canvas.width, canvas.height);

    const convertedBlob = await canvasToBlob(
      canvas,
      targetMimeType,
      targetMimeType === "image/jpeg" || targetMimeType === "image/webp"
        ? 0.92
        : undefined
    );

    const convertedUpload = new File([convertedBlob], nextName, {
      type: targetMimeType,
      lastModified: Date.now(),
    });

    const uploadedFile = await uploadFileViaAppRoute(
      targetProvider,
      convertedUpload,
      getRawFolderId(currentFolderId)
    );

    try {
      await deleteRemoteFile(targetProvider, sourceFile.id);
    } catch (error) {
      try {
        await deleteRemoteFile(targetProvider, uploadedFile.id);
      } catch {
        // Best-effort cleanup. The original error is the actionable one.
      }
      throw error;
    }

    return uploadedFile;
  };

  const renameFile = async (id: string, newName: string) => {
    const sourceFile = filesToShow.find((file) => file.id === id);
    const targetProvider = sourceFile?.provider || currentLocationProvider;
    if (!targetProvider || !sourceFile) return;

    const trimmed = newName.trim();
    if (!trimmed) return;

    const previousExtension = getFileExtension(sourceFile.name);
    const nextExtension = getFileExtension(trimmed);
    const previousMappedMime =
      IMAGE_FORMATS[previousExtension as keyof typeof IMAGE_FORMATS];
    const nextMappedMime = IMAGE_FORMATS[nextExtension as keyof typeof IMAGE_FORMATS];
    const changedImageExtension =
      !sourceFile.isFolder &&
      sourceFile.mimeType.startsWith("image/") &&
      Boolean(previousExtension) &&
      Boolean(nextExtension) &&
      previousExtension !== nextExtension;
    const needsImageConversion =
      changedImageExtension &&
      Boolean(previousMappedMime) &&
      Boolean(nextMappedMime) &&
      previousMappedMime !== nextMappedMime;

    const previousFiles = files;
    const previousFolderNames = folderNames;

    setFilesForTab(activeTabId, (prev) =>
      prev.map((file) =>
        file.id === id
          ? {
              ...file,
              name: trimmed,
              mimeType: needsImageConversion
                ? nextMappedMime || file.mimeType
                : file.mimeType,
            }
          : file
      )
    );
    setFolderNames((prev) => {
      const folderNameKey = getFolderNameKey(id, targetProvider);
      return prev[folderNameKey] ? { ...prev, [folderNameKey]: trimmed } : prev;
    });

    try {
      if (
        changedImageExtension &&
        (!previousMappedMime || !nextMappedMime)
      ) {
        throw new Error("Only JPG, JPEG, PNG and WEBP image conversions are supported");
      }

      if (needsImageConversion) {
        const convertedFile = await convertImageRename(
          sourceFile,
          trimmed,
          targetProvider
        );
        setFilesForTab(activeTabId, (prev) =>
          prev.map((file) => (file.id === id ? convertedFile : file))
        );
        setSelection((prev) => prev.map((entry) => (entry === id ? convertedFile.id : entry)));
        syncFavoriteItem(sourceFile, convertedFile, targetProvider);
        registerFolderNames([convertedFile]);
      } else {
        const res = await fetch(`/api/cloud/${targetProvider}/files`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: id, newName: trimmed }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Rename failed");
        if (data.file) {
        const updatedFile = normalizeProviderFile(
          data.file as ProviderApiFile,
          targetProvider
        );
          setFilesForTab(activeTabId, (prev) =>
            prev.map((file) => (file.id === id ? updatedFile : file))
          );
          syncFavoriteItem(sourceFile, updatedFile, targetProvider);
          registerFolderNames([updatedFile]);
        }
      }
      void fetchFiles({ silent: true, preserveSelection: true });
    } catch (err: unknown) {
      setFilesForTab(activeTabId, previousFiles);
      setFolderNames(previousFolderNames);
      setError(err instanceof Error ? err.message : "Rename failed");
    }
  };

  const duplicateFile = async (id: string, nameOverride?: string) => {
    if (!currentLocationProvider) return;
    const source = files.find((file) => file.id === id);
    if (!source) return;
    const copyName = (nameOverride || `${source.name} copy`).trim();
    const tempId = `temp-copy-${Date.now()}-${id}`;
    const optimisticCopy: CloudFile = {
      ...source,
      id: tempId,
      name: copyName,
      modifiedTime: new Date().toISOString(),
    };

    setFilesForTab(activeTabId, (prev) => [optimisticCopy, ...prev]);
    try {
      const res = await fetch(`/api/cloud/${currentLocationProvider}/files`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "duplicate",
          fileId: id,
          newName: copyName,
          parentId: getRawFolderId(currentFolderId),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Duplicate failed");
      if (data.file) {
          const duplicatedFile = normalizeProviderFile(
            data.file as ProviderApiFile,
            currentLocationProvider
          );
        setFilesForTab(activeTabId, (prev) =>
          prev.map((file) => (file.id === tempId ? duplicatedFile : file))
        );
        registerFolderNames([duplicatedFile]);
      } else {
        setFilesForTab(activeTabId, (prev) =>
          prev.filter((file) => file.id !== tempId)
        );
      }
      void fetchFiles({ silent: true, preserveSelection: true });
    } catch (err: unknown) {
      setFilesForTab(activeTabId, (prev) =>
        prev.filter((file) => file.id !== tempId)
      );
      setError(err instanceof Error ? err.message : "Duplicate failed");
    }
  };

  const uploadFiles = async (
    list: FileList | File[] | UploadSourceItem[],
    target?: CloudActionTarget
  ) => {
    const resolvedTarget = resolveActionTarget(target);
    if (!resolvedTarget) return;
    const {
      provider: targetProvider,
      folderId: targetFolderId,
      accountId: targetAccountId,
    } = resolvedTarget;
    if (uploadManagerRef.current) {
      setError("Finish, pause, or cancel the current upload before starting another one");
      return;
    }
    const rawItems = Array.isArray(list) ? list : Array.from(list);
    const items = await Promise.all(
      rawItems.map(async (entry) => {
        const sourceFile = getUploadSourceFile(entry);
        const sniffedMimeType = await sniffMimeTypeFromFile(sourceFile).catch(() => null);
        const resolvedMimeType = resolveFileMimeType(
          sourceFile.name,
          sourceFile.type || sniffedMimeType
        );
        const extension = inferExtensionFromMimeType(resolvedMimeType);
        const nextName =
          !hasFileExtension(sourceFile.name) && extension
            ? `${sourceFile.name}.${extension}`
            : sourceFile.name;
        const relativePath = getUploadSourceRelativePath(entry);
        const pathSegments = relativePath.split("/").filter(Boolean);
        const folderSegments =
          pathSegments.length > 1 ? pathSegments.slice(0, -1) : [];

        const file =
          nextName === sourceFile.name && resolvedMimeType === (sourceFile.type || "")
            ? sourceFile
            : new File([sourceFile], nextName, {
                type: resolvedMimeType,
                lastModified: sourceFile.lastModified,
              });

        return {
          file,
          folderSegments,
          isTopLevelFile: folderSegments.length === 0,
          topLevelFolderName: folderSegments[0] || null,
        };
      })
    );
    if (items.length === 0) return;

    const folderCache = new Map<string, string>([["", targetFolderId]]);
    const resolveTargetFolderId = async (folderSegments: string[]) => {
      const cacheKey = folderSegments.join("/");
      const cachedFolderId = folderCache.get(cacheKey);
      if (cachedFolderId) {
        return cachedFolderId;
      }

      const parentFolderId = await resolveTargetFolderId(folderSegments.slice(0, -1));
      const nextFolderId = await ensureUploadFolderPath(
        targetProvider,
        parentFolderId,
        folderSegments.slice(-1)
      );
      folderCache.set(cacheKey, nextFolderId);
      return nextFolderId;
    };

    const preparedItems = await Promise.all(
      items.map(async (item) => ({
        ...item,
        targetFolderId: await resolveTargetFolderId(item.folderSegments),
      }))
    );

    const optimisticUploads: CloudFile[] = preparedItems
      .filter((item) => item.isTopLevelFile)
      .map((item, index) => ({
        id: `temp-upload-${Date.now()}-${index}`,
        name: item.file.name,
        mimeType: resolveFileMimeType(item.file.name, item.file.type),
        size: String(item.file.size),
        modifiedTime: new Date().toISOString(),
        provider: targetProvider,
        accountId: getScopedCloudAccountId(item.targetFolderId) ?? targetAccountId,
        isFolder: false,
      }));

    if (optimisticUploads.length > 0) {
      setFilesForTab(activeTabId, (prev) => [...optimisticUploads, ...prev]);
    }

    const optimisticIdsForTopLevelFiles = optimisticUploads.map((item) => item.id);

    const topLevelFolderEntries: CloudFile[] = Array.from(
      new Set(
        preparedItems
          .map((item) => item.topLevelFolderName)
          .filter((value): value is string => Boolean(value))
      )
    ).map((folderName, index) => ({
      id: `temp-upload-folder-${Date.now()}-${index}`,
      name: folderName,
      mimeType:
        targetProvider === "google"
          ? "application/vnd.google-apps.folder"
          : "application/vnd.oneflash.folder",
      provider: targetProvider,
      accountId: getScopedCloudAccountId(targetFolderId) ?? targetAccountId,
      isFolder: true,
      modifiedTime: new Date().toISOString(),
    }));

    if (topLevelFolderEntries.length > 0) {
      setFilesForTab(activeTabId, (prev) => [...topLevelFolderEntries, ...prev]);
      registerFolderNames(topLevelFolderEntries);
    }

    const topLevelFolderNames = new Set(topLevelFolderEntries.map((entry) => entry.name));
    const uploadTuning = getBrowserUploadTuning(preparedItems.length);

    const manager: DirectUploadManager = {
      status: "running",
      provider: targetProvider,
      refreshProvider: currentLocationProvider,
      tabId: activeTabId,
      folderId: currentFolderId,
      tasks: preparedItems.map((item) => ({
        optimisticId: item.isTopLevelFile ? optimisticIdsForTopLevelFiles.shift() || null : null,
        file: item.file,
        provider: targetProvider,
        targetFolderId: item.targetFolderId,
        committedBytes: 0,
        inflightBytes: 0,
        uploadUrl: null,
        sessionPromise: null,
        chunkSize:
          targetProvider === "google"
            ? uploadTuning.googleChunkSize
            : uploadTuning.onedriveChunkSize,
        status: "pending",
      })),
      activeXhrs: new Map(),
      isProcessing: false,
      resumeRequested: false,
      lastSampleTime: 0,
      lastSampleBytes: 0,
      smoothedSpeed: 0,
      maxParallelUploads: uploadTuning.maxParallelUploads,
      sessionPrewarmLimit: uploadTuning.sessionPrewarmLimit,
    };

    setError(null);
    void runDirectUploadQueue(manager).finally(() => {
      if (topLevelFolderNames.size === 0) {
        return;
      }

      setFilesForTab(activeTabId, (prev) =>
        prev.filter(
          (file) =>
            !(
              file.isFolder &&
              file.provider === targetProvider &&
              topLevelFolderNames.has(file.name) &&
              file.id.startsWith("temp-upload-folder-")
            )
        )
      );
    });
  };

  const copySelection = () => {
    if (selectedFiles.length > 0) {
      setClipboard(selectedFiles);
    }
  };

  const pasteIntoCurrentFolder = async () => {
    if (clipboard.length === 0) return;
    for (const file of clipboard) {
      await duplicateFile(file.id, `${file.name} copy`);
    }
  };

  const openTab = (
    folderId: string = currentFolderId,
    tabProvider: CloudProviderId | null = provider,
    initialPath?: string[]
  ) => {
    const nextId = `tab-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    setTabsState((prev) => [
      ...prev,
      {
        id: nextId,
        provider: tabProvider,
        folderHistory: [
          {
            folderId,
            path: initialPath && initialPath.length > 0 ? initialPath : [folderId],
          },
        ],
        historyIndex: 0,
      },
    ]);
    setActiveTabId(nextId);
  };

  const activateTab = (tabId: string) => {
    setActiveTabId(tabId);
    setSelection([]);
  };

  const closeTab = (tabId: string) => {
    setTabsState((prev) => {
      if (prev.length === 1) return prev;
      const next = prev.filter((tab) => tab.id !== tabId);
      if (activeTabId === tabId) {
        const fallback = next[Math.max(0, prev.findIndex((tab) => tab.id === tabId) - 1)] || next[0];
        setActiveTabId(fallback.id);
      }
      return next;
    });
    setTabFiles((prev) => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
  };

  const openInNewTab = (id: string) => {
    if (id.startsWith("provider:")) {
      const targetProvider = id.replace("provider:", "");
      if (targetProvider === "google" || targetProvider === "onedrive") {
        openTab("root", targetProvider, ["root"]);
      }
      return;
    }
    const target = filesToShow.find((file) => file.id === id);
    const targetProvider = target?.provider || currentLocationProvider;
    if (!targetProvider) return;
    if (target?.isFolder) {
      if (favoritesView) {
        const params = new URLSearchParams({
          provider: targetProvider,
          folderId: id,
          folderName: target.name,
        });
        window.location.href = `/files?${params.toString()}`;
        return;
      }
      openTab(id, targetProvider, ["root", id]);
      setFolderNames((prev) => ({
        ...prev,
        [getFolderNameKey(id, targetProvider)]: target.name,
      }));
      return;
    }

    if (target) {
      setPreviewFile(target);
    }
  };

  const moveFilesToTab = async (
    fileIds: string[],
    targetTabId: string,
    sourceFolderId: string,
    sourceProvider: CloudProviderId | null
  ) => {
    const targetTab = tabsState.find((tab) => tab.id === targetTabId);
    const targetEntry =
      targetTab?.folderHistory[targetTab.historyIndex] || { folderId: "root" };
    const targetProvider =
      targetTab?.provider || getFolderProviderFromId(targetEntry.folderId);
    if (!targetTab || !targetProvider || !sourceProvider) return;
    if (targetProvider !== sourceProvider) {
      setError("Files can only be moved between tabs of the same provider");
      return;
    }

    const targetFolderId = getRawFolderId(targetEntry.folderId || "root");
    const rawSourceFolderId = getRawFolderId(sourceFolderId);

    if (targetFolderId === rawSourceFolderId) return;

    const previousSourceFiles = tabFiles[activeTabId] || [];
    const previousTargetFiles = tabFiles[targetTabId] || [];
    const movedFiles = previousSourceFiles.filter((file) => fileIds.includes(file.id));

    setFilesForTab(activeTabId, (prev) =>
      prev.filter((file) => !fileIds.includes(file.id))
    );
    setFilesForTab(targetTabId, (prev) => {
      const withoutMoved = prev.filter((file) => !fileIds.includes(file.id));
      return [...movedFiles, ...withoutMoved];
    });
    setSelection([]);

    try {
      for (const fileId of fileIds) {
        const res = await fetch(`/api/cloud/${sourceProvider}/files`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "move",
            fileId,
            sourceParentId: rawSourceFolderId,
            targetParentId: targetFolderId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Move failed");
      }
      void fetchFiles({
        silent: true,
        preserveSelection: true,
        targetTabId: activeTabId,
        targetProvider: sourceProvider,
        targetFolderId: sourceFolderId,
      });
      void fetchFiles({
        silent: true,
        preserveSelection: true,
        targetTabId,
        targetProvider,
        targetFolderId: targetEntry.folderId,
      });
    } catch (err: unknown) {
      setFilesForTab(activeTabId, previousSourceFiles);
      setFilesForTab(targetTabId, previousTargetFiles);
      setError(err instanceof Error ? err.message : "Move failed");
    }
  };

  const toggleFavorite = (file: CloudFile) => {
    const favoriteProvider = file.provider || provider || null;
    if (!favoriteProvider) return;

    const key = `${favoriteProvider}:${file.id}`;
    const next = favorites.includes(key)
      ? favorites.filter((fav) => fav !== key)
      : [...favorites, key];

    const nextFavoriteItems = { ...favoriteItems };
    if (favorites.includes(key)) {
      delete nextFavoriteItems[key];
    } else {
      nextFavoriteItems[key] = {
        ...file,
        provider: favoriteProvider,
      };
    }

    setFavorites(next);
    setFavoriteItems(nextFavoriteItems);
    persistFavorites(next, nextFavoriteItems);
  };

  const isFavorite = (
    id: string,
    fileProvider: CloudProviderId | null = currentLocationProvider || null
  ) => {
    if (!fileProvider) return false;
    return favorites.includes(`${fileProvider}:${id}`);
  };

  const tabs: FinderTab[] = tabsState.map((tab) => {
    const entry = tab.folderHistory[tab.historyIndex] || {
      folderId: "root",
      path: ["root"],
    };
    const folderId = entry.folderId;
    return {
      id: tab.id,
      provider: tab.provider,
      currentFolderId: folderId,
      title: isRootFolderId(folderId) ? "oneflash.one" : folderNames[folderId] || "Folder",
    };
  });

  return (
    <CloudContext.Provider
      value={{
        provider,
        currentLocationProvider,
        currentLocationAccountId,
        files: filesToShow,
        loading,
        error,
        currentFolderId,
        breadcrumbItems,
        selection,
        setSelection,
        navigateToFolder,
        navigateToBreadcrumb,
        navigateUp,
        folderHistory: currentHistoryEntry.path,
        refreshFiles: fetchFiles,
        createFolder,
        deleteSelected,
        deleteFiles,
        clearSelection,
        searchQuery,
        setSearchQuery,
        viewMode,
        setViewMode,
        itemScale,
        setItemScale,
        itemDensity,
        sortBy,
        setSortBy,
        sortDirection,
        setSortDirection,
        setItemDensity,
        folderNames,
        navigateBack,
        navigateForward,
        canGoBack: (activeTab?.historyIndex || 0) > 0,
        canGoForward:
          (activeTab?.historyIndex || 0) <
          ((activeTab?.folderHistory.length || 1) - 1),
        renameFile,
        duplicateFile,
        uploadFiles,
        copySelection,
        pasteIntoCurrentFolder,
        hasClipboard: clipboard.length > 0,
        previewFile,
        infoFile,
        showPreview: setPreviewFile,
        showInfo: setInfoFile,
        openInNewTab,
        selectedFiles,
        connectedProviders,
        connectedAccountsByProvider,
        connectionsLoaded,
        toggleFavorite,
        isFavorite,
        tabs,
        activeTabId,
        openTab,
        activateTab,
        closeTab,
        openLocationRoot,
        moveFilesToTab,
        uploadState,
        pauseUploads,
        resumeUploads,
        cancelUploads,
      }}
    >
      {children}
    </CloudContext.Provider>
  );
}

export function useCloud() {
  const context = useContext(CloudContext);
  if (context === undefined) {
    throw new Error("useCloud must be used within a CloudProvider");
  }
  return context;
}
