import React, { useRef } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => Promise<void> | void;
  onCancel: () => void;
  actions?: { label: string; variant?: 'primary' | 'danger' | 'secondary'; onClick: () => Promise<void> | void }[];
}

export function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, actions }: ConfirmDialogProps) {
  const processingRef = useRef(false);

  if (!isOpen) return null;

  const buttonClass = (variant?: 'primary' | 'danger' | 'secondary') => {
    const base = 'px-4 py-2 text-sm font-medium rounded-lg transition-colors';
    switch (variant) {
      case 'danger':
        return `${base} text-white bg-red-600 hover:bg-red-700`;
      case 'secondary':
        return `${base} text-slate-600 hover:bg-slate-100`;
      case 'primary':
      default:
        return `${base} text-white bg-blue-600 hover:bg-blue-700`;
    }
  };

  const handleAction = async (fn: () => Promise<void> | void) => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      await fn();
    } finally {
      processingRef.current = false;
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
          <p className="text-sm text-slate-600 mb-6 whitespace-pre-line">{message}</p>
          <div className="flex justify-end gap-3">
            {actions ? (
              actions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleAction(action.onClick)}
                  className={buttonClass(action.variant)}
                >
                  {action.label}
                </button>
              ))
            ) : (
              <>
                <button
                  onClick={onCancel}
                  className={buttonClass('secondary')}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAction(onConfirm ?? (() => {}))}
                  className={buttonClass('primary')}
                >
                  Confirm
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
