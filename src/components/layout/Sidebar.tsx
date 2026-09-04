import React from 'react';
import { Category, ViewMode, CategoryTheme, StaffMember } from '../../types';
import { 
  House, 
  History, 
  Settings2, 
  X,
  UsersRound, 
  DatabaseBackup, 
  FolderCog, 
  LogOut,
  Grid3X3,
  LayoutGrid,
  PanelsTopLeft,
  ShowerHead,
  Layers
} from '../ui/AppIcons';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: ViewMode | string;
  onChangeTab: (tab: ViewMode) => void;
  categories: Category[];
  activeCategoryId?: string;
  activeCategory?: string;
  onChangeCategory?: (id: string) => void;
  onSelectCategory?: (id: string) => void;
  onManageCategories?: () => void;
  onOpenCategoryManager?: (categoryId?: string | null) => void;
  onOpenSettings?: () => void;
  onOpenStaffManager?: () => void;
  onOpenBackupModal?: () => void;
  currentStaff?: StaffMember | null;
  userEmail?: string;
  onLogout?: () => void;
}

const getCategoryIconDetails = (id: string, isActive: boolean = false) => {
  if (id === 'tiles' || id === 'porcelain') {
    return { Icon: Grid3X3, colorClass: isActive ? 'text-sky-500 dark:text-sky-400 font-bold scale-105' : 'text-sky-500/75 dark:text-sky-400/65 hover:scale-105 transition-transform' };
  }
  if (id === 'ceramics' || id === 'ceramic') {
    return { Icon: LayoutGrid, colorClass: isActive ? 'text-amber-500 dark:text-amber-400 font-bold scale-105' : 'text-amber-500/75 dark:text-amber-400/65 hover:scale-105 transition-transform' };
  }
  if (id === 'shower_box') {
    return { Icon: PanelsTopLeft, colorClass: isActive ? 'text-teal-500 dark:text-teal-400 font-bold scale-105' : 'text-teal-500/75 dark:text-teal-400/65 hover:scale-105 transition-transform' };
  }
  if (id === 'mixers') {
    return { Icon: ShowerHead, colorClass: isActive ? 'text-indigo-500 dark:text-indigo-400 font-bold scale-105' : 'text-indigo-500/75 dark:text-indigo-400/65 hover:scale-105 transition-transform' };
  }
  return { Icon: FolderCog, colorClass: isActive ? 'text-purple-500 dark:text-purple-400 font-bold scale-105' : 'text-purple-500/75 dark:text-purple-400/65 hover:scale-105 transition-transform' };
};

const Sidebar: React.FC<SidebarProps> = ({
  isOpen, 
  onClose, 
  activeTab, 
  onChangeTab, 
  categories, 
  activeCategoryId, 
  activeCategory,
  onChangeCategory, 
  onSelectCategory,
  onManageCategories,
  onOpenCategoryManager,
  onOpenSettings,
  onOpenStaffManager,
  onOpenBackupModal,
  currentStaff,
  onLogout
}) => {
  const currentActiveCategory = activeCategoryId || activeCategory;
  const selectCatHandler = onSelectCategory || onChangeCategory;
  const manageCatHandler = onOpenCategoryManager || onManageCategories;

  const staffRole = currentStaff?.role ?? null;

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] transition-opacity md:hidden"
          onClick={onClose}
          aria-hidden="true"
        ></div>
      )}

      <aside 
        className={`fixed top-0 right-0 h-[100dvh] bg-white md:bg-slate-50 dark:bg-neutral-900 w-72 shadow-2xl z-[210] transform transition-transform duration-300 ease-in-out border-l border-slate-200/60 dark:border-white/[0.07] flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'} md:translate-x-0 md:sticky md:top-0 md:h-[100dvh] md:w-64 md:shadow-none flex-shrink-0`}
        dir="rtl"
      >
        <div className="pt-[calc(1rem+env(safe-area-inset-top))] px-4 pb-4 sm:pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-5 sm:pb-5 border-b border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-[40px] h-[40px] bg-slate-100 dark:bg-neutral-800 rounded-[14px] flex items-center justify-center text-slate-800 dark:text-slate-200 shadow-sm flex-shrink-0">
               <Layers size={20} strokeWidth={2.2} />
             </div>
             <div className="text-right flex flex-col justify-center">
               <span className="text-[14px] text-slate-900 dark:text-white font-bold tracking-tight">نظام المخزون</span>
               <div className="flex items-center gap-1.5 mt-0.5">
                 <span className={`w-1.5 h-1.5 rounded-full ${staffRole === 'admin' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                 <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                   {staffRole === 'admin' ? 'مدير النظام' : 'موظف'}
                 </span>
               </div>
             </div>
          </div>
          <button 
            onClick={onClose} 
            className="md:hidden p-2 bg-slate-100 dark:bg-neutral-800 text-slate-500 rounded-[12px] hover:bg-slate-200"
            aria-label="إغلاق القائمة"
          >
             <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
          <div className="space-y-1">
             <button 
                onClick={() => { onChangeTab('dashboard'); onClose(); }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-[16px] font-semibold transition-all text-[13px] cursor-pointer active:scale-[0.98] ${activeTab === 'dashboard' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800'}`}
             >
                <House size={22} strokeWidth={2} className={`flex-shrink-0 ${activeTab === 'dashboard' ? 'text-amber-500 dark:text-amber-400' : 'text-amber-500/70 dark:text-amber-400/60'}`} />
                <span>لوحة التحكم الرئيسية</span>
             </button>
          </div>

          <div>
            <div className="px-2 mb-2 flex items-center justify-between text-[11px] font-semibold text-slate-400 dark:text-slate-500">
               <span className="flex items-center gap-1.5">
                 <FolderCog size={16} strokeWidth={2} className="text-indigo-500 dark:text-indigo-400" />
                 أقسام المعرض
               </span>
               {manageCatHandler && (
                 <button 
                   onClick={() => manageCatHandler && manageCatHandler()} 
                   className="text-slate-600 dark:text-slate-300 hover:underline text-[11px] font-semibold cursor-pointer"
                   title="إدارة الأقسام"
                 >
                   + تخصيص
                 </button>
               )}
            </div>
            <div className="space-y-1">
               {categories
                 .filter(cat => staffRole !== 'employee' || cat.visibleToEmployees === true)
                 .map(cat => {
                   const isActive = activeTab === 'inventory' && currentActiveCategory === cat.id;
                   const { Icon: CatIcon, colorClass } = getCategoryIconDetails(cat.id, isActive);

                   return (
                     <button 
                       key={cat.id} 
                       onClick={() => { 
                         if (selectCatHandler) selectCatHandler(cat.id);
                         if (onChangeTab) onChangeTab('inventory'); 
                         onClose(); 
                       }}
                       className={`w-full flex items-center justify-between px-4 py-3 rounded-[15px] font-semibold transition-all text-[13px] cursor-pointer active:scale-[0.98] ${isActive ? 'bg-slate-100 dark:bg-neutral-800 text-slate-900 dark:text-white font-bold border-r-4 border-slate-700 dark:border-slate-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-neutral-800/60'}`}
                     >
                       <div className="flex items-center gap-2.5">
                         <CatIcon size={20} strokeWidth={2} className={`flex-shrink-0 ${colorClass}`} />
                         <span className="truncate">{cat.name}</span>
                       </div>
                     </button>
                   );
                 })}
            </div>
          </div>

          <div>
            <div className="px-2 mb-2 flex items-center justify-between text-[11px] font-semibold text-slate-400 dark:text-slate-500">
               <span>العمليات والسجلات</span>
            </div>
            <div className="space-y-1">
               <button 
                  onClick={() => { onChangeTab('logs'); onClose(); }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-[16px] font-semibold transition-all text-[13px] cursor-pointer active:scale-[0.98] ${activeTab === 'logs' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800'}`}
               >
                  <History size={22} strokeWidth={2} className={`flex-shrink-0 ${activeTab === 'logs' ? 'text-sky-500 dark:text-sky-400' : 'text-sky-500/70 dark:text-sky-400/60'}`} />
                  <span>سجل الحركات والنشاطات</span>
               </button>
            </div>
          </div>

          <div>
            <div className="px-2 mb-2 flex items-center justify-between text-[11px] font-semibold text-slate-400 dark:text-slate-500">
               <span>الإدارة والنظام</span>
            </div>
            <div className="space-y-1">
               {staffRole !== 'employee' && onOpenStaffManager && (
                 <button 
                    onClick={() => { onOpenStaffManager(); onClose(); }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-[16px] font-semibold transition-all text-[13px] cursor-pointer active:scale-[0.98] ${activeTab === 'staff' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800'}`}
                 >
                    <UsersRound size={22} strokeWidth={2} className={`flex-shrink-0 ${activeTab === 'staff' ? 'text-violet-500 dark:text-violet-400' : 'text-violet-500/70 dark:text-violet-400/60'}`} />
                    <span>الموظفين</span>
                 </button>
               )}
               {onOpenBackupModal && (
                 <button 
                    onClick={() => { onOpenBackupModal(); onClose(); }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-[16px] font-semibold transition-all text-[13px] cursor-pointer active:scale-[0.98] ${activeTab === 'backup' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800'}`}
                 >
                    <DatabaseBackup size={22} strokeWidth={2} className={`flex-shrink-0 ${activeTab === 'backup' ? 'text-emerald-500 dark:text-emerald-400' : 'text-emerald-500/70 dark:text-emerald-400/60'}`} />
                    <span>النسخ الاحتياطي</span>
                 </button>
               )}
               {onOpenSettings && (
                 <button 
                    onClick={() => { onOpenSettings(); onClose(); }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-[16px] font-semibold transition-all text-[13px] cursor-pointer active:scale-[0.98] ${activeTab === 'settings' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800'}`}
                 >
                    <Settings2 size={22} strokeWidth={2} className={`flex-shrink-0 ${activeTab === 'settings' ? 'text-amber-500 dark:text-amber-400' : 'text-amber-500/70 dark:text-amber-400/60'}`} />
                    <span>الإعدادات</span>
                 </button>
               )}
            </div>
          </div>
        </div>

        {onLogout && (
          <div className="pt-3 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-slate-200/60 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-[16px] text-[13px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors cursor-pointer border border-rose-200/60 dark:border-rose-900/40 active:scale-[0.97]"
            >
              <LogOut size={20} strokeWidth={2} className="text-rose-500 dark:text-rose-400" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default React.memo(Sidebar);
