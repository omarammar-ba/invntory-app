import React, { useLayoutEffect, useRef } from 'react';
import type { Category, ViewMode, StaffMember } from '@/types';
import { House, History, Settings2, X, UsersRound, DatabaseBackup, LogOut, Layers } from 'lucide-react';
import { CategorySymbol, categoryTone } from '@/components/ui/CategorySymbol';
import { useIsMobile } from '@/hooks/useMediaQuery';

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

const Sidebar: React.FC<SidebarProps> = ({
  isOpen, onClose, activeTab, onChangeTab, categories, activeCategoryId, activeCategory,
  onChangeCategory, onSelectCategory, onManageCategories, onOpenCategoryManager,
  onOpenSettings, onOpenStaffManager, onOpenBackupModal, currentStaff, onLogout,
}) => {
  const mobile = useIsMobile();
  const asideRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const selected = activeCategoryId || activeCategory;
  const selectCategory = onSelectCategory || onChangeCategory;
  const manageCategories = onOpenCategoryManager || onManageCategories;
  const role = currentStaff?.role ?? null;

  useLayoutEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;
    if (mobile && !isOpen) aside.setAttribute('inert', '');
    else aside.removeAttribute('inert');
    if (!mobile || !isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    aside.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(aside.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [mobile, isOpen]);

  const run = (action: () => void) => { action(); onClose(); };
  const link = (label: string, Icon: typeof House, active: boolean, action: () => void) =>
    <button type="button" className="atelier-menu-link" aria-current={active ? 'page' : undefined} onClick={() => run(action)}>
      <Icon size={21} strokeWidth={1.7} aria-hidden="true" /><span>{label}</span>
    </button>;

  return <>
    {isOpen && <button type="button" className="atelier-menu-backdrop md:hidden" onClick={onClose} aria-label="إغلاق القائمة" tabIndex={-1} />}
    <aside ref={asideRef} className={`atelier-sidebar${isOpen ? ' is-open' : ''}`} dir="rtl" aria-label="القائمة الرئيسية" aria-hidden={mobile && !isOpen ? true : undefined}>
      <header className="atelier-menu-heading">
        <span className="atelier-menu-brand" aria-hidden="true"><Layers size={23} strokeWidth={1.6} /></span>
        <div><strong>نظام المخزون</strong><span>{role === 'admin' ? 'مدير النظام' : 'موظف'}</span></div>
        <button type="button" className="atelier-menu-close md:hidden" onClick={onClose} aria-label="إغلاق القائمة"><X size={20} /></button>
      </header>
      <div className="atelier-menu-content">
        {link('لوحة التحكم الرئيسية', House, activeTab === 'dashboard', () => onChangeTab('dashboard'))}
        <section className="atelier-menu-group">
          <div className="atelier-menu-group-heading"><h2>أقسام المعرض</h2>{manageCategories && <button type="button" onClick={() => manageCategories()} title="إدارة الأقسام">+ تخصيص</button>}</div>
          {categories.filter(category => role !== 'employee' || category.visibleToEmployees === true).map(category =>
            <button type="button" key={category.id} className={`atelier-menu-link atelier-menu-category ${categoryTone(category)}`}
              aria-current={activeTab === 'inventory' && selected === category.id ? 'page' : undefined}
              onClick={() => run(() => { selectCategory?.(category.id); onChangeTab('inventory'); })}>
              <CategorySymbol category={category} size={22} /><span>{category.name}</span>
            </button>)}
        </section>
        <section className="atelier-menu-group"><div className="atelier-menu-group-heading"><h2>العمليات والسجلات</h2></div>
          {link('سجل الحركات والنشاطات', History, activeTab === 'logs', () => onChangeTab('logs'))}
        </section>
        <section className="atelier-menu-group"><div className="atelier-menu-group-heading"><h2>الإدارة والنظام</h2></div>
          {role !== 'employee' && onOpenStaffManager && link('الموظفين', UsersRound, activeTab === 'staff', onOpenStaffManager)}
          {onOpenBackupModal && link('النسخ الاحتياطي', DatabaseBackup, activeTab === 'backup', onOpenBackupModal)}
          {onOpenSettings && link('الإعدادات', Settings2, activeTab === 'settings', onOpenSettings)}
        </section>
      </div>
      {onLogout && <footer className="atelier-menu-footer"><button type="button" onClick={onLogout}><LogOut size={20} strokeWidth={1.7} />تسجيل الخروج</button></footer>}
    </aside>
  </>;
};

export default React.memo(Sidebar);
