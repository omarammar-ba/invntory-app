import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { MotionModal } from '@/components/motion/MotionModal';
import { StaffRole } from '@/types';
import {
  CheckIcon,
  DatabaseIcon,
  FolderIcon,
  MoonIcon,
  SunIcon,
  UserIcon,
  UsersIcon,
} from '@/components/ui/Icons';

interface SettingsModalProps {
  isOpen?: boolean;
  isPage?: boolean;
  onClose: () => void;
  userRole?: StaffRole;
  userName?: string;
  theme?: 'light' | 'dark';
  isDarkMode?: boolean;
  currentThemeMode?: 'light' | 'dark';
  onToggleTheme?: (theme?: string) => void;
  onOpenStaffManager?: () => void;
  onOpenBackupModal?: () => void;
  onOpenCategoryManager?: (catId?: string | null) => void;
  categories?: any[];
  currentStaff?: any;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen = true,
  isPage = false,
  onClose,
  userRole = 'admin',
  userName = 'المدير',
  theme,
  isDarkMode,
  currentThemeMode,
  onToggleTheme,
  onOpenStaffManager,
  onOpenBackupModal,
  onOpenCategoryManager,
  currentStaff,
}) => {
  if (!isOpen && !isPage) return null;

  const currentDisplayName = currentStaff?.name || userName || 'المستخدم';
  const activeTheme = theme || currentThemeMode || (isDarkMode ? 'dark' : 'light');
  const isAdmin = (currentStaff?.role ?? userRole) === 'admin';

  const handleSetTheme = (targetTheme: 'light' | 'dark') => {
    onToggleTheme?.(targetTheme);
  };

  const content = (
    <div className="space-y-4" dir="rtl">
      <section className="overflow-hidden rounded-[18px] border border-slate-200/70 bg-white shadow-sm dark:border-white/[0.07] dark:bg-neutral-900">
        <div className="flex items-center gap-3 px-3.5 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-slate-300">
            <UserIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="break-words text-sm font-bold text-slate-900 dark:text-white">{currentDisplayName}</h3>
            <p className="mt-0.5 text-[10px] font-medium text-slate-400">
              {isAdmin ? 'مدير' : 'موظف'} • حساب Firebase موثّق
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 px-1 text-xs font-bold text-slate-500 dark:text-slate-400">المظهر</h2>
        <div className="grid grid-cols-2 gap-2 rounded-[18px] border border-slate-200/70 bg-white p-2 shadow-sm dark:border-white/[0.07] dark:bg-neutral-900">
          <button
            type="button"
            onClick={() => handleSetTheme('light')}
            className={`flex h-11 items-center justify-center gap-2 rounded-[12px] text-xs font-bold transition ${
              activeTheme === 'light'
                ? 'bg-slate-100 text-slate-900 dark:bg-neutral-800 dark:text-white'
                : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-neutral-800/60'
            }`}
          >
            <SunIcon className="h-4 w-4 text-amber-500" />
            فاتح
            {activeTheme === 'light' && <CheckIcon />}
          </button>
          <button
            type="button"
            onClick={() => handleSetTheme('dark')}
            className={`flex h-11 items-center justify-center gap-2 rounded-[12px] text-xs font-bold transition ${
              activeTheme === 'dark'
                ? 'bg-slate-100 text-slate-900 dark:bg-neutral-800 dark:text-white'
                : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-neutral-800/60'
            }`}
          >
            <MoonIcon className="h-4 w-4 text-indigo-400" />
            داكن
            {activeTheme === 'dark' && <CheckIcon />}
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 px-1 text-xs font-bold text-slate-500 dark:text-slate-400">الإدارة</h2>
        <div className="divide-y divide-slate-100 overflow-hidden rounded-[18px] border border-slate-200/70 bg-white shadow-sm dark:divide-white/[0.05] dark:border-white/[0.07] dark:bg-neutral-900">
          {onOpenCategoryManager && (
            <button
              type="button"
              onClick={() => {
                onOpenCategoryManager();
                if (!isPage) onClose();
              }}
              className="flex min-h-14 w-full items-center gap-3 px-3.5 py-3 text-right transition-colors hover:bg-slate-50/70 dark:hover:bg-neutral-800/40"
            >
              <FolderIcon className="h-4 w-4 shrink-0 text-sky-500" />
              <span className="min-w-0 flex-1 text-xs font-bold text-slate-900 dark:text-white">إدارة الأقسام</span>
              <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          )}

          {isAdmin && onOpenStaffManager && (
            <button
              type="button"
              onClick={() => {
                onOpenStaffManager();
                if (!isPage) onClose();
              }}
              className="flex min-h-14 w-full items-center gap-3 px-3.5 py-3 text-right transition-colors hover:bg-slate-50/70 dark:hover:bg-neutral-800/40"
            >
              <UsersIcon className="h-4 w-4 shrink-0 text-violet-500" />
              <span className="min-w-0 flex-1 text-xs font-bold text-slate-900 dark:text-white">الموظفين</span>
              <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          )}

          {onOpenBackupModal && (
            <button
              type="button"
              onClick={() => {
                onOpenBackupModal();
                if (!isPage) onClose();
              }}
              className="flex min-h-14 w-full items-center gap-3 px-3.5 py-3 text-right transition-colors hover:bg-slate-50/70 dark:hover:bg-neutral-800/40"
            >
              <DatabaseIcon className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="min-w-0 flex-1 text-xs font-bold text-slate-900 dark:text-white">النسخ الاحتياطي</span>
              <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          )}
        </div>
      </section>
    </div>
  );

  if (isPage) return <div className="mt-2 animate-fade-in">{content}</div>;

  return (
    <MotionModal className="w-full max-w-lg overflow-hidden rounded-[22px] border border-slate-200/70 bg-slate-50 p-4 shadow-2xl dark:border-white/[0.07] dark:bg-neutral-950 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">الإعدادات</h2>
        <button type="button" onClick={onClose} className="h-9 rounded-[11px] bg-white px-3 text-[11px] font-bold text-slate-500 dark:bg-neutral-900 dark:text-slate-300">إغلاق</button>
      </div>
      {content}
    </MotionModal>
  );
};

export default SettingsModal;
