import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Search } from 'lucide-react';
import { Icon } from './Icon';
import { apiClient } from '../services/api';
import type { Domain } from '../types';

try {
  // Dynamically import emoji-mart Picker to avoid SSR issues
  var EmojiPickerModule: any = null;
  import('emoji-mart').then((m) => { EmojiPickerModule = m; });
} catch {}

const LUCIDE_ICONS: string[] = [
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

const POPULAR_EMOJIS = [
  '🚀','💻','🎨','🎵','🎬','📚','🔧','🛠️','⚙️','🧠',
  '🌐','🗺️','📍','✈️','🏠','🏢','💼','📰','🎙️','📻',
  '💡','🔬','☕','🍽️','🏋️','🚴','🏔️','🌊','🛡️','🔒',
  '🔑','👁️','💰','📈','💬','✉️','📞','👥','📥','🗂️',
  '⚡','🎯','🚩','⚙️','❤️','⭐','👍','😊','✨','🎮',
  '🏆','🎲','🧩','🛒','🏪','📦','🧾','🎓','🔖','📖',
  '📝','💻','🖥️','📺','📷','🎧','🎸','💿','🌍','🌎',
  '🌏','🗾','🧭','✈️','🛫','🛬','🚂','🚃','🚄','🚅',
];

type Tab = 'icons' | 'emoji' | 'favicons';

interface IconPickerProps {
  currentIcon: string;
  onSelect: (iconName: string) => void;
  onClose: () => void;
}

export function IconPicker({ currentIcon, onSelect, onClose }: IconPickerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('icons');
  const [search, setSearch] = useState('');
  const [domains, setDomains] = useState<Domain[]>([]);
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

  useEffect(() => {
    if (activeTab === 'favicons' && domains.length === 0) {
      apiClient.domains.list().then(setDomains).catch(() => {});
    }
  }, [activeTab, domains.length]);

  const handleEmojiSelect = useCallback((emoji: any) => {
    onSelect(`emoji:${emoji.native}`);
  }, [onSelect]);

  const filteredIcons = search
    ? LUCIDE_ICONS.filter((name) => name.toLowerCase().includes(search.toLowerCase()))
    : LUCIDE_ICONS;

  const filteredEmojis = search
    ? POPULAR_EMOJIS.filter((e) => e.includes(search))
    : POPULAR_EMOJIS;

  const filteredDomains = search
    ? domains.filter((d) => d.domain.toLowerCase().includes(search.toLowerCase()))
    : domains;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'icons', label: 'Icons' },
    { id: 'emoji', label: 'Emoji' },
    { id: 'favicons', label: 'Favicons' },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div ref={containerRef} className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-sm">Choose Icon</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearch(''); }}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-slate-100 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pb-4 overflow-y-auto flex-1 min-h-0">
          {/* Lucide Icons Tab */}
          {activeTab === 'icons' && (
            <div className="pt-3">
              <div className="grid grid-cols-8 gap-1">
                {filteredIcons.map((name) => {
                  const fullName = `lucide:${name}`;
                  const isSelected = currentIcon === fullName || currentIcon === name;
                  return (
                    <button
                      key={name}
                      onClick={() => onSelect(fullName)}
                      title={name}
                      className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-blue-100 ring-2 ring-blue-500'
                          : 'hover:bg-slate-100'
                      }`}
                    >
                      <Icon name={fullName} size={18} />
                    </button>
                  );
                })}
              </div>
              {filteredIcons.length === 0 && (
                <div className="text-center text-xs text-slate-400 py-8">No icons found</div>
              )}
            </div>
          )}

          {/* Emoji Tab */}
          {activeTab === 'emoji' && (
            <div className="pt-3">
              <div className="grid grid-cols-10 gap-1">
                {filteredEmojis.map((emoji) => {
                  const fullName = `emoji:${emoji}`;
                  const isSelected = currentIcon === fullName || currentIcon === emoji;
                  return (
                    <button
                      key={emoji}
                      onClick={() => onSelect(fullName)}
                      className={`p-1 rounded-md flex items-center justify-center text-lg transition-colors ${
                        isSelected
                          ? 'bg-blue-100 ring-2 ring-blue-500'
                          : 'hover:bg-slate-100'
                      }`}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
              {filteredEmojis.length === 0 && (
                <div className="text-center text-xs text-slate-400 py-8">No emojis found</div>
              )}
            </div>
          )}

          {/* Favicons Tab */}
          {activeTab === 'favicons' && (
            <div className="pt-3">
              {filteredDomains.length === 0 && domains.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-8">
                  {search ? 'No domains found' : 'No bookmarks with favicons yet. Add some bookmarks first!'}
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-2">
                  {filteredDomains.map((domain) => {
                    const fullName = `favicon:${domain.domain}`;
                    const isSelected = currentIcon === fullName;
                    return (
                      <button
                        key={domain.domain}
                        onClick={() => onSelect(fullName)}
                        title={domain.domain}
                        className={`flex flex-col items-center gap-1 p-2 rounded-md transition-colors ${
                          isSelected
                            ? 'bg-blue-100 ring-2 ring-blue-500'
                            : 'hover:bg-slate-100'
                        }`}
                      >
                        <img
                          src={`/api/favicons/${domain.domain}`}
                          alt=""
                          width={20}
                          height={20}
                          className="rounded-sm"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <span className="text-[10px] text-slate-500 truncate w-full text-center">
                          {domain.domain}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
