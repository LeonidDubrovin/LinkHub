import React, { useState, useCallback, useMemo } from "react";
import { Collection, SpaceWithCollections } from "../types";
import { apiClient, ApiError } from "../services/api";
import { buildCollectionTree } from "../utils/buildCollectionTree";
import { ArboristNodeData, transformToArboristData } from "../utils/arboristData";

type ToastFn = (toast: { message: string; type: "success" | "error" | "info" } | null) => void;

export function useCollections(
  collections: Collection[],
  fetchCollections: () => Promise<void>,
  fetchSpaces: () => Promise<void>,
  spaces: SpaceWithCollections[],
  setToast: ToastFn,
  onCollectionDeleted?: (collectionId: string) => void
) {
  const [contextMenu, setContextMenu] = useState<{ collection: Collection; position: { x: number; y: number } } | null>(null);
  const [spaceContextMenu, setSpaceContextMenu] = useState<{ space: import("../types").Space; position: { x: number; y: number } } | null>(null);
  const [renamingCollection, setRenamingCollection] = useState<Collection | null>(null);
  const [renamingSpace, setRenamingSpace] = useState<import("../types").Space | null>(null);
  const [iconPickerCollection, setIconPickerCollection] = useState<Collection | null>(null);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [createCollectionSpaceId, setCreateCollectionSpaceId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const isDescendant = useCallback(
    (candidateAncestorId: string, descendantId: string): boolean => {
      if (candidateAncestorId === descendantId) return true;
      let curr = collections.find((c) => c.id === descendantId);
      while (curr && curr.parent_id) {
        if (curr.parent_id === candidateAncestorId) return true;
        curr = collections.find((c) => c.id === curr!.parent_id);
      }
      return false;
    },
    [collections]
  );

  const getSiblings = useCallback(
    (collectionId: string): Collection[] => {
      const coll = collections.find((c) => c.id === collectionId);
      if (!coll) return [];
      return collections
        .filter((c) => c.space_id === coll.space_id && c.parent_id === coll.parent_id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    },
    [collections]
  );

  const handleUpdateCollection = useCallback(
    async (collectionId: string, updates: Partial<Collection>) => {
      const coll = collections.find((c) => c.id === collectionId);
      if (!coll) { setToast({ message: "Collection not found", type: "error" }); return; }
      try {
        await apiClient.collections.update(collectionId, {
          name: updates.name ?? coll.name,
          icon: updates.icon ?? coll.icon,
          color: updates.color ?? coll.color,
          parent_id: updates.parent_id !== undefined ? updates.parent_id : coll.parent_id,
          sort_order: updates.sort_order !== undefined ? updates.sort_order : coll.sort_order,
        });
        await fetchCollections();
        if (updates.icon || updates.name || updates.color) {
          setToast({ message: "Collection updated", type: "success" });
        }
      } catch (error) {
        const msg = error instanceof ApiError ? error.message : "Failed to update collection";
        setToast({ message: msg, type: "error" });
      }
    },
    [collections, fetchCollections, setToast]
  );

  const handleCreateCollection = useCallback(
    async () => {
      if (!newCollectionName.trim()) {
        setToast({ message: "Please enter a name", type: "error" });
        return;
      }
      const targetSpace = createCollectionSpaceId
        ? spaces.find((s) => s.id === createCollectionSpaceId)
        : spaces.find((s) => s.id === "inbox-space") || spaces[0];
      if (!targetSpace) {
        setToast({ message: "No space available. Please reload the page.", type: "error" });
        return;
      }
      try {
        await apiClient.collections.create({
          name: newCollectionName.trim(),
          space_id: targetSpace.id,
        });
        setNewCollectionName("");
        setIsCreatingCollection(false);
        setCreateCollectionSpaceId(null);
        await fetchCollections();
        setToast({ message: "Collection created", type: "success" });
      } catch (error) {
        const msg = error instanceof ApiError ? error.message : "Failed to create collection";
        setToast({ message: msg, type: "error" });
      }
    },
    [newCollectionName, createCollectionSpaceId, spaces, fetchCollections, setToast]
  );

  const handleDeleteCollection = useCallback(
    (collectionId: string) => {
      setConfirmDialog({
        isOpen: true,
        title: "Delete Collection",
        message: "Delete this collection? Bookmarks will remain but will be unlinked from this collection.",
        onConfirm: async () => {
          try {
            await apiClient.collections.delete(collectionId);
            await fetchCollections();
            onCollectionDeleted?.(collectionId);
            setToast({ message: "Collection deleted", type: "success" });
          } catch (error) {
            const msg = error instanceof ApiError ? error.message : "Failed to delete collection";
            setToast({ message: msg, type: "error" });
          }
        },
      });
    },
    [fetchCollections, setToast, onCollectionDeleted]
  );

  const handleMoveCollection = useCallback(
    async (draggedId: string, targetId: string | null, position: "before" | "after" | "into", targetSpaceId?: string) => {
      if (draggedId === "inbox-collection") {
        setToast({ message: "Cannot move system collections", type: "error" });
        return;
      }

      if (targetId && isDescendant(draggedId, targetId)) {
        setToast({ message: "Cannot move collection into its own descendant", type: "error" });
        return;
      }

      const draggedColl = collections.find((c) => c.id === draggedId);
      if (!draggedColl) { setToast({ message: "Collection not found", type: "error" }); return; }

      const destSpaceId = targetSpaceId || draggedColl.space_id;

      try {
        if (!targetId) {
          const rootSiblings = collections.filter(
            (c) => c.space_id === destSpaceId && !c.parent_id
          );
          const maxSort = rootSiblings.reduce((max, c) => Math.max(max, c.sort_order ?? 0), 0);
          await apiClient.collections.update(draggedId, {
            name: draggedColl.name,
            icon: draggedColl.icon,
            color: draggedColl.color,
            parent_id: null,
            sort_order: maxSort + 1,
            space_id: destSpaceId,
          });
        } else if (position === "into") {
          const target = collections.find((c) => c.id === targetId);
          if (!target) { setToast({ message: "Target not found", type: "error" }); return; }
          const targetChildren = collections.filter((c) => c.parent_id === targetId);
          const maxSort = targetChildren.reduce((max, c) => Math.max(max, c.sort_order ?? 0), -1);
          await apiClient.collections.update(draggedId, {
            name: draggedColl.name,
            icon: draggedColl.icon,
            color: draggedColl.color,
            parent_id: targetId,
            sort_order: maxSort + 1,
            space_id: target.space_id,
          });
        } else {
          const target = collections.find((c) => c.id === targetId);
          if (!target) { setToast({ message: "Target not found", type: "error" }); return; }

          const siblings = collections
            .filter((c) => c.space_id === target.space_id && c.parent_id === target.parent_id && c.id !== draggedId)
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

          const targetIndex = siblings.findIndex((c) => c.id === targetId);
          let newSortOrder: number;

          if (position === "before") {
            if (targetIndex <= 0) {
              newSortOrder = (siblings[0]?.sort_order ?? 0) - 1;
            } else {
              newSortOrder = ((siblings[targetIndex - 1].sort_order ?? 0) + (target.sort_order ?? 0)) / 2;
            }
          } else {
            if (targetIndex >= siblings.length - 1) {
              newSortOrder = (target.sort_order ?? 0) + 1;
            } else {
              newSortOrder = ((target.sort_order ?? 0) + (siblings[targetIndex + 1].sort_order ?? 0)) / 2;
            }
          }

          await apiClient.collections.update(draggedId, {
            name: draggedColl.name,
            icon: draggedColl.icon,
            color: draggedColl.color,
            parent_id: target.parent_id,
            sort_order: newSortOrder,
            space_id: target.space_id,
          });
        }

        await fetchCollections();
        setToast({ message: "Collection moved", type: "success" });
      } catch (error) {
        const msg = error instanceof ApiError ? error.message : "Failed to move collection";
        setToast({ message: msg, type: "error" });
      }
    },
    [collections, fetchCollections, isDescendant, setToast]
  );

  const handleArboristMove = useCallback(
    async (args: { dragIds: string[]; parentId: string | null; parentNode: any; index: number }) => {
      const draggedId = args.dragIds[0];
      if (!draggedId) return;

      if (draggedId === "inbox-collection") {
        setToast({ message: "Cannot move system collections", type: "error" });
        return;
      }

      const draggedColl = collections.find((c) => c.id === draggedId);
      if (!draggedColl) return;

      let realParentId: string | null;
      let destSpaceId: string;

      if (!args.parentId) {
        realParentId = null;
        destSpaceId = draggedColl.space_id;
      } else if (args.parentId.startsWith("group:")) {
        realParentId = null;
        destSpaceId = args.parentId.replace("group:", "");
      } else {
        realParentId = args.parentId;
        const parentColl = collections.find((c) => c.id === args.parentId);
        if (!parentColl) return;

        if (isDescendant(draggedId, args.parentId)) {
          setToast({ message: "Cannot move collection into its own descendant", type: "error" });
          return;
        }
        destSpaceId = parentColl.space_id;
      }

      const siblings = collections
        .filter(
          (c) =>
            c.space_id === destSpaceId &&
            c.parent_id === realParentId &&
            c.id !== draggedId
        )
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      const insertIndex = Math.min(args.index, siblings.length);
      let newSortOrder: number;

      if (siblings.length === 0) {
        newSortOrder = 0;
      } else if (insertIndex === 0) {
        newSortOrder = (siblings[0].sort_order ?? 0) - 1;
      } else if (insertIndex >= siblings.length) {
        newSortOrder = (siblings[siblings.length - 1].sort_order ?? 0) + 1;
      } else {
        newSortOrder =
          ((siblings[insertIndex - 1].sort_order ?? 0) +
            (siblings[insertIndex].sort_order ?? 0)) /
          2;
      }

      try {
        await apiClient.collections.update(draggedId, {
          name: draggedColl.name,
          icon: draggedColl.icon,
          color: draggedColl.color,
          parent_id: realParentId,
          sort_order: newSortOrder,
          space_id: destSpaceId,
        });
        await fetchCollections();
        setToast({ message: "Collection moved", type: "success" });
      } catch (error) {
        const msg = error instanceof ApiError ? error.message : "Failed to move collection";
        setToast({ message: msg, type: "error" });
      }
    },
    [collections, fetchCollections, isDescendant, setToast]
  );

  const handleMoveCollectionUp = useCallback(
    async (collectionId: string) => {
      const siblings = getSiblings(collectionId);
      const idx = siblings.findIndex((c) => c.id === collectionId);
      if (idx <= 0) return;
      const prev = siblings[idx - 1];
      const curr = siblings[idx];
      await Promise.all([
        apiClient.collections.update(collectionId, { name: curr.name, icon: curr.icon, color: curr.color, parent_id: curr.parent_id, sort_order: prev.sort_order, space_id: curr.space_id }),
        apiClient.collections.update(prev.id, { name: prev.name, icon: prev.icon, color: prev.color, parent_id: prev.parent_id, sort_order: curr.sort_order, space_id: prev.space_id }),
      ]);
      await fetchCollections();
    },
    [getSiblings, fetchCollections]
  );

  const handleMoveCollectionDown = useCallback(
    async (collectionId: string) => {
      const siblings = getSiblings(collectionId);
      const idx = siblings.findIndex((c) => c.id === collectionId);
      if (idx < 0 || idx >= siblings.length - 1) return;
      const next = siblings[idx + 1];
      const curr = siblings[idx];
      await Promise.all([
        apiClient.collections.update(collectionId, { name: curr.name, icon: curr.icon, color: curr.color, parent_id: curr.parent_id, sort_order: next.sort_order, space_id: curr.space_id }),
        apiClient.collections.update(next.id, { name: next.name, icon: next.icon, color: next.color, parent_id: next.parent_id, sort_order: curr.sort_order, space_id: next.space_id }),
      ]);
      await fetchCollections();
    },
    [getSiblings, fetchCollections]
  );

  const handleMoveCollectionOut = useCallback(
    (collectionId: string) => {
      const coll = collections.find((c) => c.id === collectionId);
      if (!coll || !coll.parent_id) return;
      handleUpdateCollection(collectionId, { parent_id: null });
    },
    [collections, handleUpdateCollection]
  );

  const handleDropBookmarks = useCallback(
    async (collectionId: string, bookmarkIds: string[], sourceCollectionId?: string | null, fetchBookmarksFn?: () => Promise<void>) => {
      try {
        // IMPORTANT: Add to target FIRST, then remove from source.
        // If we remove first, the orphaned-bookmark fallback on the server
        // would temporarily add the bookmark to inbox-collection before
        // the target add happens, resulting in an unwanted extra collection.
        const result = await apiClient.collections.addBookmarksToCollection(collectionId, bookmarkIds);
        if (sourceCollectionId && result.success) {
          await Promise.all(
            bookmarkIds.map((id) =>
              apiClient.collections.removeFromBookmark(id, sourceCollectionId)
            )
          );
        }
        if (result.success) {
          await fetchCollections();
          await fetchBookmarksFn?.();
          setToast({ message: `${bookmarkIds.length} bookmark${bookmarkIds.length > 1 ? "s" : ""} moved to collection`, type: "success" });
        }
      } catch (error) {
        const msg = error instanceof ApiError ? error.message : "Failed to move bookmarks to collection";
        setToast({ message: msg, type: "error" });
      }
    },
    [fetchCollections, setToast]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, coll: Collection) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ collection: coll, position: { x: e.clientX, y: e.clientY } });
    },
    []
  );

  const handleSpaceContextMenu = useCallback(
    (e: React.MouseEvent, space: import("../types").Space) => {
      e.preventDefault();
      e.stopPropagation();
      setSpaceContextMenu({ space, position: { x: e.clientX, y: e.clientY } });
    },
    []
  );

  const handleRenameSpace = useCallback(
    async (newName: string) => {
      if (!renamingSpace) return;
      try {
        await apiClient.spaces.update(renamingSpace.id, { name: newName });
        await fetchCollections(); // refresh spaces indirectly via parent
        setToast({ message: "Group renamed", type: "success" });
      } catch (error) {
        const msg = error instanceof ApiError ? error.message : "Failed to rename group";
        setToast({ message: msg, type: "error" });
      }
      setRenamingSpace(null);
    },
    [renamingSpace, setToast]
  );

  const handleDeleteSpace = useCallback(
    (spaceId: string) => {
      setConfirmDialog({
        isOpen: true,
        title: "Delete Group",
        message: "Delete this group? All collections inside will also be removed. Bookmarks will remain but will be unlinked from those collections.",
        onConfirm: async () => {
          try {
            await apiClient.spaces.delete(spaceId);
            await fetchSpaces();
            await fetchCollections();
            setToast({ message: "Group deleted", type: "success" });
          } catch (error) {
            const msg = error instanceof ApiError ? error.message : "Failed to delete group";
            setToast({ message: msg, type: "error" });
          }
        },
      });
    },
    [fetchCollections, fetchSpaces, setToast]
  );

  const handleRenameSubmit = useCallback(
    (newName: string) => {
      if (!renamingCollection) return;
      handleUpdateCollection(renamingCollection.id, { name: newName });
      setRenamingCollection(null);
    },
    [renamingCollection, handleUpdateCollection]
  );

  const handleChangeIconSubmit = useCallback(
    (iconName: string) => {
      if (!iconPickerCollection) return;
      handleUpdateCollection(iconPickerCollection.id, { icon: iconName });
      setIconPickerCollection(null);
    },
    [iconPickerCollection, handleUpdateCollection]
  );

  const treeSpaces = useMemo(() => {
    if (spaces.length === 0 || collections.length === 0) return [];
    const sortedSpaces = [...spaces].sort((a, b) => {
      if (a.id === "inbox-space") return -1;
      if (b.id === "inbox-space") return 1;
      return a.name.localeCompare(b.name);
    });
    const visibleSpaces = sortedSpaces.filter((space) => space.name !== "Library");
    return visibleSpaces.map((space) => ({
      ...space,
      collections: buildCollectionTree(
        collections.filter((c) => c.space_id === space.id),
        null
      ),
    }));
  }, [spaces, collections]);

  const arboristData = useMemo(
    () => transformToArboristData(spaces, collections),
    [spaces, collections]
  );

  return {
    contextMenu,
    setContextMenu,
    spaceContextMenu,
    setSpaceContextMenu,
    renamingCollection,
    setRenamingCollection,
    renamingSpace,
    setRenamingSpace,
    iconPickerCollection,
    setIconPickerCollection,
    isCreatingCollection,
    setIsCreatingCollection,
    newCollectionName,
    setNewCollectionName,
    createCollectionSpaceId,
    setCreateCollectionSpaceId,

    treeSpaces,
    arboristData,

    handleCreateCollection,
    handleDeleteCollection: handleDeleteCollection,
    handleUpdateCollection,
    handleMoveCollection,
    handleArboristMove,
    handleMoveCollectionUp,
    handleMoveCollectionDown,
    handleMoveCollectionOut,
    confirmDialog,
    setConfirmDialog,
    handleContextMenu,
    handleSpaceContextMenu,
    handleRenameSpace,
    handleDeleteSpace,
    handleRenameSubmit,
    handleChangeIconSubmit,
    handleDropBookmarks,
    getSiblings,
    isDescendant,
  };
}
