import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      iconBg: 'bg-[#FEE2E2] text-[#DC2626]',
      button: 'bg-[#DC2626] hover:bg-[#B91C1C] text-[#FFFFFF]',
      border: 'border-[#FECACA]',
    },
    warning: {
      iconBg: 'bg-[#FEF3C7] text-[#D97706]',
      button: 'bg-[#D97706] hover:bg-[#B45309] text-[#FFFFFF]',
      border: 'border-[#FDE68A]',
    },
    primary: {
      iconBg: 'bg-[#CCFBF1] text-[#0F766E]',
      button: 'bg-[#0F766E] hover:bg-[#115E59] text-[#FFFFFF]',
      border: 'border-[#99F6E4]',
    },
  }[variant];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal Dialog with scale(0.96) enter curve */}
      <div
        ref={modalRef}
        className="modal-panel-enter relative w-full max-w-md rounded-xl border border-[#DCE3E0] bg-[#FFFFFF] p-5 shadow-xl"
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${variantStyles.iconBg}`}
          >
            <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
          </div>

          <div className="min-w-0 flex-1">
            <h3 id="confirm-modal-title" className="text-sm font-bold text-[#0F172A]">
              {title}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[#475569]">{description}</p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Tutup dialog"
            className="shrink-0 rounded-md p-1 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-[#F1F5F9] pt-3.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 py-1.5 text-xs font-semibold text-[#334155] hover:bg-[#F8FAFC]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-xs ${variantStyles.button}`}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2} />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
