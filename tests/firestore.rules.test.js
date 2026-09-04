import fs from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const projectId = 'ammar-inventory-rules-test';
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();

    await setDoc(doc(db, 'staff', 'admin-1'), {
      id: 'admin-1',
      name: 'عمر',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
      isPrimaryAdmin: true,
      createdAt: new Date(),
      createdBy: 'admin-1',
    });

    await setDoc(doc(db, 'staff', 'admin-2'), {
      id: 'admin-2',
      name: 'مدير ثاني',
      email: 'admin2@example.com',
      role: 'admin',
      status: 'active',
      isPrimaryAdmin: false,
      createdAt: new Date(),
      createdBy: 'admin-1',
    });

    await setDoc(doc(db, 'staff', 'employee-1'), {
      id: 'employee-1',
      name: 'أحمد',
      email: 'employee@example.com',
      role: 'employee',
      status: 'active',
      isPrimaryAdmin: false,
      createdAt: new Date(),
      createdBy: 'admin-1',
    });

    await setDoc(doc(db, 'staff', 'inactive-1'), {
      id: 'inactive-1',
      name: 'موقوف',
      email: 'inactive@example.com',
      role: 'employee',
      status: 'inactive',
      isPrimaryAdmin: false,
      createdAt: new Date(),
      createdBy: 'admin-1',
    });

    await setDoc(doc(db, 'categories', 'tiles'), {
      id: 'tiles',
      name: 'بورسلان',
      visibleToEmployees: true,
      isSystemCategory: true,
    });

    await setDoc(doc(db, 'categories', 'ceramics'), {
      id: 'ceramics',
      name: 'سيراميك',
      visibleToEmployees: true,
      isSystemCategory: true,
    });

    await setDoc(doc(db, 'categories', 'private'), {
      id: 'private',
      name: 'خاص',
      visibleToEmployees: false,
      isSystemCategory: false,
    });

    // Legacy document: intentionally has no categoryId or audit metadata.
    await setDoc(doc(db, 'tiles', 'legacy-tile'), {
      id: 'legacy-tile',
      name: 'قديم',
      meters: 10,
      boxes: 5,
      reservations: [],
    });

    await setDoc(doc(db, 'inventory', 'private-item'), {
      id: 'private-item',
      categoryId: 'private',
      name: 'مخفي بالقسم',
      meters: 1,
    });

    await setDoc(doc(db, 'tiles', 'admin-only-tile'), {
      id: 'admin-only-tile',
      categoryId: 'tiles',
      name: 'صنف مدير فقط',
      meters: 3,
      boxes: 1,
      hiddenForStaff: true,
      reservations: [],
    });

    await setDoc(doc(db, 'logs', 'legacy-log'), {
      action: 'تعديل',
      details: 'سجل قديم بدون قسم',
      tileName: 'قديم',
      timestamp: new Date(),
      user: 'عمر',
    });
  });
});

test('unauthenticated users cannot read inventory', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'tiles', 'legacy-tile')));
});

test('active admin can read legacy porcelain data', async () => {
  const db = testEnv.authenticatedContext('admin-1').firestore();
  const snap = await assertSucceeds(getDoc(doc(db, 'tiles', 'legacy-tile')));
  assert.equal(snap.data().name, 'قديم');
});

test('active employee can read a visible legacy porcelain category', async () => {
  const db = testEnv.authenticatedContext('employee-1').firestore();
  await assertSucceeds(getDocs(collection(db, 'tiles')));
});

test('employee category reads are restricted to categories visible to employees', async () => {
  const db = testEnv.authenticatedContext('employee-1').firestore();

  await assertSucceeds(getDoc(doc(db, 'categories', 'tiles')));
  await assertFails(getDoc(doc(db, 'categories', 'private')));

  await assertSucceeds(
    getDocs(
      query(
        collection(db, 'categories'),
        where('visibleToEmployees', '==', true),
      ),
    ),
  );
});


test('employee cannot expose or edit a category that is hidden by the admin', async () => {
  const db = testEnv.authenticatedContext('employee-1').firestore();

  await assertFails(
    updateDoc(doc(db, 'categories', 'private'), {
      visibleToEmployees: true,
      hiddenForStaff: false,
    }),
  );
});

test('employee cannot hide a visible category from other employees', async () => {
  const db = testEnv.authenticatedContext('employee-1').firestore();

  await assertFails(
    updateDoc(doc(db, 'categories', 'tiles'), {
      visibleToEmployees: false,
      hiddenForStaff: true,
    }),
  );
});

test('employee cannot read an inventory item whose category is hidden', async () => {
  const db = testEnv.authenticatedContext('employee-1').firestore();
  await assertFails(getDoc(doc(db, 'inventory', 'private-item')));
});

test('inactive account can read only its own staff profile, not inventory', async () => {
  const db = testEnv.authenticatedContext('inactive-1').firestore();
  await assertSucceeds(getDoc(doc(db, 'staff', 'inactive-1')));
  await assertFails(getDoc(doc(db, 'tiles', 'legacy-tile')));
});

test('employee item update must carry server audit identity', async () => {
  const db = testEnv.authenticatedContext('employee-1').firestore();
  const ref = doc(db, 'tiles', 'legacy-tile');

  await assertFails(updateDoc(ref, { meters: 9 }));

  await assertSucceeds(
    updateDoc(ref, {
      meters: 9,
      updatedAt: serverTimestamp(),
      updatedBy: 'أحمد',
      updatedByUid: 'employee-1',
    }),
  );
});

test('employee can create a visible item with creation audit only', async () => {
  const db = testEnv.authenticatedContext('employee-1').firestore();

  await assertSucceeds(
    setDoc(doc(db, 'tiles', 'employee-new'), {
      id: 'employee-new',
      categoryId: 'tiles',
      name: 'جديد',
      meters: 12,
      boxes: 6,
      reservations: [],
      createdAt: serverTimestamp(),
      createdBy: 'أحمد',
      createdByUid: 'employee-1',
    }),
  );

  await assertFails(
    setDoc(doc(db, 'tiles', 'employee-forged'), {
      id: 'employee-forged',
      categoryId: 'tiles',
      name: 'مزور',
      meters: 12,
      createdAt: serverTimestamp(),
      createdBy: 'عمر',
      createdByUid: 'admin-1',
    }),
  );
});

test('employee cannot create, edit or delete an admin-only item', async () => {
  const db = testEnv.authenticatedContext('employee-1').firestore();

  await assertFails(
    setDoc(doc(db, 'tiles', 'employee-hidden'), {
      id: 'employee-hidden',
      categoryId: 'tiles',
      name: 'مخفي',
      meters: 5,
      boxes: 2,
      hiddenForStaff: true,
      createdAt: serverTimestamp(),
      createdBy: 'أحمد',
      createdByUid: 'employee-1',
    }),
  );

  await assertFails(
    updateDoc(doc(db, 'tiles', 'admin-only-tile'), {
      meters: 4,
      hiddenForStaff: false,
      updatedAt: serverTimestamp(),
      updatedBy: 'أحمد',
      updatedByUid: 'employee-1',
    }),
  );

  await assertFails(deleteDoc(doc(db, 'tiles', 'admin-only-tile')));
});

test('admin can restore a legacy backup item without fabricated audit metadata', async () => {
  const db = testEnv.authenticatedContext('admin-1').firestore();
  await assertSucceeds(
    setDoc(doc(db, 'tiles', 'backup-item'), {
      id: 'backup-item',
      categoryId: 'tiles',
      name: 'نسخة قديمة',
      meters: 20,
      reservations: [],
    }),
  );
});

test('admin can restore a newer backup while preserving historical audit metadata', async () => {
  const db = testEnv.authenticatedContext('admin-1').firestore();
  await assertSucceeds(
    setDoc(doc(db, 'tiles', 'backup-audited-item'), {
      id: 'backup-audited-item',
      categoryId: 'tiles',
      name: 'نسخة بتاريخ قديم',
      meters: 14,
      reservations: [],
      createdAt: new Date('2026-01-05T10:00:00Z'),
      createdBy: 'موظف سابق',
      createdByUid: 'old-user-id',
      updatedAt: new Date('2026-04-02T10:00:00Z'),
      updatedBy: 'موظف سابق',
      updatedByUid: 'old-user-id',
    }),
  );
});

test('employee cannot impersonate another user in audit metadata', async () => {
  const db = testEnv.authenticatedContext('employee-1').firestore();
  await assertFails(
    updateDoc(doc(db, 'tiles', 'legacy-tile'), {
      meters: 8,
      updatedAt: serverTimestamp(),
      updatedBy: 'عمر',
      updatedByUid: 'admin-1',
    }),
  );
});

test('employee cannot list staff or edit staff profiles', async () => {
  const db = testEnv.authenticatedContext('employee-1').firestore();
  await assertFails(getDocs(collection(db, 'staff')));
  await assertFails(updateDoc(doc(db, 'staff', 'employee-1'), { name: 'اسم آخر' }));
});

test('admin can create a normal staff profile but cannot create another primary admin', async () => {
  const db = testEnv.authenticatedContext('admin-1').firestore();

  await assertSucceeds(
    setDoc(doc(db, 'staff', 'new-employee'), {
      id: 'new-employee',
      name: 'موظف جديد',
      email: 'new@example.com',
      role: 'employee',
      phone: '',
      status: 'active',
      isPrimaryAdmin: false,
      createdAt: serverTimestamp(),
      createdBy: 'admin-1',
    }),
  );

  await assertFails(
    setDoc(doc(db, 'staff', 'fake-primary'), {
      id: 'fake-primary',
      name: 'مدير مزيف',
      email: 'fake@example.com',
      role: 'admin',
      status: 'active',
      isPrimaryAdmin: true,
      createdAt: serverTimestamp(),
      createdBy: 'admin-1',
    }),
  );
});

test('admin can edit staff display details and deactivate another account', async () => {
  const db = testEnv.authenticatedContext('admin-1').firestore();

  await assertSucceeds(
    updateDoc(doc(db, 'staff', 'employee-1'), {
      name: 'أحمد جديد',
      phone: '0590000000',
    }),
  );

  await assertSucceeds(
    updateDoc(doc(db, 'staff', 'employee-1'), {
      status: 'inactive',
      statusUpdatedAt: serverTimestamp(),
      statusUpdatedBy: 'admin-1',
    }),
  );
});

test('primary admin cannot be disabled and an admin cannot disable their own account', async () => {
  const primaryDb = testEnv.authenticatedContext('admin-1').firestore();
  await assertFails(
    updateDoc(doc(primaryDb, 'staff', 'admin-1'), {
      status: 'inactive',
      statusUpdatedAt: serverTimestamp(),
      statusUpdatedBy: 'admin-1',
    }),
  );

  const secondAdminDb = testEnv.authenticatedContext('admin-2').firestore();
  await assertFails(
    updateDoc(doc(secondAdminDb, 'staff', 'admin-2'), {
      status: 'inactive',
      statusUpdatedAt: serverTimestamp(),
      statusUpdatedBy: 'admin-2',
    }),
  );
});

test('employee can delete an item only from a visible category', async () => {
  const db = testEnv.authenticatedContext('employee-1').firestore();
  await assertSucceeds(deleteDoc(doc(db, 'tiles', 'legacy-tile')));
  await assertFails(deleteDoc(doc(db, 'inventory', 'private-item')));
});

test('employee cannot hide categories or items; admin can', async () => {
  const employeeDb = testEnv.authenticatedContext('employee-1').firestore();
  const adminDb = testEnv.authenticatedContext('admin-1').firestore();

  await assertFails(
    updateDoc(doc(employeeDb, 'categories', 'tiles'), {
      visibleToEmployees: false,
      hiddenForStaff: true,
    }),
  );

  await assertSucceeds(
    updateDoc(doc(adminDb, 'categories', 'tiles'), {
      visibleToEmployees: false,
      hiddenForStaff: true,
    }),
  );

  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await updateDoc(doc(db, 'categories', 'tiles'), {
      visibleToEmployees: true,
      hiddenForStaff: false,
    });
  });

  await assertFails(
    updateDoc(doc(employeeDb, 'tiles', 'legacy-tile'), {
      hiddenForStaff: true,
      updatedAt: serverTimestamp(),
      updatedBy: 'أحمد',
      updatedByUid: 'employee-1',
    }),
  );

  await assertSucceeds(
    updateDoc(doc(adminDb, 'tiles', 'legacy-tile'), {
      hiddenForStaff: true,
      updatedAt: serverTimestamp(),
      updatedBy: 'عمر',
      updatedByUid: 'admin-1',
    }),
  );
});

test('active employee can manage category metadata but cannot delete system categories', async () => {
  const db = testEnv.authenticatedContext('employee-1').firestore();

  await assertSucceeds(
    setDoc(doc(db, 'categories', 'employee-custom'), {
      id: 'employee-custom',
      name: 'قسم موظف',
      visibleToEmployees: true,
      isSystemCategory: false,
    }),
  );

  await assertSucceeds(
    updateDoc(doc(db, 'categories', 'employee-custom'), { name: 'قسم موظف معدل' }),
  );

  await assertSucceeds(deleteDoc(doc(db, 'categories', 'employee-custom')));
  await assertFails(deleteDoc(doc(db, 'categories', 'tiles')));
});

test('admin cannot delete porcelain/ceramic category metadata but can delete a custom category', async () => {
  const db = testEnv.authenticatedContext('admin-1').firestore();
  await assertFails(deleteDoc(doc(db, 'categories', 'tiles')));
  await assertFails(deleteDoc(doc(db, 'categories', 'ceramics')));
  await assertSucceeds(deleteDoc(doc(db, 'categories', 'private')));
});

test('legacy logs remain readable to active employees', async () => {
  const db = testEnv.authenticatedContext('employee-1').firestore();
  await assertSucceeds(getDoc(doc(db, 'logs', 'legacy-log')));
});

test('log creation is bound to authenticated UID, staff name and server time', async () => {
  const db = testEnv.authenticatedContext('employee-1').firestore();

  await assertSucceeds(
    setDoc(doc(db, 'logs', 'good-log'), {
      actorUid: 'employee-1',
      user: 'أحمد',
      timestamp: serverTimestamp(),
      action: 'تعديل',
      tileName: 'قديم',
      details: 'اختبار',
      categoryId: 'tiles',
    }),
  );

  await assertFails(
    setDoc(doc(db, 'logs', 'forged-log'), {
      actorUid: 'admin-1',
      user: 'عمر',
      timestamp: serverTimestamp(),
      action: 'تعديل',
      tileName: 'قديم',
      details: 'تزوير',
      categoryId: 'tiles',
    }),
  );
});

test('employee cannot create an audit log for a hidden category', async () => {
  const db = testEnv.authenticatedContext('employee-1').firestore();

  await assertFails(
    setDoc(doc(db, 'logs', 'hidden-category-log'), {
      actorUid: 'employee-1',
      user: 'أحمد',
      timestamp: serverTimestamp(),
      action: 'إضافة',
      tileName: 'غير مسموح',
      details: 'اختبار قسم مخفي',
      categoryId: 'private',
    }),
  );
});

test('employee cannot mark an audit log as admin-only data', async () => {
  const db = testEnv.authenticatedContext('employee-1').firestore();

  await assertFails(
    setDoc(doc(db, 'logs', 'hidden-item-log'), {
      actorUid: 'employee-1',
      user: 'أحمد',
      timestamp: serverTimestamp(),
      action: 'تعديل',
      tileName: 'قديم',
      details: 'اختبار',
      categoryId: 'tiles',
      hiddenForStaff: true,
    }),
  );
});


test('admin may create a hidden-item audit log while employees cannot', async () => {
  const adminDb = testEnv.authenticatedContext('admin-1').firestore();

  await assertSucceeds(
    setDoc(doc(adminDb, 'logs', 'admin-hidden-item-log'), {
      actorUid: 'admin-1',
      user: 'عمر',
      timestamp: serverTimestamp(),
      action: 'إضافة',
      tileName: 'صنف مدير فقط',
      details: 'اختبار',
      categoryId: 'tiles',
      hiddenForStaff: true,
    }),
  );
});
