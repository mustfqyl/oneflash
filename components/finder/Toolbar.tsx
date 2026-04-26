"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bars3Icon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon as BreadcrumbChevronRightIcon,
  ChevronRightIcon, 
  Squares2X2Icon, 
  ListBulletIcon,
  FolderPlusIcon,
  ArrowUpTrayIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  PencilSquareIcon,
  DocumentDuplicateIcon,
  AdjustmentsVerticalIcon,
  ViewColumnsIcon,
  ArrowsUpDownIcon,
  CheckIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import CloudActionTargetDialog, {
  buildCloudActionTargetOptions,
} from "./CloudActionTargetDialog";
import {
  type CloudActionTarget,
  type FinderItemScale,
  type FinderItemDensity,
  type SortBy,
  useCloud,
} from "./CloudContext";

const SCALE_OPTIONS: { value: FinderItemScale; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Medium" },
  { value: "large", label: "Large" },
];

const DENSITY_OPTIONS: { value: FinderItemDensity; label: string }[] = [
  { value: "tight", label: "Tight" },
  { value: "normal", label: "Normal" },
  { value: "airy", label: "Airy" },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "dateModified", label: "Date Modified" },
  { value: "size", label: "Size" },
  { value: "kind", label: "Kind" },
];

export default function Toolbar({
  onOpenSidebar,
}: {
  onOpenSidebar?: () => void;
}) {
  const {
    currentLocationProvider,
    currentLocationAccountId,
    loading,
    selection,
    deleteSelected,
    createFolder,
    navigateBack,
    navigateForward,
    canGoBack,
    canGoForward,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    itemScale,
    setItemScale,
    itemDensity,
    setItemDensity,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
    selectedFiles,
    renameFile,
    duplicateFile,
    uploadFiles,
    breadcrumbItems,
    navigateToBreadcrumb,
    connectedProviders,
    connectedAccountsByProvider,
  } = useCloud();
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameSubmitting, setRenameSubmitting] = useState(false);
  const [folderSubmitting, setFolderSubmitting] = useState(false);
  const [targetDialogAction, setTargetDialogAction] = useState<"folder" | "upload" | null>(null);
  const [pendingFolderTarget, setPendingFolderTarget] = useState<CloudActionTarget | null>(null);
  const [pendingUploadTarget, setPendingUploadTarget] = useState<CloudActionTarget | null>(null);
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const [spacingMenuOpen, setSpacingMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sizeMenuRef = useRef<HTMLDivElement | null>(null);
  const spacingMenuRef = useRef<HTMLDivElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const handleDelete = async () => setDeleteDialogOpen(true);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sizeMenuRef.current && !sizeMenuRef.current.contains(event.target as Node)) {
        setSizeMenuOpen(false);
      }
      if (spacingMenuRef.current && !spacingMenuRef.current.contains(event.target as Node)) {
        setSpacingMenuOpen(false);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setSortMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const primarySelection = selectedFiles[0];
  const actionTargetOptions = buildCloudActionTargetOptions({
    currentLocationProvider,
    connectedProviders,
    connectedAccountsByProvider,
  });
  const canStartCloudWriteAction =
    Boolean(currentLocationAccountId) || actionTargetOptions.length > 0;
  const dialogButtonBaseClass =
    "motion-hover-lift motion-press inline-flex min-w-[96px] items-center justify-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 active:scale-[0.98] disabled:cursor-not-allowed";
  const dialogSecondaryButtonClass = `${dialogButtonBaseClass} bg-surface-elevated text-foreground hover:bg-hover disabled:opacity-50`;
  const dialogPrimaryButtonClass = `${dialogButtonBaseClass} bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-80`;
  const dialogDangerButtonClass = `${dialogButtonBaseClass} bg-red-600 text-white hover:bg-red-500 disabled:opacity-80`;
  const pendingFolderTargetLabel =
    pendingFolderTarget &&
    actionTargetOptions.find(
      (option) =>
        option.provider === pendingFolderTarget.provider &&
        option.accountId === pendingFolderTarget.accountId
    );

  const startFolderFlow = () => {
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

  const startUploadFlow = () => {
    if (currentLocationAccountId) {
      setPendingUploadTarget(null);
      uploadRef.current?.click();
      return;
    }

    if (actionTargetOptions.length === 1) {
      setPendingUploadTarget(actionTargetOptions[0]);
      uploadRef.current?.click();
      return;
    }

    if (actionTargetOptions.length > 1) {
      setTargetDialogAction("upload");
    }
  };

  const handleTargetSelect = (target: CloudActionTarget) => {
    setTargetDialogAction(null);

    if (targetDialogAction === "folder") {
      setPendingFolderTarget(target);
      setFolderDialogOpen(true);
      return;
    }

    setPendingUploadTarget(target);
    uploadRef.current?.click();
  };

  const handleRenameSubmit = async () => {
    if (!primarySelection || renameSubmitting) {
      return;
    }

    setRenameSubmitting(true);

    try {
      await renameFile(primarySelection.id, renameValue);
      setRenameDialogOpen(false);
    } finally {
      setRenameSubmitting(false);
    }
  };

  const handleCreateFolderSubmit = async () => {
    if (folderSubmitting) {
      return;
    }

    setFolderSubmitting(true);

    try {
      await createFolder(newFolderName || "New Folder", pendingFolderTarget || undefined);
      setFolderDialogOpen(false);
      setNewFolderName("");
      setPendingFolderTarget(null);
    } finally {
      setFolderSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (deleteSubmitting) {
      return;
    }

    setDeleteSubmitting(true);

    try {
      await deleteSelected();
      setDeleteDialogOpen(false);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <>
    <div className="motion-enter motion-enter-delay-1 relative z-[60] flex h-14 items-center justify-between border-b border-border bg-window-chrome px-4 backdrop-blur-md">
      <div className="flex items-center gap-1">
        {onOpenSidebar ? (
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={onOpenSidebar}
            className="motion-press mr-1 rounded-md p-1.5 text-muted transition-colors hover:bg-hover hover:text-foreground md:hidden"
          >
            <Bars3Icon className="h-5 w-5" />
          </button>
        ) : null}
        <button 
          aria-label="Go back"
          className="motion-press rounded-md p-1.5 text-muted transition-colors hover:bg-hover hover:text-foreground disabled:opacity-30"
          disabled={!canGoBack}
          onClick={navigateBack}
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <button
          aria-label="Go forward"
          className="motion-press rounded-md p-1.5 text-muted transition-colors hover:bg-hover hover:text-foreground disabled:opacity-30"
          onClick={navigateForward}
          disabled={!canGoForward}
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
        
        <div className="mx-2 h-4 w-px bg-border-strong" />
        
        <div className="ml-2 flex min-w-0 items-center gap-1 overflow-hidden">
          {breadcrumbItems.map((item, index) => {
            const isLast = index === breadcrumbItems.length - 1;
            return (
              <div key={`${item.id}-${index}`} className="flex min-w-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => navigateToBreadcrumb(index)}
                  className={`motion-nav-item max-w-[180px] truncate rounded px-1.5 py-0.5 text-sm transition-colors ${
                    isLast
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-hover hover:text-foreground"
                  }`}
                >
                  {item.name}
                </button>
                {!isLast && (
                  <BreadcrumbChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="group relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input 
            type="text" 
            placeholder="Search" 
            className="motion-hover-lift w-48 rounded-md border border-border bg-input py-1.5 pl-9 pr-3 text-sm text-foreground transition-all placeholder:text-muted focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 group-hover:bg-input-soft"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="h-4 w-px bg-border-strong" />

        {/* Size dropdown */}
        <div ref={sizeMenuRef} className="relative">
          <button
            aria-label="Item size"
            onClick={() => { setSizeMenuOpen(!sizeMenuOpen); setSpacingMenuOpen(false); setSortMenuOpen(false); }}
            className={`motion-press rounded-md p-1.5 transition-colors ${sizeMenuOpen ? "bg-hover-strong text-foreground" : "text-muted hover:bg-hover hover:text-foreground"}`}
          >
            <AdjustmentsVerticalIcon className="w-4.5 h-4.5" />
          </button>
          {sizeMenuOpen && (
            <div className="absolute right-0 top-full z-[100] mt-1.5 w-40 rounded-xl border border-border-strong bg-surface-elevated p-1.5 shadow-2xl">
              <div className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted">Size</div>
              {SCALE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => { setItemScale(option.value); setSizeMenuOpen(false); }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                    itemScale === option.value
                      ? "bg-blue-500/10 text-blue-400 font-medium"
                      : "text-foreground hover:bg-hover"
                  }`}
                >
                  {option.label}
                  {itemScale === option.value && <CheckIcon className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Spacing dropdown */}
        <div ref={spacingMenuRef} className="relative">
          <button
            aria-label="Item spacing"
            onClick={() => { setSpacingMenuOpen(!spacingMenuOpen); setSizeMenuOpen(false); setSortMenuOpen(false); }}
            className={`motion-press rounded-md p-1.5 transition-colors ${spacingMenuOpen ? "bg-hover-strong text-foreground" : "text-muted hover:bg-hover hover:text-foreground"}`}
          >
            <ViewColumnsIcon className="w-4.5 h-4.5" />
          </button>
          {spacingMenuOpen && (
            <div className="absolute right-0 top-full z-[100] mt-1.5 w-40 rounded-xl border border-border-strong bg-surface-elevated p-1.5 shadow-2xl">
              <div className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted">Spacing</div>
              {DENSITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => { setItemDensity(option.value); setSpacingMenuOpen(false); }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                    itemDensity === option.value
                      ? "bg-blue-500/10 text-blue-400 font-medium"
                      : "text-foreground hover:bg-hover"
                  }`}
                >
                  {option.label}
                  {itemDensity === option.value && <CheckIcon className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort dropdown */}
        <div ref={sortMenuRef} className="relative">
          <button
            aria-label="Sort files"
            onClick={() => { setSortMenuOpen(!sortMenuOpen); setSizeMenuOpen(false); setSpacingMenuOpen(false); }}
            className={`motion-press rounded-md p-1.5 transition-colors ${sortMenuOpen ? "bg-hover-strong text-foreground" : "text-muted hover:bg-hover hover:text-foreground"}`}
          >
            <ArrowsUpDownIcon className="w-4.5 h-4.5" />
          </button>
          {sortMenuOpen && (
            <div className="absolute right-0 top-full z-[100] mt-1.5 w-52 rounded-xl border border-border-strong bg-surface-elevated p-1.5 shadow-2xl">
              <div className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted">Sort By</div>
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    if (sortBy === option.value) {
                      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy(option.value);
                      // Default to desc for dates and sizes, asc for name and kind
                      if (option.value === "dateModified" || option.value === "size") {
                        setSortDirection("desc");
                      } else {
                        setSortDirection("asc");
                      }
                    }
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                    sortBy === option.value
                      ? "bg-blue-500/10 text-blue-400 font-medium"
                      : "text-foreground hover:bg-hover"
                  }`}
                >
                  {option.label}
                  {sortBy === option.value && (
                    sortDirection === "asc"
                      ? <ChevronUpIcon className="h-3.5 w-3.5" />
                      : <ChevronDownIcon className="h-3.5 w-3.5" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-border-strong" />

        <div className="flex rounded-md border border-border bg-input p-0.5">
          <button
            aria-label="Grid view"
            onClick={() => setViewMode("grid")}
            className={`motion-press rounded p-1 transition-colors ${viewMode === "grid" ? "bg-hover-strong text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
          >
            <Squares2X2Icon className="w-4 h-4" />
          </button>
          <button
            aria-label="List view"
            onClick={() => setViewMode("list")}
            className={`motion-press rounded p-1 transition-colors ${viewMode === "list" ? "bg-hover-strong text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
          >
            <ListBulletIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="h-4 w-px bg-border-strong" />
        
        <div className="flex gap-2">
          <button
            aria-label="Rename selected item"
            onClick={async () => {
              if (!primarySelection) return;
              setRenameValue(primarySelection.name);
              setRenameDialogOpen(true);
            }}
            disabled={loading || !primarySelection}
            className="motion-hover-lift motion-press flex items-center gap-2 rounded-md border border-border bg-surface-subtle px-2 py-1.5 text-sm font-medium transition-colors hover:bg-hover disabled:opacity-50"
          >
            <PencilSquareIcon className="h-4 w-4 text-muted" />
          </button>
          <button
            aria-label="Duplicate selected item"
            onClick={async () => {
              if (!primarySelection) return;
              await duplicateFile(primarySelection.id);
            }}
            disabled={loading || !primarySelection}
            className="motion-hover-lift motion-press flex items-center gap-2 rounded-md border border-border bg-surface-subtle px-2 py-1.5 text-sm font-medium transition-colors hover:bg-hover disabled:opacity-50"
          >
            <DocumentDuplicateIcon className="h-4 w-4 text-muted" />
          </button>
          {selection.length > 0 ? (
            <button 
              onClick={handleDelete}
              disabled={loading}
              className="motion-hover-lift motion-press flex items-center gap-2 rounded-md border border-red-500/50 bg-red-500/20 px-3 py-1.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/30"
            >
              <TrashIcon className="w-4 h-4" />
              Delete ({selection.length})
            </button>
          ) : (
            <button 
              onClick={startFolderFlow}
              disabled={loading || !canStartCloudWriteAction}
              className="motion-hover-lift motion-press flex items-center gap-2 rounded-md border border-border bg-surface-subtle px-3 py-1.5 text-sm font-medium transition-colors hover:bg-hover disabled:opacity-50"
            >
              <FolderPlusIcon className="h-4 w-4 text-muted" />
              New Folder
            </button>
          )}
          <button 
            onClick={startUploadFlow}
            className="motion-hover-lift motion-press flex items-center gap-2 rounded-md bg-blue-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500"
            disabled={loading || !canStartCloudWriteAction}
          >
            <ArrowUpTrayIcon className="w-4 h-4" />
            Upload
          </button>
          <input
            ref={uploadRef}
            className="hidden"
            type="file"
            multiple
            onChange={async (e) => {
              const input = e.currentTarget;
              const { files } = input;
              if (files) {
                await uploadFiles(files, pendingUploadTarget || undefined);
                setPendingUploadTarget(null);
                input.value = "";
              }
            }}
          />
        </div>
      </div>
    </div>
      {renameDialogOpen && primarySelection && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay px-4 backdrop-blur-sm">
          <div
            aria-busy={renameSubmitting}
            aria-modal="true"
            className="w-full max-w-[420px] rounded-xl border border-border bg-surface p-5"
            role="dialog"
          >
            <h3 className="mb-3 text-lg font-semibold">Rename Item</h3>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              disabled={renameSubmitting}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                className={dialogSecondaryButtonClass}
                disabled={renameSubmitting}
                onClick={() => setRenameDialogOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={dialogPrimaryButtonClass}
                disabled={renameSubmitting}
                onClick={handleRenameSubmit}
                type="button"
              >
                {renameSubmitting ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
                {renameSubmitting ? "Renaming..." : "Rename"}
              </button>
            </div>
          </div>
        </div>
      )}
      {folderDialogOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay px-4 backdrop-blur-sm">
          <div
            aria-busy={folderSubmitting}
            aria-modal="true"
            className="w-full max-w-[420px] rounded-xl border border-border bg-surface p-5"
            role="dialog"
          >
            <h3 className="mb-3 text-lg font-semibold">Create Folder</h3>
            {pendingFolderTargetLabel ? (
              <p className="mb-3 text-sm text-muted-foreground">
                Create in {pendingFolderTargetLabel.providerLabel} / {pendingFolderTargetLabel.accountLabel}
              </p>
            ) : null}
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              disabled={folderSubmitting}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
              placeholder="Folder name"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                className={dialogSecondaryButtonClass}
                disabled={folderSubmitting}
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
                disabled={folderSubmitting}
                onClick={handleCreateFolderSubmit}
                type="button"
              >
                {folderSubmitting ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
                {folderSubmitting ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
      <CloudActionTargetDialog
        open={targetDialogAction !== null}
        title={
          targetDialogAction === "folder"
            ? "Choose Folder Destination"
            : "Choose Upload Destination"
        }
        description={
          targetDialogAction === "folder"
            ? "Pick which connected account should receive the new folder."
            : "Pick which connected account should receive the uploaded files."
        }
        options={actionTargetOptions}
        onClose={() => setTargetDialogAction(null)}
        onSelect={handleTargetSelect}
      />
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay px-4 backdrop-blur-sm">
          <div
            aria-busy={deleteSubmitting}
            aria-modal="true"
            className="w-full max-w-[420px] rounded-xl border border-border bg-surface p-5"
            role="dialog"
          >
            <h3 className="mb-2 text-lg font-semibold">Move To Trash</h3>
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
                onClick={handleDeleteSubmit}
                type="button"
              >
                {deleteSubmitting ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
                {deleteSubmitting ? "Moving..." : "Move"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
