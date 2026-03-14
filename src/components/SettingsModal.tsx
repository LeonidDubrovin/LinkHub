import React, { useState, useEffect } from "react";
import { X, Download, Upload, Folder, Globe, Database, Settings } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackup: () => void;
  onRestore: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

type Tab = "general" | "scraper" | "backup";

export function SettingsModal({
  isOpen,
  onClose,
  onBackup,
  onRestore,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [dataDir, setDataDir] = useState("");
  const [userAgent, setUserAgent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/settings")
        .then((res) => res.json())
        .then((data) => {
          if (data.dataDir) setDataDir(data.dataDir);
          if (data.userAgent) setUserAgent(data.userAgent);
        })
        .catch(console.error);
    }
  }, [isOpen]);

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataDir, userAgent }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
      } else {
        alert(data.error || "Failed to save settings");
      }
    } catch (e) {
      alert("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-[500px]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 bg-slate-50 border-r border-slate-100 p-4 flex flex-col gap-1 flex-shrink-0">
            <button
              onClick={() => setActiveTab("general")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "general"
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Settings size={16} />
              General
            </button>
            <button
              onClick={() => setActiveTab("scraper")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "scraper"
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Globe size={16} />
              Web Scraper
            </button>
            <button
              onClick={() => setActiveTab("backup")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "backup"
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Database size={16} />
              Backup & Restore
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === "general" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-slate-900 mb-3">Data Directory</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Choose where your database and application files are stored.
                  </p>
                  
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                      <Folder size={18} className="text-slate-400" />
                      <input
                        type="text"
                        value={dataDir}
                        onChange={(e) => setDataDir(e.target.value)}
                        className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400"
                        placeholder="e.g. C:\LinkHub\Data"
                      />
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={handleSaveSettings}
                  disabled={isSaving || !dataDir || !userAgent}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors mt-6"
                >
                  {isSaving ? "Saving..." : "Save Settings"}
                </button>
              </div>
            )}

            {activeTab === "scraper" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-slate-900 mb-3">Web Scraper</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Set the User-Agent used when fetching link previews and reading content.
                  </p>
                  
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                      <Globe size={18} className="text-slate-400 flex-shrink-0" />
                      <input
                        type="text"
                        value={userAgent}
                        onChange={(e) => setUserAgent(e.target.value)}
                        className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400"
                        placeholder="Mozilla/5.0..."
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button 
                        onClick={() => setUserAgent("Mozilla/5.0 (compatible; Twitterbot/1.0)")}
                        className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded"
                      >
                        Twitterbot (Recommended)
                      </button>
                      <button 
                        onClick={() => setUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")}
                        className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded"
                      >
                        Googlebot
                      </button>
                      <button 
                        onClick={() => setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")}
                        className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded"
                      >
                        Chrome Desktop
                      </button>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={handleSaveSettings}
                  disabled={isSaving || !dataDir || !userAgent}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors mt-6"
                >
                  {isSaving ? "Saving..." : "Save Settings"}
                </button>
              </div>
            )}

            {activeTab === "backup" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-slate-900 mb-3">Backup & Restore</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Backup your bookmarks, categories, and tags to a JSON file, or restore them from a previous backup.
                  </p>
                  
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={onBackup}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium transition-colors"
                    >
                      <Download size={18} />
                      Download Backup
                    </button>
                    
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/backup");
                          const data = await res.json();
                          await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                          alert("Backup copied to clipboard!");
                        } catch (e) {
                          alert("Failed to copy backup to clipboard");
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                      Copy Backup to Clipboard
                    </button>
                    
                    <label className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors cursor-pointer">
                      <input type="file" accept=".json" className="hidden" onChange={onRestore} />
                      <Upload size={18} />
                      Restore from Backup
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
