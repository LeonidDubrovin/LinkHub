import React, { useRef } from "react";
import { cn } from "../lib/utils";
import { Globe, Settings, Plus, BookOpen } from "lucide-react";
import { SpaceWithCollections, Domain, Collection } from "../types";
import { DomainItem } from "./DomainItem";
import { CollectionTree, DragHandlers, DropPosition } from "./CollectionTree";

interface SidebarProps {
  treeSpaces: SpaceWithCollections[];
  domains: Domain[];
  pinnedDomains: string[];
  selectedCollectionId: string | null;
  selectedDomain: string | null;
  isCreatingCollection: boolean;
  newCollectionName: string;
  setIsCreatingCollection: (v: boolean) => void;
  setNewCollectionName: (v: string) => void;
  handleCreateCollection: () => void;
  onSelectCollection: (id: string | null) => void;
  onSelectDomain: (domain: string | null) => void;
  togglePinDomain: (domain: string, e: React.MouseEvent) => void;
  onCollectionContextMenu: (e: React.MouseEvent, coll: Collection) => void;
  dropTargetCollectionId: string | null;
  dropPosition: DropPosition | null;
  draggedCollectionId: string | null;
  dragHandlers: DragHandlers;
  setIsSettingsOpen: (v: boolean) => void;
  setIsAdding: (v: boolean) => void;
}

export function Sidebar({
  treeSpaces,
  domains,
  pinnedDomains,
  selectedCollectionId,
  selectedDomain,
  isCreatingCollection,
  newCollectionName,
  setIsCreatingCollection,
  setNewCollectionName,
  handleCreateCollection,
  onSelectCollection,
  onSelectDomain,
  togglePinDomain,
  onCollectionContextMenu,
  dropTargetCollectionId,
  dropPosition,
  draggedCollectionId,
  dragHandlers,
  setIsSettingsOpen,
  setIsAdding,
}: SidebarProps) {
  const dragDepthRef = useRef(0);

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
            onClick={() => { onSelectCollection(null); onSelectDomain(null); }}
            className={cn(
              "w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-sm",
              !selectedCollectionId && !selectedDomain
                ? "bg-blue-100 text-blue-700 font-medium"
                : "hover:bg-slate-200 text-slate-700",
            )}
          >
            <Globe
              size={16}
              className={
                !selectedCollectionId && !selectedDomain
                  ? "text-blue-600"
                  : "text-slate-400"
              }
            />
            All Bookmarks
          </button>
        </div>

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
          <div
            onDragEnter={() => { dragDepthRef.current++; }}
            onDragLeave={() => {
              dragDepthRef.current--;
              if (dragDepthRef.current === 0) {
                dragHandlers.onContainerLeave();
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              dragDepthRef.current = 0;
              dragHandlers.onRootDrop(e);
            }}
          >
            {treeSpaces.length === 0 ? (
              <div className="text-xs text-slate-400 px-2">No collections</div>
            ) : (
              treeSpaces.map((space) => (
                <div key={space.id} className="mb-2">
                  <div className="flex items-center gap-2 px-2 py-1 text-[10px] font-semibold uppercase text-slate-400">
                    {space.name}
                  </div>
                  {space.collections && (
                    <CollectionTree
                      collections={space.collections}
                      level={0}
                      selectedCollectionId={selectedCollectionId}
                      dropTargetCollectionId={dropTargetCollectionId}
                      dropPosition={dropPosition}
                      draggedCollectionId={draggedCollectionId}
                      onSelect={(id) => onSelectCollection(id)}
                      onContextMenu={onCollectionContextMenu}
                      dragHandlers={dragHandlers}
                    />
                  )}
                </div>
              ))
            )}
            {draggedCollectionId && (
              <div
                onDragOver={(e) => { e.preventDefault(); dragHandlers.onRootDragOver(e); }}
                onDrop={(e) => { e.stopPropagation(); dragHandlers.onRootDrop(e); }}
                className="mt-1 mx-2 py-2 border border-dashed border-slate-300 rounded-md text-center text-xs text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 transition-colors"
              >
                Drop here to move to root level
              </div>
            )}
          </div>
        </div>

        {pinnedDomains.length > 0 && (
          <div className="px-3 mb-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
              Pinned
            </div>
            {domains
              .filter((d) => pinnedDomains.includes(d.domain))
              .map((d) => (
                <div key={`pinned-${d.domain}`}>
                  <DomainItem
                    domain={d.domain}
                    count={d.count}
                    isSelected={selectedDomain === d.domain}
                    isPinned={true}
                    onSelect={(domain) => onSelectDomain(domain)}
                    onTogglePin={togglePinDomain}
                  />
                </div>
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
                <div key={d.domain}>
                  <DomainItem
                    domain={d.domain}
                    count={d.count}
                    isSelected={selectedDomain === d.domain}
                    isPinned={false}
                    onSelect={(domain) => onSelectDomain(domain)}
                    onTogglePin={togglePinDomain}
                  />
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
