import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Tile } from '@/types';
import { Box, Boxes, CalendarCheck2, Layers3, PackageOpen, Ruler } from '@/components/ui/AppIcons';

interface SummaryCardProps {
  title: string;
  value: string | number;
  subValue: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
  delay?: number;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  subValue,
  icon,
  iconBg,
  iconColor,
  valueColor = 'text-slate-900 dark:text-white',
  delay = 0,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.28,
        ease: [0.16, 1, 0.3, 1],
        delay,
      }}
      whileTap={{ scale: 0.99 }}
      className="relative overflow-hidden rounded-[16px] border border-slate-200/60 bg-white p-3 shadow-sm dark:border-white/[0.07] dark:bg-neutral-900 sm:p-3.5"
    >
      <div className="flex items-center justify-between gap-2.5">
        <h3 className="min-w-0 text-[11px] font-bold leading-[1.35] text-slate-700 dark:text-slate-200 sm:text-xs">
          {title}
        </h3>

        <div
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-[11px] border border-slate-200/50 dark:border-white/[0.05] ${iconBg} ${iconColor}`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-2 text-right">
        <p className={`text-[24px] font-black leading-none tabular-nums sm:text-[26px] ${valueColor}`}>
          {value}
        </p>
        <span className="mt-1.5 block text-[10px] font-medium leading-[1.45] text-slate-400 dark:text-slate-500 sm:text-[11px]">
          {subValue}
        </span>
      </div>
    </motion.div>
  );
};

const SummaryCards: React.FC<{
  tiles: Tile[];
  activeCategoryId?: string;
  themeColor?: string;
}> = ({
  tiles,
  activeCategoryId = 'tiles',
}) => {
  const isPieceCategory =
    activeCategoryId === 'shower_box' ||
    activeCategoryId === 'mixers' ||
    activeCategoryId === 'sanitary' ||
    tiles.some(tile => tile.unitType === 'pieces');

  const totals = useMemo(() => {
    let totalBoxes = 0;
    let totalQty = 0;
    let totalPallets = 0;
    let totalReserved = 0;

    tiles.forEach(tile => {
      totalBoxes += Number(tile.boxes) || 0;
      totalQty += Number(tile.meters) || 0;
      totalPallets += Number(tile.pallets) || 0;
      totalReserved +=
        tile.reservations?.reduce(
          (sum, reservation) => sum + (Number(reservation.meters) || 0),
          0,
        ) || 0;
    });

    return {
      typesCount: tiles.length,
      boxesCount: totalBoxes,
      qtyCount: totalQty,
      palletsCount: totalPallets,
      reservedCount: totalReserved,
      availableCount: totalQty - totalReserved,
    };
  }, [tiles]);

  if (isPieceCategory) {
    return (
      <div className="mt-3 mb-1.5 grid grid-cols-2 gap-2.5 no-print sm:gap-3 lg:grid-cols-4" dir="rtl">
        <SummaryCard
          title="إجمالي الأصناف"
          value={totals.typesCount}
          subValue="موديل مسجل في القسم"
          icon={<Boxes className="h-4 w-4" />}
          iconBg="bg-slate-50/80 dark:bg-neutral-800/80"
          iconColor="text-slate-700 dark:text-slate-300"
          valueColor="text-slate-900 dark:text-white"
          delay={0}
        />
        <SummaryCard
          title="إجمالي الكمية"
          value={totals.qtyCount}
          subValue="قطعة / طقم بالمستودع"
          icon={<PackageOpen className="h-4 w-4" />}
          iconBg="bg-emerald-50/90 dark:bg-emerald-500/10"
          iconColor="text-emerald-500"
          valueColor="text-emerald-600 dark:text-emerald-400"
          delay={0.03}
        />
        <SummaryCard
          title="المحجوز للزبائن"
          value={totals.reservedCount}
          subValue="قطعة محجوزة حالياً"
          icon={<CalendarCheck2 className="h-4 w-4" />}
          iconBg="bg-rose-50/90 dark:bg-rose-500/10"
          iconColor="text-rose-500"
          valueColor="text-rose-500"
          delay={0.06}
        />
        <SummaryCard
          title="المتوفر للبيع"
          value={totals.availableCount}
          subValue="قطعة جاهزة للطلب"
          icon={<Box className="h-4 w-4" />}
          iconBg="bg-purple-50/90 dark:bg-purple-500/10"
          iconColor="text-purple-500"
          valueColor="text-purple-600 dark:text-purple-400"
          delay={0.09}
        />
      </div>
    );
  }

  return (
    <div className="mt-3 mb-1.5 grid grid-cols-2 gap-2.5 no-print sm:gap-3 lg:grid-cols-4" dir="rtl">
      <SummaryCard
        title="إجمالي أنواع البلاط"
        value={totals.typesCount}
        subValue="أصناف مسجلة"
        icon={<Boxes className="h-4 w-4" />}
        iconBg="bg-slate-50/80 dark:bg-neutral-800/80"
        iconColor="text-slate-700 dark:text-slate-300"
        valueColor="text-slate-900 dark:text-white"
        delay={0}
      />
      <SummaryCard
        title="إجمالي الصناديق"
        value={totals.boxesCount.toFixed(0)}
        subValue="كرتونة داخل المستودع"
        icon={<PackageOpen className="h-4 w-4" />}
        iconBg="bg-amber-50/90 dark:bg-amber-500/10"
        iconColor="text-amber-500"
        valueColor="text-amber-600 dark:text-amber-400"
        delay={0.03}
      />
      <SummaryCard
        title="إجمالي الأمتار"
        value={totals.qtyCount.toFixed(1)}
        subValue="متر (م²) إجمالي"
        icon={<Ruler className="h-4 w-4" />}
        iconBg="bg-emerald-50/90 dark:bg-emerald-500/10"
        iconColor="text-emerald-500"
        valueColor="text-emerald-600 dark:text-emerald-400"
        delay={0.06}
      />
      <SummaryCard
        title="إجمالي الطبليات"
        value={totals.palletsCount.toFixed(1)}
        subValue="طبلية موزعة"
        icon={<Layers3 className="h-4 w-4" />}
        iconBg="bg-purple-50/90 dark:bg-purple-500/10"
        iconColor="text-purple-500"
        valueColor="text-purple-600 dark:text-purple-400"
        delay={0.09}
      />
    </div>
  );
};

export default React.memo(SummaryCards);
