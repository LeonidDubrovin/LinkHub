import React, { memo, useCallback } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";
import { cn } from "../lib/utils";
import { DynamicCover } from "./DynamicCover";
import { Bookmark, Collection } from "../types";
import { BOOKMARK_DRAG_TYPE } from "./ArboristNode";

interface BookmarkItemProps {
  bookmark: Bookmark;
  viewMode: "list" | "grid";
  itemSize: "small" | "medium" | "large";
  isSelected: boolean;
  isRefreshing: boolean;
  isChecked: boolean;
  onSelect: (bookmark: Bookmark) => void;
  onToggleSelection: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
}

function BookmarkItemInner({
  bookmark,
  viewMode,
  itemSize,
  isSelected,
  isRefreshing,
  isChecked,
  onSelect,
  onToggleSelection,
  onDragStart,
}: BookmarkItemProps) {
  const handleClick = useCallback(() => {
    onSelect(bookmark);
  }, [bookmark, onSelect]);

  const handleCheckboxChange = useCallback(() => {
    onToggleSelection(bookmark.id);
  }, [bookmark.id, onToggleSelection]);

  const handleDragStartCb = useCallback((e: React.DragEvent) => {
    onDragStart(e, bookmark.id);
  }, [bookmark.id, onDragStart]);

  const faviconUrl = `/api/favicons/${bookmark.domain}`;

  return (
    <div
      draggable
      onDragStart={handleDragStartCb}
      onClick={handleClick}
      className={cn(
        "group cursor-pointer border rounded-lg overflow-hidden transition-all hover:shadow-md bg-white relative",
        viewMode === "list"
          ? itemSize === "small" ? "flex items-center p-2 gap-3" :
            itemSize === "large" ? "flex items-center p-4 gap-5" :
            "flex items-center p-3 gap-4"
          : "flex flex-col",
        isSelected
          ? "border-blue-500 ring-1 ring-blue-500"
          : "border-slate-200 hover:border-slate-300",
        isRefreshing && "opacity-70 pointer-events-none"
      )}
    >
      {isRefreshing && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
          <RefreshCw size={24} className="animate-spin text-blue-500 drop-shadow-sm" />
        </div>
      )}
      <div
        className={cn(
          "z-10 flex items-center justify-center",
          viewMode === "list" ? "" : "absolute top-2 left-2",
          isChecked ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity"
        )}
      >
        <input
          type="checkbox"
          checked={isChecked}
          onChange={handleCheckboxChange}
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
            {bookmark.domain}
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
            <span key={tag.id} className="text-[10px] text-slate-400">
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
  );
}

export const BookmarkItem = memo(BookmarkItemInner);
