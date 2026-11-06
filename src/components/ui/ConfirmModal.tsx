import React, { useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { WarningIcon } from './Icons';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, message }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    cancelRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="m-auto w-[calc(100%-2rem)] max-w-sm overflow-auto rounded-[22px] border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm dark:border-white/[0.07] dark:bg-neutral-900"
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      dir="rtl"
    >
      <div className="p-6 text-center">
        <div className="flex justify-center mb-3 text-rose-500">
            <WarningIcon />
        </div>
        <h2 id={titleId} className="text-base font-bold text-slate-800 dark:text-white">تأكيد الحذف</h2>
        <p id={messageId} className="my-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{message}</p>
        <div className="flex justify-center gap-3 mt-5">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-[12px] text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 transition-all cursor-pointer active:scale-[0.97]"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-[12px] text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-2xs transition-all cursor-pointer active:scale-[0.97]"
          >
            حذف
          </button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
};

export default ConfirmModal;
