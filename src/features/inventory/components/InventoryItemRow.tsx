import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  CalendarPlus,
  Image as ImageIcon,
  Pencil,
  Trash2,
} from 'lucide-react';

import { Category, Tile } from '@/types';
import { formatAuditDate } from '../auditDate';
import {
  calculateAvailableQuantity,
  calculateReservedQuantity,
} from '../inventoryCalculations';

interface InventoryItemRowProps {
  item: Tile;
  category?: Category;
  onEdit: (item: Tile) => void;
  onDelete: (id: string) => void;
  onOpenReservation: (item: Tile) => void;
  onViewImage?: (src: string) => void;
  onClick?: (item: Tile) => void;
}

type OpenSide = 'left' | 'right' | null;

const ACTION_WIDTH = 144;

const hasValue = (value: unknown): boolean => {
  if (value === undefined || value === null) return false;
  return String(value).trim() !== '';
};

const normalizeSize = (value?: string): string => {
  if (!value) return '';

  return value
    .replace(/\*/g, '×')
    .replace(/\s*x\s*/gi, '×')
    .trim();
};

const cleanLabel = (value?: string): string => {
  if (!value) return '';

  return value
    .replace(/\s*\([^)]*\)\s*/g, '')
    .trim();
};

const formatSnapshotValue = (
  value: string | number,
  suffix?: string,
) => {
  const text = String(value).trim();

  if (!suffix || text.endsWith(suffix)) {
    return text;
  }

  return `${text} ${suffix}`;
};

interface ActionRailProps {
  item: Tile;
  side: 'left' | 'right';
  onReserve: (item: Tile) => void;
  onEdit: (item: Tile) => void;
  onDelete: (id: string) => void;
  onDone: () => void;
}

const ActionRail: React.FC<ActionRailProps> = ({
  item,
  side,
  onReserve,
  onEdit,
  onDelete,
  onDone,
}) => {
  const run = (action: () => void) => {
    onDone();
    window.setTimeout(action, 70);
  };

  return (
    <div
      className={`
        absolute inset-y-0 z-0 flex w-[144px] overflow-hidden
        ${side === 'right' ? 'right-0' : 'left-0'}
      `}
    >
      <button
        type="button"
        onClick={() => run(() => onReserve(item))}
        className="
          flex w-12 flex-col items-center justify-center gap-1
          bg-emerald-600 text-[8px] font-bold text-white
          transition active:bg-emerald-700
        "
        aria-label={`حجز ${item.name}`}
      >
        <CalendarPlus className="h-4 w-4" />
        حجز
      </button>

      <button
        type="button"
        onClick={() => run(() => onEdit(item))}
        className="
          flex w-12 flex-col items-center justify-center gap-1
          bg-slate-700 text-[8px] font-bold text-white
          transition active:bg-slate-800
          dark:bg-slate-600 dark:active:bg-slate-700
        "
        aria-label={`تعديل ${item.name}`}
      >
        <Pencil className="h-4 w-4" />
        تعديل
      </button>

      <button
        type="button"
        onClick={() => run(() => onDelete(item.id))}
        className="
          flex w-12 flex-col items-center justify-center gap-1
          bg-rose-600 text-[8px] font-bold text-white
          transition active:bg-rose-700
        "
        aria-label={`حذف ${item.name}`}
      >
        <Trash2 className="h-4 w-4" />
        حذف
      </button>
    </div>
  );
};

const InventoryItemRowComponent: React.FC<InventoryItemRowProps> = ({
  item,
  category,
  onEdit,
  onDelete,
  onOpenReservation,
  onViewImage,
  onClick,
}) => {
  const reduceMotion = useReducedMotion();
  const [openSide, setOpenSide] = useState<OpenSide>(null);

  const availableQty = calculateAvailableQuantity(item);
  const totalReserved = calculateReservedQuantity(item);

  const isPieceUnit =
    item.unitType === 'pieces' ||
    category?.defaultUnit === 'pieces';

  const isSystemCategory =
    item.categoryId === 'tiles' ||
    item.categoryId === 'ceramics';

  const showImage = category?.fieldsConfig?.hasImage !== false;

  const availableBoxes =
    !isPieceUnit &&
    Number(item.meters) > 0 &&
    Number(item.boxes) > 0
      ? (availableQty / Number(item.meters)) * Number(item.boxes)
      : 0;

  const availablePallets =
    !isPieceUnit &&
    Number(item.meters) > 0 &&
    Number(item.pallets) > 0
      ? (availableQty / Number(item.meters)) * Number(item.pallets)
      : 0;

  const snapshotDetails = useMemo(() => {
    if (!Array.isArray(item.customFieldSnapshot)) {
      return [];
    }

    return item.customFieldSnapshot
      .filter(field => hasValue(field.value))
      .map(field => formatSnapshotValue(field.value, field.suffix));
  }, [item.customFieldSnapshot]);

  const systemDetails = useMemo(() => {
    if (!isSystemCategory) return [];

    return [
      hasValue(item.size) ? normalizeSize(item.size) : null,
      hasValue(item.shade) ? `شيد ${item.shade}` : null,
      hasValue(item.brand) ? item.brand : null,
      hasValue(item.color) ? item.color : null,
      hasValue(item.itemType) ? item.itemType : null,
      hasValue(item.materialOrGlass) ? item.materialOrGlass : null,
    ].filter(Boolean) as string[];
  }, [
    isSystemCategory,
    item.size,
    item.shade,
    item.brand,
    item.color,
    item.itemType,
    item.materialOrGlass,
  ]);

  const qualitySurface = [
    hasValue(item.quality) ? cleanLabel(item.quality) : null,
    hasValue(item.surface) ? cleanLabel(item.surface) : null,
  ]
    .filter(Boolean)
    .join(' • ');

  const detailLine = isSystemCategory
    ? [...systemDetails, ...snapshotDetails].join(' • ')
    : snapshotDetails.length > 0
      ? snapshotDetails.join(' • ')
      : [
          item.itemType,
          item.color,
          item.brand,
          item.materialOrGlass,
          hasValue(item.size) ? normalizeSize(item.size) : null,
        ]
          .filter(hasValue)
          .join(' • ');

  const secondaryStock = isPieceUnit
    ? ''
    : [
        availableBoxes > 0
          ? `${availableBoxes.toFixed(1)} كرتون`
          : null,
        availablePallets > 0
          ? `${availablePallets.toFixed(1)} طبلية`
          : null,
      ]
        .filter(Boolean)
        .join(' • ');

  const isReserved = totalReserved > 0;
  const targetX =
    openSide === 'left'
      ? -ACTION_WIDTH
      : openSide === 'right'
        ? ACTION_WIDTH
        : 0;

  const closeActions = () => setOpenSide(null);

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: {
      offset: { x: number };
      velocity: { x: number };
    },
  ) => {
    const { x } = info.offset;
    const velocity = info.velocity.x;

    if (x <= -38 || velocity <= -360) {
      setOpenSide('left');
      return;
    }

    if (x >= 38 || velocity >= 360) {
      setOpenSide('right');
      return;
    }

    setOpenSide(null);
  };

  const handleContentClick = () => {
    if (openSide) {
      closeActions();
      return;
    }

    onClick?.(item);
  };

  const quantityLabel = isPieceUnit
    ? availableQty.toLocaleString('en-US', {
        maximumFractionDigits: 0,
      })
    : availableQty.toLocaleString('en-US', {
        maximumFractionDigits: 2,
      });

  return (
    <article
      className="relative overflow-hidden bg-slate-100 dark:bg-neutral-800"
      dir="rtl"
    >
      <ActionRail
        item={item}
        side="right"
        onReserve={onOpenReservation}
        onEdit={onEdit}
        onDelete={onDelete}
        onDone={closeActions}
      />

      <ActionRail
        item={item}
        side="left"
        onReserve={onOpenReservation}
        onEdit={onEdit}
        onDelete={onDelete}
        onDone={closeActions}
      />

      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{
          left: -ACTION_WIDTH,
          right: ACTION_WIDTH,
        }}
        dragElastic={0.04}
        onDragEnd={handleDragEnd}
        animate={{ x: targetX }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                type: 'spring',
                stiffness: 460,
                damping: 42,
                mass: 0.72,
              }
        }
        onClick={handleContentClick}
        className="
          relative z-10 flex min-h-[72px] items-center gap-2.5
          bg-white px-2.5 py-2 dark:bg-neutral-900
        "
      >
        {showImage && (
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();

              if (openSide) {
                closeActions();
                return;
              }

              if (item.image && item.image !== 'none') {
                onViewImage?.(item.image);
              }
            }}
            className="
              flex h-[46px] w-[46px] shrink-0 items-center justify-center
              overflow-hidden rounded-[11px] border border-slate-200/70
              bg-slate-50 text-slate-300 shadow-sm
              dark:border-white/[0.07] dark:bg-neutral-800 dark:text-slate-500
            "
            aria-label={
              item.image
                ? `عرض صورة ${item.name}`
                : 'لا توجد صورة'
            }
          >
            {item.image && item.image !== 'none' ? (
              <img
                src={item.image}
                alt={item.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
          </button>
        )}

        <div className="min-w-0 flex-1 text-right">
          <h3 className="break-words text-[12px] font-extrabold leading-[16px] text-slate-950 dark:text-white sm:text-[13px]">
            {item.name}
          </h3>

          {qualitySurface && (
            <p className="mt-0.5 break-words text-[9px] font-semibold leading-[13px] text-slate-600 dark:text-slate-300">
              {qualitySurface}
            </p>
          )}

          {detailLine && (
            <p
              className="mt-0.5 break-words text-[8px] font-medium leading-[12px] text-slate-400 dark:text-slate-500"
              title={detailLine}
            >
              {detailLine}
            </p>
          )}

          <p className="mt-0.5 text-[7px] font-medium leading-[11px] text-slate-400 dark:text-slate-500">
            آخر تحديث: {formatAuditDate(item.updatedAt)}
          </p>
        </div>

        <div className="min-w-[82px] shrink-0 text-left">
          <div className="flex items-center justify-end gap-1.5">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                isReserved ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              aria-label={isReserved ? 'محجوز' : 'متاح'}
            />

            <strong
              className={`text-[13px] font-black tabular-nums ${
                availableQty <= 2
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-950 dark:text-white'
              }`}
            >
              {quantityLabel}
            </strong>

            <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-500">
              {isPieceUnit ? 'قطعة' : 'م²'}
            </span>
          </div>

          {secondaryStock && (
            <p className="mt-0.5 text-[7px] font-medium leading-[11px] text-slate-400 dark:text-slate-500">
              {secondaryStock}
            </p>
          )}

          {isReserved && (
            <p className="mt-0.5 text-[7px] font-bold leading-[11px] text-rose-500 dark:text-rose-400">
              محجوز{' '}
              {totalReserved.toLocaleString('en-US', {
                maximumFractionDigits: 2,
              })}{' '}
              {isPieceUnit ? 'قطعة' : 'م²'}
            </p>
          )}
        </div>
      </motion.div>
    </article>
  );
};

export const InventoryItemRow = React.memo(InventoryItemRowComponent);
