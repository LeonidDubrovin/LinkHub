import React, { useState, useCallback, useMemo, useRef } from "react";
import { Collection, SpaceWithCollections } from "../types";
import { apiClient, ApiError } from "../services/api";
import { buildCollectionTree } from "../utils/buildCollectionTree";
import { DropPosition } from "../components/CollectionTree";

type ToastFn = (toast: { message: string; type: "success" | "error" | "info" } | null) => void;

export function useCollections(
  collections: Collection[],
  fetchCollections: () => Promise<void>,
  spaces: SpaceWithCollections[],
  setToast: ToastFn,
  onCollectionDeleted?: (collectionId: string) => void
) {
  const [draggedCollectionId, setDraggedCollectionId] = useState<string | null>(null);
  const draggedCollectionIdRef = useRef<string | null>(null);
  const [dropTargetCollectionId, setDropTargetCollectionId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<DropPosition | null>(null);
  const [contextMenu, setContextMenu] = useState<{ collection: Collection; position: { x: number; y: number } } | null>(null);
  const [renamingCollection, setRenamingCollection] = useState<Collection | null>(null);
  const [iconPickerCollection, setIconPickerCollection] = useState<Collection | null>(null);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");

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
      const inboxSpace = spaces.find((s) => s.id === "inbox-space");
      const targetSpace = inboxSpace || spaces[0];
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
        await fetchCollections();
        setToast({ message: "Collection created", type: "success" });
      } catch (error) {
        const msg = error instanceof ApiError ? error.message : "Failed to create collection";
        setToast({ message: msg, type: "error" });
      }
    },
    [newCollectionName, spaces, fetchCollections, setToast]
  );

  const handleDeleteCollection = useCallback(
    async (collectionId: string) => {
      if (!confirm("Delete this collection? Bookmarks will remain but will be unlinked from this collection.")) return;
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
    [fetchCollections, setToast, onCollectionDeleted]
  );

  const handleMoveCollection = useCallback(
    async (draggedId: string, targetId: string | null, position: DropPosition) => {
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

      try {
        if (!targetId) {
          const rootSiblings = collections.filter(
            (c) => c.space_id === draggedColl.space_id && !c.parent_id
          );
          const maxSort = rootSiblings.reduce((max, c) => Math.max(max, c.sort_order ?? 0), 0);
          await apiClient.collections.update(draggedId, {
            name: draggedColl.name,
            icon: draggedColl.icon,
            color: draggedColl.color,
            parent_id: null,
            sort_order: maxSort + 1,
          });
        } else if (position === "into") {
          const targetChildren = collections.filter((c) => c.parent_id === targetId);
          const maxSort = targetChildren.reduce((max, c) => Math.max(max, c.sort_order ?? 0), -1);
          await apiClient.collections.update(draggedId, {
            name: draggedColl.name,
            icon: draggedColl.icon,
            color: draggedColl.color,
            parent_id: targetId,
            sort_order: maxSort + 1,
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
          });
        }

        await fetchCollections();
        setToast({ message: "Collection moved", type: "success" });
      } catch (error) {
        const msg = error instanceof ApiError ? error.message : "Failed to move collection";
        setToast({ message: msg, type: "error" });
      } finally {
        draggedCollectionIdRef.current = null;
        setDraggedCollectionId(null);
        setDropTargetCollectionId(null);
        setDropPosition(null);
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
      await handleUpdateCollection(collectionId, { sort_order: prev.sort_order });
      await handleUpdateCollection(prev.id, { sort_order: siblings[idx].sort_order });
    },
    [getSiblings, handleUpdateCollection]
  );

  const handleMoveCollectionDown = useCallback(
    async (collectionId: string) => {
      const siblings = getSiblings(collectionId);
      const idx = siblings.findIndex((c) => c.id === collectionId);
      if (idx < 0 || idx >= siblings.length - 1) return;
      const next = siblings[idx + 1];
      await handleUpdateCollection(collectionId, { sort_order: next.sort_order });
      await handleUpdateCollection(next.id, { sort_order: siblings[idx].sort_order });
    },
    [getSiblings, handleUpdateCollection]
  );

  const handleMoveCollectionOut = useCallback(
    (collectionId: string) => {
      const coll = collections.find((c) => c.id === collectionId);
      if (!coll || !coll.parent_id) return;
      handleUpdateCollection(collectionId, { parent_id: null });
    },
    [collections, handleUpdateCollection]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, coll: Collection) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ collection: coll, position: { x: e.clientX, y: e.clientY } });
    },
    []
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

  const dragHandlers = useMemo(
    () => ({
      onDragStart: (e: React.DragEvent, collId: string) => {
        e.stopPropagation();
        draggedCollectionIdRef.current = collId;
        setDraggedCollectionId(collId);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", collId);
      },
      onDragOver: (e: React.DragEvent, collId: string, position: DropPosition) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedId = draggedCollectionIdRef.current;
        if (!draggedId || draggedId === collId) return;
        if (position === "into" && isDescendant(draggedId, collId)) return;
        setDropTargetCollectionId(collId);
        setDropPosition(position);
      },
      onDrop: (e: React.DragEvent, collId: string, position: DropPosition) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedId = draggedCollectionIdRef.current;
        if (draggedId && draggedId !== collId) {
          handleMoveCollection(draggedId, collId, position);
        } else {
          draggedCollectionIdRef.current = null;
          setDraggedCollectionId(null);
          setDropTargetCollectionId(null);
          setDropPosition(null);
        }
      },
      onDragEnd: () => {
        draggedCollectionIdRef.current = null;
        setDraggedCollectionId(null);
        setDropTargetCollectionId(null);
        setDropPosition(null);
      },
      onContainerLeave: () => {
        setDropTargetCollectionId(null);
        setDropPosition(null);
      },
      onRootDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const draggedId = draggedCollectionIdRef.current;
        if (draggedId) {
          handleMoveCollection(draggedId, null, "after");
        }
      },
      onRootDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        setDropTargetCollectionId(null);
        setDropPosition(null);
      },
    }),
    [isDescendant, handleMoveCollection]
  );

  return {
    contextMenu,
    setContextMenu,
    renamingCollection,
    setRenamingCollection,
    iconPickerCollection,
    setIconPickerCollection,
    isCreatingCollection,
    setIsCreatingCollection,
    newCollectionName,
    setNewCollectionName,
    dropTargetCollectionId,
    dropPosition,
    draggedCollectionId,

    treeSpaces,

    handleCreateCollection,
    handleDeleteCollection: handleDeleteCollection,
    handleUpdateCollection,
    handleMoveCollection,
    handleMoveCollectionUp,
    handleMoveCollectionDown,
    handleMoveCollectionOut,
    handleContextMenu,
    handleRenameSubmit,
    handleChangeIconSubmit,
    getSiblings,
    isDescendant,
    dragHandlers,
  };
}
