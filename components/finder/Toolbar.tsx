"use client";

import { useRef, useState } from "react";
import { 
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
  DocumentDuplicateIcon
} from "@heroicons/react/24/outline";
import { useCloud } from "./CloudContext";

export default function Toolbar() {
  const {
    provider,
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
    selectedFiles,
    renameFile,
    duplicateFile,
    uploadFiles,
    breadcrumbItems,
    navigateToBreadcrumb,
  } = useCloud();
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const handleCreateFolder = () => setFolderDialogOpen(true);
  const handleDelete = async () => setDeleteDialogOpen(true);

  const primarySelection = selectedFiles[0];
  const sizeOptions = [
    { value: "compact", label: "S" },
    { value: "comfortable", label: "M" },
    { value: "large", label: "L" },
  ] as const;
  const densityOptions = [
    { value: "tight", label: "T" },
    { value: "normal", label: "N" },
    { value: "airy", label: "A" },
  ] as const;

  return (
    <>
    <div className="h-14 border-b border-zinc-700/50 flex items-center justify-between px-4 bg-[#232325]/50 backdrop-blur-md">
      <div className="flex items-center gap-1">
        <button 
          className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors disabled:opacity-30"
          disabled={!canGoBack}
          onClick={navigateBack}
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <button
          className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors disabled:opacity-30"
          onClick={navigateForward}
          disabled={!canGoForward}
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
        
        <div className="h-4 w-px bg-zinc-700 mx-2" />
        
        <div className="ml-2 flex min-w-0 items-center gap-1 overflow-hidden">
          {breadcrumbItems.map((item, index) => {
            const isLast = index === breadcrumbItems.length - 1;
            return (
              <div key={`${item.id}-${index}`} className="flex min-w-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => navigateToBreadcrumb(index)}
                  className={`max-w-[180px] truncate rounded px-1.5 py-0.5 text-sm transition-colors ${
                    isLast
                      ? "font-semibold text-white"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                >
                  {item.name}
                </button>
                {!isLast && (
                  <BreadcrumbChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative group">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Search" 
            className="bg-black/40 border border-zinc-700/50 rounded-md pl-9 pr-3 py-1.5 text-sm w-48 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all group-hover:bg-black/60"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="h-4 w-px bg-zinc-700" />

        <div className="flex bg-black/40 rounded-md border border-zinc-700/50 p-0.5">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1 rounded transition-colors ${viewMode === "grid" ? "text-white bg-zinc-700/50 shadow-sm" : "text-zinc-400 hover:text-white"}`}
          >
            <Squares2X2Icon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1 rounded transition-colors ${viewMode === "list" ? "text-white bg-zinc-700/50 shadow-sm" : "text-zinc-400 hover:text-white"}`}
          >
            <ListBulletIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="h-4 w-px bg-zinc-700" />

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-zinc-700/50 bg-black/40 px-1 py-0.5">
            <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Size
            </span>
            <div className="flex gap-0.5">
              {sizeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setItemScale(option.value)}
                  className={`cursor-pointer rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                    itemScale === option.value
                      ? "bg-zinc-700/70 text-white shadow-sm"
                      : "text-zinc-400 hover:bg-white/6 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center rounded-md border border-zinc-700/50 bg-black/40 px-1 py-0.5">
            <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Spacing
            </span>
            <div className="flex gap-0.5">
              {densityOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setItemDensity(option.value)}
                  className={`cursor-pointer rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                    itemDensity === option.value
                      ? "bg-zinc-700/70 text-white shadow-sm"
                      : "text-zinc-400 hover:bg-white/6 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-4 w-px bg-zinc-700" />

        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (!primarySelection) return;
              setRenameValue(primarySelection.name);
              setRenameDialogOpen(true);
            }}
            disabled={loading || !primarySelection}
            className="flex items-center gap-2 px-2 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 border border-zinc-700/50 rounded-md text-sm font-medium transition-colors"
          >
            <PencilSquareIcon className="w-4 h-4 text-zinc-400" />
          </button>
          <button
            onClick={async () => {
              if (!primarySelection) return;
              await duplicateFile(primarySelection.id);
            }}
            disabled={loading || !primarySelection}
            className="flex items-center gap-2 px-2 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 border border-zinc-700/50 rounded-md text-sm font-medium transition-colors"
          >
            <DocumentDuplicateIcon className="w-4 h-4 text-zinc-400" />
          </button>
          {selection.length > 0 ? (
            <button 
              onClick={handleDelete}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-md text-sm font-medium text-red-500 transition-colors"
            >
              <TrashIcon className="w-4 h-4" />
              Delete ({selection.length})
            </button>
          ) : (
            <button 
              onClick={handleCreateFolder}
              disabled={loading || !provider}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 border border-zinc-700/50 rounded-md text-sm font-medium transition-colors"
            >
              <FolderPlusIcon className="w-4 h-4 text-zinc-400" />
              New Folder
            </button>
          )}
          <button 
            onClick={() => uploadRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 rounded-md text-sm font-medium text-white shadow-sm transition-colors"
            disabled={loading || !provider}
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
              if (e.target.files) {
                await uploadFiles(e.target.files);
                e.currentTarget.value = "";
              }
            }}
          />
        </div>
      </div>
    </div>
      {renameDialogOpen && primarySelection && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="w-[420px] rounded-xl border border-zinc-700 bg-[#1f1f21] p-5">
            <h3 className="text-lg font-semibold mb-3">Rename Item</h3>
            <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" />
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1.5 rounded bg-zinc-700 text-sm" onClick={() => setRenameDialogOpen(false)}>Cancel</button>
              <button className="px-3 py-1.5 rounded bg-blue-600 text-sm" onClick={async () => { await renameFile(primarySelection.id, renameValue); setRenameDialogOpen(false); }}>Rename</button>
            </div>
          </div>
        </div>
      )}
      {folderDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="w-[420px] rounded-xl border border-zinc-700 bg-[#1f1f21] p-5">
            <h3 className="text-lg font-semibold mb-3">Create Folder</h3>
            <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" placeholder="Folder name" />
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1.5 rounded bg-zinc-700 text-sm" onClick={() => setFolderDialogOpen(false)}>Cancel</button>
              <button className="px-3 py-1.5 rounded bg-blue-600 text-sm" onClick={async () => { await createFolder(newFolderName || "New Folder"); setFolderDialogOpen(false); setNewFolderName(""); }}>Create</button>
            </div>
          </div>
        </div>
      )}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="w-[420px] rounded-xl border border-zinc-700 bg-[#1f1f21] p-5">
            <h3 className="text-lg font-semibold mb-2">Move To Trash</h3>
            <p className="text-sm text-zinc-400">Selected items will be removed from current storage.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1.5 rounded bg-zinc-700 text-sm" onClick={() => setDeleteDialogOpen(false)}>Cancel</button>
              <button className="px-3 py-1.5 rounded bg-red-600 text-sm" onClick={async () => { await deleteSelected(); setDeleteDialogOpen(false); }}>Move</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
