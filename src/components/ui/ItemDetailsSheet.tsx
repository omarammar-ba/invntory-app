import React, { useMemo, useRef, useState } from 'react';
import { Bookmark, ChevronLeft, Pencil } from 'lucide-react';
import type { Category, LogEntry, Tile } from '@/types';
import { ResponsiveOverlay } from './ResponsiveOverlay';
import ActivityTimeline from './ActivityTimeline';
import CategoryPreview from './CategoryPreview';
import { calculateAvailableQuantity, calculateReservedQuantity } from '@/features/inventory/inventoryCalculations';
import { getLogDate } from '@/features/dashboard/dashboardModel';

export interface ItemSelection { name: string; categoryId?: string; }
export default function ItemDetailsSheet({ selection, tiles, logs, categories, onClose, onExited, onEdit, onReserve, onViewHistory }: {
  selection: ItemSelection | null; tiles: Tile[]; logs: LogEntry[]; categories: Category[];
  onClose: () => void; onExited?: () => void; onEdit?: (tile: Tile) => void;
  onReserve?: (tile: Tile) => void; onViewHistory?: (name: string) => void;
}) {
  const pendingAction = useRef<(() => void) | null>(null);
  const [choice, setChoice] = useState<{ selection: ItemSelection; categoryId: string; id: string } | null>(null);
  const matches = useMemo(() => selection ? tiles.filter(item => item.name === selection.name && (!selection.categoryId || item.categoryId === selection.categoryId)) : [], [selection, tiles]);
  // A log has a code/category, not an immutable item id. Never guess between variants.
  const tile = choice?.selection === selection
    ? matches.find(item => item.categoryId === choice.categoryId && item.id === choice.id)
    : matches.length === 1 ? matches[0] : undefined;
  const category = categories.find(entry => entry.id === (tile?.categoryId || selection?.categoryId));
  const recent = useMemo(() => selection ? logs.filter(log => log.tileName === selection.name && (!selection.categoryId || log.categoryId === selection.categoryId))
    .map((log, index) => ({ log, index })).sort((a, b) => (getLogDate(b.log.timestamp)?.getTime() || 0) - (getLogDate(a.log.timestamp)?.getTime() || 0) || a.index - b.index).map(entry => entry.log) : [], [logs, selection]);
  const unit = (tile?.unitType || category?.defaultUnit) === 'pieces' ? 'قطعة' : 'م²';
  const format = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  const act = (callback: (item: Tile) => void) => { if (tile) { pendingAction.current = () => callback(tile); onClose(); } };
  const afterExit = () => { const action = pendingAction.current; pendingAction.current = null; if (action) action(); else onExited?.(); };
  return <ResponsiveOverlay open={selection !== null} onClose={onClose} onExited={afterExit} title="تفاصيل الصنف" mobileSnap="large" desktopMaxWidth="max-w-xl" contentClassName="item-inspector app-readable"
    footer={tile && (onEdit || onReserve) ? <div className="item-inspector-actions">{onEdit && <button type="button" className="home-primary-button" onClick={() => act(onEdit)}><Pencil size={17} />تعديل الصنف</button>}{onReserve && <button type="button" className="home-secondary-button" onClick={() => act(onReserve)}><Bookmark size={17} />الحجوزات</button>}</div> : undefined}>
    <header className="item-inspector-identity"><div>{category && <p>{category.name}</p>}<h3><bdi>{selection?.name}</bdi></h3><span>{[tile?.size, tile?.quality, tile?.surface].filter(Boolean).join(' · ')}</span></div>{category && <CategoryPreview category={category} image={tile?.image} />}</header>
    {(matches.length > 1 || (matches.length === 1 && !tile)) && <section className="item-inspector-variants" aria-label="اختيار الصنف الحالي">
      <p>{matches.length > 1 ? 'يوجد أكثر من صنف بهذا الكود. اختر الصنف الحالي حسب تفاصيله قبل التعديل أو الحجز.' : 'الصنف الذي اخترته لم يعد متاحًا. اختر الصنف الموجود حاليًا للمتابعة.'}</p>
      <div role="group" aria-label="الأصناف المطابقة للكود">{matches.map(item => <button type="button" key={JSON.stringify([item.categoryId, item.id])} aria-pressed={tile?.categoryId === item.categoryId && tile?.id === item.id} onClick={() => selection && setChoice({ selection, categoryId: item.categoryId, id: item.id })}>
        <strong>{[categories.find(entry => entry.id === item.categoryId)?.name, item.size, item.shade && `شيد ${item.shade}`, item.quality, item.surface].filter(Boolean).join(' · ') || item.name}</strong>
        <span>معرّف الصنف: <bdi>{item.id}</bdi></span>
      </button>)}</div>
    </section>}
    {tile ? <>
      <dl className="item-inspector-balance"><div><dt>المتاح الآن</dt><dd><bdi>{format(calculateAvailableQuantity(tile))}</bdi><span>{unit}</span></dd></div><div><dt>المحجوز</dt><dd><bdi>{format(calculateReservedQuantity(tile))}</bdi><span>{unit}</span></dd></div><div><dt>الإجمالي</dt><dd><bdi>{format(Number(tile.meters) || 0)}</bdi><span>{unit}</span></dd></div></dl>
      <dl className="item-inspector-specs">{[['كود الشيد', tile.shade], ['اللون', tile.color], ['الماركة', tile.brand], ['النوع', tile.itemType], ['المادة', tile.materialOrGlass], ...(tile.customFieldSnapshot || []).map(field => [field.label, `${field.value} ${field.suffix || ''}`])].map(([label, value], index) => value && <div key={index}><dt>{label}</dt><dd><bdi>{value}</bdi></dd></div>)}</dl>
      {tile.notes && <p className="item-inspector-note">{tile.notes}</p>}
    </> : matches.length === 0 && <p className="item-inspector-note">هذا الصنف غير موجود حاليًا في المخزون. الحركات المسجّلة له محفوظة أدناه.</p>}
    {recent.length > 0 && <section className="item-inspector-history"><div><h4>آخر حركات الكود</h4>{onViewHistory && <button type="button" className="home-text-button" onClick={() => { const name = selection?.name; if (name) pendingAction.current = () => onViewHistory(name); onClose(); }}>السجل الكامل<ChevronLeft size={14} /></button>}</div><ActivityTimeline logs={recent.slice(0, 3)} categories={categories} /></section>}
  </ResponsiveOverlay>;
}
