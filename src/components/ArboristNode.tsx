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
  onDropBookmarks?: (collectionId: string, bookmarkIds: string[], sourceCollectionId?: string | null, isFromTrash?: boolean) => void;
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
    const types = Array.from(e.dataTransfer.types);
    if (types.includes(BOOKMARK_DRAG_TYPE)) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
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
        const isFromTrash = e.dataTransfer.getData("application/linkhub-source-trash") === "true";
        onDropBookmarks(data.id, ids, sourceCollectionId, isFromTrash);
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
        className="flex items-center gap-1.5 py-1 pr-3 text-sm mt-1 select-none font-semibold text-slate-600 cursor-pointer hover:text-slate-800"
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
        "group flex items-center gap-1.5 py-[5px] pr-2 rounded-md text-sm select-none cursor-pointer transition-colors",
        isDragging && "opacity-40",
        isBookmarkOver && "bg-blue-50 ring-1 ring-green-400",
        !isBookmarkOver && isSelected
          ? "bg-blue-600 text-white"
          : !isBookmarkOver && willReceiveDrop
            ? "bg-blue-50 ring-1 ring-blue-400"
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
          className={cn(
            "w-4 h-4 flex-shrink-0 flex items-center justify-center transition-colors",
            isSelected ? "text-blue-200 hover:text-white" : "text-slate-400 hover:text-slate-600"
          )}
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
      <span className="flex-shrink-0 flex items-center justify-center">
        <Icon name={data.icon || 'lucide:Folder'} size={18} color={isSelected ? 'white' : undefined} />
      </span>
      <span className="truncate flex-1 min-w-0">{data.name}</span>
      {!data.isGroup && data.bookmarkCount > 0 && (
        <span className={cn(
          "text-[11px] tabular-nums leading-none px-1 py-0.5 rounded",
          isSelected
            ? "bg-blue-500/50 text-white"
            : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
        )}>
          {data.bookmarkCount}
        </span>
      )}
    </div>
  );
});
