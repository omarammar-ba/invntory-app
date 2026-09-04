import React, {
  startTransition,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { AnimatePresence, motion, LayoutGroup } from 'motion/react';
import { CATEGORY_ACCENTS, springTransition, motionEase } from '@/styles/motion';

import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import {
  ListIcon,
  HomeIcon,
  PlusIcon,
  HistoryIcon,
  SearchIcon,
  FolderIcon,
  MenuIcon,
  PrintIcon
} from "@/components/ui/Icons";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { PullToRefresh } from "@/components/ui/PullToRefresh";

import { Login } from "@/features/auth";
import { Dashboard, SummaryCards } from "@/features/dashboard";
import {
  TileList,
  TileForm,
  SearchFilter,
  ImageModal,
  ReservationModal,
  FullListModal,
  inventoryService
} from "@/features/inventory";
import { CategoryManagerModal, DEFAULT_SHOWER_BOX_FIELDS, categoryService } from "@/features/categories";
import { StaffManagerModal, staffService } from "@/features/staff";
import { BackupModal } from "@/features/backup";
import { SettingsModal, PrintPdfModal } from "@/features/settings";
import { LogsView } from "@/features/logs";

import {
  db,
  auth,
  isPermissionDenied,
  clearProtectedLocalData,
  isFirebaseConfigured,
  getAuditTimestamp
} from "@/services/firebase";

import {
  Tile,
  Reservation,
  LogEntry,
  Category,
  StaffMember
} from "@/types";


type ViewMode =
  | 'dashboard'
  | 'inventory'
  | 'logs'
  | 'settings'
  | 'staff'
  | 'backup';

type AddItemSource =
  | 'category'
  | 'global';

const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'tiles',
    name: 'بورسلان',
    themeColor: 'sky',
    defaultUnit: 'meters',
    template: 'porcelain',
    visibleToEmployees: true,
    hiddenForStaff: false,
    isSystemCategory: true,

    fieldsConfig: {
      hasImage: true,
      hasSize: true,
      hasItemType: false,
      hasMaterial: false,
      hasColor: false,
      hasBrand: false,
      hasBoxCalc: true,
    },
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

    fieldsConfig: {
      hasImage: true,
      hasSize: true,
      hasItemType: false,
      hasMaterial: false,
      hasColor: false,
      hasBrand: false,
      hasBoxCalc: true,
    },
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
    itemNameLabel: 'اسم الصنف',
    customFields: DEFAULT_SHOWER_BOX_FIELDS.map(field => ({
      ...field,
      options: field.options?.map(option => ({ ...option })),
    })),

    fieldsConfig: {
      hasImage: true,
      hasSize: false,
      hasItemType: false,
      hasMaterial: false,
      hasColor: false,
      hasBrand: false,
      hasBoxCalc: false,
    },
  },
];


const UI_CACHE_VERSION = 1;
const UI_CACHE_PREFIX = 'inventory_ui_cache_v1';
const INVENTORY_FIRST_PAGE_SIZE = 24;
const INVENTORY_NEXT_PAGE_SIZE = 64;
const INVENTORY_CACHE_WRITE_DELAY_MS = 1000;
const RETURN_REFRESH_MIN_INTERVAL_MS = 60_000;

interface InventoryUiCache {
  version: number;
  savedAt: number;
  porcelainTiles: Tile[];
  ceramicTiles: Tile[];
  otherItems: Tile[];
  categories: Category[];
  logs: LogEntry[];
}

const getInventoryUiCacheKey = (
  uid: string,
  role: StaffMember['role']
) => `${UI_CACHE_PREFIX}:${uid}:${role}`;

const makeCacheFriendlyTile = (tile: Tile): Tile => ({
  ...tile,
  // Images can be several MB as base64. Keep the fast-start cache lightweight;
  // Firestore restores the real image a moment later in the background.
  image: '',
});

const readInventoryUiCache = (
  uid: string,
  role: StaffMember['role']
): InventoryUiCache | null => {
  try {
    const raw = localStorage.getItem(getInventoryUiCacheKey(uid, role));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InventoryUiCache;
    if (
      parsed?.version !== UI_CACHE_VERSION ||
      !Array.isArray(parsed.porcelainTiles) ||
      !Array.isArray(parsed.ceramicTiles) ||
      !Array.isArray(parsed.otherItems) ||
      !Array.isArray(parsed.categories) ||
      !Array.isArray(parsed.logs)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeInventoryUiCache = (
  uid: string,
  role: StaffMember['role'],
  payload: Omit<InventoryUiCache, 'version' | 'savedAt'>
) => {
  try {
    const cache: InventoryUiCache = {
      version: UI_CACHE_VERSION,
      savedAt: Date.now(),
      porcelainTiles: payload.porcelainTiles.map(makeCacheFriendlyTile),
      ceramicTiles: payload.ceramicTiles.map(makeCacheFriendlyTile),
      otherItems: payload.otherItems.map(makeCacheFriendlyTile),
      categories: payload.categories,
      logs: payload.logs.slice(0, 100),
    };

    localStorage.setItem(
      getInventoryUiCacheKey(uid, role),
      JSON.stringify(cache)
    );
  } catch (error) {
    // A cache failure must never block the live Firestore experience.
    console.warn('Unable to save instant inventory UI cache:', error);
  }
};

const App: React.FC = () => {
  const [
    user,
    setUser
  ] = useState<any>(
    null
  );

  const [
    authLoading,
    setAuthLoading
  ] = useState<boolean>(
    true
  );

  const [
    isDarkMode,
    setIsDarkMode
  ] = useState<boolean>(
    () => {
      if (
        typeof window !==
        'undefined'
      ) {
        const savedTheme =
          localStorage.getItem(
            'app_theme'
          );

        if (savedTheme) {
          return (
            savedTheme ===
            'dark'
          );
        }

        return false;
      }

      return false;
    }
  );

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement
        .classList
        .add('dark');

      localStorage.setItem(
        'app_theme',
        'dark'
      );
    } else {
      document.documentElement
        .classList
        .remove('dark');

      localStorage.setItem(
        'app_theme',
        'light'
      );
    }
  }, [
    isDarkMode
  ]);

  const [
    porcelainTiles,
    setPorcelainTiles
  ] = useState<Tile[]>(
    []
  );

  const [
    ceramicTiles,
    setCeramicTiles
  ] = useState<Tile[]>(
    []
  );

  const [
    otherItems,
    setOtherItems
  ] = useState<Tile[]>(
    []
  );

  const [
    logs,
    setLogs
  ] = useState<LogEntry[]>(
    []
  );

  const [
    loading,
    setLoading
  ] = useState<boolean>(
    false
  );


  const [
    inventoryRefreshVersion,
    setInventoryRefreshVersion
  ] = useState(0);

  const [
    inventorySyncError,
    setInventorySyncError
  ] = useState<string | null>(null);

  const [
    pendingInventoryAction,
    setPendingInventoryAction
  ] = useState<'print' | 'backup' | null>(null);

  const [
    editingTile,
    setEditingTile
  ] = useState<
    Tile | null
  >(null);

  const [
    viewingImage,
    setViewingImage
  ] = useState<
    string | null
  >(null);

  const [
    searchQuery,
    setSearchQuery
  ] = useState<string>(
    ''
  );

  const [
    deleteTargetId,
    setDeleteTargetId
  ] = useState<
    string | null
  >(null);

  const [
    reservingTile,
    setReservingTile
  ] = useState<
    Tile | null
  >(null);

  const [
    view,
    setView
  ] = useState<ViewMode>(
    'dashboard'
  );

  const [
    isAddingNew,
    setIsAddingNew
  ] = useState(false);

  const [
    addItemSource,
    setAddItemSource
  ] = useState<AddItemSource>(
    'category'
  );

  const [
    selectedModelForLogs,
    setSelectedModelForLogs
  ] = useState<
    string | null
  >(null);

  const [
    isSidebarOpen,
    setIsSidebarOpen
  ] = useState(false);

  const [
    isCategoryModalOpen,
    setIsCategoryModalOpen
  ] = useState(false);

  const [
    isSettingsModalOpen,
    setIsSettingsModalOpen
  ] = useState(false);

  const [
    editingCategoryModalId,
    setEditingCategoryModalId
  ] = useState<
    string | null
  >(null);

  const [
    categories,
    setCategories
  ] = useState<Category[]>(
    []
  );

  const [
    categoriesReady,
    setCategoriesReady
  ] = useState(false);

  const [
    activeCategoryId,
    setActiveCategoryId
  ] = useState<
    string | null
  >('tiles');

  const [
    isStaffModalOpen,
    setIsStaffModalOpen
  ] = useState(false);

  const [
    isPrintPdfModalOpen,
    setIsPrintPdfModalOpen
  ] = useState(false);

  const [
    isFullListModalOpen,
    setIsFullListModalOpen
  ] = useState(false);

  const [
    currentStaff,
    setCurrentStaff
  ] = useState<
    StaffMember | null
  >(null);


  const clearSecuritySensitiveState =
    useCallback(
      () => {
        setPorcelainTiles([]);
        setCeramicTiles([]);
        setOtherItems([]);
        setCategories([]);
        setCategoriesReady(false);
        setLogs([]);
        setSearchQuery('');

        clearProtectedLocalData();
      },
      []
    );


  useEffect(() => {
    if (authLoading) return;

    const launchSplash = document.getElementById('app-launch-splash');
    if (!launchSplash) {
      document.documentElement.classList.remove('app-launching');
      return;
    }

    launchSplash.classList.add('app-launch-splash--hidden');
    const removeTimer = window.setTimeout(() => {
      launchSplash.remove();
      document.documentElement.classList.remove('app-launching');
    }, 320);

    return () => window.clearTimeout(removeTimer);
  }, [authLoading]);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      clearSecuritySensitiveState();
      setUser(null);
      setCurrentStaff(null);
      setAuthLoading(false);
      return;
    }

    const unsubscribe = auth.onAuthStateChanged(async u => {
      if (!u) {
        clearSecuritySensitiveState();
        setUser(null);
        setCurrentStaff(null);
        setAuthLoading(false);
        return;
      }

      setAuthLoading(true);
      clearSecuritySensitiveState();

      try {
        let staffDoc = await db.collection('staff').doc(u.uid).get();

        // One-time production bootstrap for the existing Firebase account.
        // It creates only the missing staff profile; inventory data is never touched.
        if (!staffDoc.exists) {
          await staffService.bootstrapPrimaryAdmin({
            uid: u.uid,
            email: u.email,
          });
          staffDoc = await db.collection('staff').doc(u.uid).get();
        }

        if (!staffDoc.exists) {
          throw new Error('لا يوجد ملف صلاحيات لهذا الحساب.');
        }

        const data = staffDoc.data();

        if (data.status !== 'active') {
          throw new Error('هذا الحساب غير نشط.');
        }

        if (data.role !== 'admin' && data.role !== 'employee') {
          throw new Error('صلاحية الحساب غير صحيحة.');
        }

        const activeStaff: StaffMember = {
          id: u.uid,
          name: String(data.name || '').trim() || 'مستخدم',
          email: String(data.email || u.email || ''),
          role: data.role,
          status: data.status,
          phone: data.phone || '',
          createdAt: data.createdAt || '',
          lastActive: data.lastActive,
          isPrimaryAdmin: data.isPrimaryAdmin === true,
          createdBy: data.createdBy,
        };

        const cachedUi = readInventoryUiCache(u.uid, activeStaff.role);
        if (cachedUi) {
          setPorcelainTiles(cachedUi.porcelainTiles);
          setCeramicTiles(cachedUi.ceramicTiles);
          setOtherItems(cachedUi.otherItems);
          setCategories(cachedUi.categories);
          setLogs(cachedUi.logs);
        }

        setCurrentStaff(activeStaff);
        setUser(u);

        if (activeStaff.role === 'admin') {
          // Do not block the already-authenticated app shell/cache while checking
          // one-time category metadata. Inventory documents are never touched here.
          void staffService.ensureBaseCategories().catch(error => {
            console.error('Base category bootstrap failed:', error);
          });
        }
      } catch (err) {
        console.error('Error loading authenticated staff account:', err);
        clearSecuritySensitiveState();
        setCurrentStaff(null);
        setUser(null);

        try {
          await auth.signOut();
        } catch (signOutError) {
          console.error('Failed to sign out invalid staff account:', signOutError);
        }
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, [clearSecuritySensitiveState]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const unsubscribe = db
      .collection('staff')
      .doc(user.uid)
      .onSnapshot(
        snapshot => {
          if (!snapshot.exists) {
            clearSecuritySensitiveState();
            setCurrentStaff(null);
            setUser(null);
            void auth.signOut();
            return;
          }

          const data = snapshot.data();
          if (
            data.status !== 'active' ||
            (data.role !== 'admin' && data.role !== 'employee')
          ) {
            clearSecuritySensitiveState();
            setCurrentStaff(null);
            setUser(null);
            void auth.signOut();
            return;
          }

          setCurrentStaff(previous => ({
            id: user.uid,
            name: String(data.name || previous?.name || '').trim() || 'مستخدم',
            email: String(data.email || previous?.email || user.email || ''),
            role: data.role,
            status: data.status,
            phone: data.phone || '',
            createdAt: data.createdAt || previous?.createdAt || '',
            lastActive: data.lastActive,
            isPrimaryAdmin: data.isPrimaryAdmin === true,
            createdBy: data.createdBy,
          }));
        },
        error => {
          console.error('Staff profile subscription error:', error);
        },
      );

    return () => unsubscribe();
  }, [user, clearSecuritySensitiveState]);

  useEffect(() => {
    if (
      view ===
        'staff' &&
      currentStaff &&
      currentStaff.role !==
        'admin'
    ) {
      setView(
        'dashboard'
      );
    }
  }, [
    view,
    currentStaff
  ]);

  const handleLogout =
    async () => {
      setCurrentStaff(
        null
      );

      clearSecuritySensitiveState();

      setUser(
        null
      );

      try {
        await auth.signOut();
      } catch (err) {
        console.error(
          'Logout error:',
          err
        );
      }
    };

  const handlePullRefresh =
    useCallback(
      async () => {
        setInventorySyncError(null);
        setLoading(true);
        setInventoryRefreshVersion(
          previous => previous + 1
        );

        // Pull-to-refresh gives immediate tactile feedback. The inventory
        // continues loading in small Firestore batches in the background.
        await new Promise(resolve =>
          window.setTimeout(resolve, 450)
        );
      },
      []
    );


  useEffect(() => {
    if (!user || !currentStaff) {
      setCategoriesReady(false);
      return;
    }

    setCategoriesReady(false);
    const isAdmin = currentStaff.role === 'admin';

    const handleCategories = (snapshot: any) => {
      const defaultMap = new Map(DEFAULT_CATEGORIES.map(category => [category.id, category]));
      const categoryMap = new Map<string, Category>();

      // Firestore is the single production source of truth for which categories exist.
      // Known system defaults are merged only to fill presentation/config fields that
      // may be missing in the legacy database; they are never recreated by the client.
      if (snapshot && !snapshot.empty) {
        snapshot.docs.forEach((document: any) => {
          const category = { id: document.id, ...document.data() } as Category;
          if (!isAdmin && category.visibleToEmployees !== true) return;

          categoryMap.set(category.id, {
            ...(defaultMap.get(category.id) || {}),
            ...category,
            id: category.id,
          });
        });
      }

      setCategories(
        Array.from(categoryMap.values()).filter(
          category => isAdmin || category.visibleToEmployees === true,
        ),
      );
      setCategoriesReady(true);
    };

    const handleCategoryError = (error: any) => {
      console.error('Category subscription error:', error);
      if (isPermissionDenied(error)) setCategories([]);
      setCategoriesReady(true);
    };

    const ref = db.collection('categories');
    const unsubscribe = isAdmin
      ? ref.onSnapshot(handleCategories, handleCategoryError)
      : ref.where('visibleToEmployees', '==', true).onSnapshot(handleCategories, handleCategoryError);

    return () => unsubscribe?.();
  }, [user, currentStaff]);

  const visibleCategoryIdsString =
    useMemo(
      () => {
        return Array.from(
          new Set(
            categories.map(
              c => c.id
            )
          )
        )
          .sort()
          .join(',');
      },
      [
        categories
      ]
    );

  useEffect(() => {
    if (!user || !currentStaff) return;

    if (
      currentStaff.role === 'employee' &&
      activeCategoryId
    ) {
      const visibleCategoryIds = new Set<string>(
        visibleCategoryIdsString.split(',').filter(Boolean)
      );

      if (!visibleCategoryIds.has(activeCategoryId)) {
        const firstAvailable = Array.from(visibleCategoryIds)[0] ?? null;
        setEditingTile(null);
        setIsAddingNew(false);
        setView('dashboard');
        setActiveCategoryId(firstAvailable);
      }
    }
  }, [
    user,
    currentStaff,
    activeCategoryId,
    visibleCategoryIdsString
  ]);

  useEffect(() => {
    if (!user || !currentStaff) {
      setLoading(false);
      return;
    }

    if (!categoriesReady) {
      setLoading(true);
      return;
    }

    let cancelled = false;
    const unsubs: (() => void)[] = [];
    const isAdmin = currentStaff.role === 'admin';
    const visibleCategoryIds = new Set<string>(
      visibleCategoryIdsString.split(',').filter(Boolean)
    );

    setLoading(true);
    setInventorySyncError(null);

    if (!isAdmin) {
      if (!visibleCategoryIds.has('tiles')) setPorcelainTiles([]);
      if (!visibleCategoryIds.has('ceramics')) setCeramicTiles([]);
      setOtherItems(previous =>
        previous.filter(item =>
          typeof item.categoryId === 'string' &&
          visibleCategoryIds.has(item.categoryId)
        )
      );
    }

    const mapPage = (
      snapshot: any,
      forcedCategoryId?: string
    ): Tile[] =>
      snapshot.docs.map((document: any) => ({
        id: document.id,
        ...document.data(),
        ...(forcedCategoryId
          ? { categoryId: forcedCategoryId }
          : {
              categoryId:
                document.data()?.categoryId || 'uncategorized'
            })
      })) as Tile[];

    const loadPagedCollection = async (
      collectionName: 'tiles' | 'ceramics' | 'inventory',
      setter: React.Dispatch<React.SetStateAction<Tile[]>>,
      options?: {
        categoryId?: string;
        forcedCategoryId?: string;
        preserveExisting?: boolean;
      }
    ) => {
      let cursor: string | null = null;
      let accumulated: Tile[] = [];

      try {
        while (!cancelled) {
          let queryRef = db
            .collection(collectionName)
            .orderBy('__name__', 'asc');

          if (options?.categoryId) {
            queryRef = queryRef.where(
              'categoryId',
              '==',
              options.categoryId
            );
          }

          if (cursor) {
            queryRef = queryRef.startAfter(cursor);
          }

          const pageSize = cursor
            ? INVENTORY_NEXT_PAGE_SIZE
            : INVENTORY_FIRST_PAGE_SIZE;
          const snapshot = await queryRef.limit(pageSize).get();
          if (cancelled) return;

          const page = mapPage(snapshot, options?.forcedCategoryId);
          const isFirstPage = accumulated.length === 0;
          accumulated.push(...page);
          if (!options?.preserveExisting) {
            const nextItems = accumulated.slice();
            if (isFirstPage) {
              // First usable data should appear immediately. Later pages are
              // lower-priority so typing/search remains responsive while sync runs.
              setter(nextItems);
            } else {
              startTransition(() => setter(nextItems));
            }
          }

          if (snapshot.docs.length < pageSize) break;

          cursor = snapshot.docs[snapshot.docs.length - 1]?.id || null;
          if (!cursor) break;
        }

        if (!cancelled && options?.preserveExisting) {
          const nextItems = accumulated.slice();
          startTransition(() => setter(nextItems));
        }
      } catch (error) {
        if (cancelled) return;

        if (isPermissionDenied(error)) {
          setter([]);
          return;
        }

        console.error(`Inventory batch load failed for ${collectionName}:`, error);
        setInventorySyncError(
          'تعذر تحديث جزء من المخزون. اسحب للأسفل للمحاولة مرة أخرى.'
        );
      }
    };

    const inventoryLoads: Promise<void>[] = [];

    const canReadTiles = isAdmin || visibleCategoryIds.has('tiles');
    if (canReadTiles) {
      inventoryLoads.push(
        loadPagedCollection('tiles', setPorcelainTiles, {
          forcedCategoryId: 'tiles',
          preserveExisting: porcelainTiles.length > 0
        })
      );
    } else {
      setPorcelainTiles([]);
    }

    const canReadCeramics = isAdmin || visibleCategoryIds.has('ceramics');
    if (canReadCeramics) {
      inventoryLoads.push(
        loadPagedCollection('ceramics', setCeramicTiles, {
          forcedCategoryId: 'ceramics',
          preserveExisting: ceramicTiles.length > 0
        })
      );
    } else {
      setCeramicTiles([]);
    }

    const otherCategoryIds = Array.from(visibleCategoryIds).filter(
      id => id !== 'tiles' && id !== 'ceramics'
    );

    if (isAdmin) {
      inventoryLoads.push(
        loadPagedCollection('inventory', setOtherItems, {
          preserveExisting: otherItems.length > 0
        })
      );
    } else if (otherCategoryIds.length > 0) {
      const itemsByCategory = new Map<string, Tile[]>();
      otherCategoryIds.forEach(categoryId => {
        itemsByCategory.set(
          categoryId,
          otherItems.filter(item => item.categoryId === categoryId)
        );
      });

      otherCategoryIds.forEach(categoryId => {
        inventoryLoads.push(
          (async () => {
            let cursor: string | null = null;
            let accumulated: Tile[] = [];
            const preserveExisting = otherItems.some(
              item => item.categoryId === categoryId
            );

            try {
              while (!cancelled) {
                let queryRef = db
                  .collection('inventory')
                  .where('categoryId', '==', categoryId)
                  .orderBy('__name__', 'asc');

                if (cursor) queryRef = queryRef.startAfter(cursor);

                const pageSize = cursor
                  ? INVENTORY_NEXT_PAGE_SIZE
                  : INVENTORY_FIRST_PAGE_SIZE;
                const snapshot = await queryRef.limit(pageSize).get();
                if (cancelled) return;

                const page = mapPage(snapshot, categoryId);
                const isFirstPage = accumulated.length === 0;
                accumulated.push(...page);
                itemsByCategory.set(categoryId, accumulated);
                if (!preserveExisting) {
                  const nextItems = Array.from(itemsByCategory.values()).flat();
                  if (isFirstPage) {
                    setOtherItems(nextItems);
                  } else {
                    startTransition(() => setOtherItems(nextItems));
                  }
                }

                if (snapshot.docs.length < pageSize) break;
                cursor = snapshot.docs[snapshot.docs.length - 1]?.id || null;
                if (!cursor) break;
              }

              if (!cancelled && preserveExisting) {
                itemsByCategory.set(categoryId, accumulated);
                const nextItems = Array.from(itemsByCategory.values()).flat();
                startTransition(() => setOtherItems(nextItems));
              }
            } catch (error) {
              if (cancelled) return;
              if (isPermissionDenied(error)) {
                itemsByCategory.set(categoryId, []);
                setOtherItems(Array.from(itemsByCategory.values()).flat());
                return;
              }
              console.error(`Inventory batch load failed for ${categoryId}:`, error);
              setInventorySyncError(
                'تعذر تحديث جزء من المخزون. اسحب للأسفل للمحاولة مرة أخرى.'
              );
            }
          })()
        );
      });
    } else {
      setOtherItems([]);
    }

    void Promise.allSettled(inventoryLoads).then(() => {
      if (!cancelled) setLoading(false);
    });

    // Logs stay realtime because only the newest 100 records are subscribed.
    if (isAdmin) {
      unsubs.push(
        db
          .collection('logs')
          .orderBy('timestamp', 'desc')
          .limit(100)
          .onSnapshot(
            snapshot => {
              if (cancelled) return;
              setLogs(
                snapshot.empty
                  ? []
                  : snapshot.docs.map((document: any) => ({
                      id: document.id,
                      ...document.data()
                    })) as LogEntry[]
              );
            },
            error => {
              if (cancelled) return;
              if (isPermissionDenied(error)) setLogs([]);
              else console.error('Logs subscription failed:', error);
            }
          )
      );
    } else {
      const logsByCategory = new Map<string, LogEntry[]>();
      const getLogTime = (log: any) => log.timestamp?.seconds || 0;

      Array.from(visibleCategoryIds).forEach(categoryId => {
        unsubs.push(
          db
            .collection('logs')
            .where('categoryId', '==', categoryId)
            .orderBy('timestamp', 'desc')
            .limit(100)
            .onSnapshot(
              snapshot => {
                if (cancelled) return;
                logsByCategory.set(
                  categoryId,
                  snapshot.empty
                    ? []
                    : snapshot.docs.map((document: any) => ({
                        id: document.id,
                        ...document.data()
                      })) as LogEntry[]
                );

                setLogs(
                  Array.from(logsByCategory.values())
                    .flat()
                    .sort((a, b) => getLogTime(b) - getLogTime(a))
                    .slice(0, 100)
                );
              },
              error => {
                if (cancelled) return;
                if (isPermissionDenied(error)) {
                  logsByCategory.set(categoryId, []);
                  setLogs(Array.from(logsByCategory.values()).flat());
                } else {
                  console.error(`Logs subscription failed for ${categoryId}:`, error);
                }
              }
            )
        );
      });

      if (visibleCategoryIds.size === 0) setLogs([]);
    }

    return () => {
      cancelled = true;
      unsubs.forEach(unsubscribe => unsubscribe?.());
    };
  }, [
    user,
    currentStaff,
    categoriesReady,
    visibleCategoryIdsString,
    inventoryRefreshVersion
  ]);

  useEffect(() => {
    if (
      !user ||
      !currentStaff ||
      !categoriesReady ||
      loading
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      writeInventoryUiCache(user.uid, currentStaff.role, {
        porcelainTiles,
        ceramicTiles,
        otherItems,
        categories,
        logs,
      });
    }, INVENTORY_CACHE_WRITE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [
    user,
    currentStaff,
    categoriesReady,
    loading,
    porcelainTiles,
    ceramicTiles,
    otherItems,
    categories,
    logs,
  ]);

  useEffect(() => {
    if (!user || !currentStaff) return;

    let lastRefreshAt = Date.now();
    const refreshWhenReturning = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastRefreshAt < RETURN_REFRESH_MIN_INTERVAL_MS) return;
      lastRefreshAt = now;
      setInventoryRefreshVersion(previous => previous + 1);
    };

    window.addEventListener('focus', refreshWhenReturning);
    document.addEventListener('visibilitychange', refreshWhenReturning);

    return () => {
      window.removeEventListener('focus', refreshWhenReturning);
      document.removeEventListener('visibilitychange', refreshWhenReturning);
    };
  }, [user, currentStaff]);

  const isEmployee =
    currentStaff?.role ===
    'employee';

  const visiblePorcelainTiles =
    useMemo(
      () =>
        isEmployee
          ? porcelainTiles.filter(
              item =>
                item.hiddenForStaff !==
                true
            )
          : porcelainTiles,
      [
        isEmployee,
        porcelainTiles
      ]
    );

  const visibleCeramicTiles =
    useMemo(
      () =>
        isEmployee
          ? ceramicTiles.filter(
              item =>
                item.hiddenForStaff !==
                true
            )
          : ceramicTiles,
      [
        isEmployee,
        ceramicTiles
      ]
    );

  const visibleOtherItems =
    useMemo(
      () =>
        isEmployee
          ? otherItems.filter(
              item =>
                item.hiddenForStaff !==
                true
            )
          : otherItems,
      [
        isEmployee,
        otherItems
      ]
    );

  const currentTiles =
    useMemo(
      () => {
        if (
          activeCategoryId ===
          'tiles'
        ) {
          return visiblePorcelainTiles;
        }

        if (
          activeCategoryId ===
          'ceramics'
        ) {
          return visibleCeramicTiles;
        }

        return visibleOtherItems.filter(
          item =>
            item.categoryId ===
            activeCategoryId
        );
      },
      [
        activeCategoryId,
        visiblePorcelainTiles,
        visibleCeramicTiles,
        visibleOtherItems
      ]
    );

  const allItemsCombined =
    useMemo(
      () => {
        return [
          ...visiblePorcelainTiles.map(
            tile => ({
              ...tile,
              categoryId:
                'tiles'
            })
          ),

          ...visibleCeramicTiles.map(
            tile => ({
              ...tile,
              categoryId:
                'ceramics'
            })
          ),

          ...visibleOtherItems
        ];
      },
      [
        visiblePorcelainTiles,
        visibleCeramicTiles,
        visibleOtherItems
      ]
    );

  const visibleLogs =
    useMemo(
      () => {
        if (!isEmployee) {
          return logs;
        }

        const visibleNames =
          new Set(
            allItemsCombined.map(
              item => item.name
            )
          );

        return logs.filter(
          log =>
            !log.tileName ||
            visibleNames.has(
              log.tileName
            )
        );
      },
      [
        isEmployee,
        logs,
        allItemsCombined
      ]
    );

  const logAction =
    useCallback(
      async (
        action: string,
        tileName: string,
        details: string,
        categoryId?: string
      ) => {
        const activeStaffName = currentStaff?.name || 'مستخدم';

        const catIdToUse =
          categoryId ||
          activeCategoryId ||
          'tiles';

        const newLog = {
          actorUid:
            user?.uid ||
            currentStaff?.id ||
            '',

          timestamp:
            getAuditTimestamp(),

          user:
            activeStaffName,

          action:
            String(
              action ||
                ''
            ),

          tileName:
            String(
              tileName ||
                ''
            ),

          details:
            String(
              details ||
                ''
            ),

          categoryId:
            String(
              catIdToUse
            )
        };

        const localLog:
          LogEntry = {
          id:
            'local-' +
            Date.now(),

          ...newLog
        };

        setLogs(
          prev => [
            localLog,
            ...prev
          ]
        );

        try {
          await db
            .collection(
              'logs'
            )
            .add(
              newLog
            );
        } catch (error) {
          console.error(
            'Failed to persist log',
            error
          );

          throw error;
        }
      },
      [
        currentStaff,
        user,
        activeCategoryId,
      ]
    );

  const handleEditClick =
    useCallback(
      (
        tile: Tile
      ) => {
        setEditingTile(
          tile
        );

        if (
          tile.categoryId &&
          tile.categoryId !==
            activeCategoryId
        ) {
          setActiveCategoryId(
            tile.categoryId
          );
        }

        setView(
          'inventory'
        );

        window.scrollTo({
          top: 0,
          behavior:
            'smooth'
        });
      },
      [
        activeCategoryId
      ]
    );

  const handleViewModelLogs =
    useCallback(
      (
        tileName: string
      ) => {
        setSelectedModelForLogs(
          tileName
        );

        setView(
          'logs'
        );

        window.scrollTo({
          top: 0,
          behavior:
            'smooth'
        });
      },
      []
    );

  const handleDataRestored =
    useCallback(
      () => {
        setPorcelainTiles([]);
        setCeramicTiles([]);
        setOtherItems([]);
        setLogs([]);
        setSearchQuery('');
        setLoading(true);
        setInventoryRefreshVersion(previous => previous + 1);
      },
      []
    );

  const handleSaveTile =
    useCallback(
      async (
        tileData:
          | Omit<
              Tile,
              'id'
            >
          | Tile
      ) => {
        try {
          if (
            'id' in
            tileData
          ) {
            const {
              id,
              createdAt: _createdAt,
              createdBy: _createdBy,
              createdByUid: _createdByUid,
              updatedAt: _previousUpdatedAt,
              updatedBy: _previousUpdatedBy,
              updatedByUid: _previousUpdatedByUid,
              ...dataToUpdate
            } =
              tileData;

            const targetCategory =
              tileData.categoryId ||
              activeCategoryId;

            if (
              !targetCategory
            ) {
              throw new Error(
                'لا يوجد قسم صالح للصنف.'
              );
            }

            let collectionName =
              'inventory';

            if (
              targetCategory ===
              'tiles'
            ) {
              collectionName =
                'tiles';
            } else if (
              targetCategory ===
              'ceramics'
            ) {
              collectionName =
                'ceramics';
            }

            const oldTile =
              allItemsCombined.find(
                tile =>
                  tile.id ===
                  id
              ) ||
              currentTiles.find(
                tile =>
                  tile.id ===
                  id
              );

            let changeDetails =
              'تم تحديث البيانات';

            if (oldTile) {
              const changes:
                string[] = [];

              if (
                oldTile.name !==
                dataToUpdate.name
              ) {
                changes.push(
                  `الاسم: ${oldTile.name} -> ${dataToUpdate.name}`
                );
              }

              if (
                oldTile.meters !==
                dataToUpdate.meters
              ) {
                changes.push(
                  `الكمية: ${oldTile.meters} -> ${dataToUpdate.meters}`
                );
              }

              if (
                oldTile.itemType !==
                dataToUpdate.itemType
              ) {
                changes.push(
                  `النوع: ${dataToUpdate.itemType || '-'}`
                );
              }

              if (
                oldTile.color !==
                dataToUpdate.color
              ) {
                changes.push(
                  `اللون: ${dataToUpdate.color || '-'}`
                );
              }

              if (
                changes.length >
                0
              ) {
                changeDetails =
                  changes.join(
                    ' | '
                  );
              }
            }

            const auditTimestamp =
              getAuditTimestamp();
            const localAuditTimestamp =
              new Date();
            const auditActorName =
              currentStaff?.name ||
              'مستخدم';
            const auditActorUid =
              user?.uid ||
              currentStaff?.id ||
              '';

            await db
              .collection(
                collectionName
              )
              .doc(id)
              .update({
                ...dataToUpdate,

                categoryId:
                  targetCategory,

                updatedAt:
                  auditTimestamp,

                updatedBy:
                  auditActorName,

                updatedByUid:
                  auditActorUid
              });

            const updatedTile = {
              ...dataToUpdate,
              id,

              categoryId:
                targetCategory,

              updatedAt:
                localAuditTimestamp,

              updatedBy:
                auditActorName,

              updatedByUid:
                auditActorUid
            } as Tile;

            if (
              targetCategory ===
              'tiles'
            ) {
              setPorcelainTiles(
                previous =>
                  previous.map(
                    tile =>
                      tile.id ===
                      id
                        ? {
                            ...tile,
                            ...updatedTile
                          }
                        : tile
                  )
              );
            } else if (
              targetCategory ===
              'ceramics'
            ) {
              setCeramicTiles(
                previous =>
                  previous.map(
                    tile =>
                      tile.id ===
                      id
                        ? {
                            ...tile,
                            ...updatedTile
                          }
                        : tile
                  )
              );
            } else {
              setOtherItems(
                previous =>
                  previous.map(
                    tile =>
                      tile.id ===
                      id
                        ? {
                            ...tile,
                            ...updatedTile
                          }
                        : tile
                  )
              );
            }

            setEditingTile(
              null
            );

            setIsAddingNew(
              false
            );

            void logAction(
              'تعديل',
              dataToUpdate.name,
              changeDetails,
              targetCategory
            ).catch(
              error =>
                console.error(
                  'Audit log failed',
                  error
                )
            );
          } else {
            const targetCategory =
              tileData.categoryId ||
              activeCategoryId;

            if (
              !targetCategory
            ) {
              throw new Error(
                'لا يوجد قسم صالح للصنف.'
              );
            }

            let collectionName =
              'inventory';

            if (
              targetCategory ===
              'tiles'
            ) {
              collectionName =
                'tiles';
            } else if (
              targetCategory ===
              'ceramics'
            ) {
              collectionName =
                'ceramics';
            }

            const newId =
              'item_' +
              Date.now()
                .toString(
                  36
                ) +
              '_' +
              Math.random()
                .toString(
                  36
                )
                .substring(
                  2,
                  7
                );

            const auditTimestamp =
              getAuditTimestamp();
            const localAuditTimestamp =
              new Date();
            const auditActorName =
              currentStaff?.name ||
              'مستخدم';
            const auditActorUid =
              user?.uid ||
              currentStaff?.id ||
              '';

            const newTileWithId = {
              ...tileData,

              id:
                newId,

              categoryId:
                targetCategory,

              createdAt:
                localAuditTimestamp,

              createdBy:
                auditActorName,

              createdByUid:
                auditActorUid
            } as Tile;

            await db
              .collection(
                collectionName
              )
              .doc(
                newId
              )
              .set({
                ...newTileWithId,

                createdAt:
                  auditTimestamp
              });

            if (
              targetCategory ===
              'tiles'
            ) {
              setPorcelainTiles(
                previous => [
                  newTileWithId,
                  ...previous
                ]
              );
            } else if (
              targetCategory ===
              'ceramics'
            ) {
              setCeramicTiles(
                previous => [
                  newTileWithId,
                  ...previous
                ]
              );
            } else {
              setOtherItems(
                previous => [
                  newTileWithId,
                  ...previous
                ]
              );
            }

            setIsAddingNew(
              false
            );

            setActiveCategoryId(
              targetCategory
            );

            void logAction(
              'إضافة',
              tileData.name,
              `إضافة صنف جديد بالكمية: ${tileData.meters}`,
              targetCategory
            ).catch(
              error =>
                console.error(
                  'Audit log failed',
                  error
                )
            );
          }
        } catch (error) {
          console.error(
            'Save error:',
            error
          );

          if (
            error instanceof Error &&
            error.message
          ) {
            throw error;
          }

          throw new Error(
            'تعذر حفظ الصنف في Firebase. تحقق من الاتصال والصلاحيات ثم حاول مرة أخرى.'
          );
        }
      },
      [
        activeCategoryId,
        allItemsCombined,
        currentTiles,
        logAction,
        currentStaff,
        user
      ]
    );

  const handleSaveCategoryLocal =
    useCallback(
      (
        savedCategory:
          Category
      ) => {
        setCategories(
          prev => {
            const idx =
              prev.findIndex(
                c =>
                  c.id ===
                  savedCategory.id
              );

            let updated:
              Category[];

            if (
              idx >= 0
            ) {
              updated = [
                ...prev
              ];

              updated[idx] =
                savedCategory;
            } else {
              updated = [
                ...prev,
                savedCategory
              ];
            }

            return updated;
          }
        );

        void logAction(
          'تخصيص قسم',
          savedCategory.name,
          `تم حفظ وتعديل إعدادات وحقول قسم ${savedCategory.name}`,
          savedCategory.id
        ).catch(
          err =>
            console.error(
              'Audit log failed',
              err
            )
        );
      },
      [
        logAction
      ]
    );

  const handleDeleteCategoryLocal =
    useCallback(
      async (
        categoryId:
          string
      ) => {
        if (
          categoryId === 'tiles' ||
          categoryId === 'ceramics'
        ) {
          throw new Error(
            'لا يمكن حذف أقسام البورسلان أو السيراميك.'
          );
        }

        const hasItems =
          allItemsCombined.some(
            item =>
              item.categoryId === categoryId
          );

        if (hasItems) {
          throw new Error(
            'لا يمكن حذف قسم يحتوي أصناف. انقل الأصناف أو اترك القسم موجودًا حتى لا تختفي بياناته.'
          );
        }

        await categoryService.deleteCategory(categoryId);

        setCategories(previous =>
          previous.filter(
            category =>
              category.id !== categoryId
          )
        );

        if (
          activeCategoryId ===
          categoryId
        ) {
          const remaining =
            categories.filter(
              category =>
                category.id !== categoryId
            );

          setActiveCategoryId(
            remaining[0]?.id ??
            null
          );
        }

      },
      [
        categories,
        activeCategoryId,
        allItemsCombined
      ]
    );

  const handleUpdateReservations =
    useCallback(
      async (
        updatedReservations:
          Reservation[]
      ) => {
        if (
          !reservingTile
        ) {
          return;
        }

        try {
          const targetCategory =
            reservingTile.categoryId ||
            activeCategoryId;

          if (
            !targetCategory
          ) {
            throw new Error(
              'لا يوجد قسم صالح للصنف.'
            );
          }

          let collectionName =
            'inventory';

          if (
            targetCategory ===
            'tiles'
          ) {
            collectionName =
              'tiles';
          } else if (
            targetCategory ===
            'ceramics'
          ) {
            collectionName =
              'ceramics';
          }

          const auditTimestamp =
            getAuditTimestamp();
          const localAuditTimestamp =
            new Date();
          const auditActorName =
            currentStaff?.name ||
            'مستخدم';
          const auditActorUid =
            user?.uid ||
            currentStaff?.id ||
            '';

          await db
            .collection(
              collectionName
            )
            .doc(
              reservingTile.id
            )
            .update({
              reservations:
                updatedReservations,

              isReserved:
                updatedReservations.length >
                0,

              updatedAt:
                auditTimestamp,

              updatedBy:
                auditActorName,

              updatedByUid:
                auditActorUid
            });

          const updatedTile:
            Tile = {
            ...reservingTile,

            reservations:
              updatedReservations,

            isReserved:
              updatedReservations.length >
              0,

            updatedAt:
              localAuditTimestamp,

            updatedBy:
              auditActorName,

            updatedByUid:
              auditActorUid
          };

          if (
            targetCategory ===
            'tiles'
          ) {
            setPorcelainTiles(
              previous =>
                previous.map(
                  tile =>
                    tile.id ===
                    reservingTile.id
                      ? updatedTile
                      : tile
                )
            );
          } else if (
            targetCategory ===
            'ceramics'
          ) {
            setCeramicTiles(
              previous =>
                previous.map(
                  tile =>
                    tile.id ===
                    reservingTile.id
                      ? updatedTile
                      : tile
                )
            );
          } else {
            setOtherItems(
              previous =>
                previous.map(
                  tile =>
                    tile.id ===
                    reservingTile.id
                      ? updatedTile
                      : tile
                )
            );
          }

          setReservingTile(
            null
          );

          void logAction(
            'حجز',
            reservingTile.name,
            `تم تحديث الحجوزات. عدد الحجوزات: ${updatedReservations.length}`,
            targetCategory
          ).catch(
            error =>
              console.error(
                'Audit log failed',
                error
              )
          );
        } catch (error) {
          console.error(
            'Reservation error:',
            error
          );

          if (
            error instanceof Error &&
            error.message
          ) {
            throw error;
          }

          throw new Error(
            'تعذر حفظ الحجوزات. تحقق من الاتصال ثم حاول مرة أخرى.'
          );
        }
      },
      [
        reservingTile,
        activeCategoryId,
        logAction,
        currentStaff,
        user
      ]
    );

  const handleConfirmDelete =
    useCallback(
      async () => {
        if (
          !deleteTargetId
        ) {
          return;
        }

        const itemToDelete =
          allItemsCombined.find(
            item =>
              item.id ===
              deleteTargetId
          ) ||
          currentTiles.find(
            item =>
              item.id ===
              deleteTargetId
          );

        const targetCategory =
          itemToDelete
            ?.categoryId ||
          activeCategoryId;

        if (
          !targetCategory
        ) {
          console.error(
            'Delete error: missing category'
          );

          return;
        }

        let collectionName:
          | 'tiles'
          | 'ceramics'
          | 'inventory' =
          'inventory';

        if (
          targetCategory ===
          'tiles'
        ) {
          collectionName =
            'tiles';
        } else if (
          targetCategory ===
          'ceramics'
        ) {
          collectionName =
            'ceramics';
        }

        const idToDelete =
          deleteTargetId;

        try {
          await inventoryService.deleteItem(
            collectionName,
            idToDelete
          );

          if (itemToDelete) {
            void logAction(
              'حذف',
              itemToDelete.name,
              'تم حذف الصنف نهائياً من النظام',
              targetCategory,
            ).catch(error =>
              console.error('Audit log failed', error),
            );
          }

          setPorcelainTiles(
            previous =>
              previous.filter(
                item =>
                  item.id !==
                  idToDelete
              )
          );

          setCeramicTiles(
            previous =>
              previous.filter(
                item =>
                  item.id !==
                  idToDelete
              )
          );

          setOtherItems(
            previous =>
              previous.filter(
                item =>
                  item.id !==
                  idToDelete
              )
          );

          setDeleteTargetId(
            null
          );

          setEditingTile(
            null
          );

          setIsAddingNew(
            false
          );

        } catch (error) {
          console.error(
            'Delete error:',
            error
          );

          alert(
            error instanceof Error && error.message
              ? error.message
              : 'تعذر حذف الصنف. تحقق من الاتصال والصلاحيات ثم حاول مرة أخرى.'
          );
        }
      },
      [
        deleteTargetId,
        activeCategoryId,
        currentTiles,
        allItemsCombined,
        logAction
      ]
    );

  const changeView =
    useCallback(
      (
        newView:
          ViewMode
      ) => {
        if (newView === 'backup') {
          if (inventorySyncError) {
            alert(
              'لم يكتمل تحديث بيانات المخزون. أعد المحاولة بعد نجاح المزامنة حتى لا يتم إنشاء نسخة احتياطية ناقصة.'
            );
            return;
          }

          if (loading) {
            setPendingInventoryAction('backup');
            return;
          }
        }

        setEditingTile(
          null
        );

        setIsAddingNew(
          false
        );

        if (
          newView ===
            'staff' &&
          currentStaff?.role !==
            'admin'
        ) {
          setView(
            'dashboard'
          );
        } else {
          setView(
            newView
          );
        }

        window.scrollTo({
          top: 0,
          behavior:
            'smooth'
        });
      },
      [
        currentStaff,
        loading,
        inventorySyncError
      ]
    );

  const handleCategoryChange =
    useCallback(
      (
        catId:
          string
      ) => {
        setActiveCategoryId(
          catId
        );

        setEditingTile(
          null
        );

        setView(
          'inventory'
        );

        window.scrollTo({
          top: 0,
          behavior:
            'smooth'
        });
      },
      []
    );

  const filteredTiles =
    useMemo(
      () => {
        const query =
          (
            searchQuery ||
            ''
          )
            .toLowerCase()
            .trim();

        if (!query) {
          return currentTiles;
        }

        return currentTiles.filter(
          tile =>
            (
              tile.name ||
              ''
            )
              .toLowerCase()
              .includes(
                query
              ) ||
            (
              tile.shade ||
              ''
            )
              .toLowerCase()
              .includes(
                query
              ) ||
            (
              tile.quality ||
              ''
            )
              .toLowerCase()
              .includes(
                query
              ) ||
            (
              tile.size ||
              ''
            )
              .toLowerCase()
              .includes(
                query
              ) ||
            (
              tile.itemType ||
              ''
            )
              .toLowerCase()
              .includes(
                query
              ) ||
            (
              tile.color ||
              ''
            )
              .toLowerCase()
              .includes(
                query
              ) ||
            (
              tile.brand ||
              ''
            )
              .toLowerCase()
              .includes(
                query
              ) ||
            (
              tile.materialOrGlass ||
              ''
            )
              .toLowerCase()
              .includes(
                query
              ) ||
            (
              tile.customFieldSnapshot ||
              []
            )
              .map(
                field =>
                  `${field.label} ${field.value} ${field.suffix || ''}`
              )
              .join(' ')
              .toLowerCase()
              .includes(
                query
              )
        );
      },
      [
        currentTiles,
        searchQuery
      ]
    );

  const activeCategoryData =
    useMemo(
      () => {
        if (
          !activeCategoryId
        ) {
          return (
            categories[0] ||
            DEFAULT_CATEGORIES[0]
          );
        }

        return (
          categories.find(
            c =>
              c.id ===
              activeCategoryId
          ) ||
          categories[0] ||
          DEFAULT_CATEGORIES[0]
        );
      },
      [
        categories,
        activeCategoryId
      ]
    );

  const openPrintReport =
    useCallback(
      () => {
        if (inventorySyncError) {
          alert(
            'لم يكتمل تحديث بيانات المخزون. أعد المحاولة بعد نجاح المزامنة حتى لا يتم إنشاء تقرير ناقص.'
          );
          return;
        }

        if (loading) {
          setPendingInventoryAction('print');
          return;
        }

        setIsPrintPdfModalOpen(true);
      },
      [loading, inventorySyncError]
    );

  useEffect(() => {
    if (loading || !pendingInventoryAction) return;

    if (inventorySyncError) {
      setPendingInventoryAction(null);
      alert(
        pendingInventoryAction === 'backup'
          ? 'تعذر إكمال تحديث المخزون، لذلك لم يتم فتح النسخ الاحتياطي حتى لا يتم تصدير نسخة ناقصة.'
          : 'تعذر إكمال تحديث المخزون، لذلك لم يتم فتح التقرير حتى لا يظهر تقرير ناقص.'
      );
      return;
    }

    if (pendingInventoryAction === 'print') {
      setPendingInventoryAction(null);
      setIsPrintPdfModalOpen(true);
      return;
    }

    if (pendingInventoryAction === 'backup') {
      setPendingInventoryAction(null);
      setView('backup');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [loading, pendingInventoryAction, inventorySyncError]);

  if (
    authLoading
  ) {
    // React fallback for direct/dev loads. In production the matching HTML
    // splash is already visible before the JavaScript bundle finishes loading.
    return (
      <div
        className="app-viewport relative flex items-center justify-center overflow-hidden bg-[linear-gradient(145deg,#0f172a_0%,#172554_45%,#3730a3_100%)] px-6 text-white"
        dir="rtl"
        role="status"
        aria-live="polite"
      >
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-blue-400/15 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-violet-400/15 blur-3xl" />

        <div className="relative flex flex-col items-center text-center">
          <div className="mb-5 rounded-[26px] border border-white/20 bg-white/10 p-2.5 shadow-2xl shadow-black/20 backdrop-blur-md">
            <img
              src="/icons/icon-192.png"
              alt=""
              className="h-20 w-20 rounded-[20px] shadow-lg"
            />
          </div>

          <h1 className="text-2xl font-black tracking-tight">إدارة مخزون</h1>
          <p className="mt-1.5 text-xs font-semibold text-blue-100/75">
            مخزونك جاهز بين إيديك
          </p>

          <div className="mt-7 flex items-center gap-2" aria-hidden="true">
            {[0, 1, 2].map(index => (
              <span
                key={index}
                className="h-2 w-2 animate-pulse rounded-full bg-white/50"
                style={{ animationDelay: `${index * 140}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user || !currentStaff) {
    return <Login />;
  }

  return (
    <div
      className="
        app-viewport
        bg-slate-100/70
        md:bg-[#eef2f6]
        dark:bg-neutral-950
        text-slate-800
        dark:text-slate-100
        flex
        flex-col
        md:flex-row
        transition-colors
      "
      dir="rtl"
    >

      <Sidebar
        isOpen={
          isSidebarOpen
        }
        onClose={() =>
          setIsSidebarOpen(
            false
          )
        }
        activeTab={view}
        onChangeTab={t =>
          changeView(
            t as ViewMode
          )
        }
        categories={
          categories
        }
        activeCategory={
          activeCategoryId ?? undefined
        }
        activeCategoryId={
          activeCategoryId ?? undefined
        }
        onSelectCategory={
          handleCategoryChange
        }
        onChangeCategory={
          handleCategoryChange
        }
        onOpenCategoryManager={() => {
          setEditingCategoryModalId(
            null
          );

          setIsCategoryModalOpen(
            true
          );
        }}
        onOpenSettings={() =>
          changeView(
            'settings'
          )
        }
        onOpenStaffManager={() =>
          changeView(
            'staff'
          )
        }
        onOpenBackupModal={() =>
          changeView(
            'backup'
          )
        }
        currentStaff={
          currentStaff
        }
        userEmail={
          user?.email
        }
        onLogout={
          handleLogout
        }
      />

      {currentStaff?.role ===
        'admin' && (
        <StaffManagerModal
          isOpen={
            isStaffModalOpen
          }
          onClose={() =>
            setIsStaffModalOpen(
              false
            )
          }
          currentStaff={
            currentStaff
          }
        />
      )}

      <div
        className="
          flex-1
          flex
          flex-col
          min-w-0
          min-h-[100dvh]
        "
      >
        <Header
          onOpenSidebar={() =>
            setIsSidebarOpen(
              true
            )
          }
          currentStaff={
            currentStaff
          }
          title={
            view ===
              'dashboard'
              ? 'إدارة مخزون'
              : view ===
                  'inventory'
                ? activeCategoryData.name
                : view ===
                    'logs'
                  ? 'سجل الحركات والأحداث'
                  : view ===
                      'settings'
                    ? 'الإعدادات'
                    : view ===
                        'backup'
                      ? 'النسخ الاحتياطي'
                      : view ===
                          'staff'
                        ? 'الموظفين'
                        : 'إدارة مخزون'
          }
        />

        {inventorySyncError && (
          <div className="mx-3 mt-2 flex items-center justify-between gap-3 rounded-[13px] border border-amber-200/70 bg-amber-50/90 px-3 py-2 text-[11px] font-semibold text-amber-800 shadow-sm dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300 sm:mx-6 lg:mx-8">
            <span>{inventorySyncError}</span>
            <button
              type="button"
              onClick={() => void handlePullRefresh()}
              className="shrink-0 rounded-[9px] bg-white/80 px-2.5 py-1 font-bold text-amber-800 dark:bg-neutral-900/60 dark:text-amber-300"
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        <PullToRefresh
          onRefresh={
            handlePullRefresh
          }
          disabled={
            isAddingNew ||
            !!editingTile ||
            !!viewingImage ||
            !!reservingTile ||
            !!deleteTargetId ||
            isFullListModalOpen ||
            isCategoryModalOpen ||
            isStaffModalOpen ||
            isSettingsModalOpen ||
            isPrintPdfModalOpen
          }
          className="
            flex-1
            flex
            flex-col
          "
        >
          <div
            className="
              flex-1
              max-w-7xl
              w-full
              mx-auto
              px-3
              sm:px-6
              lg:px-8
              py-4
              sm:py-6
              pb-[calc(105px+env(safe-area-inset-bottom))]
              lg:pb-6
            "
          >
            <div className="w-full">
                {view ===
                'dashboard' ? (
                  <Dashboard
                    allTiles={
                      allItemsCombined
                    }
                    categories={
                      categories
                    }
                    logs={
                      visibleLogs
                    }
                    currentStaff={
                      currentStaff
                    }
                    isSyncing={
                      loading
                    }
                    onSearch={
                      term => {
                        setSearchQuery(
                          term
                        );

                        changeView(
                          'inventory'
                        );
                      }
                    }
                    onSelectCategory={
                      catId => {
                        setIsAddingNew(
                          false
                        );

                        handleCategoryChange(
                          catId
                        );
                      }
                    }
                    onNavigate={
                      v =>
                        changeView(
                          v as ViewMode
                        )
                    }
                    onAddTile={() => {
                      changeView(
                        'inventory'
                      );

                      setAddItemSource(
                        'global'
                      );

                      setIsAddingNew(
                        true
                      );
                    }}
                    onOpenCategoryManager={
                      catId => {
                        setEditingCategoryModalId(
                          catId ||
                            null
                        );

                        setIsCategoryModalOpen(
                          true
                        );
                      }
                    }
                    onOpenReservation={
                      tile =>
                        setReservingTile(
                          tile
                        )
                    }
                  />
                ) : view ===
                  'inventory' ? (
                  <div className="mt-2">
                    <div
                      className="
                        flex
                        items-center
                        gap-1.5
                        overflow-x-auto
                        max-w-full
                        pb-1
                        mb-3
                        custom-scrollbar
                        no-print
                        relative
                      "
                    >
                      <LayoutGroup
                        id="inventory-categories"
                      >
                        {categories.map(
                          cat => {
                            const isActive =
                              activeCategoryId ===
                              cat.id;

                            return (
                              <button
                                key={
                                  cat.id
                                }
                                onClick={() =>
                                  handleCategoryChange(
                                    cat.id
                                  )
                                }
                                className={`
                                  relative
                                  text-xs
                                  font-bold
                                  px-3.5
                                  py-2
                                  rounded-xl
                                  transition-colors
                                  whitespace-nowrap
                                  cursor-pointer
                                  overflow-hidden
                                  border
                                  ${
                                    isActive
                                      ? 'text-white dark:text-black border-transparent shadow-sm'
                                      : 'bg-white dark:bg-neutral-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800'
                                  }
                                `}
                              >
                                {isActive && (
                                  <motion.div
                                    layoutId="active-category-indicator"
                                    className="
                                      absolute
                                      inset-0
                                      rounded-xl
                                    "
                                    style={{
                                      backgroundColor:
                                        isDarkMode
                                          ? (
                                              CATEGORY_ACCENTS[
                                                cat.themeColor
                                              ]?.dark ||
                                              '#ffffff'
                                            )
                                          : (
                                              CATEGORY_ACCENTS[
                                                cat.themeColor
                                              ]?.light ||
                                              '#0f172a'
                                            )
                                    }}
                                    transition={
                                      springTransition
                                    }
                                  />
                                )}

                                <span
                                  className="
                                    relative
                                    z-10
                                  "
                                >
                                  {
                                    cat.name
                                  }
                                </span>
                              </button>
                            );
                          }
                        )}
                      </LayoutGroup>

                      {!isEmployee && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategoryModalId(
                              null
                            );

                            setIsCategoryModalOpen(
                              true
                            );
                          }}
                          className="
                            text-xs
                            font-bold
                            px-3
                            py-2
                            rounded-xl
                            bg-slate-100
                            dark:bg-neutral-900
                            text-slate-600
                            dark:text-slate-300
                            border
                            border-slate-200
                            dark:border-neutral-800
                            hover:bg-slate-200
                            dark:hover:bg-neutral-800
                            cursor-pointer
                            whitespace-nowrap
                          "
                          title="تخصيص وإضافة أقسام"
                        >
                          + قسم
                        </button>
                      )}
                    </div>

                    <div
                      className="
                        no-print
                        mb-3
                        flex
                        items-center
                        justify-between
                        gap-2
                        rounded-[16px]
                        border
                        border-slate-200/70
                        bg-white
                        px-2.5
                        py-2
                        shadow-sm
                        dark:border-white/[0.07]
                        dark:bg-neutral-900
                        sm:px-3
                      "
                    >
                      <div
                        className="
                          flex
                          min-w-0
                          items-center
                          gap-2
                        "
                      >
                        <div
                          className="
                            flex
                            min-w-0
                            items-center
                            gap-1.5
                          "
                        >
                          <h2
                            className="
                              whitespace-nowrap
                              text-sm
                              font-bold
                              text-slate-800
                              dark:text-slate-200
                            "
                          >
                            الأصناف
                          </h2>

                          <span
                            className="
                              rounded-full
                              bg-slate-100
                              px-1.5
                              py-0.5
                              text-[9px]
                              font-bold
                              text-slate-500
                              dark:bg-neutral-800
                              dark:text-slate-400
                            "
                          >
                            {
                              currentTiles.length
                            }
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setIsFullListModalOpen(
                              true
                            )
                          }
                          className="
                            shrink-0
                            whitespace-nowrap
                            text-[10px]
                            font-bold
                            text-indigo-600
                            transition-colors
                            hover:text-indigo-700
                            dark:text-indigo-400
                            dark:hover:text-indigo-300
                          "
                        >
                          عرض الكل
                        </button>
                      </div>

                      <div
                        className="
                          flex
                          shrink-0
                          items-center
                          gap-1.5
                        "
                      >
                        <button
                          type="button"
                          onClick={openPrintReport}
                          className="
                            flex
                            h-9
                            w-9
                            items-center
                            justify-center
                            rounded-[11px]
                            border
                            border-slate-200/70
                            bg-slate-50
                            text-slate-500
                            transition-colors
                            hover:bg-slate-100
                            active:scale-[0.98]
                            dark:border-white/[0.07]
                            dark:bg-neutral-800
                            dark:text-slate-300
                            dark:hover:bg-neutral-700
                          "
                          title="طباعة وتصدير كشف المخزون"
                          aria-label="طباعة وتصدير كشف المخزون"
                        >
                          <PrintIcon
                            className="
                              h-4
                              w-4
                            "
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAddItemSource(
                              'category'
                            );

                            setIsAddingNew(
                              true
                            );
                          }}
                          className="
                            flex
                            h-9
                            items-center
                            justify-center
                            gap-1.5
                            whitespace-nowrap
                            rounded-[11px]
                            bg-slate-900
                            px-3
                            text-[11px]
                            font-bold
                            text-white
                            shadow-sm
                            transition
                            active:scale-[0.98]
                            dark:bg-white
                            dark:text-slate-900
                            sm:px-4
                            sm:text-xs
                          "
                        >
                          <PlusIcon
                            className="
                              h-4
                              w-4
                              shrink-0
                            "
                          />

                          <span>
                            إضافة صنف
                          </span>
                        </button>
                      </div>
                    </div>



                    <div
                      className="
                        flex
                        items-center
                        gap-2
                        my-2.5
                        no-print
                      "
                    >
                      <div
                        className="
                          flex-1
                          w-full
                          min-w-0
                        "
                      >
                        <SearchFilter
                          searchQuery={
                            searchQuery
                          }
                          onSearchChange={
                            setSearchQuery
                          }
                        />
                      </div>
                    </div>

                    <div>
                        <div id="print-area">
                          <TileList
                            tiles={
                              filteredTiles
                            }
                            searchQuery={
                              searchQuery
                            }
                            loading={
                              loading
                            }
                            logs={
                              visibleLogs
                            }
                            onEdit={
                              handleEditClick
                            }
                            onDelete={
                              setDeleteTargetId
                            }
                            onOpenReservation={
                              setReservingTile
                            }
                            onViewImage={
                              setViewingImage
                            }
                            viewMode="full"
                            activeCategoryId={
                              activeCategoryId ||
                              undefined
                            }
                            category={
                              activeCategoryData
                            }
                            categories={
                              categories
                            }
                            currentStaff={
                              currentStaff
                            }
                          />
                        </div>

                        <SummaryCards
                          tiles={
                            currentTiles
                          }
                          activeCategoryId={
                            activeCategoryId ||
                            undefined
                          }
                          themeColor={
                            activeCategoryData
                              .themeColor
                          }
                        />
                    </div>
                  </div>
                ) : view ===
                  'logs' ? (
                  <LogsView
                    logs={
                      visibleLogs
                    }
                    selectedModelFilter={
                      selectedModelForLogs
                    }
                    onClearModelFilter={() =>
                      setSelectedModelForLogs(
                        null
                      )
                    }
                    categories={
                      categories
                    }
                    currentStaff={
                      currentStaff
                    }
                    onNavigateBack={() =>
                      changeView(
                        'dashboard'
                      )
                    }
                  />
                ) : view ===
                  'settings' ? (
                  <SettingsModal
                    isPage
                    onClose={() =>
                      changeView(
                        'dashboard'
                      )
                    }
                    isDarkMode={
                      isDarkMode
                    }
                    onToggleTheme={
                      theme => {
                        if (
                          theme ===
                          'dark'
                        ) {
                          setIsDarkMode(
                            true
                          );
                        } else if (
                          theme ===
                          'light'
                        ) {
                          setIsDarkMode(
                            false
                          );
                        }
                      }
                    }
                    currentThemeMode={
                      isDarkMode
                        ? 'dark'
                        : 'light'
                    }
                    categories={
                      categories
                    }
                    onOpenCategoryManager={
                      catId => {
                        setEditingCategoryModalId(
                          catId ||
                            null
                        );

                        setIsCategoryModalOpen(
                          true
                        );
                      }
                    }
                    onOpenStaffManager={() =>
                      changeView(
                        'staff'
                      )
                    }
                    onOpenBackupModal={() =>
                      changeView(
                        'backup'
                      )
                    }
                    currentStaff={
                      currentStaff
                    }
                  />
                ) : view ===
                    'staff' &&
                  currentStaff?.role ===
                    'admin' ? (
                  <StaffManagerModal
                    isPage
                    onClose={() =>
                      changeView(
                        'dashboard'
                      )
                    }
                    currentStaff={
                      currentStaff
                    }
                  />
                ) : view ===
                  'backup' ? (
                  <BackupModal
                    isPage
                    onClose={() =>
                      changeView(
                        'dashboard'
                      )
                    }
                    onDataRestored={
                      handleDataRestored
                    }
                    userRole={
                      currentStaff?.role
                    }
                    userName={
                      currentStaff?.name
                    }
                    exportData={() => ({
                      tiles:
                        porcelainTiles,

                      ceramics:
                        ceramicTiles,

                      inventory:
                        otherItems,

                      categories
                    })}
                  />
                ) : (
                  <div
                    className="
                      flex
                      flex-col
                      items-center
                      justify-center
                      p-12
                      opacity-50
                    "
                  >
                    <p
                      className="
                        text-base
                        font-bold
                      "
                    >
                      الصفحة غير متوفرة
                    </p>
                  </div>
                )}
            </div>
          </div>
        </PullToRefresh>
      </div>

      {(isAddingNew || editingTile) && (
        <TileForm
          onSave={handleSaveTile}
          editingTile={editingTile}
          onCancel={() => {
            setEditingTile(null);
            setIsAddingNew(false);
          }}
          onViewImage={setViewingImage}
          activeCategoryId={activeCategoryId || undefined}
          category={activeCategoryData}
          categories={categories}
          onCustomizeCategory={
            isEmployee
              ? undefined
              : () => {
                  setEditingCategoryModalId(activeCategoryId);
                  setIsCategoryModalOpen(true);
                }
          }
          allowCategorySwitch={!editingTile && addItemSource === 'global'}
          canManageVisibility={!isEmployee}
        />
      )}

      <BottomNav
        view={
          view
        }
        isAddingNew={
          isAddingNew
        }
        onHome={() => {
          setIsAddingNew(
            false
          );

          changeView(
            'dashboard'
          );
        }}
        onAdd={() => {
          setAddItemSource(
            'global'
          );

          setEditingTile(
            null
          );

          setIsAddingNew(
            true
          );
        }}
        onInventory={() => {
          setIsAddingNew(
            false
          );

          changeView(
            'inventory'
          );
        }}
        onLogs={() => {
          setIsAddingNew(
            false
          );

          changeView(
            'logs'
          );
        }}
      />

      {pendingInventoryAction && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
        >
          <div className="flex min-w-[250px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/70 bg-white/95 px-5 py-4 shadow-2xl backdrop-blur-md dark:border-white/[0.08] dark:bg-neutral-900/95">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {[FolderIcon, ListIcon, SearchIcon].map((Icon, index) => (
                <span
                  key={index}
                  className="flex h-9 w-9 animate-pulse items-center justify-center rounded-xl border border-slate-200/70 bg-slate-100/80 text-slate-400 shadow-sm dark:border-white/[0.06] dark:bg-white/[0.05] dark:text-slate-500"
                  style={{ animationDelay: `${index * 140}ms` }}
                >
                  <Icon className="h-4 w-4" />
                </span>
              ))}
            </div>
            <span className="text-center text-sm font-bold text-slate-700 dark:text-slate-200">
              {pendingInventoryAction === 'backup'
                ? 'جاري تحديث البيانات وتجهيز النسخة الاحتياطية...'
                : 'جاري تحديث البيانات وتجهيز التقرير...'}
            </span>
          </div>
        </div>
      )}

      {isPrintPdfModalOpen && (
        <PrintPdfModal
          isOpen={
            isPrintPdfModalOpen
          }
          onClose={() =>
            setIsPrintPdfModalOpen(
              false
            )
          }
          categories={
            categories
          }
          activeCategoryId={
            activeCategoryId ?? 'tiles'
          }
          allItems={
            allItemsCombined
          }
          currentStaff={
            currentStaff
          }
        />
      )}

      {isSettingsModalOpen && (
        <SettingsModal
          isOpen={
            isSettingsModalOpen
          }
          onClose={() =>
            setIsSettingsModalOpen(
              false
            )
          }
          isDarkMode={
            isDarkMode
          }
          onToggleTheme={
            theme => {
              if (
                theme ===
                'dark'
              ) {
                setIsDarkMode(
                  true
                );
              } else if (
                theme ===
                  'light'
              ) {
                setIsDarkMode(
                  false
                );
              }
            }
          }
          currentThemeMode={
            isDarkMode
              ? 'dark'
              : 'light'
          }
          categories={
            categories
          }
          onOpenCategoryManager={
            catId => {
              setIsSettingsModalOpen(
                false
              );

              setEditingCategoryModalId(
                catId ||
                  null
              );

              setIsCategoryModalOpen(
                true
              );
            }
          }
          currentStaff={
            currentStaff
          }
          onOpenStaffManager={() => {
            setIsSettingsModalOpen(
              false
            );

            setIsStaffModalOpen(
              true
            );
          }}
          onOpenBackupModal={() => {
            setIsSettingsModalOpen(false);
            changeView('backup');
          }}
        />
      )}

      {viewingImage && (
        <ImageModal
          src={
            viewingImage
          }
          onClose={() =>
            setViewingImage(
              null
            )
          }
        />
      )}

      {reservingTile && (
        <ReservationModal
          tile={
            reservingTile
          }
          onClose={() =>
            setReservingTile(
              null
            )
          }
          onUpdateReservations={
            handleUpdateReservations
          }
        />
      )}

      {deleteTargetId && (
        <ConfirmModal
          isOpen={
            !!deleteTargetId
          }
          onClose={() =>
            setDeleteTargetId(
              null
            )
          }
          onConfirm={
            handleConfirmDelete
          }
          message="هل تريد بالتأكيد حذف هذا الصنف من المخزون؟"
        />
      )}

      {isFullListModalOpen && (
        <FullListModal
          isOpen={
            isFullListModalOpen
          }
          onClose={() =>
            setIsFullListModalOpen(
              false
            )
          }
          category={
            activeCategoryData
          }
          tiles={
            currentTiles
          }
          logs={
            visibleLogs
          }
          onEdit={
            handleEditClick
          }
          onDelete={
            setDeleteTargetId
          }
          onOpenReservation={
            setReservingTile
          }
          onViewImage={
            setViewingImage
          }
        />
      )}

      {isCategoryModalOpen &&
        currentStaff && (
          <CategoryManagerModal
            isOpen={
              isCategoryModalOpen
            }
            onClose={() => {
              setIsCategoryModalOpen(
                false
              );

              setEditingCategoryModalId(
                null
              );
            }}
            categories={
              categories
            }
            initialEditingCategoryId={
              editingCategoryModalId
            }
            onSaveCategory={
              handleSaveCategoryLocal
            }
            onDeleteCategory={
              handleDeleteCategoryLocal
            }
            canManageVisibility={
              currentStaff.role ===
              'admin'
            }
          />
        )}
    </div>
  );
};

export default App;