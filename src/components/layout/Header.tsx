import React, { useLayoutEffect, useRef } from 'react';
import { Box, ChevronDown, Menu, ShieldCheck, UserRound } from 'lucide-react';
import { Category, StaffMember } from '@/types';
import { orderHomeCategories } from '@/features/dashboard/dashboardModel';

interface HeaderProps {
  onOpenSidebar?: () => void;
  onBack?: () => void;
  title?: string;
  currentStaff?: StaffMember | null;
  categories?: Category[];
  activeCategoryId?: string;
  onSelectCategory?: (id: string) => void;
  showBrandMark?: boolean;
}

function Header({ onOpenSidebar, title = 'إدارة مخزون', currentStaff, categories, activeCategoryId, onSelectCategory, showBrandMark = true }: HeaderProps) {
  const headerRef = useRef<HTMLElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const header = headerRef.current;
    const spacer = spacerRef.current;
    if (!header || !spacer) return;
    const update = () => { spacer.style.height = `${header.getBoundingClientRect().height}px`; };
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return <>
    <header ref={headerRef} className="atelier-header app-safe-top" dir="rtl">
      <div className="atelier-header-brand">{showBrandMark && <span className="atelier-brand-mark" aria-hidden="true"><Box size={29} strokeWidth={1.55} /></span>}
        <div>{categories?.length && onSelectCategory ? <h1 className="header-category-title" aria-label={title}><label><span className="sr-only">القسم الحالي</span><select value={activeCategoryId} onChange={event => onSelectCategory(event.target.value)}>{orderHomeCategories(categories).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select><ChevronDown size={15} aria-hidden="true" /></label></h1> : <h1>{title}</h1>}</div>
      </div>
      <div className="atelier-header-actions">
        {currentStaff && <span className="atelier-staff-badge">{currentStaff.role === 'admin' ? <ShieldCheck size={14} /> : <UserRound size={14} />} {currentStaff.name}</span>}
        {onOpenSidebar && <button type="button" className="atelier-menu-button" onClick={onOpenSidebar} aria-label="فتح القائمة الرئيسية"><Menu size={21} strokeWidth={1.6} /></button>}
      </div>
    </header>
    <div ref={spacerRef} aria-hidden="true" className="shrink-0" />
  </>;
}
export default React.memo(Header);
