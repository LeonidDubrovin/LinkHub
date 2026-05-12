import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "../lib/utils";
import { Globe, Trash2, Settings, Plus, BookOpen } from "lucide-react";
import { Domain, Collection } from "../types";
import { DomainItem } from "./DomainItem";
import { Tree, TreeApi } from "react-arborist";
import { DndProvider, useDragDropManager } from "react-dnd";
import { TouchBackend } from "react-dnd-touch-backend";
import { ArboristNode } from "./ArboristNode";
import { ArboristNodeData } from "../utils/arboristData";

interface SidebarProps {
  arboristData: ArboristNodeData[];
  domains: Domain[];
  pinnedDomains: string[];
  selectedCollectionId: string | null;
  selectedDomain: string | null;
  isViewingTrash: boolean;
  isCreatingCollection: boolean;
  isCreatingGroup: boolean;
  newCollectionName: string;
  newGroupName: string;
  createCollectionSpaceId: string | null;
  setIsCreatingCollection: (v: boolean) => void;
  setNewCollectionName: (v: string) => void;
  handleCreateCollection: () => void;
  setCreateCollectionSpaceId: (id: string | null) => void;
  setIsCreatingGroup: (v: boolean) => void;
  setNewGroupName: (v: string) => void;
  handleCreateGroup: () => void;
  onSelectCollection: (id: string | null) => void;
  onSelectDomain: (domain: string | null) => void;
  onSelectTrash: () => void;
  togglePinDomain: (domain: string, e: React.MouseEvent) => void;
  onCollectionContextMenu: (e: React.MouseEvent, coll: Collection) => void;
  onSpaceContextMenu: (e: React.MouseEvent, space: { id: string; name: string; icon: string; color: string; created_at: string }) => void;
  onArboristMove: (args: { dragIds: string[]; parentId: string | null; parentNode: any; index: number }) => void;
  onDropBookmarks: (collectionId: string, bookmarkIds: string[], sourceCollectionId?: string | null, isFromTrash?: boolean) => void;
  setIsSettingsOpen: (v: boolean) => void;
  setIsAdding: (v: boolean) => void;
}

function countVisibleNodes(nodes: ArboristNodeData[]): number {
  let count = 0;
  for (const node of nodes) {
    count++;
    if (node.children && node.children.length > 0) {
      count += countVisibleNodes(node.children);
    }
  }
  return count;
}

function CollectionTreeInner(props: {
  arboristData: ArboristNodeData[];
  selectedCollectionId: string | null;
  treeHeight: number;
  sidebarWidth: number;
  onSelectCollection: (id: string | null) => void;
  onCollectionContextMenu: (e: React.MouseEvent, coll: Collection) => void;
  onSpaceContextMenu: (e: React.MouseEvent, space: { id: string; name: string; icon: string; color: string; created_at: string }) => void;
  onArboristMove: (args: { dragIds: string[]; parentId: string | null; parentNode: any; index: number }) => void;
  handleCreateCollectionForSpace: (spaceId: string) => void;
  onDropBookmarks: (collectionId: string, bookmarkIds: string[], sourceCollectionId?: string | null, isFromTrash?: boolean) => void;
  onTreeRef: (tree: TreeApi<ArboristNodeData> | undefined) => void;
  onToggle: () => void;
}) {
  const dndManager = useDragDropManager();

  return (
    <Tree<ArboristNodeData>
      ref={props.onTreeRef}
      data={props.arboristData}
      onMove={props.onArboristMove}
      onSelect={(nodes) => {
        const node = nodes[0];
        if (node && !node.data.isGroup) {
          props.onSelectCollection(node.id);
        }
      }}
      onToggle={props.onToggle}
      selection={props.selectedCollectionId ?? undefined}
      disableDrag={(data: ArboristNodeData) => data.isGroup || data.id === "inbox-collection"}
      disableDrop={({ parentNode }: { parentNode: any; dragNodes: any[]; index: number }) => !parentNode}
      disableEdit={true}
      dndManager={dndManager}
      width={props.sidebarWidth - 48}
      height={props.treeHeight}
      indent={12}
      rowHeight={32}
      openByDefault={true}
      className="!overflow-visible"
    >
      {(nodeProps) => (
        <ArboristNode
          {...nodeProps}
          onSelectCollection={(id) => props.onSelectCollection(id)}
          onContextMenu={props.onCollectionContextMenu}
          onSpaceContextMenu={props.onSpaceContextMenu}
          onCreateCollection={props.handleCreateCollectionForSpace}
          onDropBookmarks={props.onDropBookmarks}
        />
      )}
    </Tree>
  );
}

const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 400;

export function Sidebar({
  arboristData,
  domains,
  pinnedDomains,
  selectedCollectionId,
  selectedDomain,
  isViewingTrash,
  isCreatingCollection,
  newCollectionName,
  createCollectionSpaceId,
  setIsCreatingCollection,
  isCreatingGroup,
  setNewCollectionName,
  newGroupName,
  handleCreateCollection,
  setCreateCollectionSpaceId,
  setIsCreatingGroup,
  setNewGroupName,
  handleCreateGroup,
  onSelectCollection,
  onSelectDomain,
  onSelectTrash,
  togglePinDomain,
  onCollectionContextMenu,
  onSpaceContextMenu,
  onArboristMove,
  onDropBookmarks,
  setIsSettingsOpen,
  setIsAdding,
}: SidebarProps) {
  const nothingSelected = !selectedCollectionId && !selectedDomain && !isViewingTrash;
  const treeRef = useRef<TreeApi<ArboristNodeData> | undefined>(undefined);
  const groupInputRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("sidebarWidth");
    return saved ? parseInt(saved, 10) : 256;
  });

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);
  useEffect(() => {
    if (!isCreatingGroup) return;
    const handleClick = (e: MouseEvent) => {
      if (groupInputRef.current && !groupInputRef.current.contains(e.target as Node)) {
        setIsCreatingGroup(false);
        setNewGroupName("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isCreatingGroup, setIsCreatingGroup, setNewGroupName]);

  const initialVisibleCount = useMemo(() => countVisibleNodes(arboristData), [arboristData]);
  const [treeHeight, setTreeHeight] = useState(() => initialVisibleCount * 32);

  useEffect(() => {
    setTreeHeight(initialVisibleCount * 32);
  }, [initialVisibleCount]);

  const updateTreeHeight = useCallback(() => {
    const tree = treeRef.current;
    if (tree) {
      setTreeHeight(tree.visibleNodes.length * 32);
    }
  }, []);

  const handleCreateCollectionForSpace = useCallback(
    (spaceId: string) => {
      setCreateCollectionSpaceId(spaceId);
      setIsCreatingCollection(true);
      setNewCollectionName("");
    },
    [setCreateCollectionSpaceId, setIsCreatingCollection, setNewCollectionName]
  );

  const pinnedDomainItems = domains.filter((d) => pinnedDomains.includes(d.domain));
  const otherDomainItems = domains.filter((d) => !pinnedDomains.includes(d.domain));

  return (
    <div
      ref={sidebarRef}
      className="bg-[#f1f3f5] flex flex-col flex-shrink-0 relative"
      style={{ width: `${sidebarWidth}px`, minWidth: `${MIN_SIDEBAR_WIDTH}px`, maxWidth: `${MAX_SIDEBAR_WIDTH}px` }}
    >
      <div className="p-4 flex items-center justify-between flex-shrink-0">
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

      <div className="px-3 pb-2 flex-shrink-0">
        <button
          onClick={() => setIsAdding(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 px-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Add Bookmark
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
        <div className="px-3 mb-3">
          <button
            onClick={() => { onSelectCollection(null); onSelectDomain(null); }}
            className={cn(
              "w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-sm",
              nothingSelected
                ? "bg-blue-100 text-blue-700 font-medium"
                : "hover:bg-slate-200 text-slate-700"
            )}
          >
            <Globe size={16} className={nothingSelected ? "text-blue-600" : "text-slate-400"} />
            All Bookmarks
          </button>
          <button
            onClick={onSelectTrash}
            className={cn(
              "w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-sm",
              isViewingTrash
                ? "bg-blue-100 text-blue-700 font-medium"
                : "hover:bg-slate-200 text-slate-700"
            )}
          >
            <Trash2 size={16} className={isViewingTrash ? "text-blue-600" : "text-slate-400"} />
            Trash
          </button>
        </div>

        <div className="px-3 mb-1">
          <div className="flex items-center justify-between px-2 mb-1">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Groups
            </div>
            <button
              onClick={() => setIsCreatingGroup(true)}
              className="text-[10px] text-slate-400 hover:text-blue-500 transition-colors"
              title="New group"
            >
              + Group
            </button>
          </div>
          {isCreatingGroup && (
            <div ref={groupInputRef} className="mb-2 px-2">
              <input
                autoFocus
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Group name"
                className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateGroup();
                  else if (e.key === "Escape") { setIsCreatingGroup(false); setNewGroupName(""); }
                }}
              />
            </div>
          )}
        </div>

        <div className="px-3 mb-1">
          <DndProvider backend={TouchBackend} options={{ enableMouseEvents: true, delayTouchStart: 0, delayMouseStart: 0 }}>
            <CollectionTreeInner
              arboristData={arboristData}
              selectedCollectionId={selectedCollectionId}
              treeHeight={treeHeight}
              sidebarWidth={sidebarWidth}
              onSelectCollection={onSelectCollection}
              onCollectionContextMenu={onCollectionContextMenu}
              onSpaceContextMenu={onSpaceContextMenu}
              onArboristMove={onArboristMove}
              handleCreateCollectionForSpace={handleCreateCollectionForSpace}
              onDropBookmarks={onDropBookmarks}
              onTreeRef={(tree) => { treeRef.current = tree; }}
              onToggle={() => { requestAnimationFrame(updateTreeHeight); }}
            />
          </DndProvider>
        </div>

        {isCreatingCollection && createCollectionSpaceId && (
          <div className="px-5 pb-1">
            <input
              autoFocus
              type="text"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              placeholder="Collection name"
              className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateCollection();
                else if (e.key === "Escape") { setIsCreatingCollection(false); setNewCollectionName(""); setCreateCollectionSpaceId(null); }
              }}
            />
          </div>
        )}

        {pinnedDomainItems.length > 0 && (
          <div className="px-3 mb-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
              Pinned
            </div>
            {pinnedDomainItems.map((d) => (
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

        {otherDomainItems.length > 0 && (
          <div className="px-3 mb-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
              Resources
            </div>
            {otherDomainItems.map((d) => (
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

      <div
        className="absolute right-0 top-0 bottom-0 w-2 mr-[-4px] cursor-col-resize z-10 group flex justify-center"
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startWidth = sidebarWidth;
          const handleMouseMove = (moveE: MouseEvent) => {
            const delta = moveE.clientX - startX;
            const newWidth = Math.min(
              MAX_SIDEBAR_WIDTH,
              Math.max(MIN_SIDEBAR_WIDTH, startWidth + delta)
            );
            if (sidebarRef.current) {
              sidebarRef.current.style.width = `${newWidth}px`;
            }
          };
          const cleanup = () => {
            document.body.style.cursor = "";
            document.body.classList.remove("select-none");
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            dragCleanupRef.current = null;
          };
          const handleMouseUp = () => {
            const computedWidth = sidebarRef.current
              ? parseInt(sidebarRef.current.style.width || `${sidebarWidth}`, 10)
              : sidebarWidth;
            setSidebarWidth(computedWidth);
            localStorage.setItem("sidebarWidth", String(computedWidth));
            cleanup();
          };
          dragCleanupRef.current = cleanup;
          document.addEventListener("mousemove", handleMouseMove);
          document.addEventListener("mouseup", handleMouseUp);
          document.body.style.cursor = "col-resize";
          document.body.classList.add("select-none");
        }}
      >
        <div className="h-full transition-all duration-200 w-px bg-transparent group-hover:w-1.5 group-hover:bg-blue-400" />
      </div>
    </div>
  );
}
