import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Toast } from "./components/Toast";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { AddBookmarkModal } from "./components/AddBookmarkModal";
import { SettingsModal } from "./components/SettingsModal";
import { Sidebar } from "./components/Sidebar";
import { BookmarkList } from "./components/BookmarkList";
import { InspectorPanel } from "./components/InspectorPanel";
import { CollectionContextMenu } from "./components/CollectionContextMenu";
import { IconPicker } from "./components/IconPicker";
import { RenameCollectionModal } from "./components/RenameCollectionModal";
import { Bookmark } from "./types";
import { format } from "date-fns";
import { getYouTubeId } from "./utils";
import { cn } from "./lib/utils";
import { useApi } from "./hooks/useApi";
import { useUI } from "./hooks/useUI";
import { useInspector } from "./hooks/useInspector";
import { useCollections } from "./hooks/useCollections";
import { useBookmarks } from "./hooks/useBookmarks";
import { apiClient } from "./services/api";
import { buildCollectionTree } from "./utils/buildCollectionTree";

type ToastMessage = { message: string; type: "success" | "error" | "info" };
type SortBy = "date_desc" | "date_asc" | "title_asc" | "title_desc" | "domain_asc" | "domain_desc";
type FilterBy = "all" | "has_images" | "has_summary" | "has_content";

export default function App() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [isViewingTrash, setIsViewingTrash] = useState(false);
  const [isEditingCollections, setIsEditingCollections] = useState(false);
  const [selectedCollectionIdsForEdit, setSelectedCollectionIdsForEdit] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("sidebarWidth");
    return saved ? parseInt(saved, 10) : 256;
  });
  const [isSidebarDragging, setIsSidebarDragging] = useState(false);

  useEffect(() => {
    if (!isSidebarDragging) {
      localStorage.setItem("sidebarWidth", sidebarWidth.toString());
    }
  }, [isSidebarDragging, sidebarWidth]);

  useEffect(() => {
    if (!isSidebarDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(400, e.clientX));
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsSidebarDragging(false);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isSidebarDragging]);

  const api = useApi(setToast);
  const ui = useUI();
  const insp = useInspector();
  const bm = useBookmarks(setToast);
  const coll = useCollections(api.collections, api.fetchCollections, api.spaces, setToast, (deletedId) => {
    if (selectedCollectionId === deletedId) setSelectedCollectionId(null);
  });

  const fetchBookmarks = useCallback(async () => {
    await bm.fetchBookmarks(selectedCollectionId, null, selectedDomain);
  }, [bm.fetchBookmarks, selectedCollectionId, selectedDomain]);

  const fetchAll = useCallback(async () => {
    await Promise.all([api.fetchSpaces(), api.fetchCollections(), api.fetchDomains()]);
  }, [api.fetchSpaces, api.fetchCollections, api.fetchDomains]);

  useEffect(() => { api.initialize(); }, []);

  useEffect(() => {
    if (isViewingTrash) {
      apiClient.bookmarks.listTrash().then((data) => {
        bm.setBookmarks(Array.isArray(data) ? data : []);
      });
    } else {
      bm.fetchBookmarks(selectedCollectionId, null, selectedDomain);
    }
    bm.setSelectedBookmark(null);
    insp.setIsInspectorOpen(false);
    insp.setReaderContent(null);
  }, [selectedCollectionId, selectedDomain, isViewingTrash]);

  const handleSelectCollection = useCallback((id: string | null) => {
    setSelectedCollectionId(id);
    if (id) setSelectedDomain(null);
    setIsViewingTrash(false);
  }, []);
  const handleSelectDomain = useCallback((d: string | null) => {
    setSelectedDomain(d);
    if (d) setSelectedCollectionId(null);
    setIsViewingTrash(false);
  }, []);
  const handleSelectTrash = useCallback(() => {
    setIsViewingTrash(true);
    setSelectedCollectionId(null);
    setSelectedDomain(null);
  }, []);

  const handleCreateGroup = useCallback(async () => {
    if (!newGroupName.trim()) {
      setToast({ message: "Please enter a name", type: "error" });
      return;
    }
    try {
      await apiClient.spaces.create({ name: newGroupName.trim() });
      setNewGroupName("");
      setIsCreatingGroup(false);
      await api.fetchSpaces();
      setToast({ message: "Group created", type: "success" });
    } catch {
      setToast({ message: "Failed to create group", type: "error" });
    }
  }, [newGroupName, api.fetchSpaces]);

  useEffect(() => {
    if (bm.selectedBookmark) {
      if (getYouTubeId(bm.selectedBookmark.url)) {
        insp.setInspectorTab("video");
      } else {
        insp.setInspectorTab((prev) => (prev === "video" ? "details" : prev));
      }
    }
  }, [bm.selectedBookmark?.id]);

  const handleRefreshBookmark = useCallback(
    async (id: string, skipFetch = false) => {
      await bm.handleRefreshBookmark(id, skipFetch, fetchBookmarks, fetchAll);
    },
    [bm.handleRefreshBookmark, fetchBookmarks, fetchAll]
  );

  const handleAddBookmark = useCallback(
    async (newUrls: string, collectionIds?: string[]) => {
      await bm.handleAddBookmark(newUrls, collectionIds, fetchBookmarks, fetchAll, handleRefreshBookmark);
    },
    [bm.handleAddBookmark, fetchBookmarks, fetchAll, handleRefreshBookmark]
  );

  const handleDeleteBookmark = useCallback(
    async (id: string) => {
      await bm.handleDeleteBookmark(id, fetchBookmarks, fetchAll);
    },
    [bm.handleDeleteBookmark, fetchBookmarks, fetchAll]
  );

  const handleBulkDelete = useCallback(
    async () => { await bm.handleBulkDelete(fetchBookmarks, fetchAll); },
    [bm.handleBulkDelete, fetchBookmarks, fetchAll]
  );

  const handleBulkRefresh = useCallback(
    async () => { await bm.handleBulkRefresh(fetchBookmarks, fetchAll, handleRefreshBookmark); },
    [bm.handleBulkRefresh, fetchBookmarks, fetchAll, handleRefreshBookmark]
  );

  const handleUpdateBookmarkCollections = useCallback(
    async (bookmarkId: string, collectionIds: string[]) => {
      await bm.handleUpdateBookmarkCollections(bookmarkId, collectionIds, fetchBookmarks, api.fetchCollections);
    },
    [bm.handleUpdateBookmarkCollections, fetchBookmarks, api.fetchCollections]
  );

  const handleCategorizeAll = useCallback(
    async () => { await bm.handleCategorizeAll(fetchBookmarks, api.fetchCollections); },
    [bm.handleCategorizeAll, fetchBookmarks, api.fetchCollections]
  );

  const handleBackup = useCallback(async () => {
    try {
      const data = await apiClient.get<any>("/api/backup");
      const jsonString = JSON.stringify(data, null, 2);
      try {
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bookmarks-backup-${format(new Date(), "yyyy-MM-dd-HH-mm")}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setToast({ message: "Backup downloaded successfully", type: "success" });
      } catch {
        await navigator.clipboard.writeText(jsonString);
        setToast({ message: "Backup copied to clipboard (download blocked by browser)", type: "success" });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to generate backup";
      setToast({ message: msg, type: "error" });
    }
  }, []);

  const handleRestore = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    bm.setConfirmDialog({
      isOpen: true,
      title: "Restore Backup",
      message: "Are you sure you want to restore this backup? This will OVERWRITE all your current bookmarks and collections. This action cannot be undone.",
      onConfirm: async () => {
        try {
          const text = await file.text();
          const backupData = JSON.parse(text);
          if (!backupData.version || !backupData.data) throw new Error("Invalid backup file format");
          await apiClient.post("/api/restore", backupData);
          setToast({ message: "Backup restored successfully", type: "success" });
          bm.setSelectedBookmark(null);
          setSelectedCollectionId(null);
          setSelectedDomain(null);
          await fetchBookmarks();
          await fetchAll();
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : "Failed to restore backup";
          setToast({ message: msg, type: "error" });
        } finally {
          e.target.value = "";
        }
      },
    });
  }, [fetchBookmarks, fetchAll]);

  const allCollectionsTree = useMemo(
    () => buildCollectionTree(api.collections, null),
    [api.collections]
  );

  const filteredBookmarks = useMemo(
    () =>
      bm.bookmarks
        .filter((b) => {
          const q = ui.searchQuery.toLowerCase();
          const matchesSearch =
            b.title?.toLowerCase().includes(q) || b.description?.toLowerCase().includes(q) || b.url.toLowerCase().includes(q);
          if (!matchesSearch) return false;
          if (ui.filterBy === "has_images") return b.images_json && b.images_json !== "[]";
          if (ui.filterBy === "has_summary") return !!b.description && b.description.length > 0;
          if (ui.filterBy === "has_content") return !!b.content_text && b.content_text.length > 0;
          return true;
        })
        .sort((a, b) => {
          switch (ui.sortBy) {
            case "date_asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            case "date_desc": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            case "title_asc": return (a.title || "").localeCompare(b.title || "");
            case "title_desc": return (b.title || "").localeCompare(a.title || "");
            case "domain_asc": return (a.domain || "").localeCompare(b.domain || "");
            case "domain_desc": return (b.domain || "").localeCompare(a.domain || "");
            default: return 0;
          }
        }),
    [bm.bookmarks, ui.searchQuery, ui.filterBy, ui.sortBy]
  );

  const toggleSelectAll = useCallback(() => {
    if (bm.selectedBookmarkIds.size === filteredBookmarks.length && filteredBookmarks.length > 0) bm.setSelectedBookmarkIds(new Set());
    else bm.setSelectedBookmarkIds(new Set(filteredBookmarks.map((b) => b.id)));
  }, [bm.selectedBookmarkIds, filteredBookmarks]);

  const onSelectBookmark = useCallback((bookmark: Bookmark) => {
    bm.setSelectedBookmark(bookmark);
    insp.setReaderContent(null);
    insp.setInspectorTab("details");
    insp.setIsInspectorOpen(true);
  }, [insp]);

  return (
    <>
      {api.isInitializing && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600 font-medium">Loading LinkHub...</p>
          </div>
        </div>
      )}
      <div className={cn("flex h-screen w-full bg-[#f8f9fa] text-slate-800 font-sans overflow-hidden", (insp.isDragging || isSidebarDragging) && "select-none", insp.isDragging && "cursor-col-resize", isSidebarDragging && "cursor-col-resize")}>
        <Sidebar
          arboristData={coll.arboristData}
          domains={api.domains}
          pinnedDomains={ui.pinnedDomains}
          selectedCollectionId={selectedCollectionId}
          selectedDomain={selectedDomain}
          isViewingTrash={isViewingTrash}
          isCreatingCollection={coll.isCreatingCollection}
          isCreatingGroup={isCreatingGroup}
          newCollectionName={coll.newCollectionName}
          newGroupName={newGroupName}
          setIsCreatingCollection={coll.setIsCreatingCollection}
          setNewCollectionName={coll.setNewCollectionName}
          handleCreateCollection={coll.handleCreateCollection}
          createCollectionSpaceId={coll.createCollectionSpaceId}
          setCreateCollectionSpaceId={coll.setCreateCollectionSpaceId}
          setIsCreatingGroup={setIsCreatingGroup}
          setNewGroupName={setNewGroupName}
          handleCreateGroup={handleCreateGroup}
          onSelectCollection={handleSelectCollection}
          onSelectDomain={handleSelectDomain}
          onSelectTrash={handleSelectTrash}
          togglePinDomain={ui.togglePinDomain}
          onCollectionContextMenu={coll.handleContextMenu}
          onArboristMove={coll.handleArboristMove}
          sidebarWidth={sidebarWidth}
          onSidebarResizeStart={() => setIsSidebarDragging(true)}
          setIsSettingsOpen={setIsSettingsOpen}
          setIsAdding={bm.setIsAdding}
        />

        <BookmarkList
          filteredBookmarks={filteredBookmarks}
          viewMode={ui.viewMode}
          itemSize={ui.itemSize}
          selectedBookmarkIds={bm.selectedBookmarkIds}
          selectedBookmark={bm.selectedBookmark}
          refreshingBookmarkIds={bm.refreshingBookmarkIds}
          searchQuery={ui.searchQuery}
          sortBy={ui.sortBy}
          filterBy={ui.filterBy}
          selectedCollectionId={selectedCollectionId}
          selectedTagId={null}
          selectedDomain={selectedDomain}
          collections={api.collections}
          tags={[]}
          onSelectBookmark={onSelectBookmark}
          onToggleSelectAll={toggleSelectAll}
          onToggleBookmarkSelection={bm.toggleBookmarkSelection}
          onSearchChange={ui.setSearchQuery}
          onSortChange={ui.setSortBy}
          onFilterChange={ui.setFilterBy}
          onViewModeChange={ui.setViewMode}
          onItemSizeChange={ui.setItemSize}
          onBulkDelete={handleBulkDelete}
          onBulkRefresh={handleBulkRefresh}
          onDismissInspector={() => insp.setIsInspectorOpen(false)}
        />

        <InspectorPanel
          selectedBookmark={bm.selectedBookmark}
          isInspectorOpen={insp.isInspectorOpen}
          inspectorWidth={insp.inspectorWidth}
          isDragging={insp.isDragging}
          inspectorTab={insp.inspectorTab}
          webPreviewMode={insp.webPreviewMode}
          webPreviewKey={insp.webPreviewKey}
          readerContent={insp.readerContent}
          isReaderLoading={insp.isReaderLoading}
          refreshingBookmarkIds={bm.refreshingBookmarkIds}
          isEditingCollections={isEditingCollections}
          selectedCollectionIdsForEdit={selectedCollectionIdsForEdit}
          allCollectionsTree={allCollectionsTree}
          onTabChange={insp.setInspectorTab}
          onClose={() => insp.setIsInspectorOpen(false)}
          onResizeStart={insp.handleMouseDown}
          onLoadReaderView={insp.loadReaderView}
          onWebPreviewModeChange={insp.setWebPreviewMode}
          onWebPreviewKeyChange={insp.setWebPreviewKey}
          onRefreshBookmark={handleRefreshBookmark}
          onDeleteBookmark={handleDeleteBookmark}
          onUpdateBookmarkCollections={handleUpdateBookmarkCollections}
          onToggleEditingCollections={() => {
            if (isEditingCollections) {
              handleUpdateBookmarkCollections(bm.selectedBookmark!.id, selectedCollectionIdsForEdit);
              setIsEditingCollections(false);
            } else {
              setSelectedCollectionIdsForEdit(bm.selectedBookmark?.collections?.map((c) => c.id) || []);
              setIsEditingCollections(true);
            }
          }}
          onSelectCollectionForEdit={(id, checked) => {
            if (checked) setSelectedCollectionIdsForEdit((prev) => [...prev, id]);
            else setSelectedCollectionIdsForEdit((prev) => prev.filter((x) => x !== id));
          }}
          getYouTubeId={getYouTubeId}
        />
      </div>

      <AddBookmarkModal
        isOpen={bm.isAdding}
        isLoading={bm.isAddingLoading}
        onClose={() => bm.setIsAdding(false)}
        onSubmit={handleAddBookmark}
        collections={api.collections}
        defaultCollectionIds={selectedCollectionId ? [selectedCollectionId] : []}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onBackup={handleBackup}
        onRestore={handleRestore}
        setToast={setToast}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />

      <ConfirmDialog
        isOpen={bm.confirmDialog.isOpen}
        title={bm.confirmDialog.title}
        message={bm.confirmDialog.message}
        onConfirm={bm.confirmDialog.onConfirm}
        onCancel={() => bm.setConfirmDialog({ ...bm.confirmDialog, isOpen: false })}
      />

      {coll.contextMenu && (() => {
        const s = coll.getSiblings(coll.contextMenu.collection.id);
        const i = s.findIndex(c => c.id === coll.contextMenu.collection.id);
        return (
          <CollectionContextMenu
            collection={coll.contextMenu.collection}
            position={coll.contextMenu.position}
            onClose={() => coll.setContextMenu(null)}
            onRename={coll.setRenamingCollection}
            onChangeIcon={coll.setIconPickerCollection}
            onDelete={coll.handleDeleteCollection}
            onMoveUp={coll.handleMoveCollectionUp}
            onMoveDown={coll.handleMoveCollectionDown}
            onMoveOut={coll.handleMoveCollectionOut}
            canMoveUp={i > 0}
            canMoveDown={i >= 0 && i < s.length - 1}
            canMoveOut={!!coll.contextMenu.collection.parent_id}
          />
        );
      })()}

      {coll.renamingCollection && (
        <RenameCollectionModal
          currentName={coll.renamingCollection.name}
          onSubmit={coll.handleRenameSubmit}
          onClose={() => coll.setRenamingCollection(null)}
        />
      )}

      {coll.iconPickerCollection && (
        <IconPicker
          currentIcon={coll.iconPickerCollection.icon || "Folder"}
          onSelect={coll.handleChangeIconSubmit}
          onClose={() => coll.setIconPickerCollection(null)}
        />
      )}
    </>
  );
}
