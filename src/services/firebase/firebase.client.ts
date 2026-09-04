import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, where, 
  orderBy, 
  limit,
  startAfter as firestoreStartAfter,
  documentId,
  serverTimestamp,
  Firestore,
  DocumentData,
  QuerySnapshot
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  Auth, 
  User 
} from 'firebase/auth';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};


export function isPermissionDenied(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  return code === "permission-denied" || code === "firestore/permission-denied";
}

export const PROTECTED_LOCAL_KEYS = [
  'cached_tiles_porcelain_v2',
  'cached_tiles_ceramic_v2',
  'cached_other_items_v2',
  'cached_categories_v2',
  'active_staff_list_v2',
  'cached_logs',
];

export function clearProtectedLocalData() {
  for (const key of PROTECTED_LOCAL_KEYS) {
    localStorage.removeItem(key);
  }
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.authDomain &&
  firebaseConfig.projectId && 
  firebaseConfig.appId &&
  !firebaseConfig.apiKey.includes('placeholder')
);

// Initialize Firebase App singleton safely
let appInstance: FirebaseApp | null = null;
let rawFirestore: Firestore | null = null;
let rawAuth: Auth | null = null;

if (isFirebaseConfigured) {
  try {
    appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    rawFirestore = getFirestore(appInstance);
    rawAuth = getAuth(appInstance);
  } catch (error) {
    console.error('Firebase initialization failed:', error);
  }
}

// Local storage keys mapping for fallback & instant cached access
const LOCAL_STORAGE_KEYS: Record<string, string> = {
  tiles: 'cached_tiles_porcelain_v2',
  ceramics: 'cached_tiles_ceramic_v2',
  inventory: 'cached_other_items_v2',
  categories: 'cached_categories_v2',
  staff: 'active_staff_list_v2',
  logs: 'cached_logs',
};

const getLocalData = (collectionName: string): any[] => {
  try {
    const key = LOCAL_STORAGE_KEYS[collectionName] || `cached_${collectionName}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const setLocalData = (collectionName: string, items: any[]) => {
  try {
    const key = LOCAL_STORAGE_KEYS[collectionName] || `cached_${collectionName}`;
    localStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.warn(`Failed to persist local cache for ${collectionName}:`, err);
  }
};

/**
 * Firestore rejects `undefined` anywhere inside an object/array. Form data can
 * legitimately contain optional fields, so normalize only plain JS objects
 * before writes while preserving Date, Firestore FieldValue/serverTimestamp,
 * Blob and other SDK objects unchanged.
 */
const isPlainRecord = (value: unknown): value is Record<string, any> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

export const sanitizeFirestoreData = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value
      .filter(item => item !== undefined)
      .map(item => sanitizeFirestoreData(item)) as T;
  }

  if (isPlainRecord(value)) {
    const clean: Record<string, any> = {};
    Object.entries(value).forEach(([key, item]) => {
      if (item !== undefined) {
        clean[key] = sanitizeFirestoreData(item);
      }
    });
    return clean as T;
  }

  return value;
};

// Unified Database Adapter supporting Firestore + local offline caching
export interface DocumentRef {
  id: string;
  get: () => Promise<{ exists: boolean; data: () => any }>;
  set: (data: any, options?: { merge?: boolean }) => Promise<void>;
  update: (data: any) => Promise<void>;
  delete: () => Promise<void>;
  onSnapshot: (
    onNext: (snapshot: { exists: boolean; data: () => any }) => void,
    onError?: (error: any) => void
  ) => () => void;
}

export interface QueryRef {
  where: (field: string, operator: '==', value: any) => QueryRef;
  orderBy: (field: string, direction?: 'asc' | 'desc') => QueryRef;
  limit: (count: number) => QueryRef;
  startAfter: (value: any) => QueryRef;
  get: () => Promise<{ empty: boolean; docs: Array<{ id: string; data: () => any }> }>;
  onSnapshot: (
    onNext: (snapshot: { empty: boolean; docs: Array<{ id: string; data: () => any }> }) => void,
    onError?: (error: any) => void
  ) => () => void;
}

export interface CollectionRef extends QueryRef {
  doc: (id?: string) => DocumentRef;
  add: (data: any) => Promise<{ id: string }>;
}

const applyLocalQueryConstraints = (
  items: any[],
  whereClauses: Array<{
    field: string;
    operator: '==';
    value: any;
  }>,
  orderField: string | null,
  orderDirection:
    'asc' | 'desc',
  limitCount: number | null,
  startAfterValue: any = null
) => {
  let result = [...items];

  if (whereClauses.length > 0) {
    result = result.filter(item =>
      whereClauses.every(
        clause =>
          item?.[clause.field] ===
          clause.value
      )
    );
  }

  if (orderField) {
    const normalize = (value: any) => value?.seconds ?? value ?? 0;

    result.sort((a, b) => {
      const aValue = normalize(orderField === '__name__' ? a?.id : a?.[orderField]);
      const bValue = normalize(orderField === '__name__' ? b?.id : b?.[orderField]);

      if (aValue === bValue) {
        return 0;
      }

      if (
        orderDirection === 'desc'
      ) {
        return aValue < bValue
          ? 1
          : -1;
      }

      return aValue > bValue
        ? 1
        : -1;
    });
  }

  if (startAfterValue !== null && orderField) {
    result = result.filter(item => {
      const value = orderField === '__name__' ? item?.id : item?.[orderField];
      if (orderDirection === 'desc') return value < startAfterValue;
      return value > startAfterValue;
    });
  }

  if (limitCount !== null) {
    result = result.slice(0, limitCount);
  }

  return result;
};

const createCollectionRef = (collectionName: string): CollectionRef => {
  let orderField: string | null = null;
  let orderDirection: 'asc' | 'desc' = 'asc';
  let limitCount: number | null = null;
  let startAfterValue: any = null;
  let whereClauses: { field: string, operator: '==', value: any }[] = [];

  const createQueryInstance = (
    currentOrderField: string | null = orderField,
    currentDir: 'asc' | 'desc' = orderDirection,
    currentLimit: number | null = limitCount,
    currentWhereClauses: Array<{ field: string; operator: '=='; value: any }> = [...whereClauses],
    currentStartAfter: any = startAfterValue
  ): QueryRef => {
    return {
      where(field: string, operator: '==', value: any) {
        return createQueryInstance(currentOrderField, currentDir, currentLimit, [...currentWhereClauses, { field, operator, value }], currentStartAfter);
      },
      orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
        return createQueryInstance(field, direction as any, currentLimit, currentWhereClauses, currentStartAfter);
      },
      limit(count: number) {
        return createQueryInstance(currentOrderField, currentDir, count, currentWhereClauses, currentStartAfter);
      },
      startAfter(value: any) {
        return createQueryInstance(currentOrderField, currentDir, currentLimit, currentWhereClauses, value);
      },
      async get() {
        if (rawFirestore) {
          try {
            const colRef = collection(rawFirestore, collectionName);
            const constraints = [];
            if (currentWhereClauses.length > 0) {
              currentWhereClauses.forEach(c => constraints.push(where(c.field, c.operator, c.value)));
            }
            if (currentOrderField) {
              constraints.push(orderBy(currentOrderField === '__name__' ? documentId() : currentOrderField, currentDir as "asc" | "desc") as any);
            }
            if (currentStartAfter !== null) {
              constraints.push(firestoreStartAfter(currentStartAfter));
            }
            if (currentLimit) {
              constraints.push(limit(currentLimit));
            }
            const q = constraints.length > 0 ? query(colRef, ...constraints) : colRef;
            const snap = await getDocs(q);
            return {
              empty: snap.empty,
              docs: snap.docs.map(d => ({ id: d.id, data: () => d.data() }))
            };
          } catch (e) {
            if (isPermissionDenied(e)) throw e;
            console.warn(`Firestore get docs fallback for ${collectionName}:`, e);
            if (rawFirestore) throw e;
          }
        }
        if (rawFirestore) throw new Error("Firestore is initialized but get() failed");
        
        const local =
          applyLocalQueryConstraints(
            getLocalData(
              collectionName
            ),
            currentWhereClauses,
            currentOrderField,
            currentDir,
            currentLimit,
            currentStartAfter
          );

        return {
          empty:
            local.length === 0,

          docs:
            local.map(item => ({
              id: item.id,
              data: () => item
            }))
        };
      },
      onSnapshot(
        onNext,
        onError
      ) {
        if (rawFirestore) {
          try {
            const colRef =
              collection(
                rawFirestore,
                collectionName
              );

            const constraints: any[] =
              [];

            currentWhereClauses.forEach(
              clause => {
                constraints.push(
                  where(
                    clause.field,
                    clause.operator,
                    clause.value
                  )
                );
              }
            );

            if (currentOrderField) {
              constraints.push(
                orderBy(
                  currentOrderField === '__name__' ? documentId() : currentOrderField,
                  currentDir
                )
              );
            }

            if (currentStartAfter !== null) {
              constraints.push(firestoreStartAfter(currentStartAfter));
            }

            if (currentLimit !== null) {
              constraints.push(limit(currentLimit));
            }

            const firestoreQuery =
              constraints.length > 0
                ? query(
                    colRef,
                    ...constraints
                  )
                : colRef;

            return onSnapshot(
              firestoreQuery,

              snapshot => {
                onNext({
                  empty:
                    snapshot.empty,

                  docs:
                    snapshot.docs.map(
                      docSnapshot => ({
                        id:
                          docSnapshot.id,

                        data: () =>
                          docSnapshot.data()
                      })
                    )
                });
              },

              error => {
                onError?.(error);

                if (
                  isPermissionDenied(
                    error
                  )
                ) {
                  onNext({
                    empty: true,
                    docs: []
                  });
                }
              }
            );
          } catch (error) {
            onError?.(error);

            if (
              isPermissionDenied(
                error
              )
            ) {
              onNext({
                empty: true,
                docs: []
              });
            }

            // Firebase configured:
            // NEVER fall back to LocalStorage.
            return () => {};
          }
        }

        const emitLocalSnapshot =
          () => {
            const local =
              applyLocalQueryConstraints(
                getLocalData(
                  collectionName
                ),
                currentWhereClauses,
                currentOrderField,
                currentDir,
                currentLimit,
                currentStartAfter
              );

            onNext({
              empty:
                local.length === 0,

              docs:
                local.map(item => ({
                  id: item.id,
                  data: () => item
                }))
            });
          };

        emitLocalSnapshot();

        const handleStorage = (
          event: StorageEvent
        ) => {
          const key =
            LOCAL_STORAGE_KEYS[
              collectionName
            ] ||
            `cached_${collectionName}`;

          if (event.key === key) {
            emitLocalSnapshot();
          }
        };

        window.addEventListener(
          'storage',
          handleStorage
        );

        return () => {
          window.removeEventListener(
            'storage',
            handleStorage
          );
        };
      }
    };
  };

  const queryObj = createQueryInstance();

  return {
    ...queryObj,
    doc(id?: string): DocumentRef {
      const docId = id || `doc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      return {
        id: docId,
        async get() {
          if (rawFirestore) {
            try {
              const dRef = doc(rawFirestore, collectionName, docId);
              const snap = await getDoc(dRef);
              return {
                exists: snap.exists(),
                data: () => snap.data()
              };
            } catch (e) {
              if (isPermissionDenied(e)) throw e;
              console.warn(`Firestore get doc fallback for ${collectionName}/${docId}:`, e);
              if (rawFirestore) throw e;
            }
          }
          if (rawFirestore) throw new Error("Firestore is initialized but get() failed");

          const items = getLocalData(collectionName);
          const found = items.find(i => i.id === docId);
          return {
            exists: Boolean(found),
            data: () => found || {}
          };
        },
        async set(data: any, options?: { merge?: boolean }) {
          if (rawFirestore) {
             const dRef = doc(rawFirestore, collectionName, docId);
             await setDoc(dRef, sanitizeFirestoreData(data), options || {});
             return;
          }

          const items = getLocalData(collectionName);
          const index = items.findIndex(i => i.id === docId);
          const cleanData = sanitizeFirestoreData(data);
          const mergedData = options?.merge && index >= 0 ? { ...items[index], ...cleanData, id: docId } : { ...cleanData, id: docId };
          if (index >= 0) {
            items[index] = mergedData;
          } else {
            items.unshift(mergedData);
          }
          setLocalData(collectionName, items);
        },
        async update(data: any) {
          if (rawFirestore) {
            const dRef = doc(rawFirestore, collectionName, docId);
            await updateDoc(dRef, sanitizeFirestoreData(data));
            return;
          }

          const items = getLocalData(collectionName);
          const index = items.findIndex(i => i.id === docId);
          if (index < 0) {
            throw new Error(`Cannot update missing local document: ${collectionName}/${docId}`);
          }

          items[index] = { ...items[index], ...sanitizeFirestoreData(data), id: docId };
          setLocalData(collectionName, items);
        },
        async delete() {
          if (rawFirestore) {
            const dRef = doc(rawFirestore, collectionName, docId);
            await deleteDoc(dRef);
            return;
          }

          const items = getLocalData(collectionName);
          const updated = items.filter(i => i.id !== docId);
          setLocalData(collectionName, updated);
        },
        onSnapshot(onNext, onError) {
          if (rawFirestore) {
            const dRef = doc(rawFirestore, collectionName, docId);
            return onSnapshot(
              dRef,
              snapshot => {
                onNext({
                  exists: snapshot.exists(),
                  data: () => snapshot.data(),
                });
              },
              onError,
            );
          }

          const emitLocalSnapshot = () => {
            const items = getLocalData(collectionName);
            const found = items.find(item => item.id === docId);
            onNext({
              exists: Boolean(found),
              data: () => found || {},
            });
          };

          emitLocalSnapshot();

          const handleStorage = (event: StorageEvent) => {
            const key = LOCAL_STORAGE_KEYS[collectionName] || `cached_${collectionName}`;
            if (event.key === key) emitLocalSnapshot();
          };

          window.addEventListener('storage', handleStorage);
          return () => window.removeEventListener('storage', handleStorage);
        }
      };
    },
    async add(data: any) {
      const generatedId = `item_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      const docRef = this.doc(generatedId);
      await docRef.set(data);
      return { id: generatedId };
    }
  };
};

export const db = {
  collection: (collectionName: string) => createCollectionRef(collectionName),
};

export const auth = {
  get currentUser() {
    return rawAuth?.currentUser ?? null;
  },
  onAuthStateChanged: (callback: (user: any) => void) => {
    if (rawAuth) {
      return onAuthStateChanged(rawAuth, callback);
    }

    callback(null);
    return () => {};
  },
  signInWithEmailAndPassword: async (email: string, pass: string) => {
    if (!rawAuth) {
      throw new Error('Firebase Auth is not configured.');
    }

    return await signInWithEmailAndPassword(rawAuth, email, pass);
  },
  signOut: async () => {
    clearProtectedLocalData();
    if (!rawAuth) return;

    try {
      await signOut(rawAuth);
    } catch (err) {
      console.error('Firebase signOut error', err);
      throw err;
    }
  },
};


export const getAuditTimestamp = () => {
  if (rawFirestore) {
    return serverTimestamp();
  }
  return {
    seconds: Math.floor(Date.now() / 1000)
  };
};
