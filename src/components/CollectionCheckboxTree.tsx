import React from "react";
import { Icon } from "./Icon";
import { Collection } from "../types";

interface CollectionCheckboxTreeProps {
  collections: Collection[];
  level: number;
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
}

export function CollectionCheckboxTree({
  collections,
  level,
  selectedIds,
  onToggle,
}: CollectionCheckboxTreeProps) {
  return (
    <>
      {collections.map((coll) => {
        return (
          <div
            key={coll.id}
            style={{ paddingLeft: `${level * 12}px` }}
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
              />
            )}
          </div>
        );
      })}
    </>
  );
}
