import React from "react";
import { Icon } from "./Icon";
import { Collection } from "../types";
import { DragHandlers } from "./CollectionTree";

interface CollectionCheckboxTreeProps {
  collections: Collection[];
  level: number;
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
  dragHandlers: DragHandlers;
}

export function CollectionCheckboxTree({
  collections,
  level,
  selectedIds,
  onToggle,
  dragHandlers,
}: CollectionCheckboxTreeProps) {
  return (
    <>
      {collections.map((coll) => {
        const isDraggable = coll.id !== "inbox-collection";
        return (
          <div
            key={coll.id}
            style={{ paddingLeft: `${level * 12}px` }}
            draggable={isDraggable}
            onDragStart={isDraggable ? (e) => dragHandlers.onDragStart(e, coll.id) : undefined}
            onDragOver={(e) => dragHandlers.onDragOver(e, coll.id)}
            onDragLeave={dragHandlers.onDragLeave}
            onDrop={(e) => dragHandlers.onDrop(e, coll.id)}
            onDragEnd={dragHandlers.onDragEnd}
          >
            <label className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
              <input
                type="checkbox"
                checked={selectedIds.includes(coll.id)}
                onChange={(e) => onToggle(coll.id, e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <Icon name={coll.icon || "Folder"} size={14} color={coll.color} />
              <span className="truncate">{coll.name}</span>
            </label>
            {coll.children && coll.children.length > 0 && (
              <CollectionCheckboxTree
                collections={coll.children}
                level={level + 1}
                selectedIds={selectedIds}
                onToggle={onToggle}
                dragHandlers={dragHandlers}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
