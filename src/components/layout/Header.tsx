import React from 'react';
import { ShieldCheck, UserCheck, Menu } from '../ui/AppIcons';
import { StaffMember } from '../../types';

interface HeaderProps {
  onOpenSidebar?: () => void;
  onBack?: () => void;
  title?: string;
  currentStaff?: StaffMember | null;
}

const Header: React.FC<HeaderProps> = ({
  onOpenSidebar,
  title = 'إدارة مخزون',
  currentStaff,
}) => {
  const isAdmin = currentStaff?.role === 'admin';

  return (
    <header
      className="app-safe-top sticky top-0 z-40 flex w-full items-center justify-between gap-3 border-b border-slate-200/60 bg-white/80 md:bg-slate-50/90 px-4 py-3 shadow-xs backdrop-blur-md transition-all dark:border-white/[0.06] dark:bg-black/80 sm:px-6 sm:py-3.5"
      dir="rtl"
    >
      <div className="relative z-10 flex min-w-0 items-center gap-3">
        {onOpenSidebar && (
          <button
            type="button"
            onClick={onOpenSidebar}
            className="flex shrink-0 items-center justify-center rounded-[14px] border border-slate-200/60 bg-slate-100 p-2 text-slate-800 shadow-2xs transition-all active:scale-95 dark:border-white/[0.07] dark:bg-neutral-900 dark:text-white md:hidden"
            aria-label="فتح القائمة الرئيسية"
          >
            <Menu size={20} strokeWidth={2} />
          </button>
        )}

        <h1 className="truncate text-[18px] font-bold leading-[1.35] tracking-[-0.01em] text-slate-900 dark:text-white sm:text-[21px]">
          {title}
        </h1>
      </div>

      {currentStaff && (
        <div className="hidden shrink-0 items-center gap-1.5 rounded-[12px] border border-slate-200 bg-white/70 px-3 py-1 text-xs font-bold text-slate-700 dark:border-white/[0.07] dark:bg-neutral-900/70 dark:text-slate-200 sm:inline-flex">
          {isAdmin ? (
            <ShieldCheck size={14} className="text-emerald-500" />
          ) : (
            <UserCheck size={14} className="text-indigo-500" />
          )}
          <span>{currentStaff.name || (isAdmin ? 'المدير' : 'الموظف')}</span>
          <span className="text-[10px] opacity-60">({isAdmin ? 'مدير' : 'موظف'})</span>
        </div>
      )}
    </header>
  );
};

export default React.memo(Header);
