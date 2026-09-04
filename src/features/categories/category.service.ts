import { db } from '@/services/firebase';

export const categoryService = {
  deleteCategory: async (categoryId: string): Promise<void> => {
    const cleanId = String(categoryId || '').trim();

    if (!cleanId || cleanId.length > 200 || cleanId.includes('/')) {
      throw new Error('معرّف القسم غير صالح.');
    }

    if (cleanId === 'tiles' || cleanId === 'ceramics') {
      throw new Error('لا يمكن حذف أقسام البورسلان أو السيراميك.');
    }

    const linkedItems = await db
      .collection('inventory')
      .where('categoryId', '==', cleanId)
      .limit(1)
      .get();

    if (!linkedItems.empty) {
      throw new Error('لا يمكن حذف قسم يحتوي أصناف. انقل الأصناف أو اترك القسم موجودًا حتى لا تختفي بياناته.');
    }

    await db.collection('categories').doc(cleanId).delete();
  },
};
