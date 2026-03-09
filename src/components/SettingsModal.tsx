import React from "react";
import { X, Download, Upload } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackup: () => void;
  onRestore: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  onBackup,
  onRestore,
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
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
              
              <label className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors cursor-pointer">
                <input type="file" accept=".json" className="hidden" onChange={onRestore} />
                <Upload size={18} />
                Restore from Backup
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
