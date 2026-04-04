import React from "react";
import { BookOpen, Globe, Shield, X, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { cn } from "../lib/utils";
import { getDomain } from "../utils";
import { Bookmark, Collection } from "../types";

interface ReaderContent {
  title: string;
  content: string;
  byline: string;
}

interface InspectorPanelProps {
  selectedBookmark: Bookmark | null;
  isInspectorOpen: boolean;
  inspectorWidth: number;
  isDragging: boolean;
  inspectorTab: "details" | "reader" | "web" | "video";
  webPreviewMode: "proxy" | "direct";
  webPreviewKey: number;
  readerContent: ReaderContent | null;
  isReaderLoading: boolean;
  refreshingBookmarkIds: Set<string>;
  isEditingCollections: boolean;
  selectedCollectionIdsForEdit: string[];
  allCollectionsTree: Collection[];
  collectionBookmarkCounts: Map<string, number>;
  onTabChange: (tab: "details" | "reader" | "web" | "video") => void;
  onClose: () => void;
  onResizeStart: (e: React.MouseEvent) => void;
  onLoadReaderView: (bookmark: Bookmark) => void;
  onWebPreviewModeChange: (mode: "proxy" | "direct") => void;
  onWebPreviewKeyChange: (key: number) => void;
  onRefreshBookmark: (id: string) => void;
  onDeleteBookmark: (id: string) => void;
  onUpdateBookmarkCollections: (bookmarkId: string, collectionIds: string[]) => void;
  onToggleEditingCollections: () => void;
  onSelectCollectionForEdit: (id: string, checked: boolean) => void;
  renderCollectionCheckbox: (coll: Collection, level: number) => React.ReactNode;
  getYouTubeId: (url: string) => string | null;
}

export function InspectorPanel({
  selectedBookmark,
  isInspectorOpen,
  inspectorWidth,
  isDragging,
  inspectorTab,
  webPreviewMode,
  webPreviewKey,
  readerContent,
  isReaderLoading,
  refreshingBookmarkIds,
  isEditingCollections,
  selectedCollectionIdsForEdit,
  allCollectionsTree,
  collectionBookmarkCounts,
  onTabChange,
  onClose,
  onResizeStart,
  onLoadReaderView,
  onWebPreviewModeChange,
  onWebPreviewKeyChange,
  onRefreshBookmark,
  onDeleteBookmark,
  onUpdateBookmarkCollections,
  onToggleEditingCollections,
  onSelectCollectionForEdit,
  renderCollectionCheckbox,
  getYouTubeId,
}: InspectorPanelProps) {
  if (!selectedBookmark || !isInspectorOpen) {
    return null;
  }

  return (
    <div
      className="relative border-l border-slate-200 bg-white flex flex-col flex-shrink-0 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]"
      style={{ width: `${inspectorWidth}px`, minWidth: '250px', maxWidth: 'calc(100vw - 300px)' }}
    >
      {/* Resizer Handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-6 -ml-3 cursor-col-resize z-50 group flex justify-center"
        onMouseDown={(e) => {
          e.preventDefault();
          onResizeStart(e);
        }}
      >
        <div className={cn(
          "h-full transition-all duration-200",
          isDragging ? "w-1.5 bg-blue-500" : "w-[1px] bg-transparent group-hover:w-1.5 group-hover:bg-blue-400"
        )} />
      </div>

      <div className="min-h-[56px] py-2 border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0 flex-wrap gap-2">
        <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
          <button
            onClick={() => onTabChange('details')}
            className={cn("px-3 py-1 text-xs font-medium rounded-sm transition-colors", inspectorTab === 'details' ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700")}
          >
            Details
          </button>
          <button
            onClick={() => { onTabChange('reader'); if (!readerContent) onLoadReaderView(selectedBookmark); }}
            className={cn("px-3 py-1 text-xs font-medium rounded-sm transition-colors flex items-center gap-1", inspectorTab === 'reader' ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700")}
          >
            <BookOpen size={12} /> Reader
          </button>
          <button
            onClick={() => onTabChange('web')}
            className={cn("px-3 py-1 text-xs font-medium rounded-sm transition-colors flex items-center gap-1", inspectorTab === 'web' ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700")}
          >
            <Globe size={12} /> Web
          </button>
          {getYouTubeId(selectedBookmark.url) && (
            <button
              onClick={() => onTabChange('video')}
              className={cn("px-3 py-1 text-xs font-medium rounded-sm transition-colors flex items-center gap-1", inspectorTab === 'video' ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-play"><polygon points="6 3 20 12 6 21 6 3"/></svg> Video
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {selectedBookmark && (
            <>
              <button
                onClick={() => onRefreshBookmark(selectedBookmark.id)}
                disabled={refreshingBookmarkIds.has(selectedBookmark.id)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md disabled:opacity-50"
                title="Refresh Bookmark Data"
              >
                <RefreshCw size={16} className={cn(refreshingBookmarkIds.has(selectedBookmark.id) && "animate-spin")} />
              </button>
              <button
                onClick={() => onDeleteBookmark(selectedBookmark.id)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                title="Delete Bookmark"
              >
                <Trash2 size={16} />
              </button>
              <div className="w-px h-4 bg-slate-200 mx-1" />
              <button
                onClick={() => onClose()}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md"
                title="Close Sidebar"
              >
                <X size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        {inspectorTab === 'reader' && (
          <div className="p-6">
            {readerContent ? (
              <>
                <h1 className="text-2xl font-bold text-slate-900 mb-2 leading-tight">
                  {readerContent.title}
                </h1>
                {readerContent.byline && (
                  <p className="text-sm text-slate-500 mb-6">
                    {readerContent.byline}
                  </p>
                )}
                <div
                  className="prose prose-sm prose-slate max-w-none prose-img:rounded-lg prose-a:text-blue-600"
                  dangerouslySetInnerHTML={{ __html: readerContent.content }}
                />
              </>
            ) : (
              <div className="text-center text-slate-500 mt-10">
                <p>Loading reader view...</p>
              </div>
            )}
          </div>
        )}

        {inspectorTab === 'web' && (
          <div className="w-full h-full flex flex-col">
            <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-col gap-2 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onWebPreviewModeChange(webPreviewMode === 'proxy' ? 'direct' : 'proxy')}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1.5 rounded-md font-medium transition-colors",
                      webPreviewMode === 'proxy'
                        ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                        : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    )}
                    title={webPreviewMode === 'proxy' ? "Switch to Direct mode (bypasses Cloudflare but may fail on some sites)" : "Switch to Proxy mode (bypasses iframe restrictions)"}
                  >
                    {webPreviewMode === 'proxy' ? (
                      <><Shield size={14} /> Proxy Mode</>
                    ) : (
                      <><Globe size={14} /> Direct Mode</>
                    )}
                  </button>
                  <span className="text-slate-500 hidden sm:inline">
                    {webPreviewMode === 'proxy'
                      ? "Bypasses iframe restrictions"
                      : "Bypasses Cloudflare checks"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onWebPreviewKeyChange(webPreviewKey + 1)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-md transition-colors font-medium shadow-sm"
                    title="Reload preview"
                  >
                    <RefreshCw size={14} /> Reload Page
                  </button>
                  <a
                    href={selectedBookmark.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium shadow-sm"
                    title="Open in new tab"
                  >
                    <ExternalLink size={14} /> Open Site
                  </a>
                </div>
              </div>
              {webPreviewMode === 'direct' && (
                <div className="bg-amber-50 text-amber-800 px-3 py-2 rounded-md border border-amber-200 flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-triangle shrink-0 mt-0.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                  <p>If the page below is blank or refuses to connect, the website is blocking iframes (X-Frame-Options). Please use <b>Proxy Mode</b> or open the site in a new tab.</p>
                </div>
              )}
            </div>
            <iframe
              key={`${selectedBookmark.id}-${webPreviewMode}-${webPreviewKey}`}
              src={webPreviewMode === 'proxy'
                ? `/api/proxy?url=${encodeURIComponent(selectedBookmark.url)}`
                : selectedBookmark.url}
              className="w-full flex-1 border-0 bg-white"
              title="Web Preview"
            />
          </div>
        )}

        {inspectorTab === 'video' && getYouTubeId(selectedBookmark.url) && (
          <div className="w-full h-full bg-black flex items-center justify-center">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${getYouTubeId(selectedBookmark.url)}?autoplay=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            ></iframe>
          </div>
        )}

        {inspectorTab === 'details' && (
          <div className="p-5 flex flex-col gap-6">
            {selectedBookmark.cover_image_url ? (
              <div className="w-full aspect-video rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                <img
                  src={selectedBookmark.cover_image_url}
                  alt=""
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="w-full aspect-video rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                <img
                  src={`https://image.thum.io/get/width/600/crop/800/${encodeURIComponent(selectedBookmark.url)}`}
                  alt="Screenshot"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            <div>
              <h2 className="text-xl font-bold text-slate-900 leading-tight mb-2">
                {selectedBookmark.title || selectedBookmark.url}
              </h2>
              <a
                href={selectedBookmark.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 hover:underline break-all flex items-center gap-1"
              >
                <img src={`https://www.google.com/s2/favicons?domain=${getDomain(selectedBookmark.url)}&sz=32`} alt="" className="w-4 h-4 rounded-sm" referrerPolicy="no-referrer" />
                {selectedBookmark.url} <ExternalLink size={12} />
              </a>
            </div>

            {selectedBookmark.description && (
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Description
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {selectedBookmark.description}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Collections
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (isEditingCollections) {
                          onUpdateBookmarkCollections(selectedBookmark.id, selectedCollectionIdsForEdit);
                          onToggleEditingCollections();
                        } else {
                          onToggleEditingCollections();
                        }
                      }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {isEditingCollections ? 'Save' : 'Edit'}
                    </button>
                    {isEditingCollections && (
                      <button
                        onClick={() => {
                          onToggleEditingCollections();
                        }}
                        className="text-xs text-slate-500 hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
                {isEditingCollections ? (
                  <div className="space-y-1 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2">
                    {allCollectionsTree.length === 0 ? (
                      <div className="text-xs text-slate-400 px-2">No collections</div>
                    ) : (
                      allCollectionsTree.map(coll => renderCollectionCheckbox(coll, 0))
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {(selectedBookmark.collections || []).map((coll: any) => (
                      <div key={coll.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: coll.color }}
                        />
                        {coll.name}
                      </div>
                    ))}
                    {(selectedBookmark.collections || []).length === 0 && (
                      <span className="text-sm text-slate-400">No collections</span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Added
                </div>
                <div className="text-sm text-slate-700">
                  {format(
                    new Date(selectedBookmark.created_at),
                    "MMM d, yyyy",
                  )}
                </div>
              </div>
            </div>

            {selectedBookmark.tags && selectedBookmark.tags.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Tags
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedBookmark.tags.map((tag: any) => (
                    <span
                      key={tag.id}
                      className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-md border border-slate-200"
                    >
                      #{tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {isReaderLoading && inspectorTab === 'reader' && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>
    </div>
  );
}
