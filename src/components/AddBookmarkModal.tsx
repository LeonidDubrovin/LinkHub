import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Icon } from './Icon';
import { Collection } from '../types';

interface AddBookmarkModalProps {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (urls: string, collectionIds?: string[]) => void;
  collections?: Collection[];
  defaultCollectionIds?: string[];
}

export function AddBookmarkModal({ 
  isOpen, 
  isLoading, 
  onClose, 
  onSubmit, 
  collections = [],
  defaultCollectionIds = [] 
}: AddBookmarkModalProps) {
  const [newUrls, setNewUrls] = useState("");
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(defaultCollectionIds);

  // Build tree from flat collections list
  const buildCollectionTree = (items: Collection[], parentId: string | null = null): Collection[] => {
    return items
      .filter(item => item.parent_id === parentId)
      .map(item => ({
        ...item,
        children: buildCollectionTree(items, item.id)
      }));
  };

  const treeCollections = React.useMemo(() => buildCollectionTree(collections), [collections]);

  const renderCollectionNode = (coll: Collection, level: number) => (
    <div key={coll.id} style={{ paddingLeft: `${level * 12}px` }}>
      <label className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
        <input
          type="checkbox"
          checked={selectedCollectionIds.includes(coll.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedCollectionIds(prev => [...prev, coll.id]);
            } else {
              setSelectedCollectionIds(prev => prev.filter(id => id !== coll.id));
            }
          }}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <Icon name={coll.icon || "Folder"} size={14} color={coll.color} />
        <span className="truncate">{coll.name}</span>
      </label>
      {coll.children && coll.children.length > 0 && (
        <div>
          {coll.children.map(child => renderCollectionNode(child, level + 1))}
        </div>
      )}
    </div>
  );

  useEffect(() => {
    if (isOpen) {
      setNewUrls("");
      setSelectedCollectionIds(defaultCollectionIds);
      navigator.clipboard.readText().then(text => {
        if (text) {
          const lines = text.split('\n').map(l => l.trim()).filter(l => l);
          const hasUrls = lines.some(l => l.startsWith('http://') || l.startsWith('https://'));
          if (hasUrls) {
            setNewUrls(text);
          }
        }
      }).catch(err => {
        console.error("Failed to read clipboard", err);
      });
    }
  }, [isOpen, defaultCollectionIds]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrls) return;
    // If no collection selected, we don't pass anything (backend defaults to Inbox)
    const collectionIds = selectedCollectionIds.length > 0 ? selectedCollectionIds : undefined;
    onSubmit(newUrls, collectionIds);
    setNewUrls("");
    setSelectedCollectionIds([]);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-lg">Add New Bookmark</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>
         <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              URLs (one per line)
            </label>
            <textarea
              required
              autoFocus
              placeholder="https://example.com/article&#10;https://example.com/video"
              value={newUrls}
              onChange={(e) => setNewUrls(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
            <p className="text-xs text-slate-500 mt-2">
              Paste multiple URLs separated by new lines. We'll automatically fetch titles and descriptions.
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Collections
            </label>
            <div className="space-y-1 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2">
              {treeCollections.length === 0 ? (
                <div className="text-xs text-slate-400 px-2">No collections</div>
              ) : (
                treeCollections.map(coll => renderCollectionNode(coll, 0))
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              If none selected, bookmark will be added to Inbox.
            </p>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !newUrls}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>{" "}
                  Analyzing...
                </>
              ) : (
                "Save Bookmark"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
