import React from 'react';
import { WarningIcon } from './Icons';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, message }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center z-[300] p-4 transition-opacity duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      dir="rtl"
    >
      <div
        className="relative p-6 bg-white dark:bg-neutral-900 rounded-[22px] shadow-2xl max-w-sm w-full mx-4 text-center border border-slate-200/60 dark:border-white/[0.07] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-3 text-rose-500">
            <WarningIcon />
        </div>
        <h2 id="confirm-dialog-title" className="text-base font-bold text-slate-800 dark:text-white">تأكيد الحذف</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 my-3 font-normal leading-relaxed">{message}</p>
        <div className="flex justify-center gap-3 mt-5">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-[12px] text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 transition-all cursor-pointer active:scale-[0.97]"
          >
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-[12px] text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-2xs transition-all cursor-pointer active:scale-[0.97]"
          >
            حذف
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
