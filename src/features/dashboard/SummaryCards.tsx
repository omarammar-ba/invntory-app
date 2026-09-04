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
  iconColor,
  valueColor = "text-slate-900 dark:text-white",
  delay = 0
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.35,
        ease: [0.16, 1, 0.3, 1],
        delay 
      }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.99 }}
      className="p-4 sm:p-5 rounded-[18px] shadow-xs bg-white dark:bg-neutral-900 border border-slate-200/60 dark:border-white/[0.07] relative overflow-hidden group cursor-default transition-colors hover:shadow-sm"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] sm:text-[15px] font-semibold text-slate-700 dark:text-slate-200 leading-[1.45]">{title}</h3>
        <div className={`w-[38px] h-[38px] rounded-[13px] flex items-center justify-center ${iconColor} bg-slate-50/80 dark:bg-neutral-800/80 border border-slate-200/50 dark:border-white/[0.05] transition-transform group-hover:scale-105`}>
          {icon}
        </div>
      </div>
      <div className="relative z-10 text-right">
        <p className={`text-[26px] sm:text-[29px] font-bold leading-none tabular-nums ${valueColor}`}>{value}</p>
        <span className="text-[13px] font-normal mt-1.5 text-slate-500 dark:text-slate-400 block leading-[1.5]">{subValue}</span>
      </div>
    </motion.div>
  );
};

const SummaryCards: React.FC<{ tiles: Tile[]; activeCategoryId?: string; themeColor?: string }> = ({ 
  tiles, 
  activeCategoryId = 'tiles'
}) => {
  const isPieceCategory = activeCategoryId === 'shower_box' || activeCategoryId === 'mixers' || activeCategoryId === 'sanitary' || tiles.some(t => t.unitType === 'pieces');

  const totals = useMemo(() => {
    let totalBoxes = 0;
    let totalQty = 0;
    let totalPallets = 0;
    let totalReserved = 0;

    tiles.forEach(tile => {
      totalBoxes += Number(tile.boxes) || 0;
      totalQty += Number(tile.meters) || 0;
      totalPallets += Number(tile.pallets) || 0;
      const resSum = tile.reservations?.reduce((sum, r) => sum + (Number(r.meters) || 0), 0) || 0;
      totalReserved += resSum;
    });

    return {
      typesCount: tiles.length,
      boxesCount: totalBoxes,
      qtyCount: totalQty,
      palletsCount: totalPallets,
      reservedCount: totalReserved,
      availableCount: totalQty - totalReserved
    };
  }, [tiles]);

  if (isPieceCategory) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4 mb-2 no-print" dir="rtl">
        <SummaryCard 
          title="إجمالي الأصناف" 
          value={totals.typesCount} 
          subValue="موديل مسجل في القسم"
          icon={<Boxes className="w-5 h-5" />}
          iconBg="bg-slate-500/10"
          iconColor="text-slate-700 dark:text-slate-300"
          valueColor="text-slate-900 dark:text-white"
          delay={0}
        />
        <SummaryCard 
          title="إجمالي الكمية" 
          value={`${totals.qtyCount}`} 
          subValue="قطعة / طقم بالمستودع"
          icon={<PackageOpen className="w-5 h-5" />}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
          valueColor="text-emerald-600 dark:text-emerald-400"
          delay={0.04}
        />
        <SummaryCard 
          title="المحجوز للزبائن" 
          value={`${totals.reservedCount}`} 
          subValue="قطعة محجوزة حالياً"
          icon={<CalendarCheck2 className="w-5 h-5" />}
          iconBg="bg-rose-500/10"
          iconColor="text-[#F43F62]"
          valueColor="text-[#F43F62]"
          delay={0.08}
        />
        <SummaryCard 
          title="المتوفر للبيع" 
          value={`${totals.availableCount}`} 
          subValue="قطعة جاهزة للطلب"
          icon={<Box className="w-5 h-5" />}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-500"
          valueColor="text-purple-600 dark:text-purple-400"
          delay={0.12}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4 mb-2 no-print" dir="rtl">
      <SummaryCard 
        title="إجمالي أنواع البلاط" 
        value={totals.typesCount} 
        subValue="أصناف مسجلة"
        icon={<Boxes className="w-5 h-5" />}
        iconBg="bg-slate-500/10"
        iconColor="text-slate-700 dark:text-slate-300"
        valueColor="text-slate-900 dark:text-white"
        delay={0}
      />
      <SummaryCard 
        title="إجمالي الصناديق" 
        value={totals.boxesCount.toFixed(0)} 
        subValue="كرتونة داخل المستودع"
        icon={<PackageOpen className="w-5 h-5" />}
        iconBg="bg-amber-500/10"
        iconColor="text-amber-500"
        valueColor="text-amber-600 dark:text-amber-400"
        delay={0.04}
      />
      <SummaryCard 
        title="إجمالي الأمتار" 
        value={totals.qtyCount.toFixed(1)} 
        subValue="متر (م²) إجمالي"
        icon={<Ruler className="w-5 h-5" />}
        iconBg="bg-emerald-500/10"
        iconColor="text-emerald-500"
        valueColor="text-emerald-600 dark:text-emerald-400"
        delay={0.08}
      />
      <SummaryCard 
        title="إجمالي الطبليات" 
        value={totals.palletsCount.toFixed(1)} 
        subValue="طبلية موزعة"
        icon={<Layers3 className="w-5 h-5" />}
        iconBg="bg-purple-500/10"
        iconColor="text-purple-500"
        valueColor="text-purple-600 dark:text-purple-400"
        delay={0.12}
      />
    </div>
  );
};

export default React.memo(SummaryCards);
