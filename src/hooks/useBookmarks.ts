import React, { useState, useCallback } from "react";
import { Bookmark } from "../types";
import { apiClient, ApiError } from "../services/api";

type ToastFn = (toast: { message: string; type: "success" | "error" | "info" } | null) => void;
type InvalidateFn = () => void;

export function useBookmarks(setToast: ToastFn, invalidateBookmarks?: InvalidateFn) {
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
    onConfirm?: () => void;
    actions?: { label: string; variant?: 'primary' | 'danger' | 'secondary'; onClick: () => void }[];
  }>({ isOpen: false, title: "", message: "" });

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
          invalidateBookmarks?.();
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
    [setToast, invalidateBookmarks]
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
        const restored = results.filter((r) => r.restored);
        const existing = results.filter((r) => r.exists && !r.restored);
        const added = results.filter((r) => r.success && r.id && !r.restored);
        let message = `Added ${added.length} new bookmarks.`;
        if (restored.length > 0) message += ` ${restored.length} restored from trash.`;
        if (existing.length > 0) message += ` ${existing.length} already existed.`;
        const failed = settled.filter((r) => r.status === "rejected").length;
        if (failed > 0) message += ` ${failed} failed.`;
        setToast({ message, type: added.length > 0 || restored.length > 0 ? "success" : "info" });

        if (added.length > 0 || restored.length > 0) {
          setIsAdding(false);
          await fetchBookmarksFn?.();
          await fetchAllFn?.();
          invalidateBookmarks?.();
          const refreshPromises = [...added, ...restored]
            .filter((r) => r.needsRefresh)
            .map((r) => refreshFn?.(r.id!, true));
          await Promise.all(refreshPromises);
          await fetchBookmarksFn?.();
          await fetchAllFn?.();
          invalidateBookmarks?.();
        }
      } catch {
        setToast({ message: "An unexpected error occurred", type: "error" });
      } finally {
        setIsAddingLoading(false);
      }
    },
    [setToast, invalidateBookmarks]
  );

  const handleMoveToTrash = useCallback(
    async (id: string, fetchBookmarksFn?: () => Promise<void>, fetchAllFn?: () => Promise<void>) => {
      setConfirmDialog({
        isOpen: true,
        title: "Move to trash",
        message: "Are you sure you want to move this bookmark to trash?",
        onConfirm: async () => {
          try {
            await apiClient.bookmarks.delete(id);
            if (selectedBookmark?.id === id) setSelectedBookmark(null);
            await fetchBookmarksFn?.();
            await fetchAllFn?.();
            invalidateBookmarks?.();
            setToast({ message: "Bookmark moved to trash", type: "success" });
          } catch {
            setToast({ message: "Failed to move bookmark to trash", type: "error" });
          }
        },
      });
    },
    [setToast, selectedBookmark, invalidateBookmarks]
  );

  const handleRestoreFromTrash = useCallback(
    async (id: string, fetchBookmarksFn?: () => Promise<void>, fetchAllFn?: () => Promise<void>) => {
      try {
        await apiClient.bookmarks.restoreFromTrash(id);
        if (selectedBookmark?.id === id) setSelectedBookmark(null);
        await fetchBookmarksFn?.();
        await fetchAllFn?.();
        invalidateBookmarks?.();
        setToast({ message: "Bookmark restored", type: "success" });
      } catch {
        setToast({ message: "Failed to restore bookmark", type: "error" });
      }
    },
    [setToast, selectedBookmark, invalidateBookmarks]
  );

  const handlePermanentlyDelete = useCallback(
    async (id: string, fetchBookmarksFn?: () => Promise<void>, fetchAllFn?: () => Promise<void>) => {
      setConfirmDialog({
        isOpen: true,
        title: "Delete permanently",
        message: "Are you sure you want to permanently delete this bookmark? This action cannot be undone.",
        onConfirm: async () => {
          try {
            await apiClient.bookmarks.permanentlyDelete(id);
            if (selectedBookmark?.id === id) setSelectedBookmark(null);
            await fetchBookmarksFn?.();
            await fetchAllFn?.();
            invalidateBookmarks?.();
            setToast({ message: "Bookmark deleted permanently", type: "success" });
          } catch {
            setToast({ message: "Failed to delete bookmark", type: "error" });
          }
        },
      });
    },
    [setToast, selectedBookmark, invalidateBookmarks]
  );

  const handleRemoveFromCollection = useCallback(
    async (bookmark: Bookmark, collectionId: string, fetchBookmarksFn?: () => Promise<void>, fetchAllFn?: () => Promise<void>) => {
      const otherCollections = bookmark.collections.filter((c) => c.id !== collectionId);
      const otherNames = otherCollections.map((c) => c.name).join(", ");
      const message = otherCollections.length > 0
        ? `This bookmark will remain in: ${otherNames}`
        : "This bookmark is only in this collection. Removing it will move it to trash.";

      setConfirmDialog({
        isOpen: true,
        title: "Remove from collection",
        message,
        actions: [
          { label: "Cancel", variant: "secondary", onClick: () => {} },
          {
            label: "Move to trash",
            variant: "danger",
            onClick: async () => {
              try {
                await apiClient.bookmarks.delete(bookmark.id);
                if (selectedBookmark?.id === bookmark.id) setSelectedBookmark(null);
                await fetchBookmarksFn?.();
                await fetchAllFn?.();
                invalidateBookmarks?.();
                setToast({ message: "Bookmark moved to trash", type: "success" });
              } catch {
                setToast({ message: "Failed to move bookmark to trash", type: "error" });
              }
            },
          },
          {
            label: otherCollections.length === 0 ? "Remove (trash)" : "Remove from collection",
            variant: "primary",
            onClick: async () => {
              try {
                if (otherCollections.length === 0) {
                  await apiClient.bookmarks.delete(bookmark.id);
                } else {
                  await apiClient.collections.removeFromBookmark(bookmark.id, collectionId);
                }
                if (selectedBookmark?.id === bookmark.id) setSelectedBookmark(null);
                await fetchBookmarksFn?.();
                await fetchAllFn?.();
                invalidateBookmarks?.();
                setToast({ message: "Bookmark removed from collection", type: "success" });
              } catch {
                setToast({ message: "Failed to remove bookmark from collection", type: "error" });
              }
            },
          },
        ],
      });
    },
    [setToast, selectedBookmark, invalidateBookmarks]
  );

  const handleDeleteBookmark = useCallback(
    async (bookmark: Bookmark, currentCollectionId?: string | null, fetchBookmarksFn?: () => Promise<void>, fetchAllFn?: () => Promise<void>) => {
      const isInCurrentCollection = currentCollectionId && bookmark.collections.some((c) => c.id === currentCollectionId);

      if (isInCurrentCollection) {
        const otherCollections = bookmark.collections.filter((c) => c.id !== currentCollectionId);
        const onlyHere = otherCollections.length === 0;
        const message = onlyHere
          ? "This bookmark is only in this collection. Moving it to trash."
          : `This bookmark is also in: ${otherCollections.map((c) => c.name).join(", ")}`;

        setConfirmDialog({
          isOpen: true,
          title: onlyHere ? "Move to trash" : "Remove from collection",
          message,
          actions: [
            { label: "Cancel", variant: "secondary", onClick: () => {} },
            ...(onlyHere ? [] : [{
              label: "Remove from collection" as const,
              variant: "primary" as const,
              onClick: async () => {
                try {
                  await apiClient.collections.removeFromBookmark(bookmark.id, currentCollectionId);
                  if (selectedBookmark?.id === bookmark.id) setSelectedBookmark(null);
                  await fetchBookmarksFn?.();
                  await fetchAllFn?.();
                  invalidateBookmarks?.();
                  setToast({ message: "Bookmark removed from collection", type: "success" });
                } catch {
                  setToast({ message: "Failed to remove bookmark from collection", type: "error" });
                }
              },
            }]),
            {
              label: "Move to trash",
              variant: "danger",
              onClick: async () => {
                try {
                  await apiClient.bookmarks.delete(bookmark.id);
                  if (selectedBookmark?.id === bookmark.id) setSelectedBookmark(null);
                  await fetchBookmarksFn?.();
                  await fetchAllFn?.();
                  invalidateBookmarks?.();
                  setToast({ message: "Bookmark moved to trash", type: "success" });
                } catch {
                  setToast({ message: "Failed to move bookmark to trash", type: "error" });
                }
              },
            },
          ],
        });
      } else {
        const collectionNames = bookmark.collections.map((c) => c.name).join(", ");
        const message = bookmark.collections.length > 0
          ? `This bookmark is in collections: ${collectionNames}`
          : "Are you sure you want to move this bookmark to trash?";
        setConfirmDialog({
          isOpen: true,
          title: "Move to trash",
          message,
          actions: [
            { label: "Cancel", variant: "secondary", onClick: () => {} },
            {
              label: "Move to trash",
              variant: "danger",
              onClick: async () => {
                try {
                  await apiClient.bookmarks.delete(bookmark.id);
                  if (selectedBookmark?.id === bookmark.id) setSelectedBookmark(null);
                  await fetchBookmarksFn?.();
                  await fetchAllFn?.();
                  invalidateBookmarks?.();
                  setToast({ message: "Bookmark moved to trash", type: "success" });
                } catch {
                  setToast({ message: "Failed to move bookmark to trash", type: "error" });
                }
              },
            },
          ],
        });
      }
    },
    [setToast, selectedBookmark, invalidateBookmarks]
  );

  const handleBulkDelete = useCallback(
    async (currentCollectionId?: string | null, currentBookmarks?: Bookmark[], fetchBookmarksFn?: () => Promise<void>, fetchAllFn?: () => Promise<void>, isTrash?: boolean) => {
      if (selectedBookmarkIds.size === 0) return;

      if (isTrash) {
        setConfirmDialog({
          isOpen: true,
          title: "Delete permanently",
          message: `Are you sure you want to permanently delete ${selectedBookmarkIds.size} bookmarks? This action cannot be undone.`,
          onConfirm: async () => {
            try {
              const ids: string[] = Array.from(selectedBookmarkIds);
              for (const id of ids) {
                await apiClient.bookmarks.permanentlyDelete(id);
              }
              setSelectedBookmarkIds(new Set());
              if (selectedBookmark && selectedBookmarkIds.has(selectedBookmark.id)) {
                setSelectedBookmark(null);
              }
              await fetchBookmarksFn?.();
              await fetchAllFn?.();
              invalidateBookmarks?.();
              setToast({ message: "Bookmarks deleted permanently", type: "success" });
            } catch {
              setToast({ message: "Failed to delete bookmarks", type: "error" });
            }
          },
        });
        return;
      }

      if (currentCollectionId && currentBookmarks) {
        const selectedBms = currentBookmarks.filter((b) => selectedBookmarkIds.has(b.id));
        const onlyHereCount = selectedBms.filter(
          (b) => b.collections.length === 1 && b.collections[0].id === currentCollectionId
        ).length;
        const alsoElsewhere = selectedBookmarkIds.size - onlyHereCount;

        let message = `Remove ${selectedBookmarkIds.size} bookmarks from this collection?`;
        if (onlyHereCount > 0) {
          message += `\n\n${onlyHereCount} will be moved to trash because they are not in any other collection.`;
        }
        if (alsoElsewhere > 0) {
          message += `\n${alsoElsewhere} will remain in other collections.`;
        }

        setConfirmDialog({
          isOpen: true,
          title: "Remove from collection",
          message,
          actions: [
            { label: "Cancel", variant: "secondary", onClick: () => {} },
            {
              label: "Move to trash",
              variant: "danger",
              onClick: async () => {
                try {
                  await apiClient.bookmarks.bulkDelete(Array.from(selectedBookmarkIds));
                  setSelectedBookmarkIds(new Set());
                  if (selectedBookmark && selectedBookmarkIds.has(selectedBookmark.id)) {
                    setSelectedBookmark(null);
                  }
                  await fetchBookmarksFn?.();
                  await fetchAllFn?.();
                  invalidateBookmarks?.();
                  setToast({ message: "Bookmarks moved to trash", type: "success" });
                } catch {
                  setToast({ message: "Failed to move bookmarks to trash", type: "error" });
                }
              },
            },
            {
              label: "Remove from collection",
              variant: "primary",
              onClick: async () => {
                try {
                  const ids: string[] = Array.from(selectedBookmarkIds);
                  for (const id of ids) {
                    const bm = currentBookmarks.find((b) => b.id === id);
                    if (bm && bm.collections.length === 1 && bm.collections[0].id === currentCollectionId) {
                      await apiClient.bookmarks.delete(id);
                    } else {
                      await apiClient.collections.removeFromBookmark(id, currentCollectionId);
                    }
                  }
                  setSelectedBookmarkIds(new Set());
                  if (selectedBookmark && selectedBookmarkIds.has(selectedBookmark.id)) {
                    setSelectedBookmark(null);
                  }
                  await fetchBookmarksFn?.();
                  await fetchAllFn?.();
                  invalidateBookmarks?.();
                  setToast({ message: "Bookmarks removed from collection", type: "success" });
                } catch {
                  setToast({ message: "Failed to remove bookmarks from collection", type: "error" });
                }
              },
            },
          ],
        });
      } else {
        setConfirmDialog({
          isOpen: true,
          title: "Move to trash",
          message: `Are you sure you want to move ${selectedBookmarkIds.size} bookmarks to trash?`,
          onConfirm: async () => {
            try {
              await apiClient.bookmarks.bulkDelete(Array.from(selectedBookmarkIds));
              setSelectedBookmarkIds(new Set());
              if (selectedBookmark && selectedBookmarkIds.has(selectedBookmark.id)) {
                setSelectedBookmark(null);
              }
              await fetchBookmarksFn?.();
              await fetchAllFn?.();
              invalidateBookmarks?.();
              setToast({ message: "Bookmarks moved to trash", type: "success" });
            } catch {
              setToast({ message: "Failed to move bookmarks to trash", type: "error" });
            }
          },
        });
      }
    },
    [selectedBookmarkIds, selectedBookmark, setToast, invalidateBookmarks]
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
            invalidateBookmarks?.();
          } catch {
            setToast({ message: "Failed to refresh some bookmarks", type: "error" });
          } finally {
            setRefreshingBookmarkIds((prev) => { const s = new Set(prev); ids.forEach((id) => s.delete(id)); return s; });
          }
        },
      });
    },
    [selectedBookmarkIds, selectedBookmark, setToast, invalidateBookmarks]
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
          invalidateBookmarks?.();
          setToast({ message: "Collections updated", type: "success" });
        }
      } catch {
        setToast({ message: "Failed to update collections", type: "error" });
      }
    },
    [setToast, invalidateBookmarks]
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
        invalidateBookmarks?.();
      } catch (error) {
        const msg = error instanceof ApiError ? error.message : "Failed to categorize";
        setToast({ message: msg, type: "error" });
      } finally {
        setIsCategorizing(false);
      }
    },
    [isCategorizing, setToast, invalidateBookmarks]
  );

  const toggleBookmarkSelection = useCallback((id: string) => {
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
    handleRemoveFromCollection,
    handleMoveToTrash,
    handleRestoreFromTrash,
    handlePermanentlyDelete,
    handleBulkDelete,
    handleBulkRefresh,
    handleUpdateBookmarkCollections,
    handleCategorizeAll,
    toggleBookmarkSelection,
  };
}
