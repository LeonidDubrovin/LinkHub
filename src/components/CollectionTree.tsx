import React from "react";
import { GripVertical } from "lucide-react";
import { Icon } from "./Icon";
import { cn } from "../lib/utils";
import { Collection } from "../types";

export type DropPosition = "before" | "after" | "into";

export interface DragHandlers {
  onDragStart: (e: React.DragEvent, collId: string) => void;
  onDragOver: (e: React.DragEvent, collId: string, position: DropPosition) => void;
  onDrop: (e: React.DragEvent, collId: string, position: DropPosition) => void;
  onDragEnd: () => void;
  onContainerLeave: () => void;
  onRootDrop: (e: React.DragEvent) => void;
  onRootDragOver: (e: React.DragEvent) => void;
}

function calcDropPosition(e: React.DragEvent): DropPosition {
  const rect = e.currentTarget.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const ratio = y / rect.height;
  if (ratio < 0.25) return "before";
  if (ratio > 0.75) return "after";
  return "into";
}

interface CollectionTreeProps {
  collections: Collection[];
  level: number;
  selectedCollectionId: string | null;
  dropTargetCollectionId: string | null;
  dropPosition: DropPosition | null;
  draggedCollectionId: string | null;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, coll: Collection) => void;
  dragHandlers: DragHandlers;
}

export function CollectionTree({
  collections,
  level,
  selectedCollectionId,
  dropTargetCollectionId,
  dropPosition,
  draggedCollectionId,
  onSelect,
  onContextMenu,
  dragHandlers,
}: CollectionTreeProps) {
  return (
    <>
      {collections.map((coll) => {
        const isDraggable = coll.id !== "inbox-collection";
        const isDropTarget = dropTargetCollectionId === coll.id;
        const isDragging = draggedCollectionId === coll.id;
        const pos = isDropTarget ? dropPosition : null;
        const count = (coll as any).bookmarkCount ?? 0;

        return (
          <div key={coll.id}>
            {isDropTarget && pos === "before" && (
              <div
                className="h-[2px] bg-blue-500 rounded-full mx-1"
                style={{ marginLeft: `${0.5 + level * 1}rem` }}
              />
            )}

            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm mb-0.5 transition-colors select-none group",
                isDragging && "opacity-40",
                selectedCollectionId === coll.id
                  ? "bg-blue-100 text-blue-700 font-medium"
                  : isDropTarget && pos === "into"
                  ? "bg-blue-50 outline outline-1 outline-blue-400 outline-offset-[-1px]"
                  : "hover:bg-slate-200 text-slate-700"
              )}
              style={{ paddingLeft: `${0.5 + level * 1}rem` }}
              onDragOver={(e) => {
                e.preventDefault();
                dragHandlers.onDragOver(e, coll.id, calcDropPosition(e));
              }}
              onDrop={(e) => {
                dragHandlers.onDrop(e, coll.id, calcDropPosition(e));
              }}
              onClick={() => onSelect(coll.id)}
              onContextMenu={(e) => onContextMenu(e, coll)}
            >
              <span
                draggable={isDraggable}
                onDragStart={isDraggable ? (e) => { e.stopPropagation(); dragHandlers.onDragStart(e, coll.id); } : undefined}
                onDragEnd={isDraggable ? dragHandlers.onDragEnd : undefined}
                className={cn(
                  "w-4 h-4 flex-shrink-0 flex items-center justify-center",
                  isDraggable ? "cursor-grab opacity-0 group-hover:opacity-100 active:cursor-grabbing" : "invisible"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical size={12} />
              </span>
              <Icon name={coll.icon || "Folder"} size={16} color={coll.color} />
              <span className="truncate flex-1">{coll.name}</span>
              <span className="text-xs text-slate-400">{count}</span>
            </div>

            {coll.children && coll.children.length > 0 && (
              <CollectionTree
                collections={coll.children}
                level={level + 1}
                selectedCollectionId={selectedCollectionId}
                dropTargetCollectionId={dropTargetCollectionId}
                dropPosition={dropPosition}
                draggedCollectionId={draggedCollectionId}
                onSelect={onSelect}
                onContextMenu={onContextMenu}
                dragHandlers={dragHandlers}
              />
            )}

            {isDropTarget && pos === "after" && (
              <div
                className="h-[2px] bg-blue-500 rounded-full mx-1"
                style={{ marginLeft: `${0.5 + level * 1}rem` }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
