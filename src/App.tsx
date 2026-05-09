import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Toast } from "./components/Toast";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { AddBookmarkModal } from "./components/AddBookmarkModal";
import { SettingsModal } from "./components/SettingsModal";
import { Sidebar } from "./components/Sidebar";
import { BookmarkList } from "./components/BookmarkList";
import { InspectorPanel } from "./components/InspectorPanel";
import { Bookmark, Collection } from "./types";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { getYouTubeId } from "./utils";
import { cn } from "./lib/utils";
import { Icon } from "./components/Icon";
import { useApi } from "./hooks/useApi";
import { useUI } from "./hooks/useUI";
import { useInspector } from "./hooks/useInspector";

type ToastMessage = { message: string; type: "success" | "error" | "info" };
type SortBy = "date_desc" | "date_asc" | "title_asc" | "title_desc" | "domain_asc" | "domain_desc";
type FilterBy = "all" | "has_images" | "has_summary" | "has_content";

export default function App() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const api = useApi(setToast);
  const ui = useUI();
  const insp = useInspector();

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<Set<string>>(new Set());
  const [refreshingBookmarkIds, setRefreshingBookmarkIds] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingLoading, setIsAddingLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);

  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const [isEditingCollections, setIsEditingCollections] = useState(false);
  const [selectedCollectionIdsForEdit, setSelectedCollectionIdsForEdit] = useState<string[]>([]);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [draggedCollectionId, setDraggedCollectionId] = useState<string | null>(null);
  const [dropTargetCollectionId, setDropTargetCollectionId] = useState<string | null>(null);

  const fetchBookmarks = useCallback(async () => {
    const data = await api.fetchBookmarks(selectedCollectionId, selectedTagId, selectedDomain);
    setBookmarks(data);
  }, [api.fetchBookmarks, selectedCollectionId, selectedTagId, selectedDomain]);

  const fetchAll = useCallback(async () => {
    await Promise.all([api.fetchSpaces(), api.fetchCollections(), api.fetchTags(), api.fetchDomains()]);
  }, [api.fetchSpaces, api.fetchCollections, api.fetchTags, api.fetchDomains]);

  useEffect(() => {
    api.initialize();
  }, []);

  useEffect(() => {
    fetchBookmarks();
    setSelectedBookmark(null);
    insp.setIsInspectorOpen(false);
    insp.setReaderContent(null);
  }, [selectedCollectionId, selectedTagId, selectedDomain]);

  useEffect(() => {
    if (selectedBookmark) {
      if (getYouTubeId(selectedBookmark.url)) {
        insp.setInspectorTab("video");
      } else {
        insp.setInspectorTab((prev) => (prev === "video" ? "details" : prev));
      }
    }
  }, [selectedBookmark?.id]);

  const handleRefreshBookmark = useCallback(async (id: string, skipFetch = false) => {
    setRefreshingBookmarkIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/bookmarks/${id}/refresh`, { method: "POST" });
      if (res.ok) {
        if (!skipFetch) {
          await fetchBookmarks();
          await fetchAll();
        }
        const updatedRes = await fetch(`/api/bookmarks/${id}`);
        if (updatedRes.ok) {
          const updated = await updatedRes.json();
          setSelectedBookmark((prev) => (prev?.id === id ? updated : prev));
        }
        if (!skipFetch) setToast({ message: "Bookmark refreshed successfully", type: "success" });
      } else {
        if (!skipFetch) setToast({ message: "Failed to refresh bookmark", type: "error" });
      }
    } catch (e) {
      console.error("Failed to refresh", e);
      if (!skipFetch) setToast({ message: "Failed to refresh bookmark", type: "error" });
    } finally {
      setRefreshingBookmarkIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  }, [fetchBookmarks, fetchAll]);

  const handleAddBookmark = useCallback(async (newUrls: string, collectionIds?: string[]) => {
    if (!newUrls) return;
    const urls = newUrls
      .split("\n")
      .map((u) => {
        let trimmed = u.trim();
        if (trimmed && !trimmed.match(/^https?:\/\//i)) trimmed = `https://${trimmed}`;
        return trimmed;
      })
      .filter((u) => u);
    if (urls.length === 0) return;

    setIsAddingLoading(true);
    try {
      const results = [];
      for (const url of urls) {
        const res = await fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, collectionIds }),
        });
        results.push(await res.json());
      }

      const existing = results.filter((r: any) => r.exists);
      const added = results.filter((r: any) => r.success);
      let message = `Added ${added.length} new bookmarks.`;
      if (existing.length > 0) message += ` ${existing.length} already existed.`;
      setToast({ message, type: added.length > 0 ? "success" : "info" });

      if (added.length > 0) {
        setIsAdding(false);
        await fetchBookmarks();
        await fetchAll();
        const refreshPromises = added
          .filter((r: any) => r.needsRefresh)
          .map((r: any) => handleRefreshBookmark(r.id, true));
        await Promise.all(refreshPromises);
        await fetchBookmarks();
        await fetchAll();
      }
    } catch (error) {
      console.error(error);
      setToast({ message: "An unexpected error occurred", type: "error" });
    } finally {
      setIsAddingLoading(false);
    }
  }, [fetchBookmarks, fetchAll, handleRefreshBookmark]);

  const handleDeleteBookmark = useCallback(async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Bookmark",
      message: "Are you sure you want to delete this bookmark?",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
          if (res.ok) {
            setSelectedBookmark(null);
            fetchBookmarks();
            fetchAll();
            setToast({ message: "Bookmark deleted successfully", type: "success" });
          } else {
            setToast({ message: "Failed to delete bookmark", type: "error" });
          }
        } catch (error) {
          console.error("Failed to delete bookmark", error);
          setToast({ message: "Failed to delete bookmark", type: "error" });
        }
      },
    });
  }, [fetchBookmarks, fetchAll]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedBookmarkIds.size === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: "Delete Bookmarks",
      message: `Are you sure you want to delete ${selectedBookmarkIds.size} bookmarks?`,
      onConfirm: async () => {
        try {
          const res = await fetch("/api/bookmarks/bulk-delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: Array.from(selectedBookmarkIds) }),
          });
          if (res.ok) {
            setSelectedBookmarkIds(new Set());
            if (selectedBookmark && selectedBookmarkIds.has(selectedBookmark.id)) {
              setSelectedBookmark(null);
            }
            fetchBookmarks();
            fetchAll();
          }
        } catch (e) {
          console.error("Failed to bulk delete", e);
        }
      },
    });
  }, [selectedBookmarkIds, selectedBookmark, fetchBookmarks, fetchAll]);

  const handleBulkRefresh = useCallback(async () => {
    if (selectedBookmarkIds.size === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: "Refresh Bookmarks",
      message: `Are you sure you want to refresh information for ${selectedBookmarkIds.size} bookmarks? This may take some time.`,
      onConfirm: async () => {
        const ids = Array.from(selectedBookmarkIds);
        setRefreshingBookmarkIds((prev) => {
          const s = new Set(prev);
          ids.forEach((id) => s.add(id));
          return s;
        });
        try {
          let successCount = 0;
          for (let i = 0; i < ids.length; i += 3) {
            const batch = ids.slice(i, i + 3);
            const results = await Promise.allSettled(
              batch.map((id) => fetch(`/api/bookmarks/${id}/refresh`, { method: "POST" }))
            );
            successCount += results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
          }
          await fetchBookmarks();
          await fetchAll();
          if (selectedBookmark && selectedBookmarkIds.has(selectedBookmark.id)) {
            const r = await fetch(`/api/bookmarks/${selectedBookmark.id}`);
            if (r.ok) setSelectedBookmark(await r.json());
          }
          setToast({
            message:
              successCount === ids.length
                ? `Refreshed ${successCount} bookmarks successfully`
                : `Refreshed ${successCount} out of ${ids.length} bookmarks`,
            type: "success",
          });
          setSelectedBookmarkIds(new Set());
        } catch (e) {
          console.error("Failed to bulk refresh", e);
          setToast({ message: "Failed to refresh some bookmarks", type: "error" });
        } finally {
          setRefreshingBookmarkIds((prev) => {
            const s = new Set(prev);
            ids.forEach((id) => s.delete(id));
            return s;
          });
        }
      },
    });
  }, [selectedBookmarkIds, selectedBookmark, fetchBookmarks, fetchAll]);

  const handleCategorizeAll = useCallback(async () => {
    if (isCategorizing) return;
    setIsCategorizing(true);
    try {
      const res = await fetch("/api/bookmarks/categorize-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyUntagged: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: `Categorized ${data.processed} of ${data.total} bookmarks`, type: "success" });
        fetchBookmarks();
        api.fetchCollections();
        api.fetchTags();
      } else {
        setToast({ message: data.error || "Failed to categorize bookmarks", type: "error" });
      }
    } catch (e: any) {
      setToast({ message: e.message || "Failed to categorize", type: "error" });
    } finally {
      setIsCategorizing(false);
    }
  }, [isCategorizing, fetchBookmarks, api.fetchCollections, api.fetchTags]);

  const handleBackup = useCallback(async () => {
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to fetch backup data from server");
      }
      const data = await res.json();
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
      } catch (downloadError) {
        console.warn("Download failed, falling back to clipboard:", downloadError);
        await navigator.clipboard.writeText(jsonString);
        setToast({ message: "Backup copied to clipboard (download blocked by browser)", type: "success" });
      }
    } catch (error: any) {
      console.error("Backup error:", error);
      setToast({ message: error.message || "Failed to generate backup", type: "error" });
    }
  }, []);

  const handleRestore = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setConfirmDialog({
      isOpen: true,
      title: "Restore Backup",
      message: "Are you sure you want to restore this backup? This will OVERWRITE all your current bookmarks and collections. This action cannot be undone.",
      onConfirm: async () => {
        try {
          const text = await file.text();
          const backupData = JSON.parse(text);
          if (!backupData.version || !backupData.data) throw new Error("Invalid backup file format");
          const res = await fetch("/api/restore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: text,
          });
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || "Failed to restore backup");
          }
          setToast({ message: "Backup restored successfully", type: "success" });
          setSelectedBookmark(null);
          setSelectedCollectionId(null);
          setSelectedTagId(null);
          setSelectedDomain(null);
          fetchBookmarks();
          fetchAll();
        } catch (error: any) {
          console.error("Restore error:", error);
          setToast({ message: error.message || "Failed to restore backup", type: "error" });
        } finally {
          e.target.value = "";
        }
      },
    });
  }, [fetchBookmarks, fetchAll]);

  const handleCreateCollection = useCallback(async () => {
    if (!newCollectionName.trim()) {
      setToast({ message: "Please enter a name", type: "error" });
      return;
    }
    const inboxSpace = api.spaces.find((s) => s.id === "inbox-space");
    const targetSpace = inboxSpace || api.spaces[0];
    if (!targetSpace) {
      setToast({ message: "No space available. Please reload the page.", type: "error" });
      return;
    }
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCollectionName.trim(), space_id: targetSpace.id, icon: "Folder", color: null, parent_id: null }),
      });
      if (res.ok) {
        setNewCollectionName("");
        setIsCreatingCollection(false);
        api.fetchCollections();
        setToast({ message: "Collection created", type: "success" });
      } else {
        const err = await res.json().catch(() => ({}));
        setToast({ message: `Failed: ${err.error || "unknown error"}`, type: "error" });
      }
    } catch (error: any) {
      setToast({ message: error.message || "Failed to create collection", type: "error" });
    }
  }, [newCollectionName, api.spaces, api.fetchCollections]);

  const handleDeleteCollection = useCallback(async (collectionId: string) => {
    if (!confirm("Delete this collection? Bookmarks will remain but will be unlinked from this collection.")) return;
    try {
      const res = await fetch(`/api/collections/${collectionId}`, { method: "DELETE" });
      if (res.ok) {
        if (selectedCollectionId === collectionId) setSelectedCollectionId(null);
        api.fetchCollections();
        fetchBookmarks();
        setToast({ message: "Collection deleted", type: "success" });
      } else {
        setToast({ message: "Failed to delete collection", type: "error" });
      }
    } catch (error) {
      console.error("Delete collection error:", error);
      setToast({ message: "Failed to delete collection", type: "error" });
    }
  }, [selectedCollectionId, api.fetchCollections, fetchBookmarks]);

  const handleUpdateBookmarkCollections = useCallback(async (bookmarkId: string, collectionIds: string[]) => {
    try {
      const res = await fetch(`/api/bookmarks/${bookmarkId}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionIds }),
      });
      if (res.ok) {
        const updatedRes = await fetch(`/api/bookmarks/${bookmarkId}`);
        if (updatedRes.ok) setSelectedBookmark(await updatedRes.json());
        fetchBookmarks();
        api.fetchCollections();
        setToast({ message: "Collections updated", type: "success" });
      } else {
        setToast({ message: "Failed to update collections", type: "error" });
      }
    } catch (error) {
      console.error("Update collections error:", error);
      setToast({ message: "Failed to update collections", type: "error" });
    }
  }, [fetchBookmarks, api.fetchCollections]);

  const isDescendant = useCallback((candidateAncestorId: string, descendantId: string): boolean => {
    if (candidateAncestorId === descendantId) return true;
    let curr = api.collections.find((c) => c.id === descendantId);
    while (curr && curr.parent_id) {
      if (curr.parent_id === candidateAncestorId) return true;
      curr = api.collections.find((c) => c.id === curr!.parent_id);
    }
    return false;
  }, [api.collections]);

  const handleMoveCollection = useCallback(async (draggedId: string, targetId: string) => {
    if (draggedId === "inbox-collection" || targetId === "inbox-collection") {
      setToast({ message: "Cannot move system collections", type: "error" });
      return;
    }
    if (isDescendant(draggedId, targetId)) {
      setToast({ message: "Cannot move collection into its own descendant", type: "error" });
      return;
    }
    const draggedColl = api.collections.find((c) => c.id === draggedId);
    if (!draggedColl) {
      setToast({ message: "Collection not found", type: "error" });
      return;
    }
    try {
      const res = await fetch(`/api/collections/${draggedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draggedColl.name, icon: draggedColl.icon, color: draggedColl.color, parent_id: targetId }),
      });
      if (res.ok) {
        api.fetchCollections();
        setToast({ message: "Collection moved", type: "success" });
      } else {
        const err = await res.json().catch(() => ({}));
        setToast({ message: `Failed: ${err.error || "unknown error"}`, type: "error" });
      }
    } catch (error) {
      console.error("Move collection error:", error);
      setToast({ message: "Failed to move collection", type: "error" });
    } finally {
      setDraggedCollectionId(null);
      setDropTargetCollectionId(null);
    }
  }, [api.collections, api.fetchCollections, isDescendant]);

  const treeSpaces = useMemo(() => {
    if (api.spaces.length === 0 || api.collections.length === 0) return [];
    const sortedSpaces = [...api.spaces].sort((a, b) => {
      if (a.id === "inbox-space") return -1;
      if (b.id === "inbox-space") return 1;
      return a.name.localeCompare(b.name);
    });
    const visibleSpaces = sortedSpaces.filter((space) => space.name !== "Library");
    const collectionsBySpace = new Map<string, Collection[]>();
    for (const space of visibleSpaces) {
      collectionsBySpace.set(space.id, api.collections.filter((c) => c.space_id === space.id));
    }
    const buildTree = (spaceId: string, parentId: string | null = null): Collection[] => {
      const colls = collectionsBySpace.get(spaceId) || [];
      return colls.filter((c) => c.parent_id === parentId).map((c) => ({ ...c, children: buildTree(spaceId, c.id) }));
    };
    return visibleSpaces.map((space) => ({ ...space, collections: buildTree(space.id) }));
  }, [api.spaces, api.collections]);

  const collectionBookmarkCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of bookmarks) {
      for (const coll of b.collections || []) {
        counts.set(coll.id, (counts.get(coll.id) || 0) + 1);
      }
    }
    return counts;
  }, [bookmarks]);

  const allCollectionsTree = useMemo(() => {
    const buildTree = (items: Collection[], parentId: string | null = null): Collection[] => {
      return items
        .filter((item) => item.parent_id === parentId)
        .map((item) => ({
          ...item,
          bookmarkCount: collectionBookmarkCounts.get(item.id) || 0,
          children: buildTree(items, item.id),
        }));
    };
    return buildTree(api.collections);
  }, [api.collections, collectionBookmarkCounts]);

  const filteredBookmarks = useMemo(
    () =>
      bookmarks
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
    [bookmarks, ui.searchQuery, ui.filterBy, ui.sortBy]
  );

  const renderCollections = useCallback(
    (colls: Collection[], level: number) => {
      return colls.map((coll) => (
        <div key={coll.id} className="group relative">
          <button
            draggable={coll.id !== "inbox-collection"}
            onDragStart={(e) => { e.stopPropagation(); setDraggedCollectionId(coll.id); e.dataTransfer.effectAllowed = "move"; }}
            onDragOver={(e) => { e.preventDefault(); if (draggedCollectionId && coll.id !== draggedCollectionId && !isDescendant(draggedCollectionId, coll.id)) setDropTargetCollectionId(coll.id); }}
            onDragLeave={() => setDropTargetCollectionId(null)}
            onDrop={(e) => { e.preventDefault(); setDropTargetCollectionId(null); if (draggedCollectionId && coll.id !== draggedCollectionId && !isDescendant(draggedCollectionId, coll.id)) handleMoveCollection(draggedCollectionId, coll.id); setDraggedCollectionId(null); }}
            onDragEnd={() => { setDraggedCollectionId(null); setDropTargetCollectionId(null); }}
            onClick={() => { setSelectedCollectionId(coll.id); setSelectedTagId(null); setSelectedDomain(null); }}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm mb-0.5 border transition-colors",
              selectedCollectionId === coll.id
                ? "bg-blue-100 text-blue-700 font-medium border-transparent"
                : dropTargetCollectionId === coll.id
                ? "bg-green-100 border-green-400"
                : "hover:bg-slate-200 text-slate-700 border-transparent"
            )}
            style={{ paddingLeft: `${0.5 + level * 1}rem` }}
          >
            <Icon name={coll.icon || "Folder"} size={16} color={coll.color} />
            <span className="truncate flex-1 text-left">{coll.name}</span>
            <span className="text-xs text-slate-400">{collectionBookmarkCounts.get(coll.id) || 0}</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteCollection(coll.id); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 text-slate-400"
            title="Delete collection"
          >
            <Trash2 size={12} />
          </button>
          {coll.children && coll.children.length > 0 && renderCollections(coll.children, level + 1)}
        </div>
      ));
    },
    [selectedCollectionId, dropTargetCollectionId, draggedCollectionId, collectionBookmarkCounts, isDescendant, handleMoveCollection, handleDeleteCollection]
  );

  const renderCollectionCheckbox = useCallback(
    (coll: Collection, level: number) => (
      <div
        key={coll.id}
        style={{ paddingLeft: `${level * 12}px` }}
        draggable={coll.id !== "inbox-collection"}
        onDragStart={(e) => { e.stopPropagation(); setDraggedCollectionId(coll.id); e.dataTransfer.effectAllowed = "move"; }}
        onDragOver={(e) => { e.preventDefault(); if (draggedCollectionId && coll.id !== draggedCollectionId && !isDescendant(draggedCollectionId, coll.id)) setDropTargetCollectionId(coll.id); }}
        onDragLeave={() => setDropTargetCollectionId(null)}
        onDrop={(e) => { e.preventDefault(); setDropTargetCollectionId(null); if (draggedCollectionId && coll.id !== draggedCollectionId && !isDescendant(draggedCollectionId, coll.id)) handleMoveCollection(draggedCollectionId, coll.id); setDraggedCollectionId(null); }}
        onDragEnd={() => { setDraggedCollectionId(null); setDropTargetCollectionId(null); }}
      >
        <label className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
          <input
            type="checkbox"
            checked={selectedCollectionIdsForEdit.includes(coll.id)}
            onChange={(e) => {
              if (e.target.checked) setSelectedCollectionIdsForEdit((prev) => [...prev, coll.id]);
              else setSelectedCollectionIdsForEdit((prev) => prev.filter((id) => id !== coll.id));
            }}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <Icon name={coll.icon || "Folder"} size={14} color={coll.color} />
          <span className="truncate">{coll.name}</span>
        </label>
        {coll.children && coll.children.length > 0 && <div>{coll.children.map((child) => renderCollectionCheckbox(child, level + 1))}</div>}
      </div>
    ),
    [selectedCollectionIdsForEdit, draggedCollectionId, isDescendant, handleMoveCollection]
  );

  const toggleSelectAll = useCallback(() => {
    if (selectedBookmarkIds.size === filteredBookmarks.length && filteredBookmarks.length > 0) setSelectedBookmarkIds(new Set());
    else setSelectedBookmarkIds(new Set(filteredBookmarks.map((b) => b.id)));
  }, [selectedBookmarkIds, filteredBookmarks]);

  const toggleBookmarkSelection = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBookmarkIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }, []);

  const onSelectBookmark = useCallback((bookmark: Bookmark) => {
    setSelectedBookmark(bookmark);
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
      <div className={cn("flex h-screen w-full bg-[#f8f9fa] text-slate-800 font-sans overflow-hidden", insp.isDragging && "select-none cursor-col-resize")}>
        <Sidebar
          treeSpaces={treeSpaces}
          domains={api.domains}
          tags={api.tags}
          pinnedDomains={ui.pinnedDomains}
          selectedCollectionId={selectedCollectionId}
          selectedTagId={selectedTagId}
          selectedDomain={selectedDomain}
          isCreatingCollection={isCreatingCollection}
          newCollectionName={newCollectionName}
          setIsCreatingCollection={setIsCreatingCollection}
          setNewCollectionName={setNewCollectionName}
          handleCreateCollection={handleCreateCollection}
          onSelectCollection={(id) => { setSelectedCollectionId(id); setSelectedTagId(null); setSelectedDomain(null); }}
          onSelectTag={(id) => { setSelectedTagId(id); setSelectedCollectionId(null); setSelectedDomain(null); }}
          onSelectDomain={(d) => { setSelectedDomain(d); setSelectedCollectionId(null); setSelectedTagId(null); }}
          togglePinDomain={ui.togglePinDomain}
          renderCollections={renderCollections}
          setIsSettingsOpen={setIsSettingsOpen}
          setIsAdding={setIsAdding}
        />

        <BookmarkList
          filteredBookmarks={filteredBookmarks}
          viewMode={ui.viewMode}
          itemSize={ui.itemSize}
          selectedBookmarkIds={selectedBookmarkIds}
          selectedBookmark={selectedBookmark}
          refreshingBookmarkIds={refreshingBookmarkIds}
          searchQuery={ui.searchQuery}
          sortBy={ui.sortBy}
          filterBy={ui.filterBy}
          selectedCollectionId={selectedCollectionId}
          selectedTagId={selectedTagId}
          selectedDomain={selectedDomain}
          collections={api.collections}
          tags={api.tags}
          onSelectBookmark={onSelectBookmark}
          onToggleSelectAll={toggleSelectAll}
          onToggleBookmarkSelection={toggleBookmarkSelection}
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
          selectedBookmark={selectedBookmark}
          isInspectorOpen={insp.isInspectorOpen}
          inspectorWidth={insp.inspectorWidth}
          isDragging={insp.isDragging}
          inspectorTab={insp.inspectorTab}
          webPreviewMode={insp.webPreviewMode}
          webPreviewKey={insp.webPreviewKey}
          readerContent={insp.readerContent}
          isReaderLoading={insp.isReaderLoading}
          refreshingBookmarkIds={refreshingBookmarkIds}
          isEditingCollections={isEditingCollections}
          selectedCollectionIdsForEdit={selectedCollectionIdsForEdit}
          allCollectionsTree={allCollectionsTree}
          collectionBookmarkCounts={collectionBookmarkCounts}
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
              handleUpdateBookmarkCollections(selectedBookmark!.id, selectedCollectionIdsForEdit);
              setIsEditingCollections(false);
            } else {
              setSelectedCollectionIdsForEdit(selectedBookmark?.collections?.map((c) => c.id) || []);
              setIsEditingCollections(true);
            }
          }}
          onSelectCollectionForEdit={(id, checked) => {
            if (checked) setSelectedCollectionIdsForEdit((prev) => [...prev, id]);
            else setSelectedCollectionIdsForEdit((prev) => prev.filter((x) => x !== id));
          }}
          renderCollectionCheckbox={renderCollectionCheckbox}
          getYouTubeId={getYouTubeId}
        />
      </div>

      <AddBookmarkModal
        isOpen={isAdding}
        isLoading={isAddingLoading}
        onClose={() => setIsAdding(false)}
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
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </>
  );
}
