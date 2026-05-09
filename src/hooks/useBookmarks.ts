import React, { useState, useCallback } from "react";
import { Bookmark } from "../types";
import { apiClient, ApiError } from "../services/api";

type ToastFn = (toast: { message: string; type: "success" | "error" | "info" } | null) => void;
type ConfirmFn = (title: string, message: string) => Promise<boolean>;

export function useBookmarks(setToast: ToastFn) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<Set<string>>(new Set());
  const [refreshingBookmarkIds, setRefreshingBookmarkIds] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingLoading, setIsAddingLoading] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const fetchBookmarks = useCallback(
    async (collectionId: string | null, tagId: string | null, domain: string | null) => {
      const data = await apiClient.bookmarks.list({
        collectionId: collectionId || undefined,
        tagId: tagId || undefined,
        domain: domain || undefined,
      });
      setBookmarks(Array.isArray(data) ? data : []);
    },
    []
  );

  const handleRefreshBookmark = useCallback(
    async (id: string, skipFetch = false, fetchBookmarksFn?: () => Promise<void>, fetchAllFn?: () => Promise<void>) => {
      setRefreshingBookmarkIds((prev) => new Set(prev).add(id));
      try {
        await apiClient.bookmarks.refresh(id);
        if (!skipFetch) {
          await fetchBookmarksFn?.();
          await fetchAllFn?.();
        }
        const updated = await apiClient.bookmarks.get(id);
        setSelectedBookmark((prev) => (prev?.id === id ? updated : prev));
        if (!skipFetch) setToast({ message: "Bookmark refreshed successfully", type: "success" });
      } catch {
        if (!skipFetch) setToast({ message: "Failed to refresh bookmark", type: "error" });
      } finally {
        setRefreshingBookmarkIds((prev) => {
          const s = new Set(prev);
          s.delete(id);
          return s;
        });
      }
    },
    [setToast]
  );

  const handleAddBookmark = useCallback(
    async (newUrls: string, collectionIds?: string[], fetchBookmarksFn?: () => Promise<void>, fetchAllFn?: () => Promise<void>, refreshFn?: (id: string, skipFetch?: boolean) => Promise<void>) => {
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
        const settled = await Promise.allSettled(
          urls.map((url) => apiClient.bookmarks.create(url, collectionIds))
        );
        const results = settled
          .filter((r): r is PromiseFulfilledResult<import("../services/api").CreateBookmarkResult> => r.status === "fulfilled")
          .map((r) => r.value);
        const existing = results.filter((r) => r.exists);
        const added = results.filter((r) => r.success && r.id);
        let message = `Added ${added.length} new bookmarks.`;
        if (existing.length > 0) message += ` ${existing.length} already existed.`;
        const failed = settled.filter((r) => r.status === "rejected").length;
        if (failed > 0) message += ` ${failed} failed.`;
        setToast({ message, type: added.length > 0 ? "success" : "info" });

        if (added.length > 0) {
          setIsAdding(false);
          await fetchBookmarksFn?.();
          await fetchAllFn?.();
          const refreshPromises = added
            .filter((r) => r.needsRefresh)
            .map((r) => refreshFn?.(r.id, true));
          await Promise.all(refreshPromises);
          await fetchBookmarksFn?.();
          await fetchAllFn?.();
        }
      } catch {
        setToast({ message: "An unexpected error occurred", type: "error" });
      } finally {
        setIsAddingLoading(false);
      }
    },
    [setToast]
  );

  const handleDeleteBookmark = useCallback(
    async (id: string, fetchBookmarksFn?: () => Promise<void>, fetchAllFn?: () => Promise<void>) => {
      setConfirmDialog({
        isOpen: true,
        title: "Delete Bookmark",
        message: "Are you sure you want to delete this bookmark?",
        onConfirm: async () => {
          try {
            await apiClient.bookmarks.delete(id);
            setSelectedBookmark(null);
            await fetchBookmarksFn?.();
            await fetchAllFn?.();
            setToast({ message: "Bookmark deleted successfully", type: "success" });
          } catch {
            setToast({ message: "Failed to delete bookmark", type: "error" });
          }
        },
      });
    },
    [setToast]
  );

  const handleBulkDelete = useCallback(
    async (fetchBookmarksFn?: () => Promise<void>, fetchAllFn?: () => Promise<void>) => {
      if (selectedBookmarkIds.size === 0) return;
      setConfirmDialog({
        isOpen: true,
        title: "Delete Bookmarks",
        message: `Are you sure you want to delete ${selectedBookmarkIds.size} bookmarks?`,
        onConfirm: async () => {
          try {
            await apiClient.bookmarks.bulkDelete(Array.from(selectedBookmarkIds));
            setSelectedBookmarkIds(new Set());
            if (selectedBookmark && selectedBookmarkIds.has(selectedBookmark.id)) {
              setSelectedBookmark(null);
            }
            await fetchBookmarksFn?.();
            await fetchAllFn?.();
          } catch {
            setToast({ message: "Failed to bulk delete", type: "error" });
          }
        },
      });
    },
    [selectedBookmarkIds, selectedBookmark, setToast]
  );

  const handleBulkRefresh = useCallback(
    async (fetchBookmarksFn?: () => Promise<void>, fetchAllFn?: () => Promise<void>, refreshFn?: (id: string, skipFetch?: boolean) => Promise<void>) => {
      if (selectedBookmarkIds.size === 0) return;
      setConfirmDialog({
        isOpen: true,
        title: "Refresh Bookmarks",
        message: `Are you sure you want to refresh information for ${selectedBookmarkIds.size} bookmarks? This may take some time.`,
        onConfirm: async () => {
          const ids: string[] = Array.from(selectedBookmarkIds);
          setRefreshingBookmarkIds((prev) => { const s = new Set(prev); ids.forEach((id) => s.add(id)); return s; });
          try {
            let successCount = 0;
            for (let i = 0; i < ids.length; i += 3) {
              const batch = ids.slice(i, i + 3);
              const results = await Promise.allSettled(
                batch.map((id) => apiClient.bookmarks.refresh(id))
              );
              successCount += results.filter((r) => r.status === "fulfilled").length;
            }
            await fetchBookmarksFn?.();
            await fetchAllFn?.();
            if (selectedBookmark && selectedBookmarkIds.has(selectedBookmark.id)) {
              const updated = await apiClient.bookmarks.get(selectedBookmark.id);
              setSelectedBookmark(updated);
            }
            setToast({
              message: successCount === ids.length
                ? `Refreshed ${successCount} bookmarks successfully`
                : `Refreshed ${successCount} out of ${ids.length} bookmarks`,
              type: "success",
            });
            setSelectedBookmarkIds(new Set());
          } catch {
            setToast({ message: "Failed to refresh some bookmarks", type: "error" });
          } finally {
            setRefreshingBookmarkIds((prev) => { const s = new Set(prev); ids.forEach((id) => s.delete(id)); return s; });
          }
        },
      });
    },
    [selectedBookmarkIds, selectedBookmark, setToast]
  );

  const handleUpdateBookmarkCollections = useCallback(
    async (bookmarkId: string, collectionIds: string[], fetchBookmarksFn?: () => Promise<void>, fetchCollectionsFn?: () => Promise<void>) => {
      try {
        const result = await apiClient.collections.setForBookmark(bookmarkId, collectionIds);
        if (result.success) {
          const updated = await apiClient.bookmarks.get(bookmarkId);
          setSelectedBookmark(updated);
          await fetchBookmarksFn?.();
          await fetchCollectionsFn?.();
          setToast({ message: "Collections updated", type: "success" });
        }
      } catch {
        setToast({ message: "Failed to update collections", type: "error" });
      }
    },
    [setToast]
  );

  const handleCategorizeAll = useCallback(
    async (fetchBookmarksFn?: () => Promise<void>, fetchCollectionsFn?: () => Promise<void>, fetchTagsFn?: () => Promise<void>) => {
      if (isCategorizing) return;
      setIsCategorizing(true);
      try {
        const data = await apiClient.post<{ processed: number; total: number }>("/api/bookmarks/categorize-all", { onlyUntagged: true });
        setToast({ message: `Categorized ${data.processed} of ${data.total} bookmarks`, type: "success" });
        await fetchBookmarksFn?.();
        await fetchCollectionsFn?.();
        await fetchTagsFn?.();
      } catch (error) {
        const msg = error instanceof ApiError ? error.message : "Failed to categorize";
        setToast({ message: msg, type: "error" });
      } finally {
        setIsCategorizing(false);
      }
    },
    [isCategorizing, setToast]
  );

  const toggleBookmarkSelection = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBookmarkIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }, []);

  return {
    bookmarks,
    setBookmarks,
    selectedBookmark,
    setSelectedBookmark,
    selectedBookmarkIds,
    setSelectedBookmarkIds,
    refreshingBookmarkIds,
    isAdding,
    setIsAdding,
    isAddingLoading,
    isCategorizing,
    confirmDialog,
    setConfirmDialog,

    fetchBookmarks,
    handleRefreshBookmark,
    handleAddBookmark,
    handleDeleteBookmark,
    handleBulkDelete,
    handleBulkRefresh,
    handleUpdateBookmarkCollections,
    handleCategorizeAll,
    toggleBookmarkSelection,
  };
}
