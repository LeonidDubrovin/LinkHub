import React, { useState, useMemo } from "react";
import { Bookmark } from "../types";
import { getDomain } from "../utils";

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

interface UseBookmarksParams {
  setToast: React.Dispatch<React.SetStateAction<ToastState | null>>;
  setConfirmDialog: React.Dispatch<React.SetStateAction<ConfirmDialogState>>;
  setIsAdding: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAddingLoading: React.Dispatch<React.SetStateAction<boolean>>;
  fetchCollections: () => void;
  fetchTags: () => void;
  fetchDomains: () => void;
  selectedCollectionId: string | null;
  selectedTagId: string | null;
  selectedDomain: string | null;
  searchQuery: string;
  filterBy: "all" | "has_images" | "has_summary" | "has_content";
  sortBy: "date_desc" | "date_asc" | "title_asc" | "title_desc" | "domain_asc" | "domain_desc";
}

export function useBookmarks({
  setToast,
  setConfirmDialog,
  setIsAdding,
  setIsAddingLoading,
  fetchCollections,
  fetchTags,
  fetchDomains,
  selectedCollectionId,
  selectedTagId,
  selectedDomain,
  searchQuery,
  filterBy,
  sortBy,
}: UseBookmarksParams) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<Set<string>>(new Set());
  const [refreshingBookmarkIds, setRefreshingBookmarkIds] = useState<Set<string>>(new Set());

  const fetchBookmarks = React.useCallback(async () => {
    let url = "/api/bookmarks?";
    if (selectedCollectionId) url += `collectionIds=${encodeURIComponent(selectedCollectionId)}&`;
    if (selectedTagId) url += `tagId=${encodeURIComponent(selectedTagId)}&`;
    if (selectedDomain) url += `domain=${encodeURIComponent(selectedDomain)}&`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      setBookmarks(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch bookmarks", e);
      setBookmarks([]);
    }
  }, [selectedCollectionId, selectedTagId, selectedDomain]);

  const handleRefreshBookmark = React.useCallback(async (id: string, skipFetch = false) => {
    setRefreshingBookmarkIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/bookmarks/${id}/refresh`, { method: 'POST' });
      if (res.ok) {
        if (!skipFetch) {
          await fetchBookmarks();
          await fetchCollections();
          await fetchTags();
          await fetchDomains();
        }
        const updatedBookmarkRes = await fetch(`/api/bookmarks/${id}`);
        if (updatedBookmarkRes.ok) {
          const updated = await updatedBookmarkRes.json();
          setSelectedBookmark(prev => prev?.id === id ? updated : prev);
        }
        if (!skipFetch) {
          setToast({ message: 'Bookmark refreshed successfully', type: 'success' });
        }
      } else {
        if (!skipFetch) setToast({ message: 'Failed to refresh bookmark', type: 'error' });
      }
    } catch (e) {
      console.error("Failed to refresh", e);
      if (!skipFetch) setToast({ message: 'Failed to refresh bookmark', type: 'error' });
    } finally {
      setRefreshingBookmarkIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  }, [fetchBookmarks, fetchCollections, fetchTags, fetchDomains, setToast]);

const handleAddBookmark = React.useCallback(async (newUrls: string, collectionIds?: string[]) => {
    if (!newUrls) return;

    const urls = newUrls.split('\n').map(u => {
        let trimmed = u.trim();
        if (trimmed && !trimmed.match(/^https?:\/\//i)) {
            trimmed = `https://${trimmed}`;
        }
        return trimmed;
    }).filter(u => u);
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
            const data = await res.json();
            results.push(data);
        }

        const existingUrls = results.filter((r: any) => r.exists);
        const addedUrls = results.filter((r: any) => r.success);

        let message = `Added ${addedUrls.length} new bookmarks.`;
        if (existingUrls.length > 0) {
            message += ` ${existingUrls.length} already existed.`;
        }

        setToast({ message, type: addedUrls.length > 0 ? 'success' : 'info' });

        if (addedUrls.length > 0) {
            setIsAdding(false);
            await fetchBookmarks();
            fetchCollections();
            fetchTags();
            fetchDomains();

            const refreshPromises = addedUrls
                .filter((r: any) => r.needsRefresh)
                .map((r: any) => handleRefreshBookmark(r.id, true));

            await Promise.all(refreshPromises);
            await fetchBookmarks();
            await fetchCollections();
            await fetchTags();
            await fetchDomains();
        }
    } catch (error) {
        console.error(error);
        setToast({ message: 'An unexpected error occurred', type: 'error' });
    } finally {
        setIsAddingLoading(false);
    }
}, [setIsAddingLoading, setToast, setIsAdding, fetchBookmarks, fetchCollections, fetchTags, fetchDomains, handleRefreshBookmark]);

  const handleDeleteBookmark = React.useCallback(async (id: string) => {
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
            fetchCollections();
            fetchTags();
            fetchDomains();
            setToast({ message: 'Bookmark deleted successfully', type: 'success' });
          } else {
            setToast({ message: 'Failed to delete bookmark', type: 'error' });
          }
        } catch (error) {
          console.error("Failed to delete bookmark", error);
          setToast({ message: 'Failed to delete bookmark', type: 'error' });
        }
      }
    });
  }, [fetchBookmarks, fetchCollections, fetchTags, fetchDomains, setToast, setConfirmDialog]);

  const handleBulkDelete = React.useCallback(async () => {
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
            fetchCollections();
            fetchTags();
            fetchDomains();
          }
        } catch (e) {
          console.error("Failed to bulk delete", e);
        }
      }
    });
  }, [selectedBookmarkIds, selectedBookmark, fetchBookmarks, fetchCollections, fetchTags, fetchDomains, setConfirmDialog]);

  const handleBulkRefresh = React.useCallback(async () => {
    if (selectedBookmarkIds.size === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: "Refresh Bookmarks",
      message: `Are you sure you want to refresh information for ${selectedBookmarkIds.size} bookmarks? This may take some time.`,
      onConfirm: async () => {
        const ids = Array.from(selectedBookmarkIds);
        setRefreshingBookmarkIds(prev => {
          const newSet = new Set(prev);
          ids.forEach(id => newSet.add(id));
          return newSet;
        });
        try {
          let successCount = 0;
          for (let i = 0; i < ids.length; i += 3) {
            const batch = ids.slice(i, i + 3);
            const results = await Promise.allSettled(batch.map(id => fetch(`/api/bookmarks/${id}/refresh`, { method: 'POST' })));
            successCount += results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
          }

          await fetchBookmarks();
          await fetchCollections();
          await fetchTags();
          await fetchDomains();

          if (selectedBookmark && selectedBookmarkIds.has(selectedBookmark.id)) {
            const updatedBookmarkRes = await fetch(`/api/bookmarks/${selectedBookmark.id}`);
            if (updatedBookmarkRes.ok) {
              const updated = await updatedBookmarkRes.json();
              setSelectedBookmark(updated);
            }
          }

          if (successCount === ids.length) {
            setToast({ message: `Refreshed ${successCount} bookmarks successfully`, type: 'success' });
          } else {
            setToast({ message: `Refreshed ${successCount} out of ${ids.length} bookmarks`, type: 'success' });
          }
          setSelectedBookmarkIds(new Set());
        } catch (e) {
          console.error("Failed to bulk refresh", e);
          setToast({ message: 'Failed to refresh some bookmarks', type: 'error' });
        } finally {
          setRefreshingBookmarkIds(prev => {
            const newSet = new Set(prev);
            ids.forEach(id => newSet.delete(id));
            return newSet;
          });
        }
      }
    });
  }, [selectedBookmarkIds, selectedBookmark, fetchBookmarks, fetchCollections, fetchTags, fetchDomains, setToast, setConfirmDialog]);

  const toggleSelectAll = React.useCallback((filteredBookmarks: Bookmark[]) => {
    if (selectedBookmarkIds.size === filteredBookmarks.length && filteredBookmarks.length > 0) {
      setSelectedBookmarkIds(new Set());
    } else {
      setSelectedBookmarkIds(new Set(filteredBookmarks.map(b => b.id)));
    }
  }, [selectedBookmarkIds]);

  const toggleBookmarkSelection = React.useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedBookmarkIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedBookmarkIds(newSet);
  }, [selectedBookmarkIds]);

  const filteredBookmarks = useMemo(() => bookmarks.filter(
    (b) => {
      const matchesSearch = b.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.url.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterBy === "has_images") {
        return b.images_json && b.images_json !== "[]";
      }
      if (filterBy === "has_summary") {
        return b.description && b.description.length > 0;
      }
      if (filterBy === "has_content") {
        return b.content_text && b.content_text.length > 0;
      }
      return true;
    }
  ).sort((a, b) => {
    switch (sortBy) {
      case "date_asc":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "date_desc":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "title_asc":
        return (a.title || "").localeCompare(b.title || "");
      case "title_desc":
        return (b.title || "").localeCompare(a.title || "");
      case "domain_asc":
        return (a.domain || "").localeCompare(b.domain || "");
      case "domain_desc":
        return (b.domain || "").localeCompare(a.domain || "");
      default:
        return 0;
    }
  }), [bookmarks, searchQuery, filterBy, sortBy]);

  return {
    bookmarks,
    setBookmarks,
    selectedBookmark,
    setSelectedBookmark,
    selectedBookmarkIds,
    setSelectedBookmarkIds,
    refreshingBookmarkIds,
    setRefreshingBookmarkIds,
    filteredBookmarks,
    fetchBookmarks,
    handleAddBookmark,
    handleDeleteBookmark,
    handleBulkDelete,
    handleRefreshBookmark,
    handleBulkRefresh,
    toggleSelectAll,
    toggleBookmarkSelection,
  };
}
