import { collection, doc, getDocFromServer, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, type DocumentData, type Query, type QueryDocumentSnapshot } from 'firebase/firestore';
import { auth, requireFirestore, sanitizeFirestoreData } from '@/services/firebase/firebase.client';
import { normalizeSize } from '@/features/dashboard/dashboardModel';
import { calculateReservedQuantity } from '@/features/inventory/inventoryCalculations';
import { CERAMIC_PRESETS, PORCELAIN_PRESETS, voicePackingKey } from '@/features/voice/voice-presets.mjs';
import { stockFingerprint, stockPlan } from '@/features/voice/stock-command-plan.mjs';
import type { VoiceItemReview } from '@/features/voice/stock-command.service';
import type { StockCommand } from '@/features/voice/stock-command.types';
import type { Category, LogEntry, PackingOption, Reservation, StaffMember, Tile } from '@/types';
import { WAREHOUSE_NAME } from './warehouseName';

export type WarehouseCategory = 'tiles' | 'ceramics';
export type WarehouseOptions = { sizes: PackingOption[]; disabledSizes: string[] };
export type WarehouseTile = Tile & { revision: number };

export const EMPTY_OPTIONS: WarehouseOptions = { sizes: [], disabledSizes: [] };
const WAREHOUSE_PATH = 'warehouses/al-naimi';

export function allSizes(category: WarehouseCategory, options: WarehouseOptions): PackingOption[] {
  return [...(category === 'tiles' ? PORCELAIN_PRESETS : CERAMIC_PRESETS), ...options.sizes];
}

export const packingKey = voicePackingKey;

export const isWarehouseCategory = (id: string): id is WarehouseCategory =>
  id === 'tiles' || id === 'ceramics';

function assertWarehouseActor(staff: StaffMember) {
  if (auth.currentUser?.uid !== staff.id || staff.role !== 'admin' || staff.status !== 'active') {
    throw new Error('جلسة المستودع غير صالحة لهذا الأمر.');
  }
}

export async function previewWarehouseVoiceItem(
  candidate: Tile, command: StockCommand, category: Category, staff: StaffMember,
): Promise<VoiceItemReview> {
  assertWarehouseActor(staff);
  const categoryId = category.id;
  if (!isWarehouseCategory(categoryId) || candidate.categoryId !== categoryId ||
      (command.categoryId && command.categoryId !== categoryId) ||
      !candidate.id || candidate.id.includes('/') || candidate.id === '.' || candidate.id === '..') {
    throw new Error('الصنف غير متاح في قسم المستودع.');
  }
  const firestore = requireFirestore();
  const snapshot = await getDocFromServer(doc(firestore, WAREHOUSE_PATH, 'stock', candidate.id));
  const raw = snapshot.data();
  if (!raw || raw.categoryId !== categoryId || raw.name !== candidate.name) {
    throw new Error('الصنف تغيّر أو لم يعد موجوداً. أعد البحث عنه.');
  }
  const item = { ...raw, id: snapshot.id } as WarehouseTile;
  const fingerprint = stockFingerprint(raw);
  const plan = stockPlan(item, command, category);
  let attempted = false;
  return {
    item, plan,
    async commit() {
      assertWarehouseActor(staff);
      if (attempted) throw new Error('سبق إرسال هذا التأكيد. راجع المستودع قبل إعادة الأمر.');
      attempted = true;
      await changeStock(categoryId, staff, plan.action === 'delete'
        ? { action: 'delete', item, fingerprint }
        : { action: 'edit', item, tile: { ...item, ...plan.patch }, fingerprint });
    },
  };
}

type OptionChange = { size: PackingOption } | { toggleSize: string };

export async function saveOptions(category: WarehouseCategory, change: OptionChange) {
  const firestore = requireFirestore();
  const reference = doc(firestore, WAREHOUSE_PATH, 'options', category);
  await runTransaction(firestore, async transaction => {
    const snapshot = await transaction.get(reference);
    const options = (snapshot.data() as WarehouseOptions | undefined) ?? EMPTY_OPTIONS;
    const sizes = allSizes(category, options);

    if ('size' in change) {
      const option = change.size;
      if (!option.desc.trim() || !Number.isFinite(option.mBox) || option.mBox <= 0 ||
        !Number.isSafeInteger(option.bPallet) || option.bPallet <= 0) {
        throw new Error('أدخل المقاس ومساحة الكرتونة وعدداً صحيحاً للكراتين بالطبلية.');
      }
      if (sizes.some(size => normalizeSize(size.desc) === normalizeSize(option.desc) && size.quality === option.quality)) {
        throw new Error('هذا المقاس موجود. أضف وصفاً مميزاً إذا كانت التعبئة مختلفة.');
      }
      transaction.set(reference, { ...options, sizes: [...options.sizes, sanitizeFirestoreData(option)] });
    } else {
      const key = change.toggleSize;
      if (options.disabledSizes.includes(key)) {
        transaction.set(reference, { ...options, disabledSizes: options.disabledSizes.filter(size => size !== key) });
      } else {
        if (sizes.filter(size => !options.disabledSizes.includes(packingKey(size))).length <= 1) {
          throw new Error('لازم يظل مقاس واحد على الأقل متاحاً للإضافة.');
        }
        transaction.set(reference, { ...options, disabledSizes: [...options.disabledSizes, key] });
      }
    }
  });
}

type WarehouseSettings = Partial<Record<WarehouseCategory, WarehouseOptions>>;
export type WarehouseSessionCache = {
  staffId: string;
  stock?: WarehouseTile[];
  settings?: WarehouseSettings;
};

function warehouseCollection(name: string) {
  return collection(requireFirestore(), WAREHOUSE_PATH, name);
}

function listenVerified(
  source: Query<DocumentData>,
  receive: (docs: QueryDocumentSnapshot<DocumentData>[]) => void,
  onError: (error: unknown) => void,
) {
  let serverConfirmed = false;
  return onSnapshot(source, { includeMetadataChanges: true }, snapshot => {
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) {
      serverConfirmed = false;
      return;
    }
    if (serverConfirmed && snapshot.docChanges().length === 0) return;
    serverConfirmed = true;
    receive(snapshot.docs);
  }, onError);
}

export function watchWarehouseStock(receive: (items: WarehouseTile[]) => void, onError: (error: unknown) => void) {
  return listenVerified(warehouseCollection('stock'), docs =>
    receive(docs.map(entry => ({ ...entry.data(), id: entry.id } as WarehouseTile))), onError);
}

export function watchWarehouseOptions(receive: (settings: WarehouseSettings) => void, onError: (error: unknown) => void) {
  return listenVerified(warehouseCollection('options'), docs =>
    receive(Object.fromEntries(docs.map(entry => [entry.id, entry.data()])) as WarehouseSettings), onError);
}

export function watchWarehouseLogs(receive: (logs: LogEntry[]) => void, onError: (error: unknown) => void) {
  return listenVerified(query(warehouseCollection('logs'), orderBy('timestamp', 'desc'), limit(100)), docs =>
    receive(docs.map(entry => ({ ...entry.data(), id: entry.id } as LogEntry))), onError);
}

type StockChange =
  | { action: 'add'; tile: Tile; voiceId?: string }
  | { action: 'edit'; item: WarehouseTile; tile: Tile; fingerprint?: string }
  | { action: 'reserve'; item: WarehouseTile; reservations: Reservation[] }
  | { action: 'delete'; item: WarehouseTile; fingerprint?: string };

export async function changeStock(category: WarehouseCategory, staff: StaffMember, change: StockChange) {
  const firestore = requireFirestore();
  const stock = collection(firestore, WAREHOUSE_PATH, 'stock');
  const reference = change.action === 'add' ? (change.voiceId ? doc(stock, change.voiceId) : doc(stock)) : doc(stock, change.item.id);
  const log = doc(collection(firestore, WAREHOUSE_PATH, 'logs'));
  const addedItem: WarehouseTile | undefined = change.action === 'add' ? {
    ...change.tile, id: reference.id, categoryId: category, revision: 1,
    createdBy: staff.name, createdByUid: staff.id,
  } : undefined;

  await runTransaction(firestore, async transaction => {
    if (change.action === 'add' && change.voiceId) {
      assertWarehouseActor(staff);
      if ((await transaction.get(reference)).exists()) throw new Error('هذا الصنف أُضيف بهذا التأكيد. راجع قائمة المستودع.');
    }
    let current: WarehouseTile | undefined;
    if (change.action !== 'add') {
      const snapshot = await transaction.get(reference);
      current = snapshot.data() as WarehouseTile | undefined;
      if ('fingerprint' in change && change.fingerprint) {
        assertWarehouseActor(staff);
        if (!current || stockFingerprint(current) !== change.fingerprint) {
          throw new Error('بيانات الصنف تغيّرت بعد المعاينة. أعد البحث وراجع التغيير.');
        }
      }
      if (!current || current.categoryId !== category || current.revision !== change.item.revision) {
        throw new Error('الصنف تغيّر. افتحه من جديد قبل متابعة التعديل.');
      }
    }

    const timestamp = serverTimestamp();
    const audit = { updatedBy: staff.name, updatedByUid: staff.id, updatedAt: timestamp };
    let action: string;
    let tileName: string;
    let details: string;

    switch (change.action) {
      case 'add': {
        tileName = change.tile.name;
        action = 'إضافة صنف';
        details = `تمت إضافة الصنف إلى ${WAREHOUSE_NAME}.`;
        transaction.set(reference, sanitizeFirestoreData({
          ...addedItem,
          createdAt: timestamp,
        }));
        break;
      }
      case 'edit': {
        const previous = current!;
        if (change.tile.meters + 0.000001 < calculateReservedQuantity(previous)) {
          throw new Error('الكمية الجديدة أقل من الكمية المحجوزة.');
        }
        tileName = change.tile.name;
        action = 'تعديل صنف';
        details = previous.meters === change.tile.meters
          ? 'تم تحديث تفاصيل الصنف.'
          : `الكمية من ${previous.meters} إلى ${change.tile.meters} م².`;
        transaction.update(reference, sanitizeFirestoreData<DocumentData>({
          ...change.tile,
          id: reference.id, categoryId: category, revision: previous.revision + 1,
          reservations: previous.reservations ?? [],
          ...audit,
        }));
        break;
      }
      case 'reserve': {
        const previous = current!;
        const reserved = calculateReservedQuantity({ ...previous, reservations: change.reservations });
        if (reserved > previous.meters + 0.000001) throw new Error('الكمية المحجوزة تتجاوز الرصيد.');
        tileName = previous.name;
        action = 'تحديث الحجوزات';
        details = `إجمالي المحجوز ${reserved} م².`;
        transaction.update(reference, {
          reservations: change.reservations, isReserved: change.reservations.length > 0,
          revision: previous.revision + 1, ...audit,
        });
        break;
      }
      case 'delete':
        tileName = current!.name;
        action = 'حذف صنف';
        details = `تم حذف الصنف من ${WAREHOUSE_NAME}.`;
        transaction.delete(reference);
        break;
    }

    transaction.set(log, { categoryId: category, action, tileName, details, timestamp, user: staff.name, actorUid: staff.id });
  });
  return addedItem && { ...addedItem, createdAt: new Date() };
}
