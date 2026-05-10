import React, { useCallback, useEffect, useRef } from "react";
import { Search, LayoutGrid, List as ListIcon, Trash2, RefreshCw, ArrowUpDown, Filter, ChevronDown, Globe, ExternalLink } from "lucide-react";
import { cn } from "../lib/utils";
import { Bookmark, Collection, Tag } from "../types";
import { BOOKMARK_DRAG_TYPE } from "./ArboristNode";
import { BookmarkItem } from "./BookmarkItem";

type SortBy = "date_desc" | "date_asc" | "title_asc" | "title_desc" | "domain_asc" | "domain_desc";
type FilterBy = "all" | "has_images" | "has_summary" | "has_content";

interface BookmarkListProps {
  bookmarks: Bookmark[];
  total: number;
  viewMode: "list" | "grid";
  itemSize: "small" | "medium" | "large";
  selectedBookmarkIds: Set<string>;
  selectedBookmark: Bookmark | null;
  refreshingBookmarkIds: Set<string>;
  searchQuery: string;
  sortBy: SortBy;
  filterBy: FilterBy;
  selectedCollectionId: string | null;
  selectedTagId: string | null;
  selectedDomain: string | null;
  collections: Collection[];
  tags: Tag[];
  onSelectBookmark: (bookmark: Bookmark) => void;
  onToggleSelectAll: () => void;
  onToggleBookmarkSelection: (id: string) => void;
  onSearchChange: (v: string) => void;
  onSortChange: (v: SortBy) => void;
  onFilterChange: (v: FilterBy) => void;
  onViewModeChange: (v: "list" | "grid") => void;
  onItemSizeChange: (v: "small" | "medium" | "large") => void;
  isTrash?: boolean;
  onBulkDelete: () => void;
  onBulkRefresh: () => void;
  onDismissInspector?: () => void;
  onLoadMore?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onBookmarkContextMenu?: (e: React.MouseEvent, bookmark: Bookmark) => void;
  onDropBookmarks?: (collectionId: string, bookmarkIds: string[], sourceCollectionId?: string | null) => void;
}

function SkeletonCard({ viewMode, itemSize }: { viewMode: "list" | "grid"; itemSize: "small" | "medium" | "large" }) {
  if (viewMode === "list") {
    return (
      <div className={cn(
        "flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-2 animate-pulse",
        itemSize === "small" ? "p-2 gap-3" : itemSize === "large" ? "p-4 gap-5" : "p-3 gap-4"
      )}>
        <div className={cn(
          "bg-slate-200 rounded-md flex-shrink-0",
          itemSize === "small" ? "w-8 h-8" : itemSize === "large" ? "w-16 h-16" : "w-12 h-12"
        )} />
        <div className="flex-1 min-w-0">
          <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
          <div className="h-3 bg-slate-200 rounded w-1/2" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-lg overflow-hidden animate-pulse">
      <div className="w-full aspect-video bg-slate-200" />
      <div className={cn("p-3", itemSize === "small" ? "p-2" : itemSize === "large" ? "p-4" : "p-3")}>
        <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
        <div className="h-3 bg-slate-200 rounded w-1/2 mb-2" />
        <div className="h-3 bg-slate-200 rounded w-2/3" />
      </div>
    </div>
  );
}

export function BookmarkList({
  bookmarks,
  total,
  viewMode,
  itemSize,
  selectedBookmarkIds,
  selectedBookmark,
  refreshingBookmarkIds,
  searchQuery,
  sortBy,
  filterBy,
  selectedCollectionId,
  selectedTagId,
  selectedDomain,
  collections,
  tags,
  onSelectBookmark,
  onToggleSelectAll,
  onToggleBookmarkSelection,
  onSearchChange,
  onSortChange,
  onFilterChange,
  onViewModeChange,
  onItemSizeChange,
  isTrash,
  onBulkDelete,
  onBulkRefresh,
  onDismissInspector,
  onLoadMore,
  hasNextPage,
  isFetchingNextPage,
  onBookmarkContextMenu,
}: BookmarkListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        onLoadMore?.();
      }
    },
    [hasNextPage, isFetchingNextPage, onLoadMore]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: "200px",
      threshold: 0,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersection]);

  const allSelected = bookmarks.length > 0 && selectedBookmarkIds.size === bookmarks.length;
  const someSelected = selectedBookmarkIds.size > 0 && selectedBookmarkIds.size < bookmarks.length;
  const selectedCollectionName = selectedCollectionId
    ? collections.find((c) => c.id === selectedCollectionId)?.name
    : undefined;
  const selectedTagName = selectedTagId
    ? tags.find((t) => t.id === selectedTagId)?.name
    : undefined;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white">
      <div className="min-h-[56px] py-3 border-b border-slate-200 flex flex-wrap items-center justify-between px-4 flex-shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(input) => {
              if (input) input.indeterminate = someSelected;
            }}
            onChange={onToggleSelectAll}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <div className="flex items-center gap-2 text-lg font-semibold whitespace-nowrap">
            {selectedCollectionName ?? selectedTagName ?? selectedDomain ?? "All Bookmarks"}
            <span className="text-sm font-normal text-slate-400 ml-2">
              {total}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap flex-1 justify-end">
          {selectedBookmarkIds.size > 0 && (
            <div className="flex items-center gap-2 mr-auto">
              <button
                onClick={onBulkRefresh}
                disabled={refreshingBookmarkIds.size > 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <RefreshCw size={14} className={refreshingBookmarkIds.size > 0 ? "animate-spin" : ""} />
                Refresh ({selectedBookmarkIds.size})
              </button>
              <button
                onClick={onBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
              >
                <Trash2 size={14} />
                {isTrash ? "Delete permanently" : "Delete"} ({selectedBookmarkIds.size})
              </button>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <Filter size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
              <select
                value={filterBy}
                onChange={(e) => onFilterChange(e.target.value as FilterBy)}
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
                onChange={(e) => onSortChange(e.target.value as SortBy)}
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
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-md text-sm w-full transition-all outline-none"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
              <button
                onClick={() => onViewModeChange("list")}
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
                onClick={() => onViewModeChange("grid")}
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
                onChange={(e) => onItemSizeChange(e.target.value as "small" | "medium" | "large")}
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
        onClick={onDismissInspector}
      >
        {bookmarks.length === 0 && !isFetchingNextPage ? (
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
            {bookmarks.map((bookmark) => (
              <BookmarkItem
                key={bookmark.id}
                bookmark={bookmark}
                viewMode={viewMode}
                itemSize={itemSize}
                isSelected={selectedBookmark?.id === bookmark.id}
                isRefreshing={refreshingBookmarkIds.has(bookmark.id)}
                isChecked={selectedBookmarkIds.has(bookmark.id)}
                onSelect={onSelectBookmark}
                onToggleSelection={onToggleBookmarkSelection}
                onDragStart={(e, id) => {
                  const ids = selectedBookmarkIds.has(id)
                    ? Array.from(selectedBookmarkIds)
                    : [id];
                  e.dataTransfer.setData(BOOKMARK_DRAG_TYPE, JSON.stringify(ids));
                  if (selectedCollectionId) {
                    e.dataTransfer.setData("application/linkhub-source-collection", selectedCollectionId);
                  }
                  e.dataTransfer.effectAllowed = "move";
                }}
                onContextMenu={onBookmarkContextMenu}
              />
            ))}
            {isFetchingNextPage && Array.from({ length: 3 }).map((_, i) => (
              <React.Fragment key={`skeleton-${i}`}>
                <SkeletonCard viewMode={viewMode} itemSize={itemSize} />
              </React.Fragment>
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="h-4" />
      </div>
    </div>
  );
}
