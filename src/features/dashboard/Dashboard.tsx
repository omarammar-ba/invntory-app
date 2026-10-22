import React, { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Bookmark, ChevronDown, ChevronLeft,
  History, PackageOpen, Pencil, Search, SlidersHorizontal, X,
} from 'lucide-react';
import type { Category, LogEntry, StaffMember, Tile } from '@/types';
import { motionEase } from '@/styles/motion';
import HomeSearchFilters from './HomeSearchFilters';
import SearchCoachmark from './SearchCoachmark';
import ActivityTimeline from '@/components/ui/ActivityTimeline';
import { CategorySymbol } from '@/components/ui/CategorySymbol';
import ItemDetailsSheet, { type ItemSelection } from '@/components/ui/ItemDetailsSheet';
import {
  activeFilterCount, EMPTY_HOME_FILTERS, getLogDate,
  createHomeSearchIndex, searchHomeIndex, orderHomeCategories, type HomeSearchFilters as Filters,
} from './dashboardModel';

interface DashboardProps {
  allTiles?: Tile[];
  logs?: LogEntry[];
  categories?: Category[];
  currentStaff?: StaffMember | null;
  isSyncing?: boolean;
  searchInputRef?: React.RefObject<HTMLInputElement>;
  onSelectCategory: (categoryId: string) => void;
  onNavigate: (tab: string) => void;
  onOpenReservation?: (tile: Tile) => void;
  onEditTile?: (tile: Tile) => void;
  onViewModelLogs?: (name: string) => void;
  onSearchActiveChange?: (active: boolean) => void;
}

const number = (value: number, digits = 2) => value.toLocaleString('en-US', { maximumFractionDigits: digits });
const quantity = (tile: Tile) => Number.isFinite(Number(tile.meters)) ? Number(tile.meters) : 0;

export default function Dashboard({
  allTiles = [], logs = [], categories = [], currentStaff, isSyncing = false,
  searchInputRef, onSelectCategory, onNavigate, onOpenReservation,
  onEditTile, onViewModelLogs, onSearchActiveChange,
}: DashboardProps) {
  const [search, setSearch] = useState('');
  const [inspecting, setInspecting] = useState<ItemSelection | null>(null);
  const inspectorTrigger = useRef<HTMLElement | null>(null);
  const inspectorScroll = useRef(0);
  const inspect = (name: string, categoryId?: string) => { inspectorTrigger.current = document.activeElement as HTMLElement; inspectorScroll.current = window.scrollY; setInspecting({ name, categoryId }); };
  const restoreInspectorFocus = () => window.requestAnimationFrame(() => { inspectorTrigger.current?.focus({ preventScroll: true }); window.scrollTo({ top: inspectorScroll.current, behavior: 'instant' }); });
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_HOME_FILTERS });
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [visibleResultCount, setVisibleResultCount] = useState(12);
  const localSearchRef = useRef<HTMLInputElement>(null);
  const searchRef = searchInputRef || localSearchRef;
  const filterRef = useRef<HTMLButtonElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const resultId = useId();
  const reduceMotion = useReducedMotion();
  const deferredSearch = useDeferredValue(search);
  const items = Array.isArray(allTiles) ? allTiles : [];
  const safeCategories = useMemo(() => orderHomeCategories(Array.isArray(categories) ? categories : []), [categories]);
  const filterCount = activeFilterCount(filters);
  const searching = Boolean(search.trim() || filterCount);



  useEffect(() => {
    onSearchActiveChange?.(searching);
    return () => onSearchActiveChange?.(false);
  }, [searching, onSearchActiveChange]);

  useEffect(() => { setVisibleResultCount(12); setExpandedItem(null); }, [deferredSearch, filters]);

  const stats = useMemo(() => {
    const byCategory = new Map<string, { count: number; meters: number; pieces: number }>();
    const categoryMap = new Map(safeCategories.map(category => [category.id, category]));
    let meters = 0, pieces = 0, reservations = 0, lowStock = 0;
    for (const item of items) {
      const value = quantity(item);
      const isPieces = (item.unitType || categoryMap.get(item.categoryId)?.defaultUnit) === 'pieces';
      if (isPieces) pieces += value; else meters += value;
      reservations += item.reservations?.length || 0;
      const threshold = Number((item as Tile & { lowStockAlert?: number }).lowStockAlert ?? 10);
      if (value > 0 && value <= threshold) lowStock++;
      const summary = byCategory.get(item.categoryId) || { count: 0, meters: 0, pieces: 0 };
      summary.count++;
      if (isPieces) summary.pieces += value; else summary.meters += value;
      byCategory.set(item.categoryId, summary);
    }
    return { byCategory, meters, pieces, reservations, lowStock };
  }, [allTiles, categories]);

  const searchIndex = useMemo(() => createHomeSearchIndex(items), [allTiles]);
  const matches = useMemo(() => searching ? searchHomeIndex(searchIndex, deferredSearch, filters) : [],
    [searchIndex, deferredSearch, filters, searching]);

  const recentLogs = useMemo(() => (Array.isArray(logs) ? logs : []).map((log, index) => ({ log, index }))
    .sort((a, b) => (getLogDate(b.log.timestamp)?.getTime() || 0) - (getLogDate(a.log.timestamp)?.getTime() || 0) || a.index - b.index)
    .slice(0, 4).map(entry => entry.log), [logs]);

  const enter = (delay: number) => reduceMotion ? {} : {
    initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay, ease: motionEase },
  };
  const clearSearch = () => { setSearch(''); setFilters({ ...EMPTY_HOME_FILTERS }); searchRef.current?.focus(); };

  return <div className="inventory-home" dir="rtl">
    <motion.div className="home-welcome" {...enter(0)}>
      <h2>مرحباً، <strong>{currentStaff?.name || 'المستخدم'}</strong></h2>
    </motion.div>

    <motion.section className="home-search-section" aria-label="البحث في المخزون" {...enter(0.04)}>
      <SearchCoachmark searchRef={searchRef} active={searching || filterOpen} userId={currentStaff?.id} />
      <form role="search" className="home-search-glass" onSubmit={event => {
        event.preventDefault();
        if (!searching) { searchRef.current?.focus(); return; }
        resultsRef.current?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
        searchRef.current?.blur();
      }}>
        <button className="home-search-lens" type="submit" aria-label="بحث"><Search size={27} strokeWidth={1.7} /></button>
        <label className="home-search-input"><span className="sr-only">اسم الصنف أو الكود أو المقاس أو اللون</span>
          <input ref={searchRef} type="search" placeholder="الكود، المقاس، اسم الصنف…" value={search}
            onChange={event => setSearch(event.target.value)} enterKeyHint="search" autoComplete="off" />
        </label>
        {search && <button type="button" className="home-icon-button home-search-clear" aria-label="مسح نص البحث" onClick={() => { setSearch(''); searchRef.current?.focus(); }}><X size={17} /></button>}
        <button ref={filterRef} type="button" className={`home-filter-toggle${filterCount ? ' has-filters' : ''}`}
          aria-label={`تصفية البحث${filterCount ? `، ${filterCount} فلاتر مفعلة` : ''}`}
          aria-haspopup="dialog" aria-expanded={filterOpen} onClick={() => { searchRef.current?.blur(); setFilterOpen(true); }}>
          <SlidersHorizontal size={23} strokeWidth={1.7} />{filterCount > 0 && <span className="home-filter-badge">{filterCount}</span>}
        </button>
      </form>
      {filterCount > 0 && <div className="home-applied-filters" aria-label="التصفية المطبقة">
        {(Object.keys(filters) as (keyof Filters)[]).filter(key => filters[key]).map(key => <button type="button" key={key}
          onClick={() => setFilters(previous => ({ ...previous, [key]: '' }))}
          aria-label={`إزالة فلتر ${key === 'categoryId' ? safeCategories.find(category => category.id === filters[key])?.name || 'القسم' : filters[key]}`}>
          {key === 'categoryId' ? safeCategories.find(category => category.id === filters[key])?.name || 'القسم' : <bdi>{filters[key]}</bdi>}<X size={12} />
        </button>)}
      </div>}
      <div className="home-sync-slot" role="status" aria-live="polite">
        {isSyncing && <p className="home-sync"><span aria-hidden="true" />جارٍ تحديث بقية المخزون…</p>}
      </div>
    </motion.section>

    {searching ? <section className="home-search-results" ref={resultsRef} aria-labelledby={resultId} aria-busy={isSyncing || search !== deferredSearch}>
      <div className="home-section-heading"><div><h2 id={resultId}>نتائج البحث</h2><p role="status">{number(matches.length, 0)} صنف مطابق{isSyncing ? ' حتى الآن' : ''}</p></div>
        <button type="button" className="home-text-button" onClick={clearSearch}>إلغاء البحث</button>
      </div>
      {matches.length ? <div className="home-results-list">{matches.slice(0, visibleResultCount).map(item => {
        const key = `${item.categoryId}:${item.id}`;
        const category = safeCategories.find(category => category.id === item.categoryId);
        const unit = (item.unitType || category?.defaultUnit) === 'pieces' ? 'قطعة' : 'م²';
        const reserved = (item.reservations || []).reduce((sum, reservation) => sum + (Number(reservation.meters) || 0), 0);
        const available = Math.max(0, quantity(item) - reserved);
        const expanded = expandedItem === key;
        return <article className="home-result" key={key}>
          <button type="button" className="home-result-summary" aria-expanded={expanded} onClick={() => setExpandedItem(expanded ? null : key)}>
            <span className="home-result-art">{item.image ? <img src={item.image} alt="" loading="lazy" /> : <PackageOpen size={24} strokeWidth={1.4} />}</span>
            <span className="home-result-label"><strong><bdi>{item.name || item.shade || 'صنف'}</bdi></strong><span>{[category?.name, item.size, item.surface, item.quality].filter(Boolean).map((text, index) => <React.Fragment key={index}>{index > 0 && ' · '}<bdi>{text}</bdi></React.Fragment>)}</span></span>
            <span className="home-result-available"><small>المتاح</small><strong><bdi>{number(available)}</bdi> <small>{unit}</small></strong>{reserved > 0 && <span>محجوز <bdi>{number(reserved)}</bdi></span>}</span>
            <ChevronDown className={expanded ? 'is-open' : ''} size={17} />
          </button>
          <AnimatePresence initial={false}>{expanded && <motion.div className="home-result-details" initial={{ height: reduceMotion ? 'auto' : 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: reduceMotion ? 'auto' : 0, opacity: 0 }}>
            <dl><div><dt>الكمية الإجمالية</dt><dd><bdi>{number(quantity(item))}</bdi> {unit}</dd></div><div><dt>المحجوز</dt><dd><bdi>{number(reserved)}</bdi> {unit}</dd></div><div><dt>المتاح</dt><dd><bdi>{number(available)}</bdi> {unit}</dd></div>
              {[['الموديل', item.shade], ['اللون', item.color], ['الماركة', item.brand], ['النوع', item.itemType], ['المادة', item.materialOrGlass]].map(([label, value]) => value && <div key={label}><dt>{label}</dt><dd><bdi>{value}</bdi></dd></div>)}
              {(item.customFieldSnapshot || []).map(field => <div key={field.fieldId}><dt>{field.label}</dt><dd><bdi>{field.value} {field.suffix || ''}</bdi></dd></div>)}
            </dl>
            {item.notes && <p className="home-result-notes">{item.notes}</p>}
            <div className="home-result-actions">
              {onOpenReservation && <button type="button" className="home-primary-button" onClick={() => onOpenReservation(item)}><Bookmark size={16} />الحجوزات</button>}
              {onEditTile && <button type="button" className="home-secondary-button" onClick={() => onEditTile(item)}><Pencil size={16} />تعديل</button>}
              {onViewModelLogs && <button type="button" className="home-text-button" onClick={() => onViewModelLogs(item.name)}><History size={15} />سجل الصنف</button>}
            </div>
          </motion.div>}</AnimatePresence>
        </article>;
      })}{matches.length > visibleResultCount && <button className="home-secondary-button home-load-more" type="button" onClick={() => setVisibleResultCount(value => value + 12)}>عرض المزيد من النتائج</button>}</div>
        : <div className="home-empty"><Search size={27} strokeWidth={1.3} /><h3>{isSyncing ? 'جارٍ البحث في المخزون…' : 'لا توجد أصناف مطابقة'}</h3><p>جرّب اسماً آخر أو عدّل التصفية.</p><button type="button" className="home-text-button" onClick={clearSearch}>مسح البحث والتصفية</button></div>}
    </section> : <>
      <motion.div className="home-stats" {...enter(0.08)}>
        <span><bdi>{number(items.length, 0)}</bdi> صنف</span><i />
        <span>{stats.meters > 0 || stats.pieces === 0 ? <><bdi>{number(stats.meters)}</bdi> م²</> : null}{stats.meters > 0 && stats.pieces > 0 && ' + '}{stats.pieces > 0 && <><bdi>{number(stats.pieces)}</bdi> قطعة</>}</span><i />
        <span><bdi>{number(stats.reservations, 0)}</bdi> حجز</span><i />
        <span className={stats.lowStock ? 'home-low-stock' : ''}><bdi>{number(stats.lowStock, 0)}</bdi> منخفض</span>
      </motion.div>
      <motion.section className="home-categories-section" {...enter(0.15)}>
        <div className="home-section-heading"><h2>الأقسام</h2><button type="button" className="home-text-button" onClick={() => onNavigate('inventory')}>عرض الكل<ChevronLeft size={15} /></button></div>
        {safeCategories.length ? <div className="home-categories-rail" role="list" aria-label="أقسام المخزون">{safeCategories.map((category, index) => {
          const summary = stats.byCategory.get(category.id);
          const defaultPieces = category.defaultUnit === 'pieces';
          return <div role="listitem" key={category.id} style={{ '--department-order': Math.min(index, 3) } as React.CSSProperties}><button type="button" className="home-category department-choice" onClick={() => onSelectCategory(category.id)}>
            <span className="department-mark" aria-hidden="true"><CategorySymbol category={category} size={30} /><ChevronLeft size={13} className="department-direction" /></span>
            <strong>{category.name}</strong><span className="category-caption"><bdi>{summary?.count || 0}</bdi> صنف</span>
            <small>{summary && summary.meters > 0 && <><bdi>{number(summary.meters)}</bdi> م²</>}{summary && summary.meters > 0 && summary.pieces > 0 && ' + '}{summary && summary.pieces > 0 && <><bdi>{number(summary.pieces)}</bdi> قطعة</>}{(!summary || (!summary.meters && !summary.pieces)) && <>0 {defaultPieces ? 'قطعة' : 'م²'}</>}</small>
          </button></div>;
        })}</div> : <p className="home-empty">لا توجد أقسام متاحة لهذا الحساب.</p>}
      </motion.section>
      <motion.section className="home-activity-section" {...enter(0.28)}>
        <div className="home-section-heading"><div><h2>آخر الحركات</h2><p>أحدث التغييرات على المخزون</p></div><button type="button" className="home-text-button" onClick={() => onNavigate('logs')}>عرض الكل<ChevronLeft size={15} /></button></div>
        {recentLogs.length ? <ActivityTimeline logs={recentLogs} categories={safeCategories} onViewModelLogs={inspect} /> : <div className="home-empty"><History size={26} strokeWidth={1.4} /><h3>لا توجد حركات بعد</h3><p>ستظهر عمليات الإضافة والتعديل والحجز هنا.</p></div>}
      </motion.section>
    </>}
    <ItemDetailsSheet selection={inspecting} tiles={items} logs={logs} categories={safeCategories} onClose={() => setInspecting(null)} onExited={restoreInspectorFocus} onEdit={onEditTile} onReserve={onOpenReservation} onViewHistory={onViewModelLogs} />
    {filterOpen && <HomeSearchFilters filters={filters} categories={safeCategories} items={items} anchor={filterRef.current}
      onDismiss={() => setFilterOpen(false)} onApply={next => { setFilters(next); setFilterOpen(false); }} />}
  </div>;
}
