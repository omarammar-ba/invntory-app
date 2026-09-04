import {
  InventoryItemRow,
} from './components/InventoryItemRow';

import {
  StaggerItem,
} from '@/components/motion/StaggerItem';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { formatAuditDate } from './auditDate';

import {
  Category,
  LogEntry,
  Tile,
} from '@/types';

import {
  DeleteIcon,
  EditIcon,
  ReservedIcon,
  FolderIcon,
  ListIcon,
  SearchIcon,
} from '@/components/ui/Icons';

interface TileListProps {
  tiles: Tile[];
  loading?: boolean;
  onEdit: (tile: Tile) => void;
  onDelete: (id: string) => void;
  onOpenReservation: (tile: Tile) => void;
  onViewImage: (src: string) => void;
  viewMode:
    | 'preview'
    | 'full';
  activeCategoryId?: string;
  category?: Category;
  categories?: Category[];
  logs?: LogEntry[];
  currentStaff?: any;
  searchQuery?: string;
  onToggleHideTile?: (
    tile: Tile,
  ) => void;
}

const INITIAL_VISIBLE_COUNT = 30;
const LOAD_MORE_COUNT = 30;

const InventoryLoadingGlyphs: React.FC<{
  label?: string;
  compact?: boolean;
}> = ({ label, compact = false }) => {
  const boxClass = compact
    ? 'h-6 w-6 rounded-lg'
    : 'h-10 w-10 rounded-xl';
  const iconClass = compact ? 'h-3 w-3' : 'h-4 w-4';

  const glyphs = [
    { Icon: FolderIcon, delay: '0ms' },
    { Icon: ListIcon, delay: '140ms' },
    { Icon: SearchIcon, delay: '280ms' },
  ];

  return (
    <div className={compact ? 'flex items-center justify-center gap-2' : 'flex flex-col items-center justify-center gap-3'}>
      <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
        {glyphs.map(({ Icon, delay }, index) => (
          <span
            key={index}
            className={`${boxClass} flex animate-pulse items-center justify-center border border-slate-200/70 bg-slate-100/70 text-slate-400/80 shadow-sm dark:border-white/[0.06] dark:bg-white/[0.05] dark:text-slate-500`}
            style={{ animationDelay: delay }}
          >
            <Icon className={iconClass} />
          </span>
        ))}
      </div>

      {label && (
        <span className={compact ? 'text-[10px] font-semibold text-slate-400 dark:text-slate-500' : 'text-[11px] font-semibold text-slate-400 dark:text-slate-500'}>
          {label}
        </span>
      )}
    </div>
  );
};

const TileList: React.FC<
  TileListProps
> = ({
  tiles,
  loading,
  onEdit,
  onDelete,
  onOpenReservation,
  onViewImage,
  activeCategoryId = 'tiles',
  category,
  categories,
  logs = [],
  searchQuery = '',
}) => {
  const listIdentity = `${activeCategoryId}\u0000${searchQuery}`;
  const [pagination, setPagination] = useState(() => ({
    key: listIdentity,
    count: INITIAL_VISIBLE_COUNT,
  }));
  const [isPrinting, setIsPrinting] = useState(false);

  const visibleCount =
    pagination.key === listIdentity
      ? pagination.count
      : INITIAL_VISIBLE_COUNT;

  useEffect(() => {
    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => setIsPrinting(false);

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const visibleTiles = useMemo(
    () => (isPrinting ? tiles : tiles.slice(0, visibleCount)),
    [isPrinting, tiles, visibleCount],
  );

  const hasMoreVisibleItems = !isPrinting && visibleTiles.length < tiles.length;

  const handleProgressiveScroll = useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      if (!hasMoreVisibleItems) return;

      const target = event.currentTarget;
      const distanceFromBottom =
        target.scrollHeight - target.scrollTop - target.clientHeight;

      if (distanceFromBottom <= 220) {
        setPagination(previous => {
          const currentCount =
            previous.key === listIdentity
              ? previous.count
              : INITIAL_VISIBLE_COUNT;

          return {
            key: listIdentity,
            count: Math.min(currentCount + LOAD_MORE_COUNT, tiles.length),
          };
        });
      }
    },
    [hasMoreVisibleItems, listIdentity, tiles.length],
  );

  const shouldShowImage = (
    tile: Tile,
  ): boolean => {
    return Boolean(
      tile.image &&
        tile.image.trim() !==
          '' &&
        tile.image !== 'none',
    );
  };

  const targetCategory =
    category ||
    categories?.find(
      c =>
        c.id ===
        activeCategoryId,
    );

  const categoryAllowsImages =
    targetCategory?.fieldsConfig?.hasImage !==
    false;

  const isPieceCategory =
    targetCategory?.defaultUnit ===
      'pieces' ||
    (!targetCategory &&
      activeCategoryId !==
        'tiles' &&
      activeCategoryId !==
        'ceramics');

  const containerStyles = {
    maxHeight: '560px',
    overflowY:
      'auto' as const,
  };

  const cellPadding =
    'px-3.5 py-3';

  return (
    <div
      className="
        mt-3
        print:mt-0
        print:w-full
      "
      dir="rtl"
    >
      <div
        className="
          hidden
          border-b-2
          border-black
          pb-3
          text-center
          print:mb-6
          print:block
        "
      >
        <h1 className="text-2xl font-bold text-black">
          كشف مخزون
          للمواد والديكورات
        </h1>

        <p className="mt-1 text-xs text-black">
          تاريخ الكشف:{' '}
          {new Date().toLocaleDateString(
            'ar-EG',
          )}
        </p>
      </div>

      <div
        onScroll={handleProgressiveScroll}
        className={`
          block
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
          md:hidden
          print:hidden
          ${
            tiles.length > 4
              ? 'max-h-[291px] overflow-y-auto overscroll-contain custom-scrollbar'
              : 'overflow-hidden'
          }
        `}
      >
        {tiles.length === 0 ? (
          loading ? (
            <div className="py-9 text-center">
              <InventoryLoadingGlyphs label="جاري تحميل أول دفعة من المخزون..." />
            </div>
          ) : (
            <div className="animate-fade-in py-12 text-center text-xs font-medium text-slate-400 dark:text-slate-500 sm:text-sm">
              لا توجد أصناف مسجلة في هذا القسم حالياً.
            </div>
          )
        ) : (
          <>
            {visibleTiles.map((tile, index) => (
              <StaggerItem key={tile.id} index={index}>
                <InventoryItemRow
                  item={tile}
                  category={targetCategory}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onOpenReservation={onOpenReservation}
                  onViewImage={onViewImage}
                />
              </StaggerItem>
            ))}

            {loading && (
              <div className="border-t border-slate-100 px-3 py-2.5 dark:border-white/[0.05]">
                <InventoryLoadingGlyphs compact label="جاري تحديث بقية الأصناف..." />
              </div>
            )}
          </>
        )}
      </div>

      <div
        className="
          hidden
          overflow-hidden
          rounded-[20px]
          border
          border-slate-200/70
          bg-white
          shadow-sm
          transition-colors
          dark:border-white/[0.07]
          dark:bg-neutral-900
          md:block
          print:overflow-visible
          print:rounded-none
          print:border-none
          print:bg-transparent
          print:shadow-none
        "
      >
        <div
          style={
            containerStyles
          }
          onScroll={handleProgressiveScroll}
          className="
            custom-scrollbar
            overflow-x-auto
            print:!h-auto
            print:!max-h-none
            print:!overflow-visible
            print:w-full
          "
        >
          <table
            className="
              w-full
              divide-y
              divide-slate-100
              text-right
              dark:divide-white/[0.05]
              print:min-w-full
              print:table
              print:border-collapse
            "
          >
            <thead
              className="
                sticky
                top-0
                z-20
                border-b
                border-slate-200/70
                bg-slate-50/90
                backdrop-blur-md
                dark:border-white/[0.07]
                dark:bg-neutral-800
                print:static
                print:table-header-group
                print:bg-gray-100
              "
            >
              <tr className="print:border-b-2 print:border-black">
                <th
                  className={`
                    ${cellPadding}
                    text-center
                    text-xs
                    font-bold
                    text-slate-600
                    dark:text-slate-400
                    print:hidden
                  `}
                >
                  الصنف
                </th>

                <th
                  className={`
                    ${cellPadding}
                    text-center
                    text-xs
                    font-bold
                    text-slate-600
                    dark:text-slate-400
                    print:hidden
                  `}
                >
                  المواصفات والخصائص
                </th>

                <th
                  className={`
                    ${cellPadding}
                    text-center
                    text-xs
                    font-bold
                    text-slate-600
                    dark:text-slate-400
                    print:hidden
                  `}
                >
                  المتوفر الفعلي
                </th>

                <th
                  className={`
                    ${cellPadding}
                    whitespace-nowrap
                    text-center
                    text-xs
                    font-bold
                    text-slate-600
                    dark:text-slate-400
                    print:hidden
                  `}
                >
                  حالة الحجز
                </th>

                <th
                  className={`
                    ${cellPadding}
                    no-print
                    text-center
                    text-xs
                    font-bold
                    text-slate-600
                    dark:text-slate-400
                  `}
                >
                  إجراءات
                </th>

                <th className="hidden border border-black bg-gray-100 px-2 py-2 text-center text-xs font-bold text-black print:table-cell">
                  اسم الصنف
                </th>

                <th className="hidden border border-black bg-gray-100 px-2 py-2 text-center text-xs font-bold text-black print:table-cell">
                  المواصفات
                </th>

                <th className="hidden border border-black bg-gray-100 px-2 py-2 text-center text-xs font-bold text-black print:table-cell">
                  المتوفر
                </th>
              </tr>
            </thead>

            <tbody
              className="
                divide-y
                divide-slate-100
                bg-white
                dark:divide-white/[0.05]
                dark:bg-transparent
                print:divide-y
                print:divide-black
                print:bg-white
              "
            >
              {tiles.length === 0 ? (
                loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <InventoryLoadingGlyphs label="جاري تحميل أول دفعة من المخزون..." />
                    </td>
                  </tr>
                ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-sm font-semibold text-slate-400 dark:text-slate-500"
                  >
                    لا توجد أصناف
                    مسجلة في هذا
                    القسم حالياً.
                  </td>
                </tr>
                )
              ) : (
                <>
                {visibleTiles.map(
                  (
                    tile,
                    index,
                  ) => {
                    const isTilePiece =
                      tile.unitType ===
                        'pieces' ||
                      isPieceCategory;

                    const totalReserved =
                      tile.reservations?.reduce(
                        (
                          sum,
                          r,
                        ) =>
                          sum +
                          r.meters,
                        0,
                      ) ||
                      0;

                    const availableQty =
                      (tile.meters ||
                        0) -
                      totalReserved;

                    const availablePallets =
                      !isTilePiece &&
                      tile.meters >
                        0
                        ? (availableQty /
                            tile.meters) *
                          (tile.pallets ||
                            0)
                        : 0;

                    const lastUpdateStr =
                      formatAuditDate(
                        tile.updatedAt,
                      );

                    const showImg =
                      categoryAllowsImages &&
                      shouldShowImage(
                        tile,
                      );

                    return (
                      <StaggerItem
                        as="tr"
                        index={index}
                        key={tile.id}
                        className="
                          group
                          transition-colors
                          hover:bg-slate-50/80
                          dark:hover:bg-white/[0.03]
                          print:break-inside-avoid
                          print:hover:bg-transparent
                        "
                      >
                        <td
                          className={`
                            ${cellPadding}
                            print:hidden
                          `}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            {categoryAllowsImages &&
                              (showImg ? (
                                <div className="group relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-[11px] border border-slate-200/60 shadow-sm dark:border-white/[0.06] no-print">
                                  <img
                                    src={
                                      tile.image
                                    }
                                    alt={
                                      tile.name
                                    }
                                    className="h-full w-full cursor-pointer object-cover transition-transform duration-200 group-hover:scale-105"
                                    onClick={() =>
                                      onViewImage(
                                        tile.image,
                                      )
                                    }
                                    loading="lazy"
                                  />
                                </div>
                              ) : (
                                <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[11px] border border-dashed border-slate-200/80 bg-slate-50 p-0.5 text-center shadow-sm dark:border-neutral-700/70 dark:bg-neutral-800/80 no-print">
                                  <span className="text-[10px] font-bold leading-tight text-slate-400 dark:text-slate-500">
                                    بدون صورة
                                  </span>
                                </div>
                              ))}

                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold leading-tight text-slate-900 dark:text-white sm:text-sm">
                                {
                                  tile.name
                                }
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] font-semibold">
                                {tile.quality && (
                                  <span className="rounded-[6px] border border-emerald-200/50 bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                    {
                                      tile.quality
                                    }
                                  </span>
                                )}

                                {tile.surface && (
                                  <span className="rounded-[6px] border border-slate-200/60 bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:border-white/[0.06] dark:bg-neutral-800 dark:text-slate-300">
                                    {
                                      tile.surface
                                    }
                                  </span>
                                )}

                                {tile.itemType && (
                                  <span className="rounded-[6px] border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-slate-300">
                                    {
                                      tile.itemType
                                    }
                                  </span>
                                )}
                              </div>

                              <div className="mt-0.5 text-[10px] font-normal text-slate-400 dark:text-slate-500">
                                آخر تحديث:{' '}
                                {
                                  lastUpdateStr
                                }
                              </div>
                            </div>
                          </div>
                        </td>

                        <td
                          className={`
                            ${cellPadding}
                            text-center
                            align-middle
                            print:hidden
                          `}
                        >
                          {tile
                            .customFieldSnapshot &&
                          tile
                            .customFieldSnapshot
                            .length >
                            0 ? (
                            <div className="mx-auto flex max-w-xs flex-wrap items-center justify-center gap-1">
                              {tile.customFieldSnapshot.map(
                                snap => (
                                  <span
                                    key={
                                      snap.fieldId
                                    }
                                    className="rounded-[6px] border border-slate-200/60 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:border-white/[0.06] dark:bg-neutral-800 dark:text-slate-300"
                                  >
                                    <span className="text-slate-400">
                                      {
                                        snap.label
                                      }
                                      :{' '}
                                    </span>

                                    <strong>
                                      {
                                        snap.value
                                      }

                                      {snap.suffix
                                        ? ` ${snap.suffix}`
                                        : ''}
                                    </strong>
                                  </span>
                                ),
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              {tile.size && (
                                <span className="rounded-[8px] border border-slate-200/60 bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800 dark:border-white/[0.06] dark:bg-neutral-800 dark:text-slate-100">
                                  {
                                    tile.size
                                  }
                                </span>
                              )}

                              <div className="mt-0.5 flex flex-wrap items-center justify-center gap-1 text-[10px] font-normal leading-tight text-slate-500 dark:text-slate-400">
                                {tile.shade && (
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                                    شيد:{' '}
                                    {
                                      tile.shade
                                    }
                                  </span>
                                )}

                                {tile.shade &&
                                  tile.color && (
                                    <span>
                                      •
                                    </span>
                                  )}

                                {tile.color && (
                                  <span>
                                    {
                                      tile.color
                                    }
                                  </span>
                                )}

                                {(tile.shade ||
                                  tile.color) &&
                                  tile.brand && (
                                    <span>
                                      •
                                    </span>
                                  )}

                                {tile.brand && (
                                  <span>
                                    {
                                      tile.brand
                                    }
                                  </span>
                                )}

                                {tile.materialOrGlass && (
                                  <span>
                                    •{' '}
                                    {
                                      tile.materialOrGlass
                                    }
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        <td
                          className={`
                            ${cellPadding}
                            text-center
                            align-middle
                            print:hidden
                          `}
                        >
                          <div className="flex flex-col items-center justify-center">
                            <div
                              className={`
                                flex
                                items-center
                                justify-center
                                gap-0.5
                                text-xs
                                font-bold
                                tabular-nums
                                sm:text-sm
                                ${
                                  availableQty <=
                                  2
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-slate-900 dark:text-white'
                                }
                              `}
                            >
                              <span>
                                {isTilePiece
                                  ? availableQty
                                  : availableQty.toFixed(
                                      1,
                                    )}
                              </span>

                              <small className="mr-0.5 text-[10px] font-normal text-slate-400">
                                {isTilePiece
                                  ? 'قطعة'
                                  : 'م²'}
                              </small>
                            </div>

                            {!isTilePiece && (
                              <div className="mt-0.5 text-[10px] font-normal tabular-nums text-slate-400 dark:text-slate-500">
                                {availablePallets.toFixed(
                                  1,
                                )}{' '}
                                طبلية
                              </div>
                            )}
                          </div>
                        </td>

                        <td
                          className={`
                            ${cellPadding}
                            whitespace-nowrap
                            text-center
                            align-middle
                            print:hidden
                          `}
                        >
                          {totalReserved >
                          0 ? (
                            <div className="inline-flex items-center justify-center gap-1 rounded-[10px] border border-rose-200/50 bg-rose-50 px-2.5 py-1 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />

                              <span className="text-[11px] font-bold">
                                محجوز (
                                {
                                  totalReserved
                                }
                                )
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center justify-center gap-1 rounded-[10px] border border-emerald-200/50 bg-emerald-50 px-2.5 py-1 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

                              <span className="text-[11px] font-bold">
                                متاح
                              </span>
                            </div>
                          )}
                        </td>

                        <td
                          className={`
                            ${cellPadding}
                            no-print
                            whitespace-nowrap
                            text-center
                            align-middle
                          `}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                onOpenReservation(
                                  tile,
                                )
                              }
                              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[11px] border border-amber-200/50 bg-amber-50/70 text-amber-600 shadow-sm transition-transform hover:bg-amber-100 hover:text-amber-800 active:scale-95 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-900/50"
                              title="إدارة الحجوزات"
                            >
                              <ReservedIcon className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                onEdit(
                                  tile,
                                )
                              }
                              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[11px] border border-slate-200/60 bg-slate-100 text-slate-600 shadow-sm transition-transform hover:bg-slate-200 hover:text-slate-900 active:scale-95 dark:border-white/[0.06] dark:bg-neutral-800 dark:text-slate-300 dark:hover:bg-neutral-700 dark:hover:text-white"
                              title="تعديل الصنف"
                            >
                              <EditIcon className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                onDelete(
                                  tile.id,
                                )
                              }
                              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[11px] border border-rose-200/50 bg-rose-50/70 text-rose-600 shadow-sm transition-transform hover:bg-rose-100 hover:text-rose-800 active:scale-95 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/50"
                              title="حذف الصنف"
                            >
                              <DeleteIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>

                        <td className="hidden border border-black px-2 py-2 text-center font-bold text-black print:table-cell">
                          {tile.name}
                        </td>

                        <td className="hidden border border-black px-2 py-2 text-center font-bold text-black print:table-cell">
                          {tile.customFieldSnapshot
                            ?.map(
                              s =>
                                `${s.label}: ${s.value}`,
                            )
                            .join(
                              ' | ',
                            ) ||
                            tile.size ||
                            tile.itemType ||
                            '-'}
                        </td>

                        <td className="hidden border border-black px-2 py-2 text-center font-bold text-black print:table-cell">
                          {
                            availableQty
                          }{' '}
                          {isTilePiece
                            ? 'قطعة'
                            : 'م²'}
                        </td>
                      </StaggerItem>
                    );
                  },
                )}

                {loading && (
                  <tr>
                    <td colSpan={5} className="py-3 text-center">
                      <InventoryLoadingGlyphs compact label="جاري تحديث بقية الأصناف..." />
                    </td>
                  </tr>
                )}
                </>
              )}
            </tbody>
          </table>

        </div>
      </div>
    </div>
  );
};

export default React.memo(
  TileList,
);