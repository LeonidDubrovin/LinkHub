import React from "react";
import { Search, LayoutGrid, List as ListIcon, Trash2, RefreshCw, ArrowUpDown, Filter, ChevronDown, Globe, ExternalLink } from "lucide-react";
import { cn } from "../lib/utils";
import { DynamicCover } from "./DynamicCover";
import { getDomain } from "../utils";
import { Bookmark, Collection, Tag } from "../types";

// Constants for UI dimensions
const HEADER_HEIGHT = 56;
const SEARCH_INPUT_MIN_WIDTH = 150;
const GRID_ITEM_MIN_WIDTH_SMALL = 180;
const GRID_ITEM_MIN_WIDTH_MEDIUM = 240;
const GRID_ITEM_MIN_WIDTH_LARGE = 320;
const REFRESH_OVERLAY_SIZE = 24;
const TEXT_SIZE_SMALL = 10;

interface BookmarkListProps {
  filteredBookmarks: Bookmark[];
  viewMode: "list" | "grid";
  itemSize: "small" | "medium" | "large";
  selectedBookmarkIds: Set<string>;
  selectedBookmark: Bookmark | null;
  refreshingBookmarkIds: Set<string>;
  searchQuery: string;
  sortBy: string;
  filterBy: string;
  selectedCollectionId: string | null;
  selectedTagId: string | null;
  selectedDomain: string | null;
  collections: Collection[];
  tags: Tag[];
  onSelectBookmark: (bookmark: Bookmark) => void;
  onToggleSelectAll: () => void;
  onToggleBookmarkSelection: (id: string, e: React.MouseEvent) => void;
  onSearchChange: (v: string) => void;
  onSortChange: (v: any) => void;
  onFilterChange: (v: any) => void;
  onViewModeChange: (v: "list" | "grid") => void;
  onItemSizeChange: (v: "small" | "medium" | "large") => void;
  onBulkDelete: () => void;
  onBulkRefresh: () => void;
  onDismissInspector?: () => void;
}

export function BookmarkList({
  filteredBookmarks,
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
  onBulkDelete,
  onBulkRefresh,
  onDismissInspector,
}: BookmarkListProps) {
  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white">
      <div className={`min-h-[${HEADER_HEIGHT}px] py-3 border-b border-slate-200 flex flex-wrap items-center justify-between px-4 flex-shrink-0 gap-3`}>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={filteredBookmarks.length > 0 && selectedBookmarkIds.size === filteredBookmarks.length}
            ref={input => {
              if (input) {
                input.indeterminate = selectedBookmarkIds.size > 0 && selectedBookmarkIds.size < filteredBookmarks.length;
              }
            }}
            onChange={onToggleSelectAll}
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
                Delete ({selectedBookmarkIds.size})
              </button>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <Filter size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
              <select
                value={filterBy}
                onChange={(e) => onFilterChange(e.target.value as "all" | "has_images" | "has_summary" | "has_content")}
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
                onChange={(e) => onSortChange(e.target.value as "date_desc" | "date_asc" | "title_asc" | "title_desc" | "domain_asc" | "domain_desc")}
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

          <div className="relative flex-grow min-w-[${SEARCH_INPUT_MIN_WIDTH}px] max-w-xs">
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
        {filteredBookmarks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <Globe size={48} className="mb-4 opacity-20" />
            <p>No bookmarks found.</p>
          </div>
        ) : (
          <div
            className={cn(
              viewMode === "grid"
? itemSize === "small" ? `grid grid-cols-[repeat(auto-fill,minmax(${GRID_ITEM_MIN_WIDTH_SMALL}px,1fr))] gap-3` :
                   itemSize === "large" ? `grid grid-cols-[repeat(auto-fill,minmax(${GRID_ITEM_MIN_WIDTH_LARGE}px,1fr))] gap-5` :
                   `grid grid-cols-[repeat(auto-fill,minmax(${GRID_ITEM_MIN_WIDTH_MEDIUM}px,1fr))] gap-4`
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
                  onSelectBookmark(bookmark);
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
                    <RefreshCw size={REFRESH_OVERLAY_SIZE} className="animate-spin text-blue-500 drop-shadow-sm" />
                  </div>
                )}
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
                    onChange={(e) => onToggleBookmarkSelection(bookmark.id, e as React.MouseEvent<HTMLInputElement>)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

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
                      {(bookmark.collections || []).slice(0, 2).map((coll: Collection) => (
                       <span
                         key={coll.id}
                          className={`text-[${TEXT_SIZE_SMALL}px] font-medium px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 flex items-center gap-1`}
                       >
                         <div
                           className="w-1.5 h-1.5 rounded-full"
                           style={{ backgroundColor: coll.color }}
                         />
                         {coll.name}
                       </span>
                     ))}
                     {(bookmark.collections || []).length > 2 && (
                        <span className={`text-[${TEXT_SIZE_SMALL}px] text-slate-400`}>
                         +{(bookmark.collections || []).length - 2} more
                       </span>
                     )}
                     {bookmark.tags?.slice(0, 2).map((tag) => (
                       <span
                         key={tag.id}
                          className={`text-[${TEXT_SIZE_SMALL}px] text-slate-400`}
                       >
                         #{tag.name}
                       </span>
                     ))}
                   </div>
                </div>

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
  );
}
