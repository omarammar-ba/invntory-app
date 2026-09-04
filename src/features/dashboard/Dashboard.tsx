import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Bath,
  Box,
  ChevronLeft,
  FolderCog,
  Grid3X3,
  LayoutGrid,
  PackageOpen,
  PanelsTopLeft,
  Pencil,
  Ruler,
  Search,
  ShowerHead,
  Tags,
  UserCheck,
  Plus,
  Armchair,
  Layers3,
} from '@/components/ui/AppIcons';
import { Category, LogEntry, StaffMember, Tile } from '@/types';
import { CATEGORY_THEME_STYLES } from '@/styles/uiTokens';
import { motionEase } from '@/styles/motion';

interface DashboardProps {
  allTiles?: Tile[];
  allReservations?: any[];
  logs?: LogEntry[];
  categories?: Category[];
  currentStaff?: StaffMember | null;
  isSyncing?: boolean;
  onSearch?: (term: string) => void;
  onSelectCategory: (categoryId: string) => void;
  onNavigate: (tab: string) => void;
  onAddTile?: () => void;
  onOpenCategoryManager?: (categoryId?: string | null) => void;
  onOpenReservation?: (tile: Tile) => void;
}

const CUSTOM_CATEGORY_ICONS = [
  PackageOpen,
  Box,
  Layers3,
  Tags,
  Ruler,
  Armchair,
  Bath,
  FolderCog,
];

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash =
      value.charCodeAt(index) +
      ((hash << 5) - hash);

    hash |= 0;
  }

  return Math.abs(hash);
}

function getCategoryVisual(
  category: Category,
  index: number,
) {
  let icon =
    CUSTOM_CATEGORY_ICONS[
      hashString(
        category.id || `${index}`,
      ) %
        CUSTOM_CATEGORY_ICONS.length
    ];

  let subtitle =
    category.defaultUnit === 'pieces'
      ? 'أصناف بالقطعة'
      : 'أرضيات وحوائط';

  if (category.id === 'tiles') {
    icon = Grid3X3;
    subtitle = 'أرضيات وحوائط';
  } else if (
    category.id === 'ceramics'
  ) {
    icon = LayoutGrid;
    subtitle = 'أرضيات وحوائط';
  } else if (
    category.id === 'shower_box'
  ) {
    icon = PanelsTopLeft;
    subtitle = 'قواطع وحمامات';
  } else if (
    category.id === 'mixers'
  ) {
    icon = ShowerHead;
    subtitle = 'خلاطات وشاورات';
  } else if (
    category.id === 'sanitary'
  ) {
    icon = Bath;
    subtitle = 'أدوات وتجهيزات';
  }

  return {
    icon,
    subtitle,
    color:
      (category.themeColor &&
        CATEGORY_THEME_STYLES[
          category.themeColor
        ]) ||
      CATEGORY_THEME_STYLES.sky,
  };
}

const containerVariants = {
  hidden: {
    opacity: 0,
  },

  show: {
    opacity: 1,

    transition: {
      staggerChildren: 0.035,
      delayChildren: 0.02,
    },
  },
};

const itemVariants = {
  hidden: {
    opacity: 0,
    y: 8,
    scale: 0.995,
  },

  show: {
    opacity: 1,
    y: 0,
    scale: 1,

    transition: {
      duration: 0.22,
      ease: motionEase,
    },
  },
};

const Dashboard: React.FC<
  DashboardProps
> = ({
  allTiles = [],
  allReservations,
  logs = [],
  categories = [],
  currentStaff,
  isSyncing = false,
  onSearch,
  onSelectCategory,
  onNavigate,
}) => {
  const [
    localSearch,
    setLocalSearch,
  ] = useState('');

  const safeTiles =
    Array.isArray(allTiles)
      ? allTiles
      : [];

  const safeCategories =
    Array.isArray(categories)
      ? categories
      : [];

  const safeLogs =
    Array.isArray(logs)
      ? logs
      : [];

  const dashboardCategories =
    useMemo(() => {
      // Keep the employee experience exactly as configured by Firestore.
      // For admins only, pin the two core inventory sections to the top
      // so Porcelain is always first and Ceramics is always second.
      if (currentStaff?.role !== 'admin') {
        return safeCategories;
      }

      const priority: Record<string, number> = {
        tiles: 0,
        ceramics: 1,
      };

      return safeCategories
        .map((category, originalIndex) => ({ category, originalIndex }))
        .sort((left, right) => {
          const leftPriority = priority[left.category.id] ?? 2;
          const rightPriority = priority[right.category.id] ?? 2;

          if (leftPriority !== rightPriority) {
            return leftPriority - rightPriority;
          }

          return left.originalIndex - right.originalIndex;
        })
        .map(entry => entry.category);
    }, [safeCategories, currentStaff?.role]);

  const displayName =
    currentStaff?.name ||
    'المستخدم';

  const totalItemsCount =
    safeTiles.length;

  const totalQuantitySum =
    safeTiles.reduce(
      (sum, item) =>
        sum +
        (Number(item.meters) ||
          0),
      0,
    );

  const activeReservationsCount =
    Array.isArray(
      allReservations,
    )
      ? allReservations.length
      : safeTiles.reduce(
          (sum, item) =>
            sum +
            (item.reservations
              ?.length || 0),
          0,
        );

  const lowStockCount =
    safeTiles.filter(item => {
      const qty =
        Number(item.meters) || 0;

      const alertLimit =
        (item as any)
          .lowStockAlert !==
        undefined
          ? Number(
              (item as any)
                .lowStockAlert,
            )
          : 10;

      return (
        qty > 0 &&
        qty <= alertLimit
      );
    }).length;

  const handleSearchSubmit = (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    const term =
      localSearch.trim();

    if (
      term &&
      onSearch
    ) {
      onSearch(term);
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={
        containerVariants
      }
      className="space-y-4 pb-4"
      dir="rtl"
    >
      <motion.div
        variants={itemVariants}
        className="pt-0.5"
      >
        <h1
          className="
            flex
            items-center
            gap-2
            text-xl
            font-black
            tracking-tight
            text-slate-900
            dark:text-white
            sm:text-2xl
          "
        >
          <span>
            مرحباً{' '}
            {displayName}
          </span>

          <span
            className="select-none"
            role="img"
            aria-label="تحية"
          >
            👋
          </span>
        </h1>

        <p
          className="
            mt-0.5
            text-[11px]
            font-medium
            text-slate-500
            dark:text-slate-400
            sm:text-xs
          "
        >
          راجع المخزون والأقسام
          والحركات من مكان واحد.
        </p>


        {isSyncing && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/75 px-2.5 py-1 text-[10px] font-semibold text-slate-500 shadow-sm dark:border-white/[0.06] dark:bg-neutral-900/75 dark:text-slate-400">
            <div className="flex items-center gap-1" aria-hidden="true">
              <span className="flex h-5 w-5 animate-pulse items-center justify-center rounded-md border border-slate-200/70 bg-slate-100/70 text-slate-400 dark:border-white/[0.06] dark:bg-white/[0.05] dark:text-slate-500">
                <Layers3 size={10} strokeWidth={2.2} />
              </span>
              <span
                className="flex h-5 w-5 animate-pulse items-center justify-center rounded-md border border-slate-200/70 bg-slate-100/70 text-slate-400 dark:border-white/[0.06] dark:bg-white/[0.05] dark:text-slate-500"
                style={{ animationDelay: '140ms' }}
              >
                <PackageOpen size={10} strokeWidth={2.2} />
              </span>
              <span
                className="flex h-5 w-5 animate-pulse items-center justify-center rounded-md border border-slate-200/70 bg-slate-100/70 text-slate-400 dark:border-white/[0.06] dark:bg-white/[0.05] dark:text-slate-500"
                style={{ animationDelay: '280ms' }}
              >
                <Search size={10} strokeWidth={2.2} />
              </span>
            </div>
            جاري تحديث بقية المخزون...
          </div>
        )}
      </motion.div>

      <motion.form
        variants={itemVariants}
        onSubmit={
          handleSearchSubmit
        }
        className="relative"
      >
        <div
          className="
            relative
            flex
            items-center
          "
        >
          <input
            type="text"
            value={localSearch}
            onChange={event =>
              setLocalSearch(
                event.target.value,
              )
            }
            placeholder="ابحث عن صنف، موديل، قياس، كود، لون..."
            className="
              h-11
              w-full
              rounded-[16px]
              border
              border-slate-200/80
              bg-white
              pr-10
              pl-14
              text-xs
              font-medium
              text-slate-800
              shadow-sm
              outline-none
              transition-all
              placeholder:text-slate-400
              focus:border-indigo-400
              focus:ring-2
              focus:ring-indigo-500/15
              dark:border-white/[0.07]
              dark:bg-neutral-900
              dark:text-white
              dark:placeholder:text-slate-500
              sm:text-sm
            "
          />

          <Search
            size={17}
            className="
              pointer-events-none
              absolute
              right-3.5
              text-slate-400
              dark:text-slate-500
            "
          />

          {localSearch.trim() && (
            <button
              type="submit"
              className="
                absolute
                left-2.5
                rounded-[10px]
                bg-indigo-600
                px-3
                py-1.5
                text-[11px]
                font-bold
                text-white
                transition
                active:scale-95
              "
            >
              بحث
            </button>
          )}
        </div>
      </motion.form>

      <motion.div
        variants={itemVariants}
        className="
          flex
          w-full
          flex-wrap
          items-center
          justify-center
          gap-x-2
          gap-y-1
          text-center
          text-[11px]
          font-bold
          text-slate-600
          dark:text-slate-300
          sm:text-xs
        "
      >
        <button
          type="button"
          onClick={() =>
            onNavigate(
              'inventory',
            )
          }
          className="
            transition-colors
            hover:text-indigo-600
            dark:hover:text-indigo-400
          "
        >
          <span
            className="
              font-black
              text-slate-900
              dark:text-white
            "
          >
            {totalItemsCount}
          </span>{' '}
          صنف
        </button>

        <span
          className="
            text-slate-300
            dark:text-neutral-700
          "
        >
          •
        </span>

        <button
          type="button"
          onClick={() =>
            onNavigate(
              'inventory',
            )
          }
          className="
            transition-colors
            hover:text-indigo-600
            dark:hover:text-indigo-400
          "
        >
          <span
            className="
              font-black
              text-slate-900
              dark:text-white
            "
          >
            {totalQuantitySum.toLocaleString(
              'en-US',
              {
                maximumFractionDigits: 0,
              },
            )}
          </span>{' '}
          إجمالي الكمية
        </button>

        <span
          className="
            text-slate-300
            dark:text-neutral-700
          "
        >
          •
        </span>

        <button
          type="button"
          onClick={() =>
            onNavigate(
              'inventory',
            )
          }
          className="
            transition-colors
            hover:text-indigo-600
            dark:hover:text-indigo-400
          "
        >
          <span
            className="
              font-black
              text-slate-900
              dark:text-white
            "
          >
            {
              activeReservationsCount
            }
          </span>{' '}
          محجوز
        </button>

        <span
          className="
            text-slate-300
            dark:text-neutral-700
          "
        >
          •
        </span>

        <button
          type="button"
          onClick={() =>
            onNavigate(
              'inventory',
            )
          }
          className="
            transition-colors
            hover:text-indigo-600
            dark:hover:text-indigo-400
          "
        >
          <span
            className={
              lowStockCount > 0
                ? 'font-black text-amber-600 dark:text-amber-400'
                : 'font-black text-slate-900 dark:text-white'
            }
          >
            {lowStockCount}
          </span>{' '}
          منخفض
        </button>
      </motion.div>

      <motion.section
        variants={itemVariants}
      >
        <div
          className="
            mb-2
            flex
            items-center
            justify-between
          "
        >
          <h2
            className="
              text-base
              font-bold
              text-slate-900
              dark:text-white
              sm:text-lg
            "
          >
            الأقسام
          </h2>

          <button
            type="button"
            onClick={() =>
              onNavigate(
                'inventory',
              )
            }
            className="
              flex
              items-center
              gap-1
              text-[11px]
              font-bold
              text-indigo-600
              transition
              active:scale-95
              dark:text-indigo-400
              sm:text-xs
            "
          >
            عرض الكل
            <ChevronLeft
              size={14}
            />
          </button>
        </div>

        <div
          className={`
            rounded-[18px]
            border
            border-slate-200/70
            bg-white
            shadow-sm
            divide-y
            divide-slate-100
            dark:border-white/[0.07]
            dark:bg-neutral-900
            dark:divide-white/[0.05]
            ${dashboardCategories.length > 4
              ? 'max-h-[280px] overflow-y-auto overscroll-contain custom-scrollbar'
              : 'overflow-hidden'}
          `}
        >
          {dashboardCategories.map(
            (
              category,
              index,
            ) => {
              const categoryItems =
                safeTiles.filter(
                  item =>
                    item.categoryId ===
                    category.id,
                );

              const visual =
                getCategoryVisual(
                  category,
                  index,
                );

              const IconComponent =
                visual.icon;

              const isPieceUnit =
                category.defaultUnit ===
                'pieces';

              const totalQty =
                categoryItems.reduce(
                  (
                    sum,
                    item,
                  ) =>
                    sum +
                    (Number(
                      item.meters,
                    ) || 0),
                  0,
                );

              return (
                <motion.button
                  layout
                  key={
                    category.id
                  }
                  type="button"
                  onClick={() =>
                    onSelectCategory(
                      category.id,
                    )
                  }
                  whileTap={{
                    scale: 0.99,
                  }}
                  className="
                    flex
                    min-h-[70px]
                    w-full
                    items-center
                    gap-3
                    px-3
                    py-2.5
                    text-right
                    transition-colors
                    hover:bg-slate-50/70
                    dark:hover:bg-neutral-800/40
                  "
                >
                  <div
                    className={`
                      flex
                      h-9
                      w-9
                      shrink-0
                      items-center
                      justify-center
                      rounded-[12px]
                      ${visual.color}
                    `}
                  >
                    <IconComponent
                      size={18}
                      strokeWidth={2}
                    />
                  </div>

                  <div
                    className="
                      min-w-0
                      flex-1
                    "
                  >
                    <h3
                      className="
                        break-words
                        text-xs
                        font-bold
                        text-slate-900
                        dark:text-white
                        sm:text-sm
                      "
                    >
                      {
                        category.name
                      }
                    </h3>

                    <p
                      className="
                        mt-0.5
                        text-[10px]
                        font-medium
                        text-slate-400
                        dark:text-slate-500
                      "
                    >
                      {
                        visual.subtitle
                      }
                    </p>

                  </div>

                  <div
                    className="
                      shrink-0
                      text-left
                      leading-tight
                    "
                  >
                    <div
                      className="
                        text-[10px]
                        font-extrabold
                        text-slate-700
                        dark:text-slate-200
                      "
                    >
                      {categoryItems.length}{' '}
                      صنف
                    </div>

                    <div
                      className="
                        mt-0.5
                        text-[9px]
                        font-semibold
                        text-slate-400
                        dark:text-slate-500
                      "
                    >
                      {totalQty.toLocaleString(
                        'en-US',
                        {
                          maximumFractionDigits:
                            isPieceUnit
                              ? 0
                              : 1,
                        },
                      )}{' '}
                      {isPieceUnit
                        ? 'قطعة'
                        : 'م²'}
                    </div>
                  </div>
                </motion.button>
              );
            },
          )}
        </div>
      </motion.section>

      <motion.section
        variants={itemVariants}
      >
        <div
          className="
            mb-2
            flex
            items-center
            justify-between
          "
        >
          <h2
            className="
              text-base
              font-bold
              text-slate-900
              dark:text-white
              sm:text-lg
            "
          >
            آخر الحركات
          </h2>

          <button
            type="button"
            onClick={() =>
              onNavigate('logs')
            }
            className="
              flex
              items-center
              gap-1
              text-[11px]
              font-bold
              text-indigo-600
              transition
              active:scale-95
              dark:text-indigo-400
              sm:text-xs
            "
          >
            عرض الكل
            <ChevronLeft
              size={14}
            />
          </button>
        </div>

        {safeLogs.length > 0 ? (
          <div
            className="
              overflow-hidden
              rounded-[18px]
              border
              border-slate-200/70
              bg-white
              shadow-sm
              divide-y
              divide-slate-100
              dark:border-white/[0.07]
              dark:bg-neutral-900
              dark:divide-white/[0.05]
            "
          >
            {safeLogs
              .slice(0, 3)
              .map(
                (
                  log,
                  index,
                ) => {
                  const action =
                    log.action ||
                    '';

                  const isAdd =
                    action.includes(
                      'إضافة',
                    ) ||
                    action.includes(
                      'اضافة',
                    ) ||
                    action.includes(
                      'إنشاء',
                    );

                  const isReservation =
                    action.includes(
                      'حجز',
                    );

                  const userName =
                    (log as any)
                      .userName ||
                    (log.user
                      ? log.user.split(
                          '@',
                        )[0]
                      : 'مستخدم');

                  let timeAgo =
                    'الآن';

                  if (
                    log.timestamp
                  ) {
                    try {
                      const date =
                        (log
                          .timestamp as any)
                          .toDate
                          ? (
                              log.timestamp as any
                            ).toDate()
                          : (
                                log.timestamp as any
                              )
                              .seconds
                            ? new Date(
                                (
                                  log.timestamp as any
                                )
                                  .seconds *
                                  1000,
                              )
                            : new Date(
                                log.timestamp as any,
                              );

                      if (
                        !Number.isNaN(
                          date.getTime(),
                        )
                      ) {
                        const diffMinutes =
                          Math.floor(
                            (Date.now() -
                              date.getTime()) /
                              60000,
                          );

                        const diffHours =
                          Math.floor(
                            diffMinutes /
                              60,
                          );

                        if (
                          diffMinutes <
                          1
                        ) {
                          timeAgo =
                            'الآن';
                        } else if (
                          diffMinutes <
                          60
                        ) {
                          timeAgo = `منذ ${diffMinutes} د`;
                        } else if (
                          diffHours <
                          24
                        ) {
                          timeAgo = `منذ ${diffHours} س`;
                        } else {
                          timeAgo =
                            date.toLocaleDateString(
                              'ar-EG',
                              {
                                month:
                                  'numeric',
                                day: 'numeric',
                              },
                            );
                        }
                      }
                    } catch {
                      timeAgo =
                        'منذ قليل';
                    }
                  }

                  return (
                    <div
                      key={
                        log.id ||
                        index
                      }
                      className="
                        flex
                        min-h-[56px]
                        items-center
                        justify-between
                        gap-2.5
                        px-3
                        py-2.5
                        transition-colors
                        hover:bg-slate-50/60
                        dark:hover:bg-neutral-800/40
                      "
                    >
                      <div
                        className="
                          flex
                          min-w-0
                          flex-1
                          items-center
                          gap-2.5
                        "
                      >
                        <div
                          className="
                            flex
                            h-8
                            w-8
                            shrink-0
                            items-center
                            justify-center
                            rounded-full
                            border
                            border-slate-200
                            bg-slate-100
                            text-xs
                            font-bold
                            text-slate-700
                            dark:border-neutral-700
                            dark:bg-neutral-800
                            dark:text-slate-300
                          "
                        >
                          {userName
                            .charAt(
                              0,
                            )
                            .toUpperCase()}
                        </div>

                        <div
                          className="
                            min-w-0
                            flex-1
                          "
                        >
                          <p
                            className="
                              break-words
                              text-xs
                              font-semibold
                              text-slate-900
                              dark:text-white
                            "
                          >
                            {
                              userName
                            }{' '}
                            {action}
                          </p>

                          {log.tileName && (
                            <p
                              className="
                                mt-0.5
                                break-words
                                text-[10px]
                                font-semibold
                                text-indigo-600
                                dark:text-indigo-400
                                sm:text-[11px]
                              "
                            >
                              {
                                log.tileName
                              }
                              {log.details
                                ? ` - ${log.details}`
                                : ''}
                            </p>
                          )}
                        </div>
                      </div>

                      <div
                        className="
                          flex
                          shrink-0
                          items-center
                          gap-2
                        "
                      >
                        <span
                          className="
                            text-[10px]
                            font-medium
                            text-slate-400
                            dark:text-slate-500
                          "
                        >
                          {timeAgo}
                        </span>

                        <div
                          className={`
                            flex
                            h-7
                            w-7
                            items-center
                            justify-center
                            rounded-[9px]
                            ${
                              isAdd
                                ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400'
                                : isReservation
                                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                                  : 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                            }
                          `}
                        >
                          {isAdd ? (
                            <Plus
                              size={
                                13
                              }
                            />
                          ) : isReservation ? (
                            <UserCheck
                              size={
                                13
                              }
                            />
                          ) : (
                            <Pencil
                              size={
                                13
                              }
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                },
              )}
          </div>
        ) : (
          <div
            className="
              flex
              min-h-[54px]
              items-center
              justify-center
              rounded-[16px]
              border
              border-slate-200/70
              bg-white
              px-4
              py-3
              text-center
              text-[10px]
              font-medium
              text-slate-400
              shadow-sm
              dark:border-white/[0.07]
              dark:bg-neutral-900
              dark:text-slate-500
            "
          >
            لا توجد حركات
          </div>
        )}
      </motion.section>
    </motion.div>
  );
};

export default React.memo(
  Dashboard,
);