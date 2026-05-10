import React, { useState, useCallback } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { Icon } from "./Icon";
import { cn } from "../lib/utils";
import { ArboristNodeData } from "../utils/arboristData";
import { NodeRendererProps } from "react-arborist";
import { Collection } from "../types";

export const BOOKMARK_DRAG_TYPE = "application/linkhub-bookmark";

interface ArboristNodeProps extends NodeRendererProps<ArboristNodeData> {
  onSelectCollection: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, coll: Collection) => void;
  onSpaceContextMenu: (e: React.MouseEvent, space: { id: string; name: string; icon: string; color: string; created_at: string }) => void;
  onCreateCollection: (spaceId: string) => void;
  onDropBookmarks?: (collectionId: string, bookmarkIds: string[], sourceCollectionId?: string | null) => void;
}

export const ArboristNode = React.memo(function ArboristNode({
  node,
  style,
  dragHandle,
  onSelectCollection,
  onContextMenu,
  onSpaceContextMenu,
  onCreateCollection,
  onDropBookmarks,
}: ArboristNodeProps) {
  const data = node.data;
  const [isBookmarkOver, setIsBookmarkOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(BOOKMARK_DRAG_TYPE)) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
      setIsBookmarkOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.stopPropagation();
    setIsBookmarkOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsBookmarkOver(false);
    if (!onDropBookmarks || data.isGroup) return;
    try {
      const payload = e.dataTransfer.getData(BOOKMARK_DRAG_TYPE);
      if (payload) {
        const ids: string[] = JSON.parse(payload);
        const sourceCollectionId = e.dataTransfer.getData("application/linkhub-source-collection") || null;
        onDropBookmarks(data.id, ids, sourceCollectionId);
      }
    } catch {}
  }, [onDropBookmarks, data.id, data.isGroup]);

  if (data.isGroup) {
    const groupStyle = { ...style, paddingLeft: (style.paddingLeft as number || 0) + 8 };
    const space = {
      id: data.space_id,
      name: data.name,
      icon: data.icon,
      color: data.color,
      created_at: "",
    };
    return (
      <div
        style={groupStyle}
        className="flex items-center gap-2 py-1.5 pr-3 text-sm mt-2 mb-px select-none font-semibold text-slate-700 cursor-pointer hover:text-slate-900"
        onClick={() => node.toggle()}
        onContextMenu={(e) => onSpaceContextMenu(e, space)}
      >
        <span
          onClick={(e) => { e.stopPropagation(); node.toggle(); }}
          className="w-4 h-4 flex-shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-600"
        >
          <ChevronRight
            size={14}
            className={cn("transition-transform duration-150", node.isOpen && "rotate-90")}
          />
        </span>
        <span className="truncate flex-1">
          {data.name}
        </span>
      </div>
    );
  }

  const isSelected = node.isSelected;
  const isDragging = node.isDragging;
  const willReceiveDrop = node.willReceiveDrop;
  const isCustomIcon = !!data.icon && data.icon !== "Folder";
  const iconColor = isCustomIcon
    ? data.color
    : isSelected
      ? "#94a3b8"
      : "#cbd5e1";

  const collection: Collection = {
    id: data.id,
    name: data.name,
    icon: data.icon,
    color: data.color,
    space_id: data.space_id,
    parent_id: node.parent?.id?.startsWith("group:") ? null : node.parent?.id ?? null,
    sort_order: 0,
    created_at: "",
    bookmarkCount: data.bookmarkCount,
  };

  const nodeStyle = { ...style, paddingLeft: (style.paddingLeft as number || 0) + 8 };

  return (
    <div
      ref={dragHandle}
      style={nodeStyle}
      className={cn(
        "flex items-center gap-2 py-1.5 pr-3 rounded-md text-sm mb-px select-none cursor-pointer",
        isDragging && "opacity-40",
        isBookmarkOver && "bg-blue-50 ring-2 ring-green-400 ring-offset-[-1px]",
        !isBookmarkOver && isSelected
          ? "bg-blue-100 text-blue-700 font-medium"
          : !isBookmarkOver && willReceiveDrop
            ? "bg-blue-50 ring-2 ring-blue-400 ring-offset-[-1px]"
            : !isBookmarkOver && "hover:bg-slate-100 text-slate-700"
      )}
      onClick={() => onSelectCollection(data.id)}
      onContextMenu={(e) => onContextMenu(e, collection)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {node.isInternal && !data.isGroup && (node.children?.length ?? 0) > 0 ? (
        <span
          onClick={(e) => {
            e.stopPropagation();
            node.toggle();
          }}
          className="w-4 h-4 flex-shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-600"
        >
          <ChevronRight
            size={14}
            className={cn(
              "transition-transform duration-150",
              node.isOpen && "rotate-90"
            )}
          />
        </span>
      ) : (
        <span className="w-4 h-4 flex-shrink-0" />
      )}
      <Icon name={data.icon} size={16} color={iconColor} />
      <span className="truncate flex-1">{data.name}</span>
      {!data.isGroup && (
        <span className="text-xs text-slate-400">{data.bookmarkCount}</span>
      )}
    </div>
  );
});
