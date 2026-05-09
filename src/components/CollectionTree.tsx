import React from "react";
import { Icon } from "./Icon";
import { cn } from "../lib/utils";
import { Collection } from "../types";

export interface DragHandlers {
  onDragStart: (e: React.DragEvent, collId: string) => void;
  onDragOver: (e: React.DragEvent, collId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, collId: string) => void;
  onDragEnd: () => void;
}

interface CollectionTreeProps {
  collections: Collection[];
  level: number;
  selectedCollectionId: string | null;
  dropTargetCollectionId: string | null;
  collectionBookmarkCounts: Map<string, number>;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, coll: Collection) => void;
  dragHandlers: DragHandlers;
}

export function CollectionTree({
  collections,
  level,
  selectedCollectionId,
  dropTargetCollectionId,
  collectionBookmarkCounts,
  onSelect,
  onContextMenu,
  dragHandlers,
}: CollectionTreeProps) {
  return (
    <>
      {collections.map((coll) => {
        const isDraggable = coll.id !== "inbox-collection";
        return (
          <div key={coll.id}>
            <button
              draggable={isDraggable}
              onDragStart={isDraggable ? (e) => dragHandlers.onDragStart(e, coll.id) : undefined}
              onDragOver={(e) => dragHandlers.onDragOver(e, coll.id)}
              onDragLeave={dragHandlers.onDragLeave}
              onDrop={(e) => dragHandlers.onDrop(e, coll.id)}
              onDragEnd={dragHandlers.onDragEnd}
              onClick={() => onSelect(coll.id)}
              onContextMenu={(e) => onContextMenu(e, coll)}
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
            {coll.children && coll.children.length > 0 && (
              <CollectionTree
                collections={coll.children}
                level={level + 1}
                selectedCollectionId={selectedCollectionId}
                dropTargetCollectionId={dropTargetCollectionId}
                collectionBookmarkCounts={collectionBookmarkCounts}
                onSelect={onSelect}
                onContextMenu={onContextMenu}
                dragHandlers={dragHandlers}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
