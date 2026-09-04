import { db } from '@/services/firebase';

type InventoryCollectionName = 'tiles' | 'ceramics' | 'inventory';

const isAllowedCollection = (value: string): value is InventoryCollectionName =>
  value === 'tiles' || value === 'ceramics' || value === 'inventory';

export const inventoryService = {
  deleteItem: async (
    collectionName: InventoryCollectionName,
    itemId: string,
  ): Promise<void> => {
    const cleanCollection = String(collectionName || '').trim();
    const cleanId = String(itemId || '').trim();

    if (!isAllowedCollection(cleanCollection)) {
      throw new Error('مجموعة المخزون غير صالحة.');
    }

    if (!cleanId || cleanId.length > 500 || cleanId.includes('/')) {
      throw new Error('معرّف الصنف غير صالح.');
    }

    await db.collection(cleanCollection).doc(cleanId).delete();
  },
};
