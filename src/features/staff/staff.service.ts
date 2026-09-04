import { deleteApp, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';

import {
  auth,
  db,
  firebaseConfig,
  getAuditTimestamp,
  isFirebaseConfigured,
} from '@/services/firebase';
import { StaffMember, StaffRole } from '@/types';

const PRIMARY_ADMIN_EMAIL = String(import.meta.env.VITE_PRIMARY_ADMIN_EMAIL || '')
  .trim()
  .toLowerCase();
const PRIMARY_ADMIN_NAME = String(import.meta.env.VITE_PRIMARY_ADMIN_NAME || 'عمر').trim() || 'عمر';

const BASE_CATEGORY_DOCS = [
  {
    id: 'tiles',
    name: 'بورسلان',
    themeColor: 'sky',
    defaultUnit: 'meters',
    template: 'porcelain',
    visibleToEmployees: true,
    hiddenForStaff: false,
    isSystemCategory: true,
  },
  {
    id: 'ceramics',
    name: 'سيراميك',
    themeColor: 'rose',
    defaultUnit: 'meters',
    template: 'ceramic',
    visibleToEmployees: true,
    hiddenForStaff: false,
    isSystemCategory: true,
  },
  {
    id: 'shower_box',
    name: 'شور بكس',
    themeColor: 'emerald',
    defaultUnit: 'pieces',
    template: 'shower_box',
    iconType: 'shower',
    visibleToEmployees: true,
    hiddenForStaff: false,
    isSystemCategory: false,
  },
] as const;

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();

const validateNewStaff = (input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: StaffRole;
}) => {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const password = String(input.password || '');
  const phone = String(input.phone || '').trim();
  const role = input.role;

  if (name.length < 2 || name.length > 100) {
    throw new Error('اسم الموظف يجب أن يكون بين حرفين و100 حرف.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('البريد الإلكتروني غير صالح.');
  }

  if (password.length < 8 || password.length > 128) {
    throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
  }

  if (phone.length > 40) {
    throw new Error('رقم الهاتف طويل بشكل غير صالح.');
  }

  if (role !== 'admin' && role !== 'employee') {
    throw new Error('صلاحية الموظف غير صحيحة.');
  }

  return { name, email, password, phone, role };
};

const mapAuthError = (error: any): Error => {
  const code = String(error?.code || '');

  if (code === 'auth/email-already-in-use') {
    return new Error('هذا البريد الإلكتروني مستخدم بحساب موجود مسبقًا.');
  }
  if (code === 'auth/invalid-email') {
    return new Error('البريد الإلكتروني غير صالح.');
  }
  if (code === 'auth/weak-password') {
    return new Error('كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل.');
  }
  if (code === 'auth/operation-not-allowed') {
    return new Error('تسجيل الدخول بالبريد وكلمة المرور غير مفعّل في Firebase Authentication.');
  }
  if (code === 'auth/network-request-failed') {
    return new Error('تعذر الاتصال بـ Firebase. تحقق من الإنترنت ثم حاول مجددًا.');
  }

  return error instanceof Error ? error : new Error('حدث خطأ أثناء إنشاء الحساب.');
};

export const staffService = {
  subscribeToStaff: (callback: (staff: StaffMember[]) => void) => {
    return db.collection('staff').onSnapshot((snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(document => ({
          id: document.id,
          ...document.data(),
        })) as StaffMember[];
        callback(list);
      } else {
        callback([]);
      }
    });
  },

  /**
   * One-time bootstrap for the existing Firebase account.
   * This only creates the missing staff profile for the configured primary email.
   * It never writes to tiles, ceramics, inventory or logs.
   *
   * IMPORTANT: run this once while the project's CURRENT legacy rule
   * `allow read, write: if request.auth != null` is still deployed. After the
   * profile exists, deploy the hardened firestore.rules supplied with the app.
   */
  bootstrapPrimaryAdmin: async (input: {
    uid: string;
    email: string | null | undefined;
  }): Promise<void> => {
    if (!isFirebaseConfigured) {
      throw new Error('إعدادات Firebase غير مكتملة.');
    }

    const uid = String(input.uid || '').trim();
    const email = normalizeEmail(input.email);

    if (!uid || uid.includes('/') || uid.length > 200) {
      throw new Error('معرّف حساب Firebase غير صالح.');
    }

    if (!PRIMARY_ADMIN_EMAIL) {
      throw new Error('أضف VITE_PRIMARY_ADMIN_EMAIL في ملف .env ثم أعد تشغيل التطبيق.');
    }

    if (!email || email !== PRIMARY_ADMIN_EMAIL) {
      throw new Error('هذا الحساب غير معتمد كمدير رئيسي في ملف .env.');
    }

    const target = db.collection('staff').doc(uid);
    const existing = await target.get();
    if (existing.exists) return;

    // Under the legacy rules we can verify that a primary profile was not already created.
    const staffSnapshot = await db.collection('staff').limit(1).get();
    if (!staffSnapshot.empty) {
      throw new Error('تم إعداد الموظفين مسبقًا. لا يمكن إنشاء مدير رئيسي ثانٍ تلقائيًا.');
    }

    await target.set({
      id: uid,
      name: PRIMARY_ADMIN_NAME,
      email,
      role: 'admin',
      status: 'active',
      isPrimaryAdmin: true,
      createdAt: getAuditTimestamp(),
      createdBy: uid,
    });
  },

  /** Creates only missing category metadata. Existing inventory documents are untouched. */
  ensureBaseCategories: async (): Promise<void> => {
    for (const category of BASE_CATEGORY_DOCS) {
      const ref = db.collection('categories').doc(category.id);
      const existing = await ref.get();
      if (!existing.exists) {
        await ref.set(category);
      }
    }
  },

  /**
   * Creates a Firebase Auth user through a SECONDARY Firebase app, so the
   * currently signed-in manager is never logged out. Works on the Spark plan.
   */
  createStaff: async (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role: StaffRole;
  }): Promise<void> => {
    if (!isFirebaseConfigured) {
      throw new Error('خدمة Firebase غير مهيأة بعد.');
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('يجب تسجيل دخول المدير أولًا.');
    }

    const clean = validateNewStaff(input);
    const secondaryName = `staff-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryName);
    const secondaryAuth = getAuth(secondaryApp);
    let createdUser: Awaited<ReturnType<typeof createUserWithEmailAndPassword>>['user'] | null = null;

    try {
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        clean.email,
        clean.password,
      );
      createdUser = credential.user;

      try {
        await updateProfile(createdUser, { displayName: clean.name });
      } catch (profileError) {
        console.warn('Firebase displayName update failed; staff profile remains authoritative.', profileError);
      }

      await db.collection('staff').doc(createdUser.uid).set({
        id: createdUser.uid,
        name: clean.name,
        email: clean.email,
        role: clean.role,
        phone: clean.phone,
        status: 'active',
        isPrimaryAdmin: false,
        createdAt: getAuditTimestamp(),
        createdBy: currentUser.uid,
      });
    } catch (error) {
      if (createdUser) {
        try {
          await deleteUser(createdUser);
        } catch (rollbackError) {
          console.error('Failed to rollback newly-created Firebase Auth user:', rollbackError);
        }
      }
      throw mapAuthError(error);
    } finally {
      try {
        await firebaseSignOut(secondaryAuth);
      } catch {
        // Secondary auth session is isolated from the manager; cleanup continues below.
      }
      try {
        await deleteApp(secondaryApp);
      } catch {
        // No user-facing impact if app cleanup is already complete.
      }
    }
  },

  /**
   * Spark-plan safe account disabling: the Auth identity remains in Authentication,
   * while the staff profile is marked inactive. The app and Firestore rules deny
   * all inventory access to inactive profiles.
   */
  setStaffStatus: async (uid: string, status: 'active' | 'inactive'): Promise<void> => {
    const cleanUid = String(uid || '').trim();
    if (!cleanUid || cleanUid.includes('/') || cleanUid.length > 200) {
      throw new Error('معرّف الموظف غير صالح.');
    }

    if (status !== 'active' && status !== 'inactive') {
      throw new Error('حالة الموظف غير صالحة.');
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('يجب تسجيل دخول المدير أولًا.');
    }

    const ref = db.collection('staff').doc(cleanUid);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      throw new Error('حساب الموظف غير موجود.');
    }

    const data = snapshot.data();
    if (data.isPrimaryAdmin === true) {
      throw new Error('لا يمكن تعطيل المدير الرئيسي.');
    }
    if (status === 'inactive' && cleanUid === currentUser.uid) {
      throw new Error('لا يمكنك تعطيل حسابك الحالي.');
    }

    await ref.update({
      status,
      statusUpdatedAt: getAuditTimestamp(),
      statusUpdatedBy: currentUser.uid,
    });
  },
};
