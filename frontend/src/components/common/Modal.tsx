'use client';

import { useEffect, useRef, ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-card w-full max-w-md rounded-xl shadow-2xl border border-border animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h3 id="modal-title" className="text-xl font-bold text-foreground">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
        {footer && (
          <div className="p-6 pt-4 border-t border-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
