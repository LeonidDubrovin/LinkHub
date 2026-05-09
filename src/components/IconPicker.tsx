import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Icon } from './Icon';

const COLLECTION_ICONS: string[] = [
  'Folder', 'FolderOpen', 'FolderHeart', 'FolderKey', 'FolderLock', 'FolderPen',
  'FileText', 'FileCode', 'FileVideo', 'FileAudio', 'FileImage', 'File',
  'Bookmark', 'BookOpen', 'BookMarked', 'Library', 'GraduationCap',
  'Code', 'Terminal', 'GitBranch', 'Cpu', 'Binary', 'Monitor', 'Laptop',
  'Palette', 'Paintbrush', 'Pipette', 'PenTool', 'SwatchBook',
  'Video', 'Film', 'Clapperboard', 'Tv', 'Camera',
  'Music', 'Headphones', 'Guitar', 'Disc',
  'Gamepad2', 'Trophy', 'Dice5', 'Puzzle',
  'Globe', 'Map', 'Compass', 'Plane', 'MapPin',
  'ShoppingCart', 'Store', 'Package', 'Receipt',
  'Heart', 'Star', 'ThumbsUp', 'Smile', 'Sparkles',
  'Briefcase', 'Building2', 'Landmark', 'Factory',
  'Newspaper', 'Rss', 'Podcast', 'Radio',
  'Lightbulb', 'Brain', 'Microscope', 'FlaskConical',
  'Home', 'Coffee', 'UtensilsCrossed', 'Wine',
  'Dumbbell', 'Bike', 'Mountain', 'Waves',
  'Shield', 'Lock', 'Key', 'Eye',
  'Wallet', 'PiggyBank', 'TrendingUp', 'BarChart3',
  'MessageSquare', 'Mail', 'Phone', 'Users',
  'Inbox', 'Archive', 'Trash2', 'Clock',
  'Zap', 'Target', 'Flag', 'Settings',
];

interface IconPickerProps {
  currentIcon: string;
  onSelect: (iconName: string) => void;
  onClose: () => void;
}

export function IconPicker({ currentIcon, onSelect, onClose }: IconPickerProps) {
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [onClose]);

  const filtered = search
    ? COLLECTION_ICONS.filter((name) => name.toLowerCase().includes(search.toLowerCase()))
    : COLLECTION_ICONS;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div ref={containerRef} className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-sm">Choose Icon</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="px-4 py-2">
          <input
            autoFocus
            type="text"
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="px-4 pb-4 max-h-64 overflow-y-auto">
          <div className="grid grid-cols-8 gap-1">
            {filtered.map((name) => {
              const isSelected = name === currentIcon;
              return (
                <button
                  key={name}
                  onClick={() => onSelect(name)}
                  title={name}
                  className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-blue-100 ring-2 ring-blue-500'
                      : 'hover:bg-slate-100'
                  }`}
                >
                  <Icon name={name} size={18} />
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-8 text-center text-xs text-slate-400 py-4">No icons found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
