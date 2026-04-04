import React from "react";
import { cn } from "../lib/utils";
import { Icon } from "./Icon";
import { Globe, Settings, Plus, Pin, PinOff, BookOpen } from "lucide-react";

interface SidebarProps {
  treeSpaces: any[];
  domains: any[];
  tags: any[];
  pinnedDomains: string[];
  selectedCollectionId: string | null;
  selectedTagId: string | null;
  selectedDomain: string | null;
  isCreatingCollection: boolean;
  newCollectionName: string;
  setIsCreatingCollection: (v: boolean) => void;
  setNewCollectionName: (v: string) => void;
  handleCreateCollection: () => void;
  onSelectCollection: (id: string | null) => void;
  onSelectTag: (id: string | null) => void;
  onSelectDomain: (domain: string | null) => void;
  togglePinDomain: (domain: string, e: React.MouseEvent) => void;
  renderCollections: (colls: any[], level: number) => React.ReactNode;
  setIsSettingsOpen: (v: boolean) => void;
  setIsAdding: (v: boolean) => void;
}

export function Sidebar({
  treeSpaces,
  domains,
  tags,
  pinnedDomains,
  selectedCollectionId,
  selectedTagId,
  selectedDomain,
  isCreatingCollection,
  newCollectionName,
  setIsCreatingCollection,
  setNewCollectionName,
  handleCreateCollection,
  onSelectCollection,
  onSelectTag,
  onSelectDomain,
  togglePinDomain,
  renderCollections,
  setIsSettingsOpen,
  setIsAdding,
}: SidebarProps) {
  return (
    <div className="w-64 bg-[#f1f3f5] border-r border-slate-200 flex flex-col flex-shrink-0">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center text-white">
            <BookOpen size={14} />
          </div>
          <span className="tracking-tight">LinkHub</span>
        </div>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-1.5 hover:bg-slate-200 rounded-md text-slate-500"
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>

      <div className="px-3 pb-2">
        <button
          onClick={() => setIsAdding(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 px-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Add Bookmark
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-3 mb-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
            Filters
          </div>
          <button
            onClick={() => {
              onSelectCollection(null);
              onSelectTag(null);
              onSelectDomain(null);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-sm",
              !selectedCollectionId && !selectedTagId && !selectedDomain
                ? "bg-blue-100 text-blue-700 font-medium"
                : "hover:bg-slate-200 text-slate-700",
            )}
          >
            <Globe
              size={16}
              className={
                !selectedCollectionId && !selectedTagId && !selectedDomain
                  ? "text-blue-600"
                  : "text-slate-400"
              }
            />
            All Bookmarks
          </button>
        </div>

        {/* Spaces & Collections Tree */}
        <div className="px-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">
              Collections
            </div>
            <button
              onClick={() => setIsCreatingCollection(true)}
              className="text-xs text-blue-600 hover:underline px-2"
            >
              + New
            </button>
          </div>
          {isCreatingCollection && (
            <div className="mb-2 px-2">
              <input
                autoFocus
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="Collection name"
                className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateCollection();
                  } else if (e.key === "Escape") {
                    setIsCreatingCollection(false);
                    setNewCollectionName("");
                  }
                }}
              />
            </div>
          )}
          {treeSpaces.length === 0 ? (
            <div className="text-xs text-slate-400 px-2">No collections</div>
          ) : (
            treeSpaces.map((space) => (
              <div key={space.id} className="mb-2">
                <div className="flex items-center gap-2 px-2 py-1 text-[10px] font-semibold uppercase text-slate-400">
                  {space.name}
                </div>
                {space.collections && renderCollections(space.collections, 0)}
              </div>
            ))
          )}
        </div>

        {pinnedDomains.length > 0 && (
          <div className="px-3 mb-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
              Pinned
            </div>
            {domains
              .filter((d) => pinnedDomains.includes(d.domain))
              .map((d) => (
                <button
                  key={`pinned-${d.domain}`}
                  onClick={() => {
                    onSelectDomain(d.domain);
                    onSelectCollection(null);
                    onSelectTag(null);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-sm mb-0.5 group",
                    selectedDomain === d.domain
                      ? "bg-blue-100 text-blue-700 font-medium"
                      : "hover:bg-slate-200 text-slate-700",
                  )}
                >
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${d.domain}&sz=32`}
                    alt=""
                    className="w-4 h-4 rounded-sm"
                    referrerPolicy="no-referrer"
                  />
                  <span className="truncate flex-1 text-left">{d.domain}</span>
                  <span className="text-xs text-slate-400 font-medium group-hover:hidden">
                    {d.count}
                  </span>
                  <div
                    className="hidden group-hover:flex items-center justify-center text-slate-400 hover:text-slate-600"
                    onClick={(e) => togglePinDomain(d.domain, e)}
                    title="Unpin resource"
                  >
                    <PinOff size={14} />
                  </div>
                </button>
              ))}
          </div>
        )}

        {domains.filter((d) => !pinnedDomains.includes(d.domain)).length > 0 && (
          <div className="px-3 mb-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
              Resources
            </div>
            {domains
              .filter((d) => !pinnedDomains.includes(d.domain))
              .map((d) => (
                <button
                  key={d.domain}
                  onClick={() => {
                    onSelectDomain(d.domain);
                    onSelectCollection(null);
                    onSelectTag(null);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-sm mb-0.5 group",
                    selectedDomain === d.domain
                      ? "bg-blue-100 text-blue-700 font-medium"
                      : "hover:bg-slate-200 text-slate-700",
                  )}
                >
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${d.domain}&sz=32`}
                    alt=""
                    className="w-4 h-4 rounded-sm"
                    referrerPolicy="no-referrer"
                  />
                  <span className="truncate flex-1 text-left">{d.domain}</span>
                  <span className="text-xs text-slate-400 font-medium group-hover:hidden">
                    {d.count}
                  </span>
                  <div
                    className="hidden group-hover:flex items-center justify-center text-slate-400 hover:text-slate-600"
                    onClick={(e) => togglePinDomain(d.domain, e)}
                    title="Pin resource"
                  >
                    <Pin size={14} />
                  </div>
                </button>
              ))}
          </div>
        )}

        {tags.length > 0 && (
          <div className="px-3 mb-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
              Tags
            </div>
            <div className="flex flex-wrap gap-1 px-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => {
                    onSelectTag(tag.id);
                    onSelectCollection(null);
                    onSelectDomain(null);
                  }}
                  className={cn(
                    "text-xs px-2 py-1 rounded-md border transition-colors",
                    selectedTagId === tag.id
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
                  )}
                >
                  #{tag.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
