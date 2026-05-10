import React, { useState, useEffect, useRef } from 'react';
import { Pencil, Trash2, Plus, Folder } from 'lucide-react';
import { Space } from '../types';

interface SpaceContextMenuProps {
  space: Space;
  position: { x: number; y: number };
  onClose: () => void;
  onRename: (space: Space) => void;
  onDelete: (spaceId: string) => void;
  onAddCollection: (spaceId: string) => void;
}

export function SpaceContextMenu({
  space,
  position,
  onClose,
  onRename,
  onDelete,
  onAddCollection,
}: SpaceContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState(position);

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const x = Math.min(position.x, window.innerWidth - rect.width - 8);
    const y = Math.min(position.y, window.innerHeight - rect.height - 8);
    setAdjustedPos({ x: Math.max(0, x), y: Math.max(0, y) });
  }, [position]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const isSystem = space.id === 'inbox-space';

  return (
    <div
      ref={menuRef}
      className="fixed bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-[60] min-w-[180px]"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
    >
      <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 truncate flex items-center gap-2 border-b border-slate-100 mb-1">
        <Folder size={12} className="text-slate-400" />
        {space.name}
      </div>

      <button
        onClick={() => { onClose(); onAddCollection(space.id); }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <Plus size={14} />
        Add Collection
      </button>

      <button
        onClick={() => { onClose(); onRename(space); }}
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
          isSystem ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-100'
        }`}
        disabled={isSystem}
      >
        <Pencil size={14} />
        Rename
      </button>

      <div className="border-t border-slate-100 my-1" />

      <button
        onClick={() => { onClose(); onDelete(space.id); }}
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
          isSystem ? 'text-slate-300 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'
        }`}
        disabled={isSystem}
      >
        <Trash2 size={14} />
        Delete
      </button>
    </div>
  );
}
