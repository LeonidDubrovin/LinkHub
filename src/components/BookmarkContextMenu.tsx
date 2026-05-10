import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Copy, RefreshCw, Trash2, Link2 } from 'lucide-react';
import { Bookmark } from '../types';

interface BookmarkContextMenuProps {
  bookmark: Bookmark;
  position: { x: number; y: number };
  onClose: () => void;
  onOpen: (url: string) => void;
  onCopyUrl: (url: string) => void;
  onRefresh: (id: string) => void;
  onDelete: (id: string) => void;
}

export function BookmarkContextMenu({
  bookmark,
  position,
  onClose,
  onOpen,
  onCopyUrl,
  onRefresh,
  onDelete,
}: BookmarkContextMenuProps) {
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

  return (
    <div
      ref={menuRef}
      className="fixed bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-[60] min-w-[180px]"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
    >
      <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 truncate border-b border-slate-100 mb-1">
        {bookmark.title || bookmark.url}
      </div>

      <button
        onClick={() => { onClose(); onOpen(bookmark.url); }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <ExternalLink size={14} />
        Open in browser
      </button>

      <button
        onClick={() => { onClose(); onCopyUrl(bookmark.url); }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <Copy size={14} />
        Copy URL
      </button>

      <div className="border-t border-slate-100 my-1" />

      <button
        onClick={() => { onClose(); onRefresh(bookmark.id); }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <RefreshCw size={14} />
        Refresh
      </button>

      <div className="border-t border-slate-100 my-1" />

      <button
        onClick={() => { onClose(); onDelete(bookmark.id); }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash2 size={14} />
        Delete
      </button>
    </div>
  );
}
