import React, { useRef, useEffect } from 'react';
import { X, CheckCircle2, RotateCcw, AlertCircle, Link2 } from 'lucide-react';
import { CreateBookmarkResult } from '../services/api';

interface BulkAddResultModalProps {
  isOpen: boolean;
  urls: string[];
  results: CreateBookmarkResult[];
  onClose: () => void;
}

export function BulkAddResultModal({ isOpen, urls, results, onClose }: BulkAddResultModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const map = new Map<string, CreateBookmarkResult>();
  urls.forEach((url, i) => map.set(url, results[i] ?? { success: false, error: 'No result' }));

  const added = urls.filter(u => { const r = map.get(u)!; return r.success && r.id && !r.restored && !r.exists; });
  const restored = urls.filter(u => { const r = map.get(u)!; return r.restored; });
  const existing = urls.filter(u => { const r = map.get(u)!; return r.exists && !r.restored; });
  const failed = urls.filter(u => { const r = map.get(u)!; return !r.success && !r.exists; });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={modalRef} className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-lg">Import Results</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {/* Added */}
          {added.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-green-700 font-medium text-sm mb-1">
                <CheckCircle2 size={16} />
                <span>Added ({added.length})</span>
              </div>
              <ul className="space-y-1">
                {added.map(url => (
                  <li key={url} className="text-sm text-slate-600 truncate pl-6" title={url}>{url}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Restored */}
          {restored.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-blue-700 font-medium text-sm mb-1">
                <RotateCcw size={16} />
                <span>Restored from trash ({restored.length})</span>
              </div>
              <ul className="space-y-1">
                {restored.map(url => (
                  <li key={url} className="text-sm text-slate-600 truncate pl-6" title={url}>{url}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Existing */}
          {existing.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-1">
                <Link2 size={16} />
                <span>Already existed ({existing.length})</span>
              </div>
              <ul className="space-y-1">
                {existing.map(url => (
                  <li key={url} className="text-sm text-slate-600 truncate pl-6" title={url}>{url}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Failed */}
          {failed.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-1">
                <AlertCircle size={16} />
                <span>Failed ({failed.length})</span>
              </div>
              <ul className="space-y-1">
                {failed.map(url => {
                  const r = map.get(url)!;
                  return (
                    <li key={url} className="text-sm text-slate-600 pl-6" title={r.error || url}>
                      <span className="truncate block">{url}</span>
                      {r.error && <span className="text-xs text-red-500">{r.error}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
