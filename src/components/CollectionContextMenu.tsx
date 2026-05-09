import React, { useState, useEffect, useRef } from 'react';
import { Pencil, Trash2, Image, ArrowUp, ArrowDown, Outdent } from 'lucide-react';
import { Icon } from './Icon';
import { Collection } from '../types';

interface ContextMenuAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  separatorAfter?: boolean;
}

interface CollectionContextMenuProps {
  collection: Collection;
  position: { x: number; y: number };
  onClose: () => void;
  onRename: (collection: Collection) => void;
  onChangeIcon: (collection: Collection) => void;
  onDelete: (collectionId: string) => void;
  onMoveUp: (collectionId: string) => void;
  onMoveDown: (collectionId: string) => void;
  onMoveOut: (collectionId: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canMoveOut: boolean;
}

export function CollectionContextMenu({
  collection,
  position,
  onClose,
  onRename,
  onChangeIcon,
  onDelete,
  onMoveUp,
  onMoveDown,
  onMoveOut,
  canMoveUp,
  canMoveDown,
  canMoveOut,
}: CollectionContextMenuProps) {
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
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [onClose]);

  const isSystem = collection.id === 'inbox-collection';

  const actions: ContextMenuAction[] = [
    { label: 'Rename', icon: <Pencil size={14} />, onClick: () => { onClose(); onRename(collection); }, disabled: isSystem },
    { label: 'Change Icon', icon: <Image size={14} />, onClick: () => { onClose(); onChangeIcon(collection); }, disabled: isSystem },
    { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => { onClose(); onDelete(collection.id); }, danger: true, disabled: isSystem, separatorAfter: true },
    { label: 'Move Up', icon: <ArrowUp size={14} />, onClick: () => { onClose(); onMoveUp(collection.id); }, disabled: !canMoveUp },
    { label: 'Move Down', icon: <ArrowDown size={14} />, onClick: () => { onClose(); onMoveDown(collection.id); }, disabled: !canMoveDown, separatorAfter: true },
    { label: 'Move Out of Parent', icon: <Outdent size={14} />, onClick: () => { onClose(); onMoveOut(collection.id); }, disabled: !canMoveOut },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-[60] min-w-[180px]"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
    >
      <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 truncate flex items-center gap-2 border-b border-slate-100 mb-1">
        <Icon name={collection.icon || 'Folder'} size={12} color={collection.color} />
        {collection.name}
      </div>
      {actions.map((action, i) => (
        <React.Fragment key={i}>
          <button
            onClick={action.onClick}
            disabled={action.disabled}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
              action.danger
                ? action.disabled ? 'text-slate-300' : 'text-red-600 hover:bg-red-50'
                : action.disabled ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {action.icon}
            {action.label}
          </button>
          {action.separatorAfter && <div className="border-t border-slate-100 my-1" />}
        </React.Fragment>
      ))}
    </div>
  );
}
