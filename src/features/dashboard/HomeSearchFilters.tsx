import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import type { Category, Tile } from '@/types';
import { EMPTY_HOME_FILTERS, normalizeSearch, normalizeSize, type HomeSearchFilters as Filters } from './dashboardModel';

interface Props {
  filters: Filters;
  categories: Category[];
  items: Tile[];
  anchor: HTMLButtonElement | null;
  onApply: (filters: Filters) => void;
  onDismiss: () => void;
}

function choices(items: Tile[], key: 'size' | 'quality' | 'surface'): string[] {
  const values = new Map<string, string>();
  for (const item of items) {
    const value = item[key]?.trim();
    if (value) values.set(key === 'size' ? normalizeSize(value) : normalizeSearch(value), value);
  }
  return [...values.values()].sort((a, b) => a.localeCompare(b, 'ar', { numeric: true }));
}

export default function HomeSearchFilters({ filters, categories, items, anchor, onApply, onDismiss }: Props) {
  const [draft, setDraft] = useState<Filters>({ ...filters });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const groupId = useId();
  const scopedItems = draft.categoryId ? items.filter(item => item.categoryId === draft.categoryId) : items;
  const sizes = choices(scopedItems, 'size');
  const qualities = choices(scopedItems, 'quality');
  const surfaces = choices(scopedItems, 'surface');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const position = () => {
      const rect = anchor?.getBoundingClientRect();
      const height = window.visualViewport?.height || window.innerHeight;
      const top = Math.max(16, Math.min((rect?.bottom || 110) + 16, height - Math.min(540, height - 32)));
      dialog.style.setProperty('--filter-top', `${top}px`);
      dialog.style.setProperty('--filter-left', `${Math.max(16, Math.min(rect?.left || 16, window.innerWidth - 408))}px`);
    };
    position();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    dialog.focus({ preventScroll: true });
    window.addEventListener('resize', position);
    window.visualViewport?.addEventListener('resize', position);
    return () => {
      window.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('resize', position);
      document.body.style.overflow = previousOverflow;
      dialog.close();
      anchor?.focus({ preventScroll: true });
    };
  }, [anchor]);

  const selectCategory = (categoryId: string) => setDraft(previous => ({
    ...previous, categoryId, size: '', quality: '', surface: '',
  }));

  const optionGroup = (key: 'quality' | 'surface', legend: string, options: string[]) => options.length > 0 && (
    <fieldset className="home-filter-group">
      <legend>{legend}</legend>
      <div className="home-filter-segments">
        {['', ...options].map(value => <label key={value} className={draft[key] === value ? 'is-selected' : ''}>
          <input type="radio" name={`${groupId}-${key}`} value={value} checked={draft[key] === value}
            onChange={() => setDraft(previous => ({ ...previous, [key]: value }))} />
          <span>{value || 'الكل'}</span>
        </label>)}
      </div>
    </fieldset>
  );

  return <dialog ref={dialogRef} tabIndex={-1} className="home-filter-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onDismiss(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onDismiss();
    }} dir="rtl">
    <form onSubmit={event => { event.preventDefault(); onApply(draft); }}>
      <div className="home-filter-heading">
        <h2 id={titleId}>تصفية البحث</h2>
        <button type="button" className="home-text-button" onClick={() => setDraft({ ...EMPTY_HOME_FILTERS })}>مسح</button>
        <button type="button" className="home-icon-button" aria-label="إغلاق التصفية دون تطبيق" onClick={onDismiss}><X size={18} /></button>
      </div>
      <fieldset className="home-filter-group">
        <legend>القسم</legend>
        <div className="home-filter-chips">
          {[{ id: '', name: 'الكل' }, ...categories].map(category => <label key={category.id} className={draft.categoryId === category.id ? 'is-selected' : ''}>
            <input type="radio" name={`${groupId}-category`} value={category.id} checked={draft.categoryId === category.id}
              onChange={() => selectCategory(category.id)} />
            <span>{category.name}</span>{draft.categoryId === category.id && <Check size={14} aria-hidden="true" />}
          </label>)}
        </div>
      </fieldset>
      {sizes.length > 0 && <label className="home-filter-group home-size-select">
        <span>المقاس</span>
        <span className="home-select-wrap"><select value={draft.size} onChange={event => setDraft(previous => ({ ...previous, size: event.target.value }))}>
          <option value="">جميع المقاسات</option>
          {sizes.map(size => <option key={size} value={size}>{size}</option>)}
        </select><ChevronDown size={17} aria-hidden="true" /></span>
      </label>}
      {optionGroup('quality', 'النخب', qualities)}
      {optionGroup('surface', 'التشطيب', surfaces)}
      <button type="submit" className="home-primary-button home-filter-apply"><Check size={18} />تطبيق</button>
    </form>
  </dialog>;
}
