import React, { useState, useMemo } from "react";
import { Space, Collection, Bookmark } from "../types";

interface ToastMessage {
  message: string;
  type: "success" | "error" | "info";
}

interface UseCollectionsReturn {
  selectedCollectionId: string | null;
  setSelectedCollectionId: React.Dispatch<React.SetStateAction<string | null>>;
  isEditingCollections: boolean;
  setIsEditingCollections: React.Dispatch<React.SetStateAction<boolean>>;
  selectedCollectionIdsForEdit: string[];
  setSelectedCollectionIdsForEdit: React.Dispatch<React.SetStateAction<string[]>>;
  isCreatingCollection: boolean;
  setIsCreatingCollection: React.Dispatch<React.SetStateAction<boolean>>;
  newCollectionName: string;
  setNewCollectionName: React.Dispatch<React.SetStateAction<string>>;
  draggedCollectionId: string | null;
  setDraggedCollectionId: React.Dispatch<React.SetStateAction<string | null>>;
  dropTargetCollectionId: string | null;
  setDropTargetCollectionId: React.Dispatch<React.SetStateAction<string | null>>;
  fetchCollections: () => Promise<void>;
  handleCreateCollection: () => Promise<void>;
  handleDeleteCollection: (collectionId: string) => Promise<void>;
  handleMoveCollection: (draggedId: string, targetId: string) => Promise<void>;
  handleUpdateBookmarkCollections: (bookmarkId: string, collectionIds: string[]) => Promise<void>;
  isDescendant: (candidateAncestorId: string, descendantId: string) => boolean;
  treeSpaces: (Space & { collections: Collection[] })[];
  allCollectionsTree: Collection[];
  collectionBookmarkCounts: Map<string, number>;
}

export function useCollections(
  spaces: Space[],
  collections: Collection[],
  setCollections: React.Dispatch<React.SetStateAction<Collection[]>>,
  bookmarks: Bookmark[],
  setBookmarks: React.Dispatch<React.SetStateAction<Bookmark[]>>,
  setSelectedBookmark: React.Dispatch<React.SetStateAction<Bookmark | null>>,
  fetchBookmarks: () => void,
  setToast: (toast: ToastMessage | null) => void
): UseCollectionsReturn {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [isEditingCollections, setIsEditingCollections] = useState(false);
  const [selectedCollectionIdsForEdit, setSelectedCollectionIdsForEdit] = useState<string[]>([]);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [draggedCollectionId, setDraggedCollectionId] = useState<string | null>(null);
  const [dropTargetCollectionId, setDropTargetCollectionId] = useState<string | null>(null);

  const fetchCollections = async () => {
    try {
      const res = await fetch("/api/collections");
      if (!res.ok) throw new Error(`Failed to fetch collections: ${res.status}`);
      const data = await res.json();
      setCollections(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch collections", e);
      setCollections([]);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) {
      setToast({ message: "Please enter a name", type: "error" });
      return;
    }

    const inboxSpace = spaces.find(s => s.id === 'inbox-space');
    const targetSpace = inboxSpace || spaces[0];

    if (!targetSpace) {
      setToast({ message: "No space available. Please reload the page.", type: "error" });
      return;
    }

    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCollectionName.trim(),
          space_id: targetSpace.id,
          icon: "Folder",
          color: null,
          parent_id: null
        })
      });
      if (res.ok) {
        setNewCollectionName("");
        setIsCreatingCollection(false);
        fetchCollections();
        setToast({ message: "Collection created", type: "success" });
      } else {
        const err = await res.json().catch(() => ({}));
        setToast({ message: `Failed: ${err.error || 'unknown error'}`, type: "error" });
      }
    } catch (error: any) {
      setToast({ message: error.message || "Failed to create collection", type: "error" });
    }
  };

  const handleUpdateBookmarkCollections = async (bookmarkId: string, collectionIds: string[]) => {
    try {
      const res = await fetch(`/api/bookmarks/${bookmarkId}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionIds }),
      });
      if (res.ok) {
        const updatedRes = await fetch(`/api/bookmarks/${bookmarkId}`);
        if (updatedRes.ok) {
          const updated = await updatedRes.json();
          setSelectedBookmark(updated);
        }
        fetchBookmarks();
        fetchCollections();
        setToast({ message: "Collections updated", type: "success" });
      } else {
        setToast({ message: "Failed to update collections", type: "error" });
      }
    } catch (error) {
      console.error("Update collections error:", error);
      setToast({ message: "Failed to update collections", type: "error" });
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (!confirm("Delete this collection? Bookmarks will remain but will be unlinked from this collection.")) {
      return;
    }
    try {
      const res = await fetch(`/api/collections/${collectionId}`, { method: "DELETE" });
      if (res.ok) {
        if (selectedCollectionId === collectionId) {
          setSelectedCollectionId(null);
        }
        fetchCollections();
        fetchBookmarks();
        setToast({ message: "Collection deleted", type: "success" });
      } else {
        setToast({ message: "Failed to delete collection", type: "error" });
      }
    } catch (error) {
      console.error("Delete collection error:", error);
      setToast({ message: "Failed to delete collection", type: "error" });
    }
  };

  const isDescendant = (candidateAncestorId: string, descendantId: string): boolean => {
    if (candidateAncestorId === descendantId) return true;
    let curr = collections.find(c => c.id === descendantId);
    while (curr && curr.parent_id) {
      if (curr.parent_id === candidateAncestorId) return true;
      curr = collections.find(c => c.id === curr.parent_id);
    }
    return false;
  };

  const handleMoveCollection = async (draggedId: string, targetId: string) => {
    if (draggedId === 'inbox-collection' || targetId === 'inbox-collection') {
      setToast({ message: "Cannot move system collections", type: "error" });
      return;
    }
    if (isDescendant(draggedId, targetId)) {
      setToast({ message: "Cannot move collection into its own descendant", type: "error" });
      return;
    }

    const draggedColl = collections.find(c => c.id === draggedId);
    if (!draggedColl) {
      setToast({ message: "Collection not found", type: "error" });
      return;
    }

    try {
      const res = await fetch(`/api/collections/${draggedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draggedColl.name,
          icon: draggedColl.icon,
          color: draggedColl.color,
          parent_id: targetId
        })
      });
      if (res.ok) {
        fetchCollections();
        setToast({ message: "Collection moved", type: "success" });
      } else {
        const err = await res.json().catch(() => ({}));
        setToast({ message: `Failed: ${err.error || 'unknown error'}`, type: "error" });
      }
    } catch (error) {
      console.error("Move collection error:", error);
      setToast({ message: "Failed to move collection", type: "error" });
    } finally {
      setDraggedCollectionId(null);
      setDropTargetCollectionId(null);
    }
  };

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
      return roots.map(c => ({
        ...c,
        children: buildTree(spaceId, c.id)
      }));
    };

    return visibleSpaces.map(space => ({
      ...space,
      collections: buildTree(space.id)
    }));
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
      return items
        .filter(item => item.parent_id === parentId)
        .map(item => ({
          ...item,
          bookmarkCount: collectionBookmarkCounts.get(item.id) || 0,
          children: buildTree(items, item.id)
        }));
    };
    return buildTree(collections);
  }, [collections, collectionBookmarkCounts]);

  return {
    selectedCollectionId,
    setSelectedCollectionId,
    isEditingCollections,
    setIsEditingCollections,
    selectedCollectionIdsForEdit,
    setSelectedCollectionIdsForEdit,
    isCreatingCollection,
    setIsCreatingCollection,
    newCollectionName,
    setNewCollectionName,
    draggedCollectionId,
    setDraggedCollectionId,
    dropTargetCollectionId,
    setDropTargetCollectionId,
    fetchCollections,
    handleCreateCollection,
    handleDeleteCollection,
    handleMoveCollection,
    handleUpdateBookmarkCollections,
    isDescendant,
    treeSpaces,
    allCollectionsTree,
    collectionBookmarkCounts,
  };
}
