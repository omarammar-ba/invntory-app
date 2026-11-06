import { collection, doc, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, type DocumentData, type Query, type QueryDocumentSnapshot } from 'firebase/firestore';
import { requireFirestore, sanitizeFirestoreData } from '@/services/firebase/firebase.client';
import { normalizeSize } from '@/features/dashboard/dashboardModel';
import { calculateReservedQuantity } from '@/features/inventory/inventoryCalculations';
import { CERAMIC_PRESETS, PORCELAIN_PRESETS } from '@/features/voice/voice-presets.mjs';
import type { LogEntry, PackingOption, Reservation, StaffMember, Tile } from '@/types';
import { WAREHOUSE_NAME } from './warehouseName';

export type WarehouseCategory = 'tiles' | 'ceramics';
export type WarehouseOptions = { sizes: PackingOption[]; disabledSizes: string[] };
export type WarehouseTile = Tile & { revision: number };

export const EMPTY_OPTIONS: WarehouseOptions = { sizes: [], disabledSizes: [] };
const WAREHOUSE_PATH = 'warehouses/al-naimi';

export function allSizes(category: WarehouseCategory, options: WarehouseOptions): PackingOption[] {
  return [...(category === 'tiles' ? PORCELAIN_PRESETS : CERAMIC_PRESETS), ...options.sizes];
}

export function packingKey(option: PackingOption) {
  return option.quality ? JSON.stringify([option.desc, option.quality]) : option.desc;
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

export function watchWarehouse(
  receiveStock: (items: WarehouseTile[]) => void,
  receiveLogs: (logs: LogEntry[]) => void,
  receiveOptions: (options: Partial<Record<WarehouseCategory, WarehouseOptions>>) => void,
  onError: () => void,
) {
  const firestore = requireFirestore();
  const path = (name: string) => collection(firestore, WAREHOUSE_PATH, name);
  // Check authorization before exposing data, and skip repeated metadata-only events.
  const listen = (source: Query<DocumentData>, receive: (docs: QueryDocumentSnapshot<DocumentData>[]) => void) => {
    let authorized = false;
    return onSnapshot(source, { includeMetadataChanges: true }, snapshot => {
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) {
        // The next server snapshot may contain changes represented only by metadata.
        authorized = false;
        return;
      }
      if (authorized && snapshot.docChanges().length === 0) return;
      authorized = true;
      receive(snapshot.docs);
    }, onError);
  };
  const stock = listen(path('stock'), docs => receiveStock(docs.map(entry => ({ ...entry.data(), id: entry.id } as WarehouseTile))));
  const logs = listen(query(path('logs'), orderBy('timestamp', 'desc'), limit(100)), docs =>
    receiveLogs(docs.map(entry => ({ ...entry.data(), id: entry.id } as LogEntry))));
  const options = listen(path('options'), docs =>
    receiveOptions(Object.fromEntries(docs.map(entry => [entry.id, entry.data()])) as Partial<Record<WarehouseCategory, WarehouseOptions>>));
  return () => { stock(); logs(); options(); };
}

type StockChange =
  | { action: 'add'; tile: Tile }
  | { action: 'edit'; item: WarehouseTile; tile: Tile }
  | { action: 'reserve'; item: WarehouseTile; reservations: Reservation[] }
  | { action: 'delete'; item: WarehouseTile };

export async function changeStock(category: WarehouseCategory, staff: StaffMember, change: StockChange) {
  const firestore = requireFirestore();
  const stock = collection(firestore, WAREHOUSE_PATH, 'stock');
  const reference = change.action === 'add' ? doc(stock) : doc(stock, change.item.id);
  const log = doc(collection(firestore, WAREHOUSE_PATH, 'logs'));
  const addedItem: WarehouseTile | undefined = change.action === 'add' ? {
    ...change.tile, id: reference.id, categoryId: category, revision: 1,
    createdBy: staff.name, createdByUid: staff.id,
  } : undefined;

  await runTransaction(firestore, async transaction => {
    let current: WarehouseTile | undefined;
    if (change.action !== 'add') {
      const snapshot = await transaction.get(reference);
      current = snapshot.data() as WarehouseTile | undefined;
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
