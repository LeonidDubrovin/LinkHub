import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ToastProps {
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  onClose: () => void;
}

export function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => onClose(), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300" role="alert" aria-live="assertive">
      <div className={cn(
        "px-4 py-3 rounded-lg shadow-lg border flex items-center gap-3",
        toast.type === 'success' ? "bg-green-50 border-green-200 text-green-800" : 
        toast.type === 'error' ? "bg-red-50 border-red-200 text-red-800" : 
        "bg-blue-50 border-blue-200 text-blue-800"
      )}>
        {toast.type === 'success' ? <div className="w-2 h-2 rounded-full bg-green-500" /> : 
         toast.type === 'error' ? <div className="w-2 h-2 rounded-full bg-red-500" /> : 
         <div className="w-2 h-2 rounded-full bg-blue-500" />}
        <p className="text-sm font-medium">{toast.message}</p>
        <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
