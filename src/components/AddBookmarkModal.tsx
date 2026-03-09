import React, { useState } from 'react';
import { X } from 'lucide-react';

interface AddBookmarkModalProps {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (urls: string) => void;
}

export function AddBookmarkModal({ isOpen, isLoading, onClose, onSubmit }: AddBookmarkModalProps) {
  const [newUrls, setNewUrls] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrls) return;
    onSubmit(newUrls);
    setNewUrls("");
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
              Paste multiple URLs separated by new lines. We'll automatically fetch titles, descriptions, and use AI to categorize them.
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
