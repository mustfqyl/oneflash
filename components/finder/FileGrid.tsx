"use client";

import { usePathname } from "next/navigation";
import {
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowPathIcon,
  DocumentIcon,
  FolderIcon,
  StarIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { type CloudFile, useCloud } from "./CloudContext";

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

const SIZE_STYLES = {
  compact: {
    grid: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-8",
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
    grid: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6",
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
    grid: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
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
    gridGap: "gap-3",
    listGap: "gap-1",
    gridItem: "gap-2 rounded-lg px-2 py-2",
    listItem: "gap-2 rounded-md px-2 py-1.5",
    rootPadding: "p-4",
  },
  normal: {
    gridGap: "gap-6",
    listGap: "gap-2",
    gridItem: "gap-3 rounded-xl p-3",
    listItem: "gap-3 rounded-lg p-2",
    rootPadding: "p-6",
  },
  airy: {
    gridGap: "gap-8",
    listGap: "gap-3",
    gridItem: "gap-4 rounded-2xl px-4 py-4",
    listItem: "gap-3 rounded-xl px-3 py-2.5",
    rootPadding: "p-7",
  },
} as const;

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

function ImageThumbnail({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <DocumentIcon className={className} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

function VideoThumbnail({
  src,
  className,
}: {
  src: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  if (failed) {
    return <DocumentIcon className={className} />;
  }

  if (frameSrc) {
    return <img src={frameSrc} alt="" className={className} />;
  }

  return (
    <video
      ref={videoRef}
      src={src}
      className={className}
      muted
      playsInline
      preload="metadata"
      onLoadedMetadata={(event) => {
        const video = event.currentTarget;
        const targetTime =
          Number.isFinite(video.duration) && video.duration > 1 ? 1 : 0;
        video.currentTime = targetTime;
      }}
      onSeeked={(event) => {
        const video = event.currentTarget;
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const context = canvas.getContext("2d");
          if (!context) {
            setFailed(true);
            return;
          }
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          setFrameSrc(canvas.toDataURL("image/jpeg", 0.82));
        } catch {
          setFailed(true);
        }
      }}
      onError={() => setFailed(true)}
    />
  );
}

export default function FileGrid() {
  const pathname = usePathname();
  const {
    provider,
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
    currentFolderId,
    isFavorite,
    navigateBack,
    navigateForward,
    setViewMode,
    activeTabId,
  } = useCloud();
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [renameDialog, setRenameDialog] = useState<{ open: boolean; fileId: string; name: string } | null>(null);
  const [renameSubmitting, setRenameSubmitting] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[] | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [selectionBox, setSelectionBox] = useState<SelectionBoxState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragDepthRef = useRef(0);
  const dragSelectionBaseRef = useRef<string[]>([]);
  const dragSelectionAdditiveRef = useRef(false);
  const dragSelectionMovedRef = useRef(false);
  const suppressClearClickRef = useRef(false);
  const showInitialLoading = loading && files.length === 0;
  const showBackgroundRefreshing = loading && files.length > 0;
  const favoritesView = pathname === "/favorites";
  const sizeStyles = SIZE_STYLES[itemScale];
  const densityStyles = DENSITY_STYLES[itemDensity];

  const isExternalFileDrag = (event: DragEvent | ReactDragEvent) =>
    Array.from(event.dataTransfer?.types || []).includes("Files");

  const providerForFile = (fileProvider?: "google" | "onedrive" | null) =>
    fileProvider || provider;

  const buildDownloadUrlForFile = (fileId: string, fileProvider?: "google" | "onedrive" | null) =>
    providerForFile(fileProvider)
      ? `${window.location.origin}/api/cloud/${providerForFile(fileProvider)}/open?fileId=${encodeURIComponent(fileId)}&download=1`
      : "";

  const buildPreviewUrl = (fileId: string, fileProvider?: "google" | "onedrive" | null) =>
    providerForFile(fileProvider)
      ? `/api/cloud/${providerForFile(fileProvider)}/open?fileId=${encodeURIComponent(fileId)}`
      : "";

  const isImageFile = (mimeType: string) => mimeType.startsWith("image/");
  const isVideoFile = (mimeType: string) => mimeType.startsWith("video/");
  const isAudioFile = (mimeType: string) => mimeType.startsWith("audio/");
  const isPdfFile = (mimeType: string) => mimeType === "application/pdf";

  const buildTabDragPayload = (fileId: string) =>
    JSON.stringify({
      ids:
        selection.includes(fileId) && selection.length > 0
          ? selection
          : [fileId],
      sourceFolderId: currentFolderId,
      sourceProvider: provider,
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
    const closeMenu = (event: MouseEvent) => {
      if (menuRef.current && event.target instanceof Node && !menuRef.current.contains(event.target)) {
        setMenu(null);
      }
    };
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (event.key === "Escape" && previewFile) {
        event.preventDefault();
        showPreview(null);
      } else
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
        setFolderDialogOpen(true);
      } else if (meta && event.key.toLowerCase() === "i") {
        event.preventDefault();
        if (selectedFiles[0]) showInfo(selectedFiles[0]);
      } else if (event.key === " ") {
        event.preventDefault();
        if (previewFile) {
          showPreview(null);
        } else if (selectedFiles[0]) {
          openInNewTab(selectedFiles[0].id);
        }
      } else if (meta && event.key.toLowerCase() === "d") {
        event.preventDefault();
        for (const item of selectedFiles) await duplicateFile(item.id);
      } else if (meta && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelection();
      } else if (meta && event.key.toLowerCase() === "v") {
        event.preventDefault();
        await pasteIntoCurrentFolder();
      } else if (meta && event.key === "Backspace") {
        event.preventDefault();
        if (selection.length > 0) setDeleteDialogOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setViewMode, navigateBack, navigateForward, selectedFiles, showInfo, duplicateFile, copySelection, pasteIntoCurrentFolder, selection.length, previewFile, showPreview, openInNewTab]);

  if (showInitialLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-zinc-400 h-full">
        <div className="animate-pulse flex flex-col items-center">
          <FolderIcon className="w-12 h-12 mb-4 opacity-50" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-zinc-400 h-full text-center">
        <div className="flex flex-col items-center justify-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <span className="text-red-500 text-xl font-bold">!</span>
          </div>
          <p className="text-red-400 font-medium mb-2">{error}</p>
          {!provider && <p className="text-sm">Please select an account from the sidebar.</p>}
        </div>
      </div>
    );
  }

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  if (filteredFiles.length === 0 && provider) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 h-full">
        <div className="text-zinc-500 text-sm">
          {searchQuery ? "Search result is empty." : "This folder is empty."}
        </div>
      </div>
    );
  }

  const handleSelect = (id: string, isCtrl: boolean) => {
    if (isCtrl) {
      setSelection(selection.includes(id) ? selection.filter(s => s !== id) : [...selection, id]);
    } else {
      setSelection([id]);
    }
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

  return (
    <div
      ref={gridRef}
      className={`${densityStyles.rootPadding} min-h-full relative`}
      onClick={() => {
        if (suppressClearClickRef.current) {
          suppressClearClickRef.current = false;
          return;
        }
        clearSelection();
        setMenu(null);
      }}
      onMouseDown={handleCanvasMouseDown}
      onDragEnter={(e) => {
        if (!provider || !isExternalFileDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        dragDepthRef.current += 1;
        setDropActive(true);
      }}
      onDragOver={(e) => {
        if (!provider || !isExternalFileDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropActive(true);
      }}
      onDragLeave={(e) => {
        if (!provider || !isExternalFileDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) {
          setDropActive(false);
        }
      }}
      onDrop={async (e) => {
        if (!provider || !isExternalFileDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        dragDepthRef.current = 0;
        setDropActive(false);
        const droppedFiles = Array.from(e.dataTransfer.files || []);
        if (droppedFiles.length > 0) {
          await uploadFiles(droppedFiles);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY, fileId: null });
      }}
    >
      {dropActive && (
        <div
          data-ignore-drag-select="true"
          className="pointer-events-none absolute inset-4 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-blue-400/70 bg-blue-500/10 backdrop-blur-sm"
        >
          <div className="rounded-2xl border border-white/10 bg-black/60 px-6 py-4 text-center">
            <p className="text-lg font-semibold text-white">Drop files here</p>
            <p className="mt-1 text-sm text-zinc-300">They will be uploaded to the current folder</p>
          </div>
        </div>
      )}
      {showBackgroundRefreshing && (
        <div className="pointer-events-none absolute bottom-4 right-4 z-20">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#454545] bg-[#2b2b2b]/95 text-[#bdbdbd] shadow-lg backdrop-blur-sm">
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
            ? `grid ${sizeStyles.grid} ${densityStyles.gridGap}`
            : `flex flex-col ${densityStyles.listGap}`
        }
      >
        {filteredFiles.map((file) => {
          const isSelected = selection.includes(file.id);
          const favorite = isFavorite(file.id, file.provider);
          const nameParts = getNameParts(file);
          return (
            <div 
              key={file.id} 
              ref={(node) => {
                itemRefs.current[file.id] = node;
              }}
              data-file-item="true"
              draggable={!file.isFolder}
              className={`cursor-default transition-colors group select-none ${
                viewMode === "grid"
                  ? `flex flex-col items-center ${densityStyles.gridItem}`
                  : `flex items-center ${densityStyles.listItem}`
              } ${isSelected ? "bg-blue-500/20 ring-1 ring-blue-500/50" : "hover:bg-white/5"}`}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(file.id, e.ctrlKey || e.metaKey);
              }}
              onDragStart={(e) => {
                if (file.isFolder || !provider) {
                  e.preventDefault();
                  return;
                }
                e.dataTransfer.effectAllowed = "copyMove";
                e.dataTransfer.setData(
                  "application/x-oneflash-files",
                  buildTabDragPayload(file.id)
                );
                const downloadUrl = buildDownloadUrlForFile(file.id, file.provider);
                e.dataTransfer.setData(
                  "DownloadURL",
                  `${file.mimeType || "application/octet-stream"}:${file.name}:${downloadUrl}`
                );
                e.dataTransfer.setData("text/uri-list", downloadUrl);
                e.dataTransfer.setData("text/plain", file.name);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (file.isFolder && !favoritesView) {
                  navigateToFolder(file.id);
                  clearSelection();
                } else {
                  openInNewTab(file.id);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!selection.includes(file.id)) {
                  setSelection([file.id]);
                }
                setMenu({ x: e.clientX, y: e.clientY, fileId: file.id });
              }}
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
                        className={`overflow-hidden border border-white/10 bg-[#2d2d2d] shadow-md ${
                          viewMode === "grid"
                            ? sizeStyles.gridPreviewBox
                            : sizeStyles.listPreviewBox
                        }`}
                      >
                        <ImageThumbnail
                          src={buildPreviewUrl(file.id, file.provider)}
                          alt={file.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : isVideoFile(file.mimeType) && providerForFile(file.provider) ? (
                      <div
                        className={`overflow-hidden border border-white/10 bg-[#1f1f20] shadow-md ${
                          viewMode === "grid"
                            ? sizeStyles.gridPreviewBox
                            : sizeStyles.listPreviewBox
                        }`}
                      >
                        <VideoThumbnail
                          src={buildPreviewUrl(file.id, file.provider)}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : file.iconLink ? (
                      <img
                        src={file.iconLink}
                        alt=""
                        className={`object-contain drop-shadow-md ${
                          viewMode === "grid"
                            ? sizeStyles.gridFileIcon
                            : sizeStyles.listFileIcon
                        }`}
                      />
                    ) : (
                      <>
                        <DocumentIcon
                          className={`text-zinc-200 drop-shadow-md ${
                            viewMode === "grid"
                              ? sizeStyles.gridDocumentIcon
                              : sizeStyles.listDocumentIcon
                          }`}
                        />
                        {viewMode === "grid" && (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent rounded-sm" />
                            <div className="absolute bottom-1 right-1 text-[8px] font-bold text-white bg-red-500 px-1 rounded-sm opacity-90 uppercase truncate max-w-full">
                              {file.name.split('.').pop()?.substring(0, 4)}
                            </div>
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
                      ? "text-white"
                      : "text-zinc-300 group-hover:text-white"
                  }`}
                >
                  {nameParts.main}
                </span>
                {nameParts.extension && (
                  <span
                    className={`shrink-0 uppercase tracking-[0.16em] ${
                      viewMode === "grid"
                        ? "mt-1 text-[10px] text-zinc-500"
                        : "text-[10px] text-zinc-500"
                    } ${isSelected ? "text-zinc-200" : ""}`}
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
          className="fixed z-50 w-56 rounded-xl border border-white/8 bg-[#3b3b3f]/30 p-1.5 shadow-2xl backdrop-blur-3xl text-sm"
          style={{ left: menuLeft, top: menuTop }}
        >
          {menu.fileId ? (
            <>
              {(() => {
                const target = selectedOrTarget(menu.fileId)[0];
                return (
                  <>
              <button
                className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-[#f0f0f0] transition-colors hover:bg-white/10"
                onClick={() => openInNewTab(menu.fileId || currentFolderId)}
              >
                Open
              </button>
                  {target?.isFolder && (
                    <button
                      className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-[#f0f0f0] transition-colors hover:bg-white/10"
                      onClick={() => openInNewTab(menu.fileId || currentFolderId)}
                    >
                      Open in New Tab
                    </button>
                  )}
                  </>
                );
              })()}
              <button
                className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-[#f0f0f0] transition-colors hover:bg-white/10"
                onClick={() => {
                  const target = selectedOrTarget(menu.fileId)[0];
                  if (!target) return;
                  window.open(
                    `${buildDownloadUrlForFile(target.id, target.provider)}&name=${encodeURIComponent(target.name)}`,
                    "_blank"
                  );
                  setMenu(null);
                }}
              >
                Download
              </button>
              <div className="mx-2 my-1 h-px bg-white/10" />
              <button className="w-full rounded-lg px-3 py-1.5 text-left text-[13px] text-[#f0f0f0] transition-colors hover:bg-white/10" onClick={() => handleRename(menu.fileId)}>
                Rename
              </button>
              <button className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-[#f0f0f0] transition-colors hover:bg-white/10" onClick={() => handleDuplicate(menu.fileId)}>
                Duplicate
              </button>
              <button className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-[#f0f0f0] transition-colors hover:bg-white/10" onClick={() => { copySelection(); setMenu(null); }}>
                Copy
              </button>
              <button
                className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-[#f0f0f0] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!hasClipboard}
                onClick={async () => {
                  await pasteIntoCurrentFolder();
                  setMenu(null);
                }}
              >
                Paste
              </button>
              <div className="mx-2 my-1 h-px bg-white/10" />
              <button className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-[#f0f0f0] transition-colors hover:bg-white/10" onClick={() => handleInfo(menu.fileId)}>
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
                  className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-[#f0f0f0] transition-colors hover:bg-white/10"
                  onClick={() => {
                    setFolderDialogOpen(true);
                    setMenu(null);
                  }}
                >
                  New Folder
                </button>
                <button
                  className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-[#f0f0f0] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!hasClipboard}
                  onClick={async () => {
                    await pasteIntoCurrentFolder();
                    setMenu(null);
                  }}
                >
                  Paste
                </button>
                <button
                  className="w-full cursor-pointer rounded-lg px-3 py-1.5 text-left text-[13px] text-[#f0f0f0] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!provider}
                  onClick={() => {
                    setMenu(null);
                    setTimeout(() => {
                      const input = document.querySelector('input[type="file"].hidden') as HTMLInputElement | null;
                      input?.click();
                    }, 0);
                  }}
                >
                  Upload
                </button>
              </>
          )}
        </div>
      )}
      {previewFile && providerForFile(previewFile.provider) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => showPreview(null)}
        >
          <div
            className="relative flex h-[86vh] w-[88vw] max-w-6xl min-h-0 flex-col overflow-hidden rounded-2xl border border-[#3d3d3d] bg-[#1c1c1e] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#323232] bg-[#242426] px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#f0f0f0]">
                  {previewFile.name}
                </p>
                <p className="truncate text-xs text-[#8a8a8a]">
                  {previewFile.mimeType}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={buildDownloadUrlForFile(previewFile.id, previewFile.provider)}
                  className="rounded-md border border-[#4a4a4a] bg-[#303032] px-3 py-1.5 text-xs font-medium text-[#f0f0f0] transition-colors hover:bg-[#3a3a3a]"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => showPreview(null)}
                  className="rounded-md p-1.5 text-[#c8c8c8] transition-colors hover:bg-[#3a3a3a] hover:text-white"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#111112] p-4">
              {isImageFile(previewFile.mimeType) ? (
                <div className="flex max-h-full max-w-full items-center justify-center overflow-hidden">
                  <img
                    src={buildPreviewUrl(previewFile.id, previewFile.provider)}
                    alt={previewFile.name}
                    className="h-auto max-h-[calc(86vh-6rem)] w-auto max-w-[calc(88vw-2rem)] rounded-lg object-contain shadow-2xl"
                  />
                </div>
              ) : isVideoFile(previewFile.mimeType) ? (
                <div className="flex max-h-full max-w-full items-center justify-center overflow-hidden">
                  <video
                    src={buildPreviewUrl(previewFile.id, previewFile.provider)}
                    controls
                    autoPlay
                    className="h-auto max-h-[calc(86vh-6rem)] w-auto max-w-[calc(88vw-2rem)] rounded-lg bg-black object-contain shadow-2xl"
                  />
                </div>
              ) : isAudioFile(previewFile.mimeType) ? (
                <audio
                  src={buildPreviewUrl(previewFile.id, previewFile.provider)}
                  controls
                  autoPlay
                  className="w-full max-w-2xl"
                />
              ) : isPdfFile(previewFile.mimeType) ? (
                <iframe
                  src={buildPreviewUrl(previewFile.id, previewFile.provider)}
                  className="h-full max-h-full w-full max-w-full rounded-lg border border-[#2e2e2e] bg-white"
                  title={previewFile.name}
                />
              ) : (
                <div className="flex flex-col items-center gap-4 text-center">
                  <DocumentIcon className="h-20 w-20 text-[#8a8a8a]" />
                  <div>
                    <p className="text-sm font-medium text-[#f0f0f0]">
                      This file type cannot be previewed here.
                    </p>
                    <p className="mt-1 text-xs text-[#8a8a8a]">
                      Download it or open it with the system viewer.
                    </p>
                  </div>
                  <a
                  href={buildDownloadUrlForFile(previewFile.id, previewFile.provider)}
                    className="rounded-md border border-[#4a4a4a] bg-[#303032] px-4 py-2 text-sm font-medium text-[#f0f0f0] transition-colors hover:bg-[#3a3a3a]"
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {infoFile && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center" onClick={() => showInfo(null)}>
          <div className="w-[480px] rounded-xl border border-zinc-700 bg-[#1f1f21] p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Info</h3>
            <div className="space-y-1 text-sm">
              <p>Name: {infoFile.name}</p>
              <p>Type: {infoFile.mimeType || "unknown"}</p>
              <p>Modified: {infoFile.modifiedTime || "-"}</p>
              <p>Size: {infoFile.size || "-"}</p>
            </div>
              <button className="mt-4 cursor-pointer px-3 py-1.5 rounded bg-white text-black text-sm" onClick={() => showInfo(null)}>
                Close
              </button>
          </div>
        </div>
      )}
      {renameDialog?.open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="w-[420px] rounded-xl border border-zinc-700 bg-[#1f1f21] p-5">
            <h3 className="text-lg font-semibold mb-3">Rename Item</h3>
            <input
              value={renameDialog.name}
              onChange={(e) => setRenameDialog({ ...renameDialog, name: e.target.value })}
              disabled={renameSubmitting}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm disabled:opacity-60"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button className="cursor-pointer px-3 py-1.5 rounded bg-zinc-700 text-sm disabled:cursor-not-allowed disabled:opacity-50" disabled={renameSubmitting} onClick={() => setRenameDialog(null)}>Cancel</button>
              <button
                disabled={renameSubmitting}
                className="cursor-pointer px-3 py-1.5 rounded bg-blue-600 text-sm disabled:cursor-not-allowed disabled:opacity-80"
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
              >
                {renameSubmitting ? "Renaming..." : "Rename"}
              </button>
            </div>
          </div>
        </div>
      )}
      {folderDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="w-[420px] rounded-xl border border-zinc-700 bg-[#1f1f21] p-5">
            <h3 className="text-lg font-semibold mb-3">Create Folder</h3>
            <input value={newFolderName} disabled={createSubmitting} onChange={(e) => setNewFolderName(e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm disabled:opacity-60" placeholder="Folder name" />
            <div className="mt-4 flex justify-end gap-2">
              <button className="cursor-pointer px-3 py-1.5 rounded bg-zinc-700 text-sm disabled:cursor-not-allowed disabled:opacity-50" disabled={createSubmitting} onClick={() => setFolderDialogOpen(false)}>Cancel</button>
              <button className="cursor-pointer px-3 py-1.5 rounded bg-blue-600 text-sm disabled:cursor-not-allowed disabled:opacity-80" disabled={createSubmitting} onClick={async () => {
                if (createSubmitting) return;
                setCreateSubmitting(true);
                try {
                  await createFolder(newFolderName || "New Folder");
                  setFolderDialogOpen(false);
                  setNewFolderName("");
                } finally {
                  setCreateSubmitting(false);
                }
              }}>{createSubmitting ? "Creating..." : "Create"}</button>
            </div>
          </div>
        </div>
      )}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="w-[420px] rounded-xl border border-zinc-700 bg-[#1f1f21] p-5">
            <h3 className="text-lg font-semibold mb-2">Delete</h3>
            <p className="text-sm text-zinc-400">Selected items will be removed from current storage.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="cursor-pointer px-3 py-1.5 rounded bg-zinc-700 text-sm disabled:cursor-not-allowed disabled:opacity-50" disabled={deleteSubmitting} onClick={() => setDeleteDialogOpen(false)}>Cancel</button>
              <button className="cursor-pointer px-3 py-1.5 rounded bg-red-600 text-sm disabled:cursor-not-allowed disabled:opacity-80" disabled={deleteSubmitting} onClick={async () => {
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
              }}>{deleteSubmitting ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
