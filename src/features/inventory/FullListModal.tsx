import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
} from 'react';

import {
  Layers3,
  PackageOpen,
  Search,
  X,
} from 'lucide-react';

import {
  Category,
  LogEntry,
  Tile,
} from '@/types';

import {
  ResponsiveOverlay,
} from '@/components/ui/ResponsiveOverlay';

import {
  DeleteIcon,
  EditIcon,
  ReservedIcon,
} from '@/components/ui/Icons';

import {
  InventoryItemRow,
} from './components/InventoryItemRow';

import {
  calculateAvailableQuantity,
  calculateReservedQuantity,
} from './inventoryCalculations';
import { formatAuditDate } from './auditDate';

interface FullListModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category;
  tiles: Tile[];
  logs?: LogEntry[];
  onEdit: (
    tile: Tile,
  ) => void;
  onDelete: (
    id: string,
  ) => void;
  onOpenReservation: (
    tile: Tile,
  ) => void;
  onViewImage: (
    src: string,
  ) => void;
  onToggleHideTile?: (
    tile: Tile,
  ) => void;
}

const normalizeSize = (
  value?: string,
) =>
  value
    ? value
        .replace(
          /\*/g,
          '×',
        )
        .replace(
          /\s*x\s*/gi,
          '×',
        )
    : '';

const cleanDisplayValue = (
  value?: string,
) =>
  value
    ? value
        .replace(
          /\s*\([^)]*\)\s*/g,
          '',
        )
        .trim()
    : '';

export const FullListModal:
  React.FC<
    FullListModalProps
  > = ({
    isOpen,
    onClose,
    category,
    tiles,
    logs = [],
    onEdit,
    onDelete,
    onOpenReservation,
    onViewImage,
  }) => {
    const [
      search,
      setSearch,
    ] = useState('');


    const [visibleCount, setVisibleCount] = useState(30);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);

    const isPieceCategory =
      category.defaultUnit ===
      'pieces';

    const categoryAllowsImages =
      category.fieldsConfig
        ?.hasImage !== false;

    const filteredTiles =
      useMemo(() => {
        const query =
          search
            .toLowerCase()
            .trim();

        if (!query) {
          return tiles;
        }

        return tiles.filter(
          tile => {
            const customSnapshot =
              tile.customFieldSnapshot
                ?.map(
                  field =>
                    `${field.label} ${field.value} ${field.suffix || ''}`,
                )
                .join(' ');

            return [
              tile.name,
              tile.shade,
              tile.size,
              tile.color,
              tile.quality,
              tile.surface,
              tile.itemType,
              tile.brand,
              tile.materialOrGlass,
              customSnapshot,
            ].some(value =>
              String(
                value ||
                  '',
              )
                .toLowerCase()
                .includes(
                  query,
                ),
            );
          },
        );
      }, [
        tiles,
        search,
      ]);

    const displayedTiles = useMemo(
      () => filteredTiles.slice(0, visibleCount),
      [filteredTiles, visibleCount],
    );

    const hasMore = displayedTiles.length < filteredTiles.length;

    useEffect(() => {
      setVisibleCount(30);
    }, [search, category.id, isOpen]);

    useEffect(() => {
      const target = loadMoreRef.current;
      if (!target || !hasMore || !isOpen) return;

      const observer = new IntersectionObserver(
        entries => {
          if (entries.some(entry => entry.isIntersecting)) {
            setVisibleCount(previous =>
              Math.min(previous + 30, filteredTiles.length),
            );
          }
        },
        { rootMargin: '280px 0px' },
      );

      observer.observe(target);
      return () => observer.disconnect();
    }, [hasMore, isOpen, filteredTiles.length]);

    if (!isOpen) {
      return null;
    }

    return (
      <ResponsiveOverlay
        open={isOpen}
        onClose={onClose}
        title={`المخزون الكامل - ${category.name}`}
        mobileSnap="large"
        desktopMaxWidth="max-w-5xl"
        contentClassName="p-0"
      >
        <div className="min-h-full bg-slate-50/40 dark:bg-neutral-950/20">
          <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/95 px-3 py-3 backdrop-blur-md dark:border-white/[0.06] dark:bg-neutral-900/95 sm:px-5">
            <div className="flex items-center gap-2.5">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="text"
                  value={
                    search
                  }
                  onChange={event =>
                    setSearch(
                      event.target
                        .value,
                    )
                  }
                  placeholder="ابحث بالاسم، المقاس، الشيد، اللون..."
                  className="h-11 w-full rounded-[13px] border border-slate-200/80 bg-slate-50 pr-9 pl-9 text-xs font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 dark:border-white/[0.08] dark:bg-neutral-800/70 dark:text-white dark:focus:bg-neutral-800"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch(
                        '',
                      )
                    }
                    className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-neutral-700 dark:hover:text-slate-200"
                    aria-label="مسح البحث"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:bg-neutral-800 dark:text-slate-300">
                {
                  filteredTiles.length
                }{' '}
                صنف
              </span>
            </div>
          </div>

          <div className="p-3 sm:p-5">
            {filteredTiles.length ===
            0 ? (
              <div className="rounded-[16px] border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-xs font-medium text-slate-400 dark:border-white/[0.08] dark:bg-neutral-900 dark:text-slate-500">
                لا توجد أصناف مطابقة
                للبحث.
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-[18px] border border-slate-200/70 bg-white shadow-sm divide-y divide-slate-100 dark:border-white/[0.07] dark:bg-neutral-900 dark:divide-white/[0.05] md:hidden">
                  {displayedTiles.map(
                    tile => (
                      <InventoryItemRow
                        key={
                          tile.id
                        }
                        item={
                          tile
                        }
                        category={
                          category
                        }
                        onViewImage={
                          onViewImage
                        }
                        onOpenReservation={item => {
                          onClose();

                          onOpenReservation(
                            item,
                          );
                        }}
                        onEdit={item => {
                          onClose();

                          onEdit(
                            item,
                          );
                        }}
                        onDelete={id => {
                          onClose();

                          onDelete(
                            id,
                          );
                        }}
                      />
                    ),
                  )}
                </div>

                <div className="hidden overflow-hidden rounded-[16px] border border-slate-200/70 bg-white dark:border-white/[0.07] dark:bg-neutral-900 md:block">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-right">
                      <thead className="sticky top-0 z-10 border-b border-slate-200/70 bg-slate-50/95 dark:border-white/[0.06] dark:bg-neutral-800/95">
                        <tr>
                          <th className="min-w-[220px] p-3 text-xs font-bold text-slate-500 dark:text-slate-400">
                            الصنف
                          </th>

                          <th className="min-w-[180px] p-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                            المواصفات
                          </th>

                          <th className="min-w-[120px] p-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                            المتوفر
                          </th>

                          <th className="min-w-[120px] p-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                            الحجز
                          </th>

                          <th className="min-w-[130px] p-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                            الإجراءات
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                        {displayedTiles.map(
                          tile => {
                            const availableQty =
                              calculateAvailableQuantity(
                                tile,
                              );

                            const totalReserved =
                              calculateReservedQuantity(
                                tile,
                              );

                            const isPieceUnit =
                              tile.unitType ===
                                'pieces' ||
                              isPieceCategory;

                            const availablePallets =
                              !isPieceUnit &&
                              Number(
                                tile.meters,
                              ) > 0
                                ? (availableQty /
                                    Number(
                                      tile.meters,
                                    )) *
                                  Number(
                                    tile.pallets ||
                                      0,
                                  )
                                : 0;

                            const customText =
                              tile.customFieldSnapshot
                                ?.filter(
                                  field =>
                                    String(
                                      field.value ??
                                        '',
                                    ).trim(),
                                )
                                .map(
                                  field =>
                                    `${field.value}${
                                      field.suffix
                                        ? ` ${field.suffix}`
                                        : ''
                                    }`,
                                )
                                .join(
                                  ' • ',
                                );

                            const systemText =
                              [
                                normalizeSize(
                                  tile.size,
                                ),

                                tile.shade
                                  ? `شيد ${tile.shade}`
                                  : '',

                                tile.brand,
                                tile.color,
                                tile.itemType,
                                tile.materialOrGlass,
                              ]
                                .filter(
                                  Boolean,
                                )
                                .join(
                                  ' • ',
                                );

                            const lastUpdate =
                              formatAuditDate(
                                tile.updatedAt,
                              );

                            return (
                              <tr
                                key={
                                  tile.id
                                }
                                className="transition-colors hover:bg-slate-50/70 dark:hover:bg-neutral-800/40"
                              >
                                <td className="p-3 align-middle">
                                  <div className="flex items-center gap-2.5">
                                    {categoryAllowsImages && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          tile.image &&
                                          onViewImage(
                                            tile.image,
                                          )
                                        }
                                        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-slate-200/70 bg-slate-50 dark:border-white/[0.07] dark:bg-neutral-800"
                                      >
                                        {tile.image &&
                                        tile.image !==
                                          'none' ? (
                                          <img
                                            src={
                                              tile.image
                                            }
                                            alt={
                                              tile.name
                                            }
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          <span className="text-[9px] font-bold text-slate-400">
                                            —
                                          </span>
                                        )}
                                      </button>
                                    )}

                                    <div className="min-w-0">
                                      <div className="font-bold text-slate-900 dark:text-white">
                                        {
                                          tile.name
                                        }
                                      </div>

                                      {(tile.quality ||
                                        tile.surface) && (
                                        <div className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                          {[
                                            cleanDisplayValue(
                                              tile.quality,
                                            ),

                                            cleanDisplayValue(
                                              tile.surface,
                                            ),
                                          ]
                                            .filter(
                                              Boolean,
                                            )
                                            .join(
                                              ' • ',
                                            )}
                                        </div>
                                      )}

                                      <div className="mt-0.5 text-[9px] text-slate-400">
                                        آخر تحديث: {lastUpdate}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <td className="p-3 text-center align-middle text-[11px] font-medium leading-5 text-slate-600 dark:text-slate-300">
                                  {customText ||
                                    systemText ||
                                    '—'}
                                </td>

                                <td className="p-3 text-center align-middle">
                                  <div
                                    className={`
                                      text-sm
                                      font-black
                                      ${
                                        availableQty <=
                                        2
                                          ? 'text-rose-600 dark:text-rose-400'
                                          : 'text-slate-900 dark:text-white'
                                      }
                                    `}
                                  >
                                    {isPieceUnit
                                      ? availableQty.toFixed(
                                          0,
                                        )
                                      : availableQty.toFixed(
                                          2,
                                        )}{' '}
                                    {isPieceUnit
                                      ? 'قطعة'
                                      : 'م²'}
                                  </div>

                                  {!isPieceUnit &&
                                    availablePallets >
                                      0 && (
                                      <div className="mt-0.5 text-[10px] font-medium text-slate-400">
                                        {availablePallets.toFixed(
                                          1,
                                        )}{' '}
                                        طبلية
                                      </div>
                                    )}
                                </td>

                                <td className="p-3 text-center align-middle">
                                  {totalReserved >
                                  0 ? (
                                    <span className="inline-flex rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600 dark:bg-rose-900/25 dark:text-rose-400">
                                      محجوز{' '}
                                      {
                                        totalReserved
                                      }{' '}
                                      {isPieceUnit
                                        ? 'قطعة'
                                        : 'م²'}
                                    </span>
                                  ) : (
                                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600 dark:bg-emerald-900/25 dark:text-emerald-400">
                                      متاح
                                    </span>
                                  )}
                                </td>

                                <td className="p-3 text-center align-middle">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onClose();

                                        onOpenReservation(
                                          tile,
                                        );
                                      }}
                                      className="flex h-8 items-center gap-1 rounded-[10px] bg-amber-50 px-2.5 text-[11px] font-bold text-amber-700 dark:bg-amber-900/25 dark:text-amber-300"
                                    >
                                      <ReservedIcon className="h-3.5 w-3.5" />
                                      حجز
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        onClose();

                                        onEdit(
                                          tile,
                                        );
                                      }}
                                      className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-slate-300"
                                      aria-label="تعديل"
                                    >
                                      <EditIcon className="h-3.5 w-3.5" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        onDelete(
                                          tile.id,
                                        )
                                      }
                                      className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-rose-50 text-rose-600 dark:bg-rose-900/25 dark:text-rose-400"
                                      aria-label="حذف"
                                    >
                                      <DeleteIcon className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div ref={loadMoreRef} className="flex min-h-10 items-center justify-center py-2">
                  {hasMore ? (
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                      <div className="flex items-center gap-1" aria-hidden="true">
                        <span className="flex h-6 w-6 animate-pulse items-center justify-center rounded-lg border border-slate-200/70 bg-slate-100/70 text-slate-400/80 dark:border-white/[0.06] dark:bg-white/[0.05] dark:text-slate-500">
                          <Layers3 size={11} />
                        </span>
                        <span
                          className="flex h-6 w-6 animate-pulse items-center justify-center rounded-lg border border-slate-200/70 bg-slate-100/70 text-slate-400/80 dark:border-white/[0.06] dark:bg-white/[0.05] dark:text-slate-500"
                          style={{ animationDelay: '140ms' }}
                        >
                          <PackageOpen size={11} />
                        </span>
                        <span
                          className="flex h-6 w-6 animate-pulse items-center justify-center rounded-lg border border-slate-200/70 bg-slate-100/70 text-slate-400/80 dark:border-white/[0.06] dark:bg-white/[0.05] dark:text-slate-500"
                          style={{ animationDelay: '280ms' }}
                        >
                          <Search size={11} />
                        </span>
                      </div>
                      جاري تحميل المزيد...
                    </div>
                  ) : filteredTiles.length > 30 ? (
                    <span className="text-[10px] font-medium text-slate-300 dark:text-slate-600">تم عرض جميع الأصناف</span>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </ResponsiveOverlay>
    );
  };