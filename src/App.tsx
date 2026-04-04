import React, { useState, useEffect } from "react";
import { Icon } from "./components/Icon";
import { DynamicCover } from "./components/DynamicCover";
import { Toast } from "./components/Toast";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { AddBookmarkModal } from "./components/AddBookmarkModal";
import { SettingsModal } from "./components/SettingsModal";
import { Bookmark, Space, Collection, Tag, Domain } from "./types";
import { format } from "date-fns";
import {
  Plus,
  Search,
  Settings,
  LayoutGrid,
  List as ListIcon,
  Trash2,
  ExternalLink,
  BookOpen,
  Globe,
  Shield,
  X,
  RefreshCw,
  ArrowUpDown,
  Filter,
  ChevronDown,
  Pin,
  PinOff,
} from "lucide-react";
import { cn } from "./lib/utils";

import { getDomain, getYouTubeId } from './utils';

export default function App() {
   const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
   const [spaces, setSpaces] = useState<Space[]>([]);
   const [collections, setCollections] = useState<Collection[]>([]);
   const [tags, setTags] = useState<Tag[]>([]);
   const [domains, setDomains] = useState<Domain[]>([]);

   const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(
     null,
   );
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(
    null,
  );
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
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingLoading, setIsAddingLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [viewMode, setViewMode] = useState<"list" | "grid">(() => {
    return (localStorage.getItem('viewMode') as "list" | "grid") || "list";
  });
  const [itemSize, setItemSize] = useState<"small" | "medium" | "large">(() => {
    return (localStorage.getItem('itemSize') as "small" | "medium" | "large") || "medium";
  });
  const [pinnedDomains, setPinnedDomains] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('pinnedDomains') || '[]');
    } catch {
      return [];
    }
  });
  const [searchQuery, setSearchQuery] = useState("");

  const [readerContent, setReaderContent] = useState<{
    title: string;
    content: string;
    byline: string;
  } | null>(null);
  const [isReaderLoading, setIsReaderLoading] = useState(false);
  const [refreshingBookmarkIds, setRefreshingBookmarkIds] = useState<Set<string>>(new Set());

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
   const [confirmDialog, setConfirmDialog] = useState<{
     isOpen: boolean;
     title: string;
     message: string;
     onConfirm: () => void;
   }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

   const [isCategorizing, setIsCategorizing] = useState(false);

   const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "title_asc" | "title_desc" | "domain_asc" | "domain_desc">("date_desc");
   const [filterBy, setFilterBy] = useState<"all" | "has_images" | "has_summary" | "has_content">("all");

   // Collections editing state
   const [isEditingCollections, setIsEditingCollections] = useState(false);
   const [selectedCollectionIdsForEdit, setSelectedCollectionIdsForEdit] = useState<string[]>([]);

   // Collection creation state
   const [isCreatingCollection, setIsCreatingCollection] = useState(false);
   const [newCollectionName, setNewCollectionName] = useState("");

   // Drag and drop state for collections
   const [draggedCollectionId, setDraggedCollectionId] = useState<string | null>(null);
   const [dropTargetCollectionId, setDropTargetCollectionId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('itemSize', itemSize);
  }, [itemSize]);

  useEffect(() => {
    localStorage.setItem('pinnedDomains', JSON.stringify(pinnedDomains));
  }, [pinnedDomains]);

  useEffect(() => {
    if (selectedBookmark) {
      if (getYouTubeId(selectedBookmark.url)) {
        setInspectorTab('video');
      } else {
        setInspectorTab((prev) => prev === 'video' ? 'details' : prev);
      }
    }
  }, [selectedBookmark?.id]);

   useEffect(() => {
     fetchSpaces();
     fetchCollections();
     fetchTags();
     fetchDomains();
     fetchBookmarks();
   }, []);

   useEffect(() => {
     fetchBookmarks();
     setSelectedBookmark(null);
     setIsInspectorOpen(false);
     setReaderContent(null);
   }, [selectedCollectionId, selectedTagId, selectedDomain]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 250 && newWidth <= window.innerWidth - 350) {
        setInspectorWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!isDragging) {
      localStorage.setItem('inspectorWidth', inspectorWidth.toString());
    }
  }, [isDragging, inspectorWidth]);

   const fetchSpaces = async () => {
     try {
       const res = await fetch("/api/spaces");
       const data = await res.json();
       setSpaces(Array.isArray(data) ? data : []);
     } catch (e) {
       console.error("Failed to fetch spaces", e);
       setSpaces([]);
     }
   };

   const fetchCollections = async () => {
     try {
       const res = await fetch("/api/collections");
       const data = await res.json();
       setCollections(Array.isArray(data) ? data : []);
     } catch (e) {
       console.error("Failed to fetch collections", e);
       setCollections([]);
     }
   };

  const fetchTags = async () => {
    try {
      const res = await fetch("/api/tags");
      const data = await res.json();
      setTags(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch tags", e);
      setTags([]);
    }
  };

  const fetchDomains = async () => {
    try {
      const res = await fetch("/api/domains");
      const data = await res.json();
      setDomains(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch domains", e);
      setDomains([]);
    }
   };

   // Build tree: spaces -> collections (with nested children)
   const treeSpaces = React.useMemo(() => {
     if (spaces.length === 0 || collections.length === 0) return [];

     // Group collections by space
     const collectionsBySpace = new Map<string, Collection[]>();
     for (const space of spaces) {
       const spaceColls = collections.filter(c => c.space_id === space.id);
       collectionsBySpace.set(space.id, spaceColls);
     }

     // Build nested tree for each space
     const buildTree = (spaceId: string, parentId: string | null = null): Collection[] => {
       const colls = collectionsBySpace.get(spaceId) || [];
       const roots = colls.filter(c => c.parent_id === parentId);
       return roots.map(c => ({
         ...c,
         children: buildTree(spaceId, c.id)
       }));
     };

     return spaces.map(space => ({
       ...space,
       collections: buildTree(space.id)
     }));
   }, [spaces, collections]);

    // Compute bookmark count per collection from bookmarks array
    const collectionBookmarkCounts = React.useMemo(() => {
      const counts = new Map<string, number>();
      for (const b of bookmarks) {
        for (const coll of (b.collections || [])) {
          counts.set(coll.id, (counts.get(coll.id) || 0) + 1);
        }
      }
      return counts;
    }, [bookmarks]);

    // Build flat tree of all collections (for editing) with computed counts
    const allCollectionsTree = React.useMemo(() => {
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

    // Render functions are defined after handlers below

   const togglePinDomain = (domain: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedDomains(prev =>
      prev.includes(domain) ? prev.filter(d => d !== domain) : [...prev, domain]
    );
  };

   const fetchBookmarks = async () => {
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
   };

   const handleAddBookmark = async (newUrls: string, collectionIds?: string[]) => {
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
       // For multiple URLs, we can either use bulk endpoint (without collectionIds) or send individually
       if (urls.length === 1) {
         const res = await fetch("/api/bookmarks", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ url: urls[0], collectionIds }),
         });
         const data = await res.json();
         if (res.ok) {
           if (data.exists) {
             setToast({ message: `Bookmark already exists: ${data.title || urls[0]}`, type: 'error' });
           } else {
             setToast({ message: 'Bookmark added successfully', type: 'success' });
              setIsAdding(false);
              await fetchBookmarks();
              fetchCollections();
              fetchTags();
              fetchDomains();
             if (data.needsRefresh) {
               handleRefreshBookmark(data.id);
             }
           }
         } else {
           setToast({ message: data.error || 'Failed to add bookmark', type: 'error' });
         }
       } else {
         // For multiple, send sequentially with collectionIds
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
         
         setIsAdding(false);
         if (addedUrls.length > 0) {
           await fetchBookmarks();
           fetchCollections();
           fetchTags();
           fetchDomains();
          
           // Trigger refresh for all newly added bookmarks
           const refreshPromises = addedUrls.map((r: any) => {
             if (r.needsRefresh) {
               return handleRefreshBookmark(r.id, true);
             }
             return Promise.resolve();
           });
           
           Promise.all(refreshPromises).then(() => {
             fetchBookmarks();
             fetchCollections();
             fetchTags();
             fetchDomains();
           });
         }
       }
     } catch (error) {
       console.error(error);
       setToast({ message: 'An unexpected error occurred', type: 'error' });
     } finally {
       setIsAddingLoading(false);
     }
   };

  const handleRefreshBookmark = async (id: string, skipFetch = false) => {
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
  };

    const handleCreateCollection = async () => {
      if (!newCollectionName.trim()) {
        setToast({ message: "Please enter a name", type: "error" });
        return;
      }

      let targetSpaceId: string | null = null;

      // Use loaded spaces if available
      if (spaces.length > 0) {
        const libSpace = spaces.find(s => s.name === 'Library');
        targetSpaceId = libSpace?.id || spaces[0]?.id;
      } else {
        // Fallback: fetch spaces to find Library
        try {
          const res = await fetch("/api/spaces");
          if (res.ok) {
            const spacesData = await res.json();
            if (Array.isArray(spacesData) && spacesData.length > 0) {
              const libSpace = spacesData.find((s: any) => s.name === 'Library');
              targetSpaceId = libSpace?.id || spacesData[0]?.id;
              setSpaces(spacesData); // cache for future
            }
          }
        } catch (e) {
          console.error("Failed to fetch spaces", e);
        }
      }

      if (!targetSpaceId) {
        setToast({ message: "No space available. Please refresh the page.", type: "error" });
        return;
      }

      try {
        const res = await fetch("/api/collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newCollectionName.trim(),
            space_id: targetSpaceId,
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
        // Refresh selected bookmark detail
        const updatedRes = await fetch(`/api/bookmarks/${bookmarkId}`);
        if (updatedRes.ok) {
          const updated = await updatedRes.json();
          setSelectedBookmark(updated);
        }
        // Also refresh lists and counts
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
         // If the deleted collection was selected, clear selection
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

    // Drag-and-drop for collection hierarchy
    const isDescendant = (candidateAncestorId: string, descendantId: string): boolean => {
      if (candidateAncestorId === descendantId) return true; // self is descendant (prevent moving into self)
      let curr = collections.find(c => c.id === descendantId);
      while (curr && curr.parent_id) {
        if (curr.parent_id === candidateAncestorId) return true;
        curr = collections.find(c => c.id === curr.parent_id);
      }
      return false;
    };

    const handleMoveCollection = async (draggedId: string, targetId: string) => {
      // Prevent moving system collections
      if (draggedId === 'inbox-collection' || targetId === 'inbox-collection') {
        setToast({ message: "Cannot move system collections", type: "error" });
        return;
      }
      // Prevent cycles: target cannot be a descendant of dragged
      if (isDescendant(draggedId, targetId)) {
        setToast({ message: "Cannot move collection into its own descendant", type: "error" });
        return;
      }
      try {
        const res = await fetch(`/api/collections/${draggedId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parent_id: targetId })
        });
        if (res.ok) {
          fetchCollections();
          setToast({ message: "Collection moved", type: "success" });
        } else {
          setToast({ message: "Failed to move collection", type: "error" });
        }
      } catch (error) {
        console.error("Move collection error:", error);
        setToast({ message: "Failed to move collection", type: "error" });
      } finally {
        setDraggedCollectionId(null);
        setDropTargetCollectionId(null);
      }
    };

    // Render functions (defined after handlers for proper closure)
    const renderCollections = (colls: Collection[], level: number) => {
      return colls.map(coll => (
        <div key={coll.id} className="group relative">
          <button
            draggable={coll.id !== 'inbox-collection'}
            onDragStart={(e) => {
              e.stopPropagation();
              setDraggedCollectionId(coll.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (coll.id !== draggedCollectionId && !isDescendant(draggedCollectionId, coll.id)) {
                setDropTargetCollectionId(coll.id);
              }
            }}
            onDragLeave={() => setDropTargetCollectionId(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDropTargetCollectionId(null);
              if (draggedCollectionId && coll.id !== draggedCollectionId && !isDescendant(draggedCollectionId, coll.id)) {
                handleMoveCollection(draggedCollectionId, coll.id);
              }
              setDraggedCollectionId(null);
            }}
            onDragEnd={() => {
              setDraggedCollectionId(null);
              setDropTargetCollectionId(null);
            }}
            onClick={() => {
              setSelectedCollectionId(coll.id);
              setSelectedTagId(null);
              setSelectedDomain(null);
            }}
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
          {/* Delete button (visible on hover) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteCollection(coll.id);
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 text-slate-400"
            title="Delete collection"
          >
            <Trash2 size={12} />
          </button>
          {coll.children && coll.children.length > 0 && renderCollections(coll.children, level + 1)}
        </div>
      ));
    };

    const renderCollectionCheckbox = (coll: Collection, level: number) => (
      <div
        key={coll.id}
        style={{ paddingLeft: `${level * 12}px` }}
        draggable={coll.id !== 'inbox-collection'}
        onDragStart={(e) => {
          e.stopPropagation();
          setDraggedCollectionId(coll.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (coll.id !== draggedCollectionId && !isDescendant(draggedCollectionId, coll.id)) {
            setDropTargetCollectionId(coll.id);
          }
        }}
        onDragLeave={() => setDropTargetCollectionId(null)}
        onDrop={(e) => {
          e.preventDefault();
          setDropTargetCollectionId(null);
          if (draggedCollectionId && coll.id !== draggedCollectionId && !isDescendant(draggedCollectionId, coll.id)) {
            handleMoveCollection(draggedCollectionId, coll.id);
          }
          setDraggedCollectionId(null);
        }}
        onDragEnd={() => {
          setDraggedCollectionId(null);
          setDropTargetCollectionId(null);
        }}
      >
        <label className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
          <input
            type="checkbox"
            checked={selectedCollectionIdsForEdit.includes(coll.id)}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedCollectionIdsForEdit(prev => [...prev, coll.id]);
              } else {
                setSelectedCollectionIdsForEdit(prev => prev.filter(id => id !== coll.id));
              }
            }}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <Icon name={coll.icon || "Folder"} size={14} color={coll.color} />
          <span className="truncate">{coll.name}</span>
        </label>
        {coll.children && coll.children.length > 0 && (
          <div>
            {coll.children.map(child => renderCollectionCheckbox(child, level + 1))}
          </div>
        )}
      </div>
    );

   const handleDeleteBookmark = async (id: string) => {
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
  };

  const loadReaderView = async (bookmark: Bookmark) => {
    setIsReaderLoading(true);
    try {
      const res = await fetch(`/api/bookmarks/${bookmark.id}/readability`);
      const data = await res.json();
      if (data && data.content) {
        setReaderContent(data);
      } else {
        setReaderContent({
          title: bookmark.title,
          content: "<p>Could not extract readable content.</p>",
          byline: "",
        });
      }
    } catch (error) {
      console.error(error);
      setReaderContent({
        title: bookmark.title,
        content: "<p>Error loading reader view.</p>",
        byline: "",
      });
    } finally {
      setIsReaderLoading(false);
    }
  };

  const handleBulkDelete = async () => {
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
  };

  const handleCategorizeAll = async () => {
    if (isCategorizing) return;

    setIsCategorizing(true);
    try {
      const res = await fetch("/api/bookmarks/categorize-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyUntagged: true })
      });
      const data = await res.json();
       if (res.ok) {
         setToast({ message: `Categorized ${data.processed} of ${data.total} bookmarks`, type: 'success' });
         // Refresh
         fetchBookmarks();
         fetchCollections();
         fetchTags();
       } else {
        setToast({ message: data.error || "Failed to categorize bookmarks", type: 'error' });
      }
    } catch (e: any) {
      setToast({ message: e.message || "Failed to categorize", type: 'error' });
    } finally {
      setIsCategorizing(false);
    }
  };

  const handleBulkRefresh = async () => {
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
          // Process in batches of 3 to avoid overwhelming the server
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
  };

  const handleBackup = async () => {
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
        // If download fails (e.g. due to iframe sandbox), fallback to clipboard
        console.warn("Download failed, falling back to clipboard:", downloadError);
        await navigator.clipboard.writeText(jsonString);
        setToast({ message: "Backup copied to clipboard (download blocked by browser)", type: "success" });
      }
    } catch (error: any) {
      console.error("Backup error:", error);
      setToast({ message: error.message || "Failed to generate backup", type: "error" });
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

          if (!backupData.version || !backupData.data) {
            throw new Error("Invalid backup file format");
          }

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
          
           // Refresh all data
           setSelectedBookmark(null);
           setSelectedCollectionId(null);
           setSelectedTagId(null);
           setSelectedDomain(null);
           fetchBookmarks();
           fetchCollections();
           fetchTags();
           fetchDomains();
        } catch (error: any) {
          console.error("Restore error:", error);
          setToast({ message: error.message || "Failed to restore backup", type: "error" });
        } finally {
          // Reset file input
          e.target.value = "";
        }
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedBookmarkIds.size === filteredBookmarks.length && filteredBookmarks.length > 0) {
      setSelectedBookmarkIds(new Set());
    } else {
      setSelectedBookmarkIds(new Set(filteredBookmarks.map(b => b.id)));
    }
  };

  const toggleBookmarkSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedBookmarkIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedBookmarkIds(newSet);
  };

  const filteredBookmarks = bookmarks.filter(
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
  });

  return (
    <div className={cn("flex h-screen w-full bg-[#f8f9fa] text-slate-800 font-sans overflow-hidden", isDragging && "select-none cursor-col-resize")}>
      {/* SIDEBAR */}
      <div className="w-64 bg-[#f1f3f5] border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-lg">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center text-white">
              <BookOpen size={14} />
            </div>
            <span className="tracking-tight">LinkHub</span>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 hover:bg-slate-200 rounded-md text-slate-500"
            title="Settings"
          >
            <Settings size={18} />
          </button>
        </div>

        <div className="px-3 pb-2">
          <button
            onClick={() => setIsAdding(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 px-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Add Bookmark
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 mb-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
              Filters
            </div>
            <button
              onClick={() => {
                setSelectedCollectionId(null);
                setSelectedTagId(null);
                setSelectedDomain(null);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-sm",
                !selectedCollectionId && !selectedTagId && !selectedDomain
                  ? "bg-blue-100 text-blue-700 font-medium"
                  : "hover:bg-slate-200 text-slate-700",
              )}
            >
              <Globe
                size={16}
                className={
                  !selectedCollectionId && !selectedTagId && !selectedDomain
                    ? "text-blue-600"
                    : "text-slate-400"
                }
              />
              All Bookmarks
            </button>
          </div>

          {/* Spaces & Collections Tree */}
           <div className="px-3 mb-4">
             <div className="flex items-center justify-between">
               <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">
                 Collections
               </div>
               <button
                 onClick={() => setIsCreatingCollection(true)}
                 className="text-xs text-blue-600 hover:underline px-2"
               >
                 + New
               </button>
             </div>
             {isCreatingCollection && (
               <div className="mb-2 px-2">
                 <input
                   autoFocus
                   type="text"
                   value={newCollectionName}
                   onChange={(e) => setNewCollectionName(e.target.value)}
                   placeholder="Collection name"
                   className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') {
                       handleCreateCollection();
                     } else if (e.key === 'Escape') {
                       setIsCreatingCollection(false);
                       setNewCollectionName("");
                     }
                   }}
                 />
               </div>
             )}
             {treeSpaces.length === 0 ? (
               <div className="text-xs text-slate-400 px-2">No collections</div>
             ) : (
               treeSpaces.map(space => (
                 <div key={space.id} className="mb-2">
                   <div className="flex items-center gap-2 px-2 py-1 text-[10px] font-semibold uppercase text-slate-400">
                     {space.name}
                   </div>
                   {space.collections && renderCollections(space.collections, 0)}
                 </div>
               ))
             )}
           </div>

          {pinnedDomains.length > 0 && (
            <div className="px-3 mb-4">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
                Pinned
              </div>
               {domains.filter(d => pinnedDomains.includes(d.domain)).map((d) => (
                 <button
                   key={`pinned-${d.domain}`}
                   onClick={() => {
                     setSelectedDomain(d.domain);
                     setSelectedCollectionId(null);
                     setSelectedTagId(null);
                   }}
                   className={cn(
                     "w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-sm mb-0.5 group",
                     selectedDomain === d.domain
                       ? "bg-blue-100 text-blue-700 font-medium"
                       : "hover:bg-slate-200 text-slate-700",
                   )}
                 >
                  <img src={`https://www.google.com/s2/favicons?domain=${d.domain}&sz=32`} alt="" className="w-4 h-4 rounded-sm" referrerPolicy="no-referrer" />
                  <span className="truncate flex-1 text-left">{d.domain}</span>
                  <span className="text-xs text-slate-400 font-medium group-hover:hidden">{d.count}</span>
                  <div 
                    className="hidden group-hover:flex items-center justify-center text-slate-400 hover:text-slate-600"
                    onClick={(e) => togglePinDomain(d.domain, e)}
                    title="Unpin resource"
                  >
                    <PinOff size={14} />
                  </div>
                </button>
              ))}
            </div>
          )}

          {domains.filter(d => !pinnedDomains.includes(d.domain)).length > 0 && (
            <div className="px-3 mb-4">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
                Resources
              </div>
               {domains.filter(d => !pinnedDomains.includes(d.domain)).map((d) => (
                 <button
                   key={d.domain}
                   onClick={() => {
                     setSelectedDomain(d.domain);
                     setSelectedCollectionId(null);
                     setSelectedTagId(null);
                   }}
                   className={cn(
                     "w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-sm mb-0.5 group",
                     selectedDomain === d.domain
                       ? "bg-blue-100 text-blue-700 font-medium"
                       : "hover:bg-slate-200 text-slate-700",
                   )}
                 >
                  <img src={`https://www.google.com/s2/favicons?domain=${d.domain}&sz=32`} alt="" className="w-4 h-4 rounded-sm" referrerPolicy="no-referrer" />
                  <span className="truncate flex-1 text-left">{d.domain}</span>
                  <span className="text-xs text-slate-400 font-medium group-hover:hidden">{d.count}</span>
                  <div 
                    className="hidden group-hover:flex items-center justify-center text-slate-400 hover:text-slate-600"
                    onClick={(e) => togglePinDomain(d.domain, e)}
                    title="Pin resource"
                  >
                    <Pin size={14} />
                  </div>
                </button>
              ))}
            </div>
          )}

          {tags.length > 0 && (
            <div className="px-3 mb-4">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
                Tags
              </div>
              <div className="flex flex-wrap gap-1 px-2">
                 {tags.map((tag) => (
                   <button
                     key={tag.id}
                     onClick={() => {
                       setSelectedTagId(tag.id);
                       setSelectedCollectionId(null);
                       setSelectedDomain(null);
                     }}
                     className={cn(
                       "text-xs px-2 py-1 rounded-md border transition-colors",
                       selectedTagId === tag.id
                         ? "bg-blue-600 text-white border-blue-600"
                         : "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
                     )}
                   >
                     #{tag.name}
                   </button>
                 ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        <div className="min-h-[56px] py-3 border-b border-slate-200 flex flex-wrap items-center justify-between px-4 flex-shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={filteredBookmarks.length > 0 && selectedBookmarkIds.size === filteredBookmarks.length}
              ref={input => {
                if (input) {
                  input.indeterminate = selectedBookmarkIds.size > 0 && selectedBookmarkIds.size < filteredBookmarks.length;
                }
              }}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
             <div className="flex items-center gap-2 text-lg font-semibold whitespace-nowrap">
               {selectedCollectionId
                 ? collections.find((c) => c.id === selectedCollectionId)?.name
                 : selectedTagId
                   ? `#${tags.find((t) => t.id === selectedTagId)?.name}`
                   : selectedDomain
                     ? selectedDomain
                     : "All Bookmarks"}
              <span className="text-sm font-normal text-slate-400 ml-2">
                {filteredBookmarks.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap flex-1 justify-end">
            {selectedBookmarkIds.size > 0 && (
              <div className="flex items-center gap-2 mr-auto">
                <button
                  onClick={handleBulkRefresh}
                  disabled={refreshingBookmarkIds.size > 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  <RefreshCw size={14} className={refreshingBookmarkIds.size > 0 ? "animate-spin" : ""} />
                  Refresh ({selectedBookmarkIds.size})
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
                >
                  <Trash2 size={14} />
                  Delete ({selectedBookmarkIds.size})
                </button>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <Filter size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                <select
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value as any)}
                  className="pl-8 pr-8 py-1.5 bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-md text-sm text-slate-700 transition-all outline-none appearance-none cursor-pointer"
                >
                  <option value="all">All Bookmarks</option>
                  <option value="has_images">Has Images</option>
                  <option value="has_summary">Has Summary</option>
                  <option value="has_content">Has Content</option>
                </select>
                <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
              </div>
              
              <div className="relative flex items-center">
                <ArrowUpDown size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="pl-8 pr-8 py-1.5 bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-md text-sm text-slate-700 transition-all outline-none appearance-none cursor-pointer"
                >
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="title_asc">Title (A-Z)</option>
                  <option value="title_desc">Title (Z-A)</option>
                  <option value="domain_asc">Domain (A-Z)</option>
                  <option value="domain_desc">Domain (Z-A)</option>
                </select>
                <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="hidden sm:block w-px h-6 bg-slate-200 mx-1"></div>

            <div className="relative flex-grow min-w-[150px] max-w-xs">
              <Search
                size={16}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-md text-sm w-full transition-all outline-none"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "p-1 rounded-sm",
                    viewMode === "list"
                      ? "bg-white shadow-sm text-slate-800"
                      : "text-slate-400 hover:text-slate-600",
                  )}
                >
                  <ListIcon size={16} />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "p-1 rounded-sm",
                    viewMode === "grid"
                      ? "bg-white shadow-sm text-slate-800"
                      : "text-slate-400 hover:text-slate-600",
                  )}
                >
                  <LayoutGrid size={16} />
                </button>
              </div>
              
              <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
                <select
                  value={itemSize}
                  onChange={(e) => setItemSize(e.target.value as any)}
                  className="bg-transparent border-none text-xs text-slate-600 focus:ring-0 cursor-pointer outline-none pl-2 pr-1 py-1 appearance-none"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
                <ChevronDown size={12} className="text-slate-400 self-center mr-1 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        <div 
          className="flex-1 overflow-y-auto p-4"
          onClick={() => setIsInspectorOpen(false)}
        >
          {filteredBookmarks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Globe size={48} className="mb-4 opacity-20" />
              <p>No bookmarks found.</p>
            </div>
          ) : (
            <div
              className={cn(
                viewMode === "grid"
                  ? itemSize === "small" ? "grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3" :
                    itemSize === "large" ? "grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5" :
                    "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4"
                  : "flex flex-col gap-2",
              )}
            >
              {filteredBookmarks.map((bookmark) => {
                const domain = getDomain(bookmark.url);
                const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                
                return (
                <div
                  key={bookmark.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBookmark(bookmark);
                    setReaderContent(null);
                    setInspectorTab('details');
                    setIsInspectorOpen(true);
                  }}
                  className={cn(
                    "group cursor-pointer border rounded-lg overflow-hidden transition-all hover:shadow-md bg-white relative",
                    viewMode === "list"
                      ? itemSize === "small" ? "flex items-center p-2 gap-3" :
                        itemSize === "large" ? "flex items-center p-4 gap-5" :
                        "flex items-center p-3 gap-4"
                      : "flex flex-col",
                    selectedBookmark?.id === bookmark.id
                      ? "border-blue-500 ring-1 ring-blue-500"
                      : "border-slate-200 hover:border-slate-300",
                    refreshingBookmarkIds.has(bookmark.id) && "opacity-70 pointer-events-none"
                  )}
                >
                  {refreshingBookmarkIds.has(bookmark.id) && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
                      <RefreshCw size={24} className="animate-spin text-blue-500 drop-shadow-sm" />
                    </div>
                  )}
                  {/* Checkbox */}
                  <div
                    className={cn(
                      "z-10 flex items-center justify-center",
                      viewMode === "list" ? "" : "absolute top-2 left-2",
                      selectedBookmarkIds.has(bookmark.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedBookmarkIds.has(bookmark.id)}
                      onChange={(e) => toggleBookmarkSelection(bookmark.id, e as any)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>

                  {/* Image */}
                  <div
                    className={cn(
                      "bg-slate-100 flex-shrink-0 flex items-center justify-center overflow-hidden relative",
                      viewMode === "list"
                        ? itemSize === "small" ? "w-8 h-8 rounded-md" :
                          itemSize === "large" ? "w-16 h-16 rounded-md" :
                          "w-12 h-12 rounded-md"
                        : "w-full aspect-video border-b border-slate-100",
                    )}
                  >
                    <DynamicCover bookmark={bookmark} viewMode={viewMode} faviconUrl={faviconUrl} />
                  </div>

                  {/* Content */}
                  <div
                    className={cn(
                      "flex-1 min-w-0",
                      viewMode === "grid" && (itemSize === "small" ? "p-2" : itemSize === "large" ? "p-4" : "p-3"),
                    )}
                  >
                    <h3
                      className={cn(
                        "font-medium text-slate-800 truncate",
                        itemSize === "small" ? "text-sm" : itemSize === "large" ? "text-lg" : "text-base"
                      )}
                      title={bookmark.title || bookmark.url}
                    >
                      {bookmark.title || bookmark.url}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <img src={faviconUrl} alt="" className="w-3 h-3 rounded-sm" referrerPolicy="no-referrer" />
                      <p className="text-xs text-slate-500 truncate">
                        {domain}
                      </p>
                    </div>

                    {viewMode === "grid" && bookmark.description && (
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                        {bookmark.description}
                      </p>
                    )}

                     <div className="flex items-center gap-2 mt-2 flex-wrap">
                       {(bookmark.collections || []).slice(0, 2).map((coll: any) => (
                         <span
                           key={coll.id}
                           className="text-[10px] font-medium px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 flex items-center gap-1"
                         >
                           <div
                             className="w-1.5 h-1.5 rounded-full"
                             style={{ backgroundColor: coll.color }}
                           />
                           {coll.name}
                         </span>
                       ))}
                       {(bookmark.collections || []).length > 2 && (
                         <span className="text-[10px] text-slate-400">
                           +{(bookmark.collections || []).length - 2} more
                         </span>
                       )}
                       {bookmark.tags?.slice(0, 2).map((tag) => (
                         <span
                           key={tag.id}
                           className="text-[10px] text-slate-400"
                         >
                           #{tag.name}
                         </span>
                       ))}
                     </div>
                  </div>

                  {/* Actions */}
                  <div
                    className={cn(
                      "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                      viewMode === "grid" &&
                        "absolute top-2 right-2 bg-white/90 backdrop-blur-sm p-1 rounded-md shadow-sm border border-slate-200",
                    )}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(bookmark.url, "_blank");
                      }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                      title="Open in browser"
                    >
                      <ExternalLink size={16} />
                    </button>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL - INSPECTOR / READER */}
      {selectedBookmark && isInspectorOpen && (
        <div 
          className="relative border-l border-slate-200 bg-white flex flex-col flex-shrink-0 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]"
          style={{ width: `${inspectorWidth}px`, minWidth: '250px', maxWidth: 'calc(100vw - 300px)' }}
        >
          {/* Resizer Handle */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-6 -ml-3 cursor-col-resize z-50 group flex justify-center"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
          >
            <div className={cn(
              "h-full transition-all duration-200",
              isDragging ? "w-1.5 bg-blue-500" : "w-[1px] bg-transparent group-hover:w-1.5 group-hover:bg-blue-400"
            )} />
          </div>

          <div className="min-h-[56px] py-2 border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0 flex-wrap gap-2">
            <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
              <button 
                onClick={() => setInspectorTab('details')}
                className={cn("px-3 py-1 text-xs font-medium rounded-sm transition-colors", inspectorTab === 'details' ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700")}
              >
                Details
              </button>
              <button 
                onClick={() => { setInspectorTab('reader'); if (!readerContent) loadReaderView(selectedBookmark); }}
                className={cn("px-3 py-1 text-xs font-medium rounded-sm transition-colors flex items-center gap-1", inspectorTab === 'reader' ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700")}
              >
                <BookOpen size={12} /> Reader
              </button>
              <button 
                onClick={() => setInspectorTab('web')}
                className={cn("px-3 py-1 text-xs font-medium rounded-sm transition-colors flex items-center gap-1", inspectorTab === 'web' ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700")}
              >
                <Globe size={12} /> Web
              </button>
              {getYouTubeId(selectedBookmark.url) && (
                <button 
                  onClick={() => setInspectorTab('video')}
                  className={cn("px-3 py-1 text-xs font-medium rounded-sm transition-colors flex items-center gap-1", inspectorTab === 'video' ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700")}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-play"><polygon points="6 3 20 12 6 21 6 3"/></svg> Video
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              {selectedBookmark && (
                <>
                  <button
                    onClick={() => handleRefreshBookmark(selectedBookmark.id)}
                    disabled={refreshingBookmarkIds.has(selectedBookmark.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md disabled:opacity-50"
                    title="Refresh Bookmark Data"
                  >
                    <RefreshCw size={16} className={cn(refreshingBookmarkIds.has(selectedBookmark.id) && "animate-spin")} />
                  </button>
                  <button
                    onClick={() => handleDeleteBookmark(selectedBookmark.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                    title="Delete Bookmark"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className="w-px h-4 bg-slate-200 mx-1" />
                  <button
                    onClick={() => setIsInspectorOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md"
                    title="Close Sidebar"
                  >
                    <X size={18} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto relative">
            {inspectorTab === 'reader' && (
              <div className="p-6">
                {readerContent ? (
                  <>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2 leading-tight">
                      {readerContent.title}
                    </h1>
                    {readerContent.byline && (
                      <p className="text-sm text-slate-500 mb-6">
                        {readerContent.byline}
                      </p>
                    )}
                    <div
                      className="prose prose-sm prose-slate max-w-none prose-img:rounded-lg prose-a:text-blue-600"
                      dangerouslySetInnerHTML={{ __html: readerContent.content }}
                    />
                  </>
                ) : (
                  <div className="text-center text-slate-500 mt-10">
                    <p>Loading reader view...</p>
                  </div>
                )}
              </div>
            )}

            {inspectorTab === 'web' && (
              <div className="w-full h-full flex flex-col">
                <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-col gap-2 text-xs text-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setWebPreviewMode(m => m === 'proxy' ? 'direct' : 'proxy')}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1.5 rounded-md font-medium transition-colors",
                          webPreviewMode === 'proxy' 
                            ? "bg-blue-100 text-blue-700 hover:bg-blue-200" 
                            : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        )}
                        title={webPreviewMode === 'proxy' ? "Switch to Direct mode (bypasses Cloudflare but may fail on some sites)" : "Switch to Proxy mode (bypasses iframe restrictions)"}
                      >
                        {webPreviewMode === 'proxy' ? (
                          <><Shield size={14} /> Proxy Mode</>
                        ) : (
                          <><Globe size={14} /> Direct Mode</>
                        )}
                      </button>
                      <span className="text-slate-500 hidden sm:inline">
                        {webPreviewMode === 'proxy' 
                          ? "Bypasses iframe restrictions" 
                          : "Bypasses Cloudflare checks"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setWebPreviewKey(k => k + 1)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-md transition-colors font-medium shadow-sm"
                        title="Reload preview"
                      >
                        <RefreshCw size={14} /> Reload Page
                      </button>
                      <a 
                        href={selectedBookmark.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium shadow-sm"
                        title="Open in new tab"
                      >
                        <ExternalLink size={14} /> Open Site
                      </a>
                    </div>
                  </div>
                  {webPreviewMode === 'direct' && (
                    <div className="bg-amber-50 text-amber-800 px-3 py-2 rounded-md border border-amber-200 flex items-start gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-triangle shrink-0 mt-0.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                      <p>If the page below is blank or refuses to connect, the website is blocking iframes (X-Frame-Options). Please use <b>Proxy Mode</b> or open the site in a new tab.</p>
                    </div>
                  )}
                </div>
                <iframe 
                  key={`${selectedBookmark.id}-${webPreviewMode}-${webPreviewKey}`}
                  src={webPreviewMode === 'proxy' 
                    ? `/api/proxy?url=${encodeURIComponent(selectedBookmark.url)}` 
                    : selectedBookmark.url} 
                  className="w-full flex-1 border-0 bg-white" 
                  title="Web Preview"
                />
              </div>
            )}

            {inspectorTab === 'video' && getYouTubeId(selectedBookmark.url) && (
              <div className="w-full h-full bg-black flex items-center justify-center">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${getYouTubeId(selectedBookmark.url)}?autoplay=1`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                ></iframe>
              </div>
            )}

            {inspectorTab === 'details' && (
              <div className="p-5 flex flex-col gap-6">
                {selectedBookmark.cover_image_url ? (
                  <div className="w-full aspect-video rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                    <img
                      src={selectedBookmark.cover_image_url}
                      alt=""
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="w-full aspect-video rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                    <img
                      src={`https://image.thum.io/get/width/600/crop/800/${selectedBookmark.url}`}
                      alt="Screenshot"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                <div>
                  <h2 className="text-xl font-bold text-slate-900 leading-tight mb-2">
                    {selectedBookmark.title || selectedBookmark.url}
                  </h2>
                  <a
                    href={selectedBookmark.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-blue-600 hover:underline break-all flex items-center gap-1"
                  >
                    <img src={`https://www.google.com/s2/favicons?domain=${getDomain(selectedBookmark.url)}&sz=32`} alt="" className="w-4 h-4 rounded-sm" referrerPolicy="no-referrer" />
                    {selectedBookmark.url} <ExternalLink size={12} />
                  </a>
                </div>

                {selectedBookmark.description && (
                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Description
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {selectedBookmark.description}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Collections
                      </div>
                      <button
                        onClick={() => {
                          // Toggle edit mode
                          if (isEditingCollections) {
                            // Save
                            handleUpdateBookmarkCollections(selectedBookmark.id, selectedCollectionIdsForEdit);
                            setIsEditingCollections(false);
                          } else {
                            // Enter edit mode
                            setSelectedCollectionIdsForEdit(selectedBookmark.collections?.map(c => c.id) || []);
                            setIsEditingCollections(true);
                          }
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {isEditingCollections ? 'Save' : 'Edit'}
                      </button>
                    </div>
                    {isEditingCollections ? (
                      <div className="space-y-1 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2">
                        {allCollectionsTree.length === 0 ? (
                          <div className="text-xs text-slate-400 px-2">No collections</div>
                        ) : (
                          allCollectionsTree.map(coll => renderCollectionCheckbox(coll, 0))
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {(selectedBookmark.collections || []).map((coll: any) => (
                          <div key={coll.id} className="flex items-center gap-2 text-sm text-slate-700">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: coll.color }}
                            />
                            {coll.name}
                          </div>
                        ))}
                        {(selectedBookmark.collections || []).length === 0 && (
                          <span className="text-sm text-slate-400">No collections</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Added
                    </div>
                    <div className="text-sm text-slate-700">
                      {format(
                        new Date(selectedBookmark.created_at),
                        "MMM d, yyyy",
                      )}
                    </div>
                  </div>
                </div>

                {selectedBookmark.tags && selectedBookmark.tags.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Tags
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedBookmark.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-md border border-slate-200"
                        >
                          #{tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isReaderLoading && inspectorTab === 'reader' && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
        </div>
      )}

       {/* ADD BOOKMARK MODAL */}
       <AddBookmarkModal
         isOpen={isAdding}
         isLoading={isAddingLoading}
         onClose={() => setIsAdding(false)}
         onSubmit={handleAddBookmark}
         collections={collections}
         defaultCollectionIds={selectedCollectionId ? [selectedCollectionId] : []}
       />

      {/* SETTINGS MODAL */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onBackup={handleBackup}
        onRestore={handleRestore}
        setToast={setToast}
      />

      {/* TOAST NOTIFICATION */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </div>
  );
}
