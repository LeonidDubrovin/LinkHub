import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Toast } from "./components/Toast";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { AddBookmarkModal } from "./components/AddBookmarkModal";
import { SettingsModal } from "./components/SettingsModal";
import { Sidebar } from "./components/Sidebar";
import { BookmarkList } from "./components/BookmarkList";
import { InspectorPanel } from "./components/InspectorPanel";
import { CollectionContextMenu } from "./components/CollectionContextMenu";
import { SpaceContextMenu } from "./components/SpaceContextMenu";
import { BookmarkContextMenu } from "./components/BookmarkContextMenu";
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
import { usePaginatedBookmarks, usePaginatedTrash } from "./hooks/usePaginatedBookmarks";
import { apiClient } from "./services/api";
import { buildCollectionTree } from "./utils/buildCollectionTree";

function CollectionContextMenuWrapper({
  contextMenu,
  getSiblings,
  onClose,
  onRename,
  onChangeIcon,
  onDelete,
  onMoveUp,
  onMoveDown,
  onMoveOut,
}: {
  contextMenu: { collection: import("./types").Collection; position: { x: number; y: number } };
  getSiblings: (id: string) => import("./types").Collection[];
  onClose: () => void;
  onRename: (c: import("./types").Collection) => void;
  onChangeIcon: (c: import("./types").Collection) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onMoveOut: (id: string) => void;
}) {
  const siblings = getSiblings(contextMenu.collection.id);
  const index = siblings.findIndex((c) => c.id === contextMenu.collection.id);
  return (
    <CollectionContextMenu
      collection={contextMenu.collection}
      position={contextMenu.position}
      onClose={onClose}
      onRename={onRename}
      onChangeIcon={onChangeIcon}
      onDelete={onDelete}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onMoveOut={onMoveOut}
      canMoveUp={index > 0}
      canMoveDown={index >= 0 && index < siblings.length - 1}
      canMoveOut={!!contextMenu.collection.parent_id}
    />
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

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
  const [bookmarkContextMenu, setBookmarkContextMenu] = useState<{ bookmark: Bookmark; position: { x: number; y: number } } | null>(null);

  const queryClient = useQueryClient();
  const invalidateBookmarks = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    queryClient.invalidateQueries({ queryKey: ["trash"] });
  }, [queryClient]);

  const api = useApi(setToast);
  const ui = useUI();
  const insp = useInspector();
  const bm = useBookmarks(setToast, invalidateBookmarks);
  const coll = useCollections(api.collections, api.fetchCollections, api.fetchSpaces, api.spaces, setToast, (deletedId) => {
    if (selectedCollectionId === deletedId) setSelectedCollectionId(null);
  });

  const debouncedSearchQuery = useDebounce(ui.searchQuery, 300);

  const {
    bookmarks,
    total,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch: refetchBookmarks,
  } = usePaginatedBookmarks(
    !isViewingTrash ? selectedCollectionId : null,
    !isViewingTrash ? selectedDomain : null,
    debouncedSearchQuery,
    ui.sortBy,
    ui.filterBy,
    !isViewingTrash
  );

  const {
    trashItems,
    total: trashTotal,
    fetchNextPage: fetchNextTrashPage,
    hasNextPage: hasNextTrashPage,
    isFetchingNextPage: isFetchingNextTrashPage,
    isLoading: isTrashLoading,
    refetch: refetchTrash,
  } = usePaginatedTrash(
    isViewingTrash ? debouncedSearchQuery : "",
    ui.sortBy,
    isViewingTrash
  );

  const currentBookmarks = isViewingTrash ? trashItems : bookmarks;
  const currentTotal = isViewingTrash ? trashTotal : total;
  const currentFetchNextPage = isViewingTrash ? fetchNextTrashPage : fetchNextPage;
  const currentHasNextPage = isViewingTrash ? hasNextTrashPage : hasNextPage;
  const currentIsFetchingNextPage = isViewingTrash ? isFetchingNextTrashPage : isFetchingNextPage;
  const currentRefetch = isViewingTrash ? refetchTrash : refetchBookmarks;

  const fetchAll = useCallback(async () => {
    await Promise.all([api.fetchSpaces(), api.fetchCollections(), api.fetchTags(), api.fetchDomains()]);
  }, [api.fetchSpaces, api.fetchCollections, api.fetchTags, api.fetchDomains]);

  useEffect(() => { api.initialize(); }, []);

  useEffect(() => {
    bm.setSelectedBookmark(null);
    bm.setSelectedBookmarkIds(new Set());
    insp.setIsInspectorOpen(false);
    insp.setReaderContent(null);
  }, [selectedCollectionId, selectedDomain, isViewingTrash]);

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
      await bm.handleRefreshBookmark(id, skipFetch, currentRefetch, fetchAll);
    },
    [bm.handleRefreshBookmark, currentRefetch, fetchAll]
  );

  const handleAddBookmark = useCallback(
    async (newUrls: string, collectionIds?: string[]) => {
      await bm.handleAddBookmark(newUrls, collectionIds, currentRefetch, fetchAll, handleRefreshBookmark);
    },
    [bm.handleAddBookmark, currentRefetch, fetchAll, handleRefreshBookmark]
  );

  const handleDeleteBookmark = useCallback(
    async (bookmark: Bookmark, currentCollectionId?: string | null) => {
      await bm.handleDeleteBookmark(bookmark, currentCollectionId, currentRefetch, fetchAll);
    },
    [bm.handleDeleteBookmark, currentRefetch, fetchAll]
  );

  const handleRemoveFromCollection = useCallback(
    async (bookmark: Bookmark, collectionId: string) => {
      await bm.handleRemoveFromCollection(bookmark, collectionId, currentRefetch, fetchAll);
    },
    [bm.handleRemoveFromCollection, currentRefetch, fetchAll]
  );

  const handleMoveToTrash = useCallback(
    async (id: string) => {
      await bm.handleMoveToTrash(id, currentRefetch, fetchAll);
    },
    [bm.handleMoveToTrash, currentRefetch, fetchAll]
  );

  const handleRestoreFromTrash = useCallback(
    async (id: string) => {
      await bm.handleRestoreFromTrash(id, currentRefetch, fetchAll);
    },
    [bm.handleRestoreFromTrash, currentRefetch, fetchAll]
  );

  const handlePermanentlyDelete = useCallback(
    async (id: string) => {
      await bm.handlePermanentlyDelete(id, currentRefetch, fetchAll);
    },
    [bm.handlePermanentlyDelete, currentRefetch, fetchAll]
  );

  const handleBulkDelete = useCallback(
    async () => {
      await bm.handleBulkDelete(selectedCollectionId, currentBookmarks, currentRefetch, fetchAll, isViewingTrash);
    },
    [bm.handleBulkDelete, selectedCollectionId, currentBookmarks, currentRefetch, fetchAll, isViewingTrash]
  );

  const handleDropBookmarks = useCallback(
    async (collectionId: string, bookmarkIds: string[], sourceCollectionId?: string | null, isFromTrash?: boolean) => {
      await coll.handleDropBookmarks(collectionId, bookmarkIds, sourceCollectionId, isFromTrash, currentRefetch);
      invalidateBookmarks();
    },
    [coll.handleDropBookmarks, currentRefetch, invalidateBookmarks]
  );

  const handleBulkRefresh = useCallback(
    async () => { await bm.handleBulkRefresh(currentRefetch, fetchAll, handleRefreshBookmark); },
    [bm.handleBulkRefresh, currentRefetch, fetchAll, handleRefreshBookmark]
  );

  const handleUpdateBookmarkCollections = useCallback(
    async (bookmarkId: string, collectionIds: string[]) => {
      await bm.handleUpdateBookmarkCollections(bookmarkId, collectionIds, currentRefetch, api.fetchCollections);
    },
    [bm.handleUpdateBookmarkCollections, currentRefetch, api.fetchCollections]
  );

  const handleCategorizeAll = useCallback(
    async () => { await bm.handleCategorizeAll(currentRefetch, api.fetchCollections); },
    [bm.handleCategorizeAll, currentRefetch, api.fetchCollections]
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
          await currentRefetch();
          await fetchAll();
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : "Failed to restore backup";
          setToast({ message: msg, type: "error" });
        } finally {
          e.target.value = "";
        }
      },
    });
  }, [currentRefetch, fetchAll]);

  const allCollectionsTree = useMemo(
    () => buildCollectionTree(api.collections, null),
    [api.collections]
  );

  const toggleSelectAll = useCallback(() => {
    if (currentBookmarks.length === 0) return;
    if (bm.selectedBookmarkIds.size === currentBookmarks.length) {
      bm.setSelectedBookmarkIds(new Set());
    } else {
      bm.setSelectedBookmarkIds(new Set(currentBookmarks.map((b) => b.id)));
    }
  }, [bm.selectedBookmarkIds, currentBookmarks]);

  const handleBookmarkContextMenu = useCallback((e: React.MouseEvent, bookmark: Bookmark) => {
    e.preventDefault();
    e.stopPropagation();
    setBookmarkContextMenu({ bookmark, position: { x: e.clientX, y: e.clientY } });
  }, []);

  const handleCopyUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setToast({ message: "URL copied to clipboard", type: "success" });
    });
  }, []);

  const { setSelectedBookmark: setBmSelectedBookmark } = bm;
  const { setReaderContent: setInspReaderContent, setInspectorTab: setInspInspectorTab, setIsInspectorOpen: setInspIsInspectorOpen } = insp;

  const onSelectBookmark = useCallback((bookmark: Bookmark) => {
    setBmSelectedBookmark(bookmark);
    setInspReaderContent(null);
    setInspInspectorTab("details");
    setInspIsInspectorOpen(true);
  }, [setBmSelectedBookmark, setInspReaderContent, setInspInspectorTab, setInspIsInspectorOpen]);

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
      <div className={cn("flex h-screen w-full bg-[#f8f9fa] text-slate-800 font-sans overflow-hidden", insp.isDragging && "select-none cursor-col-resize")}>
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
          onSpaceContextMenu={coll.handleSpaceContextMenu}
          onArboristMove={coll.handleArboristMove}
          onDropBookmarks={handleDropBookmarks}

          setIsSettingsOpen={setIsSettingsOpen}
          setIsAdding={bm.setIsAdding}
        />

        <BookmarkList
          bookmarks={currentBookmarks}
          total={currentTotal}
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
          isTrash={isViewingTrash}
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
          onLoadMore={currentFetchNextPage}
          hasNextPage={currentHasNextPage}
          isFetchingNextPage={currentIsFetchingNextPage}
          onBookmarkContextMenu={handleBookmarkContextMenu}
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
          isTrash={isViewingTrash}
          onDeleteBookmark={() => {
            if (!bm.selectedBookmark) return;
            if (isViewingTrash) {
              handlePermanentlyDelete(bm.selectedBookmark.id);
            } else {
              handleDeleteBookmark(bm.selectedBookmark, selectedCollectionId);
            }
          }}
          onRestoreFromTrash={(id) => handleRestoreFromTrash(id)}
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
        actions={bm.confirmDialog.actions}
        onCancel={() => bm.setConfirmDialog({ ...bm.confirmDialog, isOpen: false })}
      />

      <ConfirmDialog
        isOpen={coll.confirmDialog.isOpen}
        title={coll.confirmDialog.title}
        message={coll.confirmDialog.message}
        onConfirm={coll.confirmDialog.onConfirm}
        onCancel={() => coll.setConfirmDialog({ ...coll.confirmDialog, isOpen: false })}
      />

      {coll.contextMenu && (
        <CollectionContextMenuWrapper
          contextMenu={coll.contextMenu}
          getSiblings={coll.getSiblings}
          onClose={() => coll.setContextMenu(null)}
          onRename={coll.setRenamingCollection}
          onChangeIcon={coll.setIconPickerCollection}
          onDelete={coll.handleDeleteCollection}
          onMoveUp={coll.handleMoveCollectionUp}
          onMoveDown={coll.handleMoveCollectionDown}
          onMoveOut={coll.handleMoveCollectionOut}
        />
      )}

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

      {coll.spaceContextMenu && (
        <SpaceContextMenu
          space={coll.spaceContextMenu.space}
          position={coll.spaceContextMenu.position}
          onClose={() => coll.setSpaceContextMenu(null)}
          onRename={(space) => coll.setRenamingSpace(space)}
          onDelete={coll.handleDeleteSpace}
          onAddCollection={(spaceId) => {
            coll.setCreateCollectionSpaceId(spaceId);
            coll.setIsCreatingCollection(true);
            coll.setNewCollectionName("");
          }}
        />
      )}

      {coll.renamingSpace && (
        <RenameCollectionModal
          currentName={coll.renamingSpace.name}
          onSubmit={(name) => {
            coll.handleRenameSpace(name);
          }}
          onClose={() => coll.setRenamingSpace(null)}
        />
      )}

      {bookmarkContextMenu && (
        <BookmarkContextMenu
          bookmark={bookmarkContextMenu.bookmark}
          position={bookmarkContextMenu.position}
          currentCollectionId={selectedCollectionId}
          isTrash={isViewingTrash}
          onClose={() => setBookmarkContextMenu(null)}
          onOpen={(url) => window.open(url, "_blank")}
          onCopyUrl={handleCopyUrl}
          onRefresh={handleRefreshBookmark}
          onDelete={handleDeleteBookmark}
          onRemoveFromCollection={handleRemoveFromCollection}
          onMoveToTrash={handleMoveToTrash}
          onRestore={handleRestoreFromTrash}
          onPermanentlyDelete={handlePermanentlyDelete}
        />
      )}
    </>
  );
}
