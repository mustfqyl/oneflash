"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export interface CloudFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  isFolder: boolean;
  iconLink?: string;
  provider?: "google" | "onedrive" | null;
}

interface ProviderApiFile {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  lastModifiedDateTime?: string;
  file?: { mimeType?: string };
  folder?: unknown;
  iconLink?: string;
}

interface FetchFilesOptions {
  silent?: boolean;
  preserveSelection?: boolean;
  targetTabId?: string;
  targetProvider?: "google" | "onedrive" | null;
  targetFolderId?: string;
}

interface FolderHistoryEntry {
  folderId: string;
  path: string[];
}

interface FinderTabState {
  id: string;
  provider: "google" | "onedrive" | null;
  folderHistory: FolderHistoryEntry[];
  historyIndex: number;
}

export interface FinderTab {
  id: string;
  provider: "google" | "onedrive" | null;
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

interface CloudContextType {
  provider: "google" | "onedrive" | null;
  files: CloudFile[];
  loading: boolean;
  error: string | null;
  currentFolderId: string;
  breadcrumbItems: BreadcrumbItem[];
  selection: string[];
  setSelection: (ids: string[]) => void;
  navigateToFolder: (folderId: string) => void;
  navigateToBreadcrumb: (index: number) => void;
  navigateUp: () => void;
  folderHistory: string[];
  refreshFiles: () => Promise<void>;
  createFolder: (name: string) => Promise<void>;
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
  folderNames: Record<string, string>;
  navigateBack: () => void;
  navigateForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  renameFile: (id: string, newName: string) => Promise<void>;
  duplicateFile: (id: string, nameOverride?: string) => Promise<void>;
  uploadFiles: (files: FileList | File[]) => Promise<void>;
  copySelection: () => void;
  pasteIntoCurrentFolder: () => Promise<void>;
  hasClipboard: boolean;
  previewFile: CloudFile | null;
  infoFile: CloudFile | null;
  showPreview: (file: CloudFile | null) => void;
  showInfo: (file: CloudFile | null) => void;
  openInNewTab: (id: string) => void;
  selectedFiles: CloudFile[];
  connectedProviders: ("google" | "onedrive")[];
  toggleFavorite: (file: CloudFile) => void;
  isFavorite: (id: string, fileProvider?: "google" | "onedrive" | null) => boolean;
  tabs: FinderTab[];
  activeTabId: string;
  openTab: (folderId?: string, tabProvider?: "google" | "onedrive" | null) => void;
  activateTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  moveFilesToTab: (
    fileIds: string[],
    targetTabId: string,
    sourceFolderId: string,
    sourceProvider: "google" | "onedrive" | null
  ) => Promise<void>;
}

const CloudContext = createContext<CloudContextType | undefined>(undefined);
const EMPTY_FILES: CloudFile[] = [];

const IMAGE_FORMATS = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

function getFileExtension(name: string) {
  const trimmed = name.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return "";
  }
  return trimmed.slice(lastDot + 1).toLowerCase();
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

export function CloudProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const providerQuery = searchParams.get("provider");
  const initialProvider: "google" | "onedrive" | null =
    providerQuery === "google" || providerQuery === "onedrive" ? providerQuery : null;
  const initialFolderId = searchParams.get("folderId") || "root";
  const initialFolderName = searchParams.get("folderName");
  
  const [tabFiles, setTabFiles] = useState<Record<string, CloudFile[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [itemScale, setItemScale] = useState<FinderItemScale>(() => {
    if (typeof window === "undefined") return "comfortable";
    const stored = window.localStorage.getItem("finder_item_scale");
    return stored === "compact" || stored === "comfortable" || stored === "large"
      ? stored
      : "comfortable";
  });
  const [itemDensity, setItemDensity] = useState<FinderItemDensity>(() => {
    if (typeof window === "undefined") return "normal";
    const stored = window.localStorage.getItem("finder_item_density");
    return stored === "tight" || stored === "normal" || stored === "airy"
      ? stored
      : "normal";
  });
  const [folderNames, setFolderNames] = useState<Record<string, string>>(() => ({
    root: "oneflash.co",
    ...(initialFolderId !== "root" && initialFolderName
      ? { [initialFolderId]: initialFolderName }
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
  const [connectedProviders, setConnectedProviders] = useState<("google" | "onedrive")[]>([]);
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem("finder_favorites");
    if (!raw) return [];
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  });
  const [favoriteItems, setFavoriteItems] = useState<FavoriteStorageMap>(() => {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem("finder_favorite_items");
    if (!raw) return {};
    try {
      return JSON.parse(raw) as FavoriteStorageMap;
    } catch {
      return {};
    }
  });
  const activeTab =
    tabsState.find((tab) => tab.id === activeTabId) || tabsState[0];
  const provider = activeTab?.provider ?? initialProvider;
  const currentHistoryEntry =
    activeTab?.folderHistory[activeTab.historyIndex] || {
      folderId: "root",
      path: ["root"],
    };
  const currentFolderId = currentHistoryEntry.folderId;
  const breadcrumbItems: BreadcrumbItem[] = currentHistoryEntry.path.map(
    (folderId, index) => ({
      id: folderId,
      name:
        index === 0
          ? "oneflash.co"
          : folderNames[folderId] || "Folder",
    })
  );
  const files = tabFiles[activeTabId] ?? EMPTY_FILES;
  const favoritesView = pathname === "/favorites";

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("finder_item_scale", itemScale);
  }, [itemScale]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("finder_item_density", itemDensity);
  }, [itemDensity]);

  const normalizeProviderFile = useCallback(
    (f: ProviderApiFile): CloudFile => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType || f.file?.mimeType || "application/octet-stream",
      size: f.size,
      modifiedTime: f.modifiedTime || f.lastModifiedDateTime,
      provider,
      isFolder:
        provider === "google"
          ? f.mimeType === "application/vnd.google-apps.folder"
          : !!f.folder,
      iconLink: f.iconLink,
    }),
    [provider]
  );

  const registerFolderNames = useCallback((entries: CloudFile[]) => {
    setFolderNames((prev) => ({
      ...prev,
      ...Object.fromEntries(
        entries
          .filter((file) => file.isFolder)
          .map((file) => [file.id, file.name])
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
    const res = await fetch("/api/settings/connections", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const list: ("google" | "onedrive")[] = [];
    if (data?.providers?.google?.connected) list.push("google");
    if (data?.providers?.onedrive?.connected) list.push("onedrive");
    setConnectedProviders(list);
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
      targetProvider = provider,
      targetFolderId = currentFolderId,
    } = options || {};

    if (!targetProvider) {
      await fetchConnections();
      const virtualFiles: CloudFile[] = connectedProviders.map((p) => ({
        id: `provider:${p}`,
        name: p === "google" ? "Google Drive" : "OneDrive",
        mimeType: "application/vnd.oneflash.provider",
        isFolder: true,
      }));
      setFilesForTab(targetTabId, virtualFiles);
      setError(null);
      if (!silent) setLoading(false);
      return;
    }
    
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/cloud/${targetProvider}/files?folderId=${targetFolderId}`
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
          // Expected state when a provider is selected but not yet connected.
          setFilesForTab(targetTabId, []);
          setError(null);
          if (!preserveSelection && targetTabId === activeTabId) setSelection([]);
          return;
        }

        throw new Error(message);
      }
      
      const formattedFiles: CloudFile[] = (data.files as ProviderApiFile[]).map(normalizeProviderFile);
      
      setFilesForTab(targetTabId, formattedFiles);
      if (!preserveSelection && targetTabId === activeTabId) {
        setSelection([]);
      }
      registerFolderNames(formattedFiles);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
      if (!silent) {
        setFilesForTab(targetTabId, []);
      }
    } finally {
      if (!silent) setLoading(false);
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

  const navigateToFolder = (folderId: string) => {
    if (folderId.startsWith("provider:")) {
      const targetProvider = folderId.replace("provider:", "");
      if (targetProvider === "google" || targetProvider === "onedrive") {
        window.location.href = `/files?provider=${targetProvider}`;
        return;
      }
    }
    setTabsState((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        const currentEntry = tab.folderHistory[tab.historyIndex] || {
          folderId: "root",
          path: ["root"],
        };
        const nextPath =
          folderId === "root"
            ? ["root"]
            : [...currentEntry.path, folderId];
        const nextEntry = { folderId, path: nextPath };
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

  const navigateToBreadcrumb = (index: number) => {
    setTabsState((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        const currentEntry = tab.folderHistory[tab.historyIndex] || {
          folderId: "root",
          path: ["root"],
        };
        const nextPath = currentEntry.path.slice(0, index + 1);
        const nextFolderId = nextPath[nextPath.length - 1] || "root";
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

  const navigateBack = () =>
    setTabsState((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId
          ? { ...tab, historyIndex: Math.max(0, tab.historyIndex - 1) }
          : tab
      )
    );
  const navigateForward = () =>
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
  const navigateUp = () => {
    if (currentHistoryEntry.path.length <= 1) return;
    navigateToBreadcrumb(currentHistoryEntry.path.length - 2);
  };

  const clearSelection = () => setSelection([]);

  const createFolder = async (name: string) => {
    if (!provider) return;
    const trimmed = name.trim() || "New Folder";
    const tempId = `temp-folder-${Date.now()}`;
    const optimisticFolder: CloudFile = {
      id: tempId,
      name: trimmed,
      mimeType:
        provider === "google"
          ? "application/vnd.google-apps.folder"
          : "application/vnd.oneflash.folder",
      provider,
      isFolder: true,
      modifiedTime: new Date().toISOString(),
    };

    setFilesForTab(activeTabId, (prev) => [optimisticFolder, ...prev]);
    registerFolderNames([optimisticFolder]);
    try {
      const res = await fetch(`/api/cloud/${provider}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, parentId: currentFolderId === "root" ? undefined : currentFolderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create folder");

      const createdFolder = normalizeProviderFile(data.folder as ProviderApiFile);
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
    if (!provider || ids.length === 0) return;
    const idsToDelete = [...ids];
    const previousFiles = files;
    setFilesForTab(activeTabId, (prev) =>
      prev.filter((file) => !idsToDelete.includes(file.id))
    );
    setSelection([]);
    try {
      for (const fileId of idsToDelete) {
        const res = await fetch(`/api/cloud/${provider}/files`, {
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
  }, [provider, files, activeTabId, setFilesForTab, fetchFiles]);

  const deleteSelected = async () => {
    if (selection.length === 0) return;
    await deleteFiles(selection);
  };

  const syncFavoriteItem = (
    previousFile: CloudFile,
    nextFile: CloudFile,
    nextProvider: "google" | "onedrive" | null
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
    targetProvider: "google" | "onedrive",
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

  const uploadConvertedFile = async (
    targetProvider: "google" | "onedrive",
    convertedFile: File
  ) => {
    const formData = new FormData();
    formData.append("file", convertedFile);
    formData.append("folderId", currentFolderId);

    const response = await fetch(`/api/cloud/${targetProvider}/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Upload failed");
    }

    return normalizeProviderFile(data.file as ProviderApiFile);
  };

  const convertImageRename = async (
    sourceFile: CloudFile,
    nextName: string,
    targetProvider: "google" | "onedrive"
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

    const uploadedFile = await uploadConvertedFile(targetProvider, convertedUpload);

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
    const targetProvider = sourceFile?.provider || provider;
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
    setFolderNames((prev) =>
      prev[id] ? { ...prev, [id]: trimmed } : prev
    );

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
          const updatedFile = normalizeProviderFile(data.file as ProviderApiFile);
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
    if (!provider) return;
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
      const res = await fetch(`/api/cloud/${provider}/files`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "duplicate",
          fileId: id,
          newName: copyName,
          parentId: currentFolderId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Duplicate failed");
      if (data.file) {
        const duplicatedFile = normalizeProviderFile(data.file as ProviderApiFile);
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

  const uploadFiles = async (list: FileList | File[]) => {
    if (!provider) return;
    const items = Array.isArray(list) ? list : Array.from(list);
    if (items.length === 0) return;
    const optimisticUploads: CloudFile[] = items.map((file, index) => ({
      id: `temp-upload-${Date.now()}-${index}`,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: String(file.size),
      modifiedTime: new Date().toISOString(),
      provider,
      isFolder: false,
    }));

    setFilesForTab(activeTabId, (prev) => [...optimisticUploads, ...prev]);
    try {
      for (let index = 0; index < items.length; index += 1) {
        const file = items[index];
        const optimisticFile = optimisticUploads[index];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folderId", currentFolderId);
        const res = await fetch(`/api/cloud/${provider}/upload`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");

        if (data.file) {
          const uploadedFile = normalizeProviderFile(data.file as ProviderApiFile);
          setFilesForTab(activeTabId, (prev) =>
            prev.map((entry) => (entry.id === optimisticFile.id ? uploadedFile : entry))
          );
        }
      }
      void fetchFiles({ silent: true, preserveSelection: true });
    } catch (err: unknown) {
      const optimisticIds = optimisticUploads.map((file) => file.id);
      setFilesForTab(activeTabId, (prev) =>
        prev.filter((file) => !optimisticIds.includes(file.id))
      );
      setError(err instanceof Error ? err.message : "Upload failed");
    }
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
    tabProvider: "google" | "onedrive" | null = provider,
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
    const targetProvider = target?.provider || provider;
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
        [id]: target.name,
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
    sourceProvider: "google" | "onedrive" | null
  ) => {
    const targetTab = tabsState.find((tab) => tab.id === targetTabId);
    if (!targetTab || !targetTab.provider || !sourceProvider) return;
    if (targetTab.provider !== sourceProvider) {
      setError("Files can only be moved between tabs of the same provider");
      return;
    }

    const targetFolderId =
      targetTab.folderHistory[targetTab.historyIndex]?.folderId || "root";

    if (targetFolderId === sourceFolderId) return;

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
            sourceParentId: sourceFolderId,
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
        targetProvider: targetTab.provider,
        targetFolderId: targetFolderId,
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
    fileProvider: "google" | "onedrive" | null = provider || null
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
      title: folderId === "root" ? "oneflash.co" : folderNames[folderId] || "Folder",
    };
  });

  return (
    <CloudContext.Provider
      value={{
        provider,
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
        toggleFavorite,
        isFavorite,
        tabs,
        activeTabId,
        openTab,
        activateTab,
        closeTab,
        moveFilesToTab,
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
