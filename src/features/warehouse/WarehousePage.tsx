import React, { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, History, Package, Plus, Ruler } from 'lucide-react';
import { ActionFeedback } from '@/components/ui/ActionFeedback';
import ConfirmModal from '@/components/ui/ConfirmModal';
import CategoryGlassMark from '@/components/ui/CategoryGlassMark';
import { categoryTone } from '@/components/ui/CategorySymbol';
import { EMPTY_HOME_FILTERS, getLogDate, matchesHomeSearch } from '@/features/dashboard/dashboardModel';
import SummaryCards from '@/features/dashboard/SummaryCards';
import { FullListModal, ImageModal, ReservationModal, TileForm, TileList } from '@/features/inventory';
import InventoryWorkspace from '@/features/inventory/InventoryWorkspace';
import { LogsView } from '@/features/logs';
import { PrintPdfModal } from '@/features/settings';
import type { Category, LogEntry, StaffMember, Tile } from '@/types';
import { useSwipeBack } from '@/hooks/useSwipeBack';
import { WAREHOUSE_NAME } from './warehouseName';
import {
  allSizes, changeStock, EMPTY_OPTIONS, packingKey, saveOptions, watchWarehouse,
  type WarehouseCategory, type WarehouseOptions, type WarehouseTile,
} from './warehouse.service';
import './warehouse.css';

const panels = [
  { id: 'stock', label: 'الأصناف', icon: Package },
  { id: 'logs', label: 'الحركات', icon: History },
  { id: 'sizes', label: 'المقاسات', icon: Ruler },
] as const;

type Panel = typeof panels[number]['id'];
type Editor = { item: WarehouseTile | null; sizes: ReturnType<typeof allSizes> };
type StockState = { items?: WarehouseTile[]; committed: WarehouseTile[] };
const formatArea = (area: number) => area.toLocaleString('en-US', { maximumFractionDigits: 4 });
const itemDate = (item: WarehouseTile) => getLogDate(item.createdAt)?.getTime() ?? 0;

function WarehouseSizes({ category, options }: {
  category: WarehouseCategory;
  options: WarehouseOptions;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [area, setArea] = useState('');
  const [cartons, setCartons] = useState('');
  const palletArea = Number(area) * Number(cartons);

  async function save(change: Parameters<typeof saveOptions>[1], success: string) {
    setPending(true);
    setError('');
    setStatus('');
    try {
      await saveOptions(category, change);
      setStatus(success);
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'تعذر حفظ التغيير. حاول مرة ثانية.');
      return false;
    } finally {
      setPending(false);
    }
  }

  async function addSize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const desc = String(data.get('size') ?? '').trim().replace(/[×xX]/g, '*');
    const size = { label: desc.replace(/\*/g, '×'), desc, mBox: Number(area), bPallet: Number(cartons) };
    if (await save({ size }, 'تمت إضافة المقاس والتعبئة.')) {
      form.reset();
      setArea('');
      setCartons('');
    }
  }

  return <section className="warehouse-options inventory-editor" aria-label="المقاسات والتعبئة">
      <form onSubmit={addSize} className="warehouse-form editor-section">
        <div className="warehouse-section-heading">
          <Ruler size={22} aria-hidden="true" /><div><h3>إضافة مقاس وتعبئة</h3><p>حدّد المقاس والتعبئة. النخب بتختاره لما تضيف الصنف.</p></div>
        </div>
        <div className="warehouse-fields">
          <label><span>المقاس أو وصف التعبئة</span>
            <input name="size" placeholder="مثال 25×50" maxLength={100} required />
          </label>
          <label><span>المتر المربع في الكرتونة</span>
            <input id="warehouse-area" name="mBox" type="number" inputMode="decimal" min="0.0001" step="any" placeholder="مثال 1.50"
              value={area} onChange={event => setArea(event.target.value)} required />
          </label>
          <label><span>عدد الكراتين في الطبلية</span>
            <input id="warehouse-cartons" name="bPallet" type="number" inputMode="numeric" min="1" step="1" placeholder="مثال 40"
              value={cartons} onChange={event => setCartons(event.target.value)} required />
          </label>
        </div>
        <div className="warehouse-form-footer">
          <div className="warehouse-calculation">
            <span>مساحة الطبلية</span>
            <output htmlFor="warehouse-area warehouse-cartons"><bdi>{Number.isFinite(palletArea) && palletArea > 0 ? formatArea(palletArea) : '—'}</bdi> م²</output>
          </div>
          <button className="warehouse-button is-primary" disabled={pending} type="submit"><Plus size={18} /> إضافة المقاس</button>
        </div>
      </form>
      <section className="warehouse-option-list">
        <h3>المقاسات المسجّلة</h3>
        <ul>
          {allSizes(category, options).map(size => {
            const key = packingKey(size);
            const disabled = options.disabledSizes.includes(key);
            return <li key={key}>
              <div>
                <div className="warehouse-option-name"><bdi>{size.desc.replace(/\*/g, '×')}</bdi>{size.quality && <span>{size.quality}</span>}{disabled && <span>موقوف</span>}</div>
                <p><bdi>{formatArea(size.mBox)}</bdi> م² بالكرتونة · <bdi>{size.bPallet}</bdi> كرتونة بالطبلية · <bdi>{formatArea(size.mBox * size.bPallet)}</bdi> م² بالطبلية</p>
              </div>
              <button className="warehouse-button" type="button" disabled={pending}
                aria-label={`${disabled ? 'تفعيل' : 'إيقاف'} ${size.desc} ${size.quality ?? ''}`}
                onClick={() => void save({ toggleSize: key }, disabled ? 'تم تفعيل المقاس.' : 'تم إيقاف المقاس للإضافات الجديدة.')}>{disabled ? 'تفعيل' : 'إيقاف'}</button>
            </li>;
          })}
        </ul>
      </section>
    {error && <ActionFeedback tone="error" message={error} />}
    {status && <p role="status" className="warehouse-feedback">{status}</p>}
  </section>;
}
export default function WarehousePage({ staff, categories, onBack, onSwipeBack }: {
  staff: StaffMember;
  categories: Category[];
  onBack: () => void;
  onSwipeBack?: () => void;
}) {
  const [categoryId, setCategoryId] = useState<WarehouseCategory>('tiles');
  const [panel, setPanel] = useState<Panel>('stock');
  const [{ items: stock, committed }, setStock] = useState<StockState>({ committed: [] });
  const [logs, setLogs] = useState<LogEntry[]>();
  const [settings, setSettings] = useState<Partial<Record<WarehouseCategory, WarehouseOptions>>>();
  const [search, setSearch] = useState('');
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [reserving, setReserving] = useState<WarehouseTile | null>(null);
  const [deleting, setDeleting] = useState<WarehouseTile | null>(null);
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(() => new Set());
  const [image, setImage] = useState('');
  const [printing, setPrinting] = useState(false);
  const [fullList, setFullList] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const canAccess = staff.role === 'admin' && staff.status === 'active';
  useSwipeBack(canAccess && onSwipeBack && !editor && !reserving && !deleting && !image && !printing && !fullList
    ? () => {
      if (panel === 'stock') onSwipeBack();
      else {
        setPanel('stock');
        setError('');
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    }
    : undefined);
  const privateCategories = useMemo<Category[]>(() => categories.map(category => ({
    ...category,
    themeColor: category.id === 'ceramics' ? 'emerald' : 'sky',
  })), [categories]);

  useEffect(() => {
    if (!canAccess) return;
    const fail = () => setLoadError(true);
    try {
      return watchWarehouse(items => {
        const sorted = items.slice().sort((a, b) => itemDate(b) - itemDate(a));
        const received = new Set(items.map(item => item.id));
        setStock(previous => ({ items: sorted, committed: previous.committed.filter(item => !received.has(item.id)) }));
        setHiddenItems(previous => {
          if (!previous.size) return previous;
          const remaining = new Set(items.filter(item => previous.has(item.id)).map(item => item.id));
          return remaining.size === previous.size ? previous : remaining;
        });
      }, setLogs, setSettings, fail);
    } catch {
      fail();
    }
  }, [canAccess, staff.id, retry]);

  const visibleStock = useMemo(
    () => [...committed, ...(stock ?? [])].filter(item => !hiddenItems.has(item.id)),
    [committed, stock, hiddenItems],
  );
  const items = useMemo(() => visibleStock.filter(item => item.categoryId === categoryId), [visibleStock, categoryId]);
  const filtered = useMemo(() => items.filter(item => matchesHomeSearch(item, search, EMPTY_HOME_FILTERS)), [items, search]);

  if (!canAccess) return null;
  const category = privateCategories.find(entry => entry.id === categoryId)!;
  const options = settings?.[categoryId] ?? EMPTY_OPTIONS;
  const categoryLogs = logs?.filter(log => log.categoryId === categoryId) ?? [];
  const ready = Boolean(stock && settings && !loadError);
  const startEditor = (item: WarehouseTile | null) => {
    if (!settings) return;
    setEditor({
      item, sizes: allSizes(categoryId, options).filter(size => !options.disabledSizes.includes(packingKey(size))),
    });
  };

  const editItem = (tile: Tile) => startEditor(tile as WarehouseTile);
  const reserveItem = (tile: Tile) => setReserving(tile as WarehouseTile);
  const selectForDeletion = (id: string) => setDeleting(items.find(item => item.id === id) ?? null);

  function selectCategory(id: WarehouseCategory) {
    setCategoryId(id);
    setSearch('');
    setError('');
  }

  async function deleteItem(item: WarehouseTile) {
    setDeleting(null);
    setError('');
    setHiddenItems(previous => new Set(previous).add(item.id));
    try {
      await changeStock(categoryId, staff, { action: 'delete', item });
    } catch (failure) {
      setHiddenItems(previous => {
        const remaining = new Set(previous);
        remaining.delete(item.id);
        return remaining;
      });
      setFullList(false);
      setError(failure instanceof Error ? failure.message : 'تعذر حذف الصنف. رجع الصنف للقائمة.');
    }
  }

  async function saveItem(tile: Tile) {
    const created = await changeStock(categoryId, staff, editor?.item
      ? { action: 'edit', item: editor.item, tile }
      : { action: 'add', tile });
    if (created) {
      // Show the acknowledged write even if the collection listener is behind.
      setStock(previous => previous.items?.some(item => item.id === created.id)
        ? previous
        : { ...previous, committed: [created, ...previous.committed] });
      setSearch('');
      setSearchResetKey(value => value + 1);
    }
    setEditor(null);
  }

  return <section dir="rtl" className="warehouse-page stock-workspace" aria-label={WAREHOUSE_NAME}>
    <button type="button" className="warehouse-back" onClick={onBack}>
      <ArrowRight size={20} aria-hidden="true" /> الرجوع للرئيسية
    </button>
    {panel === 'stock' && <div className="warehouse-stock">
      <SummaryCards tiles={items} activeCategoryId={categoryId} unitType="meters" loading={!stock} />
    </div>}
    <div className="warehouse-departments" role="group" aria-label="أقسام المستودع">
      {privateCategories.map(entry => <button key={entry.id} type="button" className={categoryTone(entry)}
        aria-pressed={entry.id === categoryId} onClick={() => selectCategory(entry.id as WarehouseCategory)}>
        <span className="warehouse-department-mark" aria-hidden="true">
          <CategoryGlassMark category={entry} compact />
        </span>
        <strong>{entry.name}</strong>
      </button>)}
    </div>
    {loadError ? <div className="space-y-2">
      <ActionFeedback tone="error" message="تعذر فتح بيانات مستودع نعيمه. تحقق من الاتصال وصلاحية الحساب." />
      <button type="button" className="warehouse-button" onClick={() => {
        setStock(previous => ({ committed: previous.committed }));
        setSettings(undefined);
        setLogs(undefined);
        setLoadError(false);
        setRetry(value => value + 1);
      }}>إعادة المحاولة</button>
    </div> : <>
      <div className="warehouse-panels" role="group" aria-label="عرض المستودع">
        {panels.map(({ id, label, icon: Icon }) => <button key={id} type="button"
          disabled={id === 'logs' ? !logs : id !== 'stock' && !settings}
          aria-pressed={panel === id} onClick={() => { setPanel(id); setError(''); }}>
          <Icon size={17} aria-hidden="true" />{label}
        </button>)}
      </div>
      {error && <ActionFeedback tone="error" message={error} />}
      {panel === 'sizes' && settings && <WarehouseSizes key={categoryId} category={categoryId} options={options} />}
      {panel === 'logs' && logs && <LogsView key={categoryId} logs={categoryLogs} tiles={items} categories={privateCategories}
        onEditTile={editItem} onOpenReservation={reserveItem} />}
      {panel === 'stock' && <InventoryWorkspace category={category} categories={privateCategories} tiles={items}
        showSummary={false} separatePrint actionsDisabled={!ready} searchQuery={search} onSearchChange={setSearch} searchResetKey={searchResetKey}
        onSelectCategory={id => selectCategory(id as WarehouseCategory)} onAdd={() => startEditor(null)}
        onShowAll={() => setFullList(true)} onPrint={() => setPrinting(true)}>
        <TileList key={categoryId} tiles={filtered} loading={!stock} activeCategoryId={categoryId} category={category}
          categories={privateCategories} searchQuery={search} logs={categoryLogs} viewMode="preview"
          onEdit={editItem} onOpenReservation={reserveItem} onViewImage={setImage} onDelete={selectForDeletion} />
      </InventoryWorkspace>}
      {fullList && <FullListModal isOpen mobileSnap="compact" category={category} tiles={items} logs={categoryLogs}
        onClose={() => setFullList(false)} onEdit={editItem} onOpenReservation={reserveItem}
        onViewImage={setImage} onDelete={selectForDeletion} />}
      {editor && <TileForm activeCategoryId={categoryId} category={category} editingTile={editor.item}
        canManageVisibility={false} warehouseName={WAREHOUSE_NAME} sizePresets={editor.sizes}
        onCancel={() => setEditor(null)} onViewImage={setImage} onSave={saveItem} />}
      {reserving && <ReservationModal tile={reserving} onClose={() => setReserving(null)}
        onUpdateReservations={async reservations => {
          await changeStock(categoryId, staff, { action: 'reserve', item: reserving, reservations });
          setReserving(null);
        }} />}
      {deleting && <ConfirmModal isOpen message={`حذف «${deleting.name}» من ${WAREHOUSE_NAME}؟`}
        onClose={() => setDeleting(null)} onConfirm={() => void deleteItem(deleting)} />}
      {image && <ImageModal src={image} onClose={() => setImage('')} />}
      {printing && <PrintPdfModal isOpen onClose={() => setPrinting(false)} activeCategoryId={categoryId}
        categories={privateCategories} allItems={visibleStock} currentStaff={staff} warehouseName={WAREHOUSE_NAME} />}
    </>}
  </section>;
}
