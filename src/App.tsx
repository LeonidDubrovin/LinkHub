import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Icon } from "./components/Icon";
import { Toast } from "./components/Toast";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { AddBookmarkModal } from "./components/AddBookmarkModal";
import { SettingsModal } from "./components/SettingsModal";
import { Sidebar } from "./components/Sidebar";
import { BookmarkList } from "./components/BookmarkList";
import { InspectorPanel } from "./components/InspectorPanel";
import { Bookmark, Space, Collection, Tag, Domain } from "./types";
import { format } from "date-fns";
import { cn } from "./lib/utils";
import { getDomain, getYouTubeId } from './utils';

export default function App() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<Set<string>>(new Set());

  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(() => {
    const saved = localStorage.getItem('inspectorWidth');
    return saved ? parseInt(saved, 10) : 400;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'details' | 'reader' | 'web' | 'video'>('details');
  const [webPreviewMode, setWebPreviewMode] = useState<'proxy' | 'direct'>('proxy');
  const [webPreviewKey, setWebPreviewKey] = useState(0);
  const [readerContent, setReaderContent] = useState<{ title: string; content: string; byline: string } | null>(null);
  const [isReaderLoading, setIsReaderLoading] = useState(false);
  const [refreshingBookmarkIds, setRefreshingBookmarkIds] = useState<Set<string>>(new Set());

  const [viewMode, setViewMode] = useState<"list" | "grid">(() => {
    return (localStorage.getItem('viewMode') as "list" | "grid") || "list";
  });
  const [itemSize, setItemSize] = useState<"small" | "medium" | "large">(() => {
    return (localStorage.getItem('itemSize') as "small" | "medium" | "large") || "medium";
  });
  const [pinnedDomains, setPinnedDomains] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('pinnedDomains') || '[]'); } catch { return []; }
  });
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "title_asc" | "title_desc" | "domain_asc" | "domain_desc">("date_desc");
  const [filterBy, setFilterBy] = useState<"all" | "has_images" | "has_summary" | "has_content">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [isEditingCollections, setIsEditingCollections] = useState(false);
  const [selectedCollectionIdsForEdit, setSelectedCollectionIdsForEdit] = useState<string[]>([]);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [draggedCollectionId, setDraggedCollectionId] = useState<string | null>(null);
  const [dropTargetCollectionId, setDropTargetCollectionId] = useState<string | null>(null);

  const [isInitializing, setIsInitializing] = useState(true);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingLoading, setIsAddingLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => { localStorage.setItem('viewMode', viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem('itemSize', itemSize); }, [itemSize]);
  useEffect(() => { localStorage.setItem('pinnedDomains', JSON.stringify(pinnedDomains)); }, [pinnedDomains]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 250 && newWidth <= window.innerWidth - 350) setInspectorWidth(newWidth);
    };
    const handleMouseUp = () => setIsDragging(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
  }, [isDragging]);

  useEffect(() => {
    if (!isDragging) localStorage.setItem('inspectorWidth', inspectorWidth.toString());
  }, [isDragging, inspectorWidth]);

  useEffect(() => {
    if (selectedBookmark) {
      if (getYouTubeId(selectedBookmark.url)) setInspectorTab('video');
      else setInspectorTab((prev) => prev === 'video' ? 'details' : prev);
    }
  }, [selectedBookmark?.id]);

  const fetchSpaces = useCallback(async () => {
    try {
      const res = await fetch("/api/spaces");
      if (!res.ok) throw new Error(`Failed to fetch spaces: ${res.status}`);
      const data = await res.json();
      setSpaces(Array.isArray(data) ? data : []);
    } catch (e) { console.error("Failed to fetch spaces", e); setSpaces([]); }
  }, []);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch("/api/collections");
      if (!res.ok) throw new Error(`Failed to fetch collections: ${res.status}`);
      const data = await res.json();
      setCollections(Array.isArray(data) ? data : []);
    } catch (e) { console.error("Failed to fetch collections", e); setCollections([]); }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/tags");
      const data = await res.json();
      setTags(Array.isArray(data) ? data : []);
    } catch (e) { console.error("Failed to fetch tags", e); setTags([]); }
  }, []);

  const fetchDomains = useCallback(async () => {
    try {
      const res = await fetch("/api/domains");
      const data = await res.json();
      setDomains(Array.isArray(data) ? data : []);
    } catch (e) { console.error("Failed to fetch domains", e); setDomains([]); }
  }, []);

  const fetchBookmarks = useCallback(async () => {
    let url = "/api/bookmarks?";
    if (selectedCollectionId) url += `collectionIds=${encodeURIComponent(selectedCollectionId)}&`;
    if (selectedTagId) url += `tagId=${encodeURIComponent(selectedTagId)}&`;
    if (selectedDomain) url += `domain=${encodeURIComponent(selectedDomain)}&`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      setBookmarks(Array.isArray(data) ? data : []);
    } catch (e) { console.error("Failed to fetch bookmarks", e); setBookmarks([]); }
  }, [selectedCollectionId, selectedTagId, selectedDomain]);

  useEffect(() => {
    async function initializeApp() {
      try {
        await Promise.all([fetchSpaces(), fetchCollections(), fetchTags(), fetchDomains(), fetchBookmarks()]);
      } catch (error) {
        console.error("Failed to initialize app:", error);
        setToast({ message: "Failed to load data. Please reload.", type: "error" });
      } finally { setIsInitializing(false); }
    }
    initializeApp();
  }, []);

  useEffect(() => {
    fetchBookmarks();
    setSelectedBookmark(null);
    setIsInspectorOpen(false);
    setReaderContent(null);
  }, [selectedCollectionId, selectedTagId, selectedDomain]);

  const treeSpaces = useMemo(() => {
    if (spaces.length === 0 || collections.length === 0) return [];
    const sortedSpaces = [...spaces].sort((a, b) => {
      if (a.id === 'inbox-space') return -1;
      if (b.id === 'inbox-space') return 1;
      return a.name.localeCompare(b.name);
    });
    const visibleSpaces = sortedSpaces.filter(space => space.name !== 'Library');
    const collectionsBySpace = new Map<string, Collection[]>();
    for (const space of visibleSpaces) {
      const spaceColls = collections.filter(c => c.space_id === space.id);
      collectionsBySpace.set(space.id, spaceColls);
    }
    const buildTree = (spaceId: string, parentId: string | null = null): Collection[] => {
      const colls = collectionsBySpace.get(spaceId) || [];
      const roots = colls.filter(c => c.parent_id === parentId);
      return roots.map(c => ({ ...c, children: buildTree(spaceId, c.id) }));
    };
    return visibleSpaces.map(space => ({ ...space, collections: buildTree(space.id) }));
  }, [spaces, collections]);

  const collectionBookmarkCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of bookmarks) {
      for (const coll of (b.collections || [])) {
        counts.set(coll.id, (counts.get(coll.id) || 0) + 1);
      }
    }
    return counts;
  }, [bookmarks]);

  const allCollectionsTree = useMemo(() => {
    const buildTree = (items: Collection[], parentId: string | null = null): Collection[] => {
      return items.filter(item => item.parent_id === parentId).map(item => ({
        ...item, bookmarkCount: collectionBookmarkCounts.get(item.id) || 0, children: buildTree(items, item.id)
      }));
    };
    return buildTree(collections);
  }, [collections, collectionBookmarkCounts]);

  const isDescendant = useCallback((candidateAncestorId: string, descendantId: string): boolean => {
    if (candidateAncestorId === descendantId) return true;
    let curr = collections.find(c => c.id === descendantId);
    while (curr && curr.parent_id) {
      if (curr.parent_id === candidateAncestorId) return true;
      curr = collections.find(c => c.id === curr.parent_id);
    }
    return false;
  }, [collections]);

  const handleCreateCollection = useCallback(async () => {
    if (!newCollectionName.trim()) { setToast({ message: "Please enter a name", type: "error" }); return; }
    const inboxSpace = spaces.find(s => s.id === 'inbox-space');
    const targetSpace = inboxSpace || spaces[0];
    if (!targetSpace) { setToast({ message: "No space available. Please reload the page.", type: "error" }); return; }
    try {
      const res = await fetch("/api/collections", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCollectionName.trim(), space_id: targetSpace.id, icon: "Folder", color: null, parent_id: null })
      });
      if (res.ok) { setNewCollectionName(""); setIsCreatingCollection(false); fetchCollections(); setToast({ message: "Collection created", type: "success" }); }
      else { const err = await res.json().catch(() => ({})); setToast({ message: `Failed: ${err.error || 'unknown error'}`, type: "error" }); }
    } catch (error: any) { setToast({ message: error.message || "Failed to create collection", type: "error" }); }
  }, [newCollectionName, spaces, fetchCollections]);

  const handleDeleteCollection = useCallback(async (collectionId: string) => {
    if (!confirm("Delete this collection? Bookmarks will remain but will be unlinked from this collection.")) return;
    try {
      const res = await fetch(`/api/collections/${collectionId}`, { method: "DELETE" });
      if (res.ok) {
        if (selectedCollectionId === collectionId) setSelectedCollectionId(null);
        fetchCollections(); fetchBookmarks();
        setToast({ message: "Collection deleted", type: "success" });
      } else { setToast({ message: "Failed to delete collection", type: "error" }); }
    } catch (error) { console.error("Delete collection error:", error); setToast({ message: "Failed to delete collection", type: "error" }); }
  }, [selectedCollectionId, fetchCollections, fetchBookmarks]);

  const handleMoveCollection = useCallback(async (draggedId: string, targetId: string) => {
    if (draggedId === 'inbox-collection' || targetId === 'inbox-collection') { setToast({ message: "Cannot move system collections", type: "error" }); return; }
    if (isDescendant(draggedId, targetId)) { setToast({ message: "Cannot move collection into its own descendant", type: "error" }); return; }
    const draggedColl = collections.find(c => c.id === draggedId);
    if (!draggedColl) { setToast({ message: "Collection not found", type: "error" }); return; }
    try {
      const res = await fetch(`/api/collections/${draggedId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draggedColl.name, icon: draggedColl.icon, color: draggedColl.color, parent_id: targetId })
      });
      if (res.ok) { fetchCollections(); setToast({ message: "Collection moved", type: "success" }); }
      else { const err = await res.json().catch(() => ({})); setToast({ message: `Failed: ${err.error || 'unknown error'}`, type: "error" }); }
    } catch (error) { console.error("Move collection error:", error); setToast({ message: "Failed to move collection", type: "error" }); }
    finally { setDraggedCollectionId(null); setDropTargetCollectionId(null); }
  }, [collections, isDescendant, fetchCollections]);

  const handleUpdateBookmarkCollections = useCallback(async (bookmarkId: string, collectionIds: string[]) => {
    try {
      const res = await fetch(`/api/bookmarks/${bookmarkId}/collections`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collectionIds }),
      });
      if (res.ok) {
        const updatedRes = await fetch(`/api/bookmarks/${bookmarkId}`);
        if (updatedRes.ok) { const updated = await updatedRes.json(); setSelectedBookmark(updated); }
        fetchBookmarks(); fetchCollections();
        setToast({ message: "Collections updated", type: "success" });
      } else { setToast({ message: "Failed to update collections", type: "error" }); }
    } catch (error) { console.error("Update collections error:", error); setToast({ message: "Failed to update collections", type: "error" }); }
  }, [fetchBookmarks, fetchCollections]);

  const togglePinDomain = useCallback((domain: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedDomains(prev => prev.includes(domain) ? prev.filter(d => d !== domain) : [...prev, domain]);
  }, []);

  const handleAddBookmark = useCallback(async (newUrls: string, collectionIds?: string[]) => {
    if (!newUrls) return;
    const urls = newUrls.split('\n').map(u => { let trimmed = u.trim(); if (trimmed && !trimmed.match(/^https?:\/\//i)) trimmed = `https://${trimmed}`; return trimmed; }).filter(u => u);
    if (urls.length === 0) return;
    setIsAddingLoading(true);
    try {
      if (urls.length === 1) {
        const res = await fetch("/api/bookmarks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: urls[0], collectionIds }) });
        const data = await res.json();
        if (res.ok) {
          if (data.exists) { setToast({ message: `Bookmark already exists: ${data.title || urls[0]}`, type: 'error' }); }
          else {
            setToast({ message: 'Bookmark added successfully', type: 'success' });
            setIsAdding(false);
            await fetchBookmarks(); fetchCollections(); fetchTags(); fetchDomains();
            if (data.needsRefresh) handleRefreshBookmark(data.id);
          }
        } else { setToast({ message: data.error || 'Failed to add bookmark', type: 'error' }); }
      } else {
        const results = [];
        for (const url of urls) { const res = await fetch("/api/bookmarks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, collectionIds }) }); results.push(await res.json()); }
        const existingUrls = results.filter((r: any) => r.exists);
        const addedUrls = results.filter((r: any) => r.success);
        let message = `Added ${addedUrls.length} new bookmarks.`;
        if (existingUrls.length > 0) message += ` ${existingUrls.length} already existed.`;
        setToast({ message, type: addedUrls.length > 0 ? 'success' : 'info' });
        setIsAdding(false);
        if (addedUrls.length > 0) {
          await fetchBookmarks(); fetchCollections(); fetchTags(); fetchDomains();
          Promise.allSettled(addedUrls.map((r: any) => r.needsRefresh ? handleRefreshBookmark(r.id, true) : Promise.resolve())).then(() => { fetchBookmarks(); fetchCollections(); fetchTags(); fetchDomains(); }).catch(() => {});
        }
      }
    } catch (error) { console.error(error); setToast({ message: 'An unexpected error occurred', type: 'error' }); }
    finally { setIsAddingLoading(false); }
  }, [fetchBookmarks, fetchCollections, fetchTags, fetchDomains]);

  const handleRefreshBookmark = useCallback(async (id: string, skipFetch = false) => {
    setRefreshingBookmarkIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/bookmarks/${id}/refresh`, { method: 'POST' });
      if (res.ok) {
        if (!skipFetch) { await fetchBookmarks(); await fetchCollections(); await fetchTags(); await fetchDomains(); }
        const updatedBookmarkRes = await fetch(`/api/bookmarks/${id}`);
        if (updatedBookmarkRes.ok) { const updated = await updatedBookmarkRes.json(); setSelectedBookmark(prev => prev?.id === id ? updated : prev); }
        if (!skipFetch) setToast({ message: 'Bookmark refreshed successfully', type: 'success' });
      } else { if (!skipFetch) setToast({ message: 'Failed to refresh bookmark', type: 'error' }); }
    } catch (e) { console.error("Failed to refresh", e); if (!skipFetch) setToast({ message: 'Failed to refresh bookmark', type: 'error' }); }
    finally { setRefreshingBookmarkIds(prev => { const newSet = new Set(prev); newSet.delete(id); return newSet; }); }
  }, [fetchBookmarks, fetchCollections, fetchTags, fetchDomains]);

  const handleDeleteBookmark = useCallback(async (id: string) => {
    setConfirmDialog({
      isOpen: true, title: "Delete Bookmark", message: "Are you sure you want to delete this bookmark?",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
          if (res.ok) { setSelectedBookmark(null); fetchBookmarks(); fetchCollections(); fetchTags(); fetchDomains(); setToast({ message: 'Bookmark deleted successfully', type: 'success' }); }
          else { setToast({ message: 'Failed to delete bookmark', type: 'error' }); }
        } catch (error) { console.error("Failed to delete bookmark", error); setToast({ message: 'Failed to delete bookmark', type: 'error' }); }
      }
    });
  }, [fetchBookmarks, fetchCollections, fetchTags, fetchDomains]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedBookmarkIds.size === 0) return;
    setConfirmDialog({
      isOpen: true, title: "Delete Bookmarks", message: `Are you sure you want to delete ${selectedBookmarkIds.size} bookmarks?`,
      onConfirm: async () => {
        try {
          const res = await fetch("/api/bookmarks/bulk-delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: Array.from(selectedBookmarkIds) }) });
          if (res.ok) { setSelectedBookmarkIds(new Set()); if (selectedBookmark && selectedBookmarkIds.has(selectedBookmark.id)) setSelectedBookmark(null); fetchBookmarks(); fetchCollections(); fetchTags(); fetchDomains(); }
        } catch (e) { console.error("Failed to bulk delete", e); }
      }
    });
  }, [selectedBookmarkIds, selectedBookmark, fetchBookmarks, fetchCollections, fetchTags, fetchDomains]);

  const handleBulkRefresh = useCallback(async () => {
    if (selectedBookmarkIds.size === 0) return;
    setConfirmDialog({
      isOpen: true, title: "Refresh Bookmarks", message: `Are you sure you want to refresh information for ${selectedBookmarkIds.size} bookmarks? This may take some time.`,
      onConfirm: async () => {
        const ids = Array.from(selectedBookmarkIds);
        setRefreshingBookmarkIds(prev => { const newSet = new Set(prev); ids.forEach(id => newSet.add(id)); return newSet; });
        try {
          let successCount = 0;
          for (let i = 0; i < ids.length; i += 3) {
            const batch = ids.slice(i, i + 3);
            const results = await Promise.allSettled(batch.map(id => fetch(`/api/bookmarks/${id}/refresh`, { method: 'POST' })));
            successCount += results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
          }
          await fetchBookmarks(); await fetchCollections(); await fetchTags(); await fetchDomains();
          if (selectedBookmark && selectedBookmarkIds.has(selectedBookmark.id)) {
            const updatedBookmarkRes = await fetch(`/api/bookmarks/${selectedBookmark.id}`);
            if (updatedBookmarkRes.ok) { const updated = await updatedBookmarkRes.json(); setSelectedBookmark(updated); }
          }
          setToast({ message: `Refreshed ${successCount} bookmarks successfully`, type: 'success' });
          setSelectedBookmarkIds(new Set());
        } catch (e) { console.error("Failed to bulk refresh", e); setToast({ message: 'Failed to refresh some bookmarks', type: 'error' }); }
        finally { setRefreshingBookmarkIds(prev => { const newSet = new Set(prev); ids.forEach(id => newSet.delete(id)); return newSet; }); }
      }
    });
  }, [selectedBookmarkIds, selectedBookmark, fetchBookmarks, fetchCollections, fetchTags, fetchDomains]);

  const handleCategorizeAll = useCallback(async () => {
    if (isCategorizing) return;
    setIsCategorizing(true);
    try {
      const res = await fetch("/api/bookmarks/categorize-all", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ onlyUntagged: true }) });
      const data = await res.json();
      if (res.ok) { setToast({ message: `Categorized ${data.processed} of ${data.total} bookmarks`, type: 'success' }); fetchBookmarks(); fetchCollections(); fetchTags(); }
      else { setToast({ message: data.error || "Failed to categorize bookmarks", type: 'error' }); }
    } catch (e: any) { setToast({ message: e.message || "Failed to categorize", type: 'error' }); }
    finally { setIsCategorizing(false); }
  }, [isCategorizing, fetchBookmarks, fetchCollections, fetchTags]);

  const handleBackup = useCallback(async () => {
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) { const errData = await res.json().catch(() => ({})); throw new Error(errData.error || "Failed to fetch backup data from server"); }
      const data = await res.json();
      const jsonString = JSON.stringify(data, null, 2);
      try {
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `bookmarks-backup-${format(new Date(), "yyyy-MM-dd-HH-mm")}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        setToast({ message: "Backup downloaded successfully", type: "success" });
      } catch (downloadError) { console.warn("Download failed, falling back to clipboard:", downloadError); await navigator.clipboard.writeText(jsonString); setToast({ message: "Backup copied to clipboard (download blocked by browser)", type: "success" }); }
    } catch (error: any) { console.error("Backup error:", error); setToast({ message: error.message || "Failed to generate backup", type: "error" }); }
  }, []);

  const handleRestore = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setConfirmDialog({
      isOpen: true, title: "Restore Backup", message: "Are you sure you want to restore this backup? This will OVERWRITE all your current bookmarks and collections. This action cannot be undone.",
      onConfirm: async () => {
        try {
          const text = await file.text();
          const backupData = JSON.parse(text);
          if (!backupData.version || !backupData.data) throw new Error("Invalid backup file format");
          const res = await fetch("/api/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: text });
          if (!res.ok) { const errorData = await res.json(); throw new Error(errorData.error || "Failed to restore backup"); }
          setToast({ message: "Backup restored successfully", type: "success" });
          setSelectedBookmark(null); setSelectedCollectionId(null); setSelectedTagId(null); setSelectedDomain(null);
          fetchBookmarks(); fetchCollections(); fetchTags(); fetchDomains();
        } catch (error: any) { console.error("Restore error:", error); setToast({ message: error.message || "Failed to restore backup", type: "error" }); }
        finally { e.target.value = ""; }
      }
    });
  }, [fetchBookmarks, fetchCollections, fetchTags, fetchDomains]);

  const loadReaderView = useCallback(async (bookmark: Bookmark) => {
    setIsReaderLoading(true);
    try {
      const res = await fetch(`/api/bookmarks/${bookmark.id}/readability`);
      const data = await res.json();
      if (data && data.content) setReaderContent(data);
      else setReaderContent({ title: bookmark.title, content: "<p>Could not extract readable content.</p>", byline: "" });
    } catch (error) { console.error(error); setReaderContent({ title: bookmark.title, content: "<p>Error loading reader view.</p>", byline: "" }); }
    finally { setIsReaderLoading(false); }
  }, []);

  const toggleBookmarkSelection = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedBookmarkIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedBookmarkIds(newSet);
  }, [selectedBookmarkIds]);

  const filteredBookmarks = useMemo(() => bookmarks.filter(
    (b) => {
      const matchesSearch = b.title?.toLowerCase().includes(searchQuery.toLowerCase()) || b.description?.toLowerCase().includes(searchQuery.toLowerCase()) || b.url.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (filterBy === "has_images") return b.images_json && b.images_json !== "[]";
      if (filterBy === "has_summary") return b.description && b.description.length > 0;
      if (filterBy === "has_content") return b.content_text && b.content_text.length > 0;
      return true;
    }
  ).sort((a, b) => {
    switch (sortBy) {
      case "date_asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "date_desc": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "title_asc": return (a.title || "").localeCompare(b.title || "");
      case "title_desc": return (b.title || "").localeCompare(a.title || "");
      case "domain_asc": return (a.domain || "").localeCompare(b.domain || "");
      case "domain_desc": return (b.domain || "").localeCompare(a.domain || "");
      default: return 0;
    }
  }), [bookmarks, searchQuery, filterBy, sortBy]);

  const toggleSelectAll = useCallback(() => {
    if (selectedBookmarkIds.size === filteredBookmarks.length && filteredBookmarks.length > 0) setSelectedBookmarkIds(new Set());
    else setSelectedBookmarkIds(new Set(filteredBookmarks.map(b => b.id)));
  }, [selectedBookmarkIds, filteredBookmarks]);

  const renderCollections = (colls: Collection[], level: number) => {
    return colls.map(coll => (
      <div key={coll.id} className="group relative">
        <button
          draggable={coll.id !== 'inbox-collection'}
          onDragStart={(e) => { e.stopPropagation(); setDraggedCollectionId(coll.id); e.dataTransfer.effectAllowed = "move"; }}
          onDragOver={(e) => { e.preventDefault(); if (coll.id !== draggedCollectionId && !isDescendant(draggedCollectionId, coll.id)) setDropTargetCollectionId(coll.id); }}
          onDragLeave={() => setDropTargetCollectionId(null)}
          onDrop={(e) => { e.preventDefault(); setDropTargetCollectionId(null); if (draggedCollectionId && coll.id !== draggedCollectionId && !isDescendant(draggedCollectionId, coll.id)) handleMoveCollection(draggedCollectionId, coll.id); setDraggedCollectionId(null); }}
          onDragEnd={() => { setDraggedCollectionId(null); setDropTargetCollectionId(null); }}
          onClick={() => { setSelectedCollectionId(coll.id); setSelectedTagId(null); setSelectedDomain(null); }}
          className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm mb-0.5 border transition-colors",
            selectedCollectionId === coll.id ? "bg-blue-100 text-blue-700 font-medium border-transparent" : dropTargetCollectionId === coll.id ? "bg-green-100 border-green-400" : "hover:bg-slate-200 text-slate-700 border-transparent"
          )}
          style={{ paddingLeft: `${0.5 + level * 1}rem` }}
        >
          <Icon name={coll.icon || "Folder"} size={16} color={coll.color} />
          <span className="truncate flex-1 text-left">{coll.name}</span>
          <span className="text-xs text-slate-400">{collectionBookmarkCounts.get(coll.id) || 0}</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleDeleteCollection(coll.id); }} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 text-slate-400" title="Delete collection">
          <Icon name="Trash2" size={12} />
        </button>
        {coll.children && coll.children.length > 0 && renderCollections(coll.children, level + 1)}
      </div>
    ));
  };

  const renderCollectionCheckbox = (coll: Collection, level: number) => (
    <div key={coll.id} style={{ paddingLeft: `${level * 12}px` }} draggable={!isEditingCollections && coll.id !== 'inbox-collection'}
      onDragStart={(e) => { if (isEditingCollections) return; e.stopPropagation(); setDraggedCollectionId(coll.id); e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={(e) => { if (isEditingCollections) return; e.preventDefault(); if (coll.id !== draggedCollectionId && !isDescendant(draggedCollectionId, coll.id)) setDropTargetCollectionId(coll.id); }}
      onDragLeave={() => { if (isEditingCollections) return; setDropTargetCollectionId(null); }}
      onDrop={(e) => { if (isEditingCollections) return; e.preventDefault(); setDropTargetCollectionId(null); if (draggedCollectionId && coll.id !== draggedCollectionId && !isDescendant(draggedCollectionId, coll.id)) handleMoveCollection(draggedCollectionId, coll.id); setDraggedCollectionId(null); }}
      onDragEnd={() => { setDraggedCollectionId(null); setDropTargetCollectionId(null); }}
    >
      <label className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
        <input type="checkbox" checked={selectedCollectionIdsForEdit.includes(coll.id)}
          onChange={(e) => { if (e.target.checked) setSelectedCollectionIdsForEdit(prev => [...prev, coll.id]); else setSelectedCollectionIdsForEdit(prev => prev.filter(id => id !== coll.id)); }}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
        <Icon name={coll.icon || "Folder"} size={14} color={coll.color} />
        <span className="truncate">{coll.name}</span>
      </label>
      {coll.children && coll.children.length > 0 && (<div>{coll.children.map(child => renderCollectionCheckbox(child, level + 1))}</div>)}
    </div>
  );

  return (
    <>
      {isInitializing && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div><p className="text-slate-600 font-medium">Loading LinkHub...</p></div>
        </div>
      )}
      <div className={cn("flex h-screen w-full bg-[#f8f9fa] text-slate-800 font-sans overflow-hidden", isDragging && "select-none cursor-col-resize")}>
        <Sidebar
          treeSpaces={treeSpaces} domains={domains} tags={tags} pinnedDomains={pinnedDomains}
          selectedCollectionId={selectedCollectionId} selectedTagId={selectedTagId} selectedDomain={selectedDomain}
          isCreatingCollection={isCreatingCollection} newCollectionName={newCollectionName}
          setIsCreatingCollection={setIsCreatingCollection} setNewCollectionName={setNewCollectionName}
          handleCreateCollection={handleCreateCollection}
          onSelectCollection={setSelectedCollectionId} onSelectTag={setSelectedTagId} onSelectDomain={setSelectedDomain}
          togglePinDomain={togglePinDomain} renderCollections={renderCollections}
          setIsSettingsOpen={setIsSettingsOpen} setIsAdding={setIsAdding}
        />

        <BookmarkList
          filteredBookmarks={filteredBookmarks} viewMode={viewMode} itemSize={itemSize}
          selectedBookmarkIds={selectedBookmarkIds} selectedBookmark={selectedBookmark}
          refreshingBookmarkIds={refreshingBookmarkIds} searchQuery={searchQuery}
          sortBy={sortBy} filterBy={filterBy}
          selectedCollectionId={selectedCollectionId} selectedTagId={selectedTagId} selectedDomain={selectedDomain}
          collections={collections} tags={tags}
          onSelectBookmark={(bookmark) => { setSelectedBookmark(bookmark); setReaderContent(null); setInspectorTab('details'); setIsInspectorOpen(true); }}
          onToggleSelectAll={toggleSelectAll} onToggleBookmarkSelection={toggleBookmarkSelection}
          onSearchChange={setSearchQuery} onSortChange={setSortBy} onFilterChange={setFilterBy}
          onViewModeChange={setViewMode} onItemSizeChange={setItemSize}
          onBulkDelete={handleBulkDelete} onBulkRefresh={handleBulkRefresh} onDismissInspector={() => setIsInspectorOpen(false)}
        />

        <InspectorPanel
          selectedBookmark={selectedBookmark} isInspectorOpen={isInspectorOpen}
          inspectorWidth={inspectorWidth} isDragging={isDragging} inspectorTab={inspectorTab}
          webPreviewMode={webPreviewMode} webPreviewKey={webPreviewKey}
          readerContent={readerContent} isReaderLoading={isReaderLoading}
          refreshingBookmarkIds={refreshingBookmarkIds}
          isEditingCollections={isEditingCollections} selectedCollectionIdsForEdit={selectedCollectionIdsForEdit}
          allCollectionsTree={allCollectionsTree} collectionBookmarkCounts={collectionBookmarkCounts}
          onTabChange={setInspectorTab} onClose={() => setIsInspectorOpen(false)}
          onResizeStart={() => setIsDragging(true)} onLoadReaderView={loadReaderView}
          onWebPreviewModeChange={setWebPreviewMode} onWebPreviewKeyChange={() => setWebPreviewKey(k => k + 1)}
          onRefreshBookmark={handleRefreshBookmark} onDeleteBookmark={handleDeleteBookmark}
          onUpdateBookmarkCollections={handleUpdateBookmarkCollections}
          onToggleEditingCollections={() => {
            if (isEditingCollections && selectedBookmark) { handleUpdateBookmarkCollections(selectedBookmark.id, selectedCollectionIdsForEdit); }
            else if (selectedBookmark) { setSelectedCollectionIdsForEdit(selectedBookmark.collections?.map((c: Collection) => c.id) || []); }
            setIsEditingCollections(!isEditingCollections);
          }}
          onSelectCollectionForEdit={(id, checked) => { if (checked) setSelectedCollectionIdsForEdit(prev => [...prev, id]); else setSelectedCollectionIdsForEdit(prev => prev.filter(i => i !== id)); }}
          renderCollectionCheckbox={renderCollectionCheckbox} getYouTubeId={getYouTubeId}
        />

        <AddBookmarkModal isOpen={isAdding} isLoading={isAddingLoading} onClose={() => setIsAdding(false)} onSubmit={handleAddBookmark} collections={collections} defaultCollectionIds={selectedCollectionId ? [selectedCollectionId] : []} />
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onBackup={handleBackup} onRestore={handleRestore} setToast={setToast} />
        <Toast toast={toast} onClose={() => setToast(null)} />
        <ConfirmDialog isOpen={confirmDialog.isOpen} title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} />
      </div>
    </>
  );
}
