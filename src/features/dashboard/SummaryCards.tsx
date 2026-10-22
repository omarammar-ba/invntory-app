import React, { useMemo } from 'react';
import type { Tile, UnitType } from '@/types';

const SummaryCards: React.FC<{ tiles: Tile[]; activeCategoryId?: string; themeColor?: string; unitType?: UnitType }> = ({ tiles, activeCategoryId = 'tiles', unitType }) => {
  const isPieceCategory = unitType === 'pieces' || activeCategoryId === 'shower_box' || activeCategoryId === 'mixers'
    || activeCategoryId === 'sanitary' || tiles.some(tile => tile.unitType === 'pieces');
  const totals = useMemo(() => {
    let totalBoxes = 0, totalQty = 0, totalPallets = 0, totalReserved = 0;
    tiles.forEach(tile => {
      totalBoxes += Number(tile.boxes) || 0;
      totalQty += Number(tile.meters) || 0;
      totalPallets += Number(tile.pallets) || 0;
      totalReserved += tile.reservations?.reduce((sum, reservation) => sum + (Number(reservation.meters) || 0), 0) || 0;
    });
    return { typesCount: tiles.length, boxesCount: totalBoxes, qtyCount: totalQty, palletsCount: totalPallets,
      reservedCount: totalReserved, availableCount: totalQty - totalReserved };
  }, [tiles]);
  const unit = isPieceCategory ? 'قطعة' : 'م²';
  const format = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return <section className="stock-totals no-print" aria-label="إجماليات المخزون"><h3>رصيد القسم</h3>
    <dl className="stock-balance"><div className="stock-available"><dt>المتاح الآن</dt><dd><bdi>{format(Math.max(0, totals.availableCount))}</bdi><span>{unit}</span></dd></div>
      <div><dt>المحجوز</dt><dd><bdi>{format(totals.reservedCount)}</bdi><span>{unit}</span></dd></div>
      <div><dt>الإجمالي</dt><dd><bdi>{format(totals.qtyCount)}</bdi><span>{unit}</span></dd></div></dl>
    <div className="stock-packing"><span><bdi>{totals.typesCount}</bdi> صنف</span>{!isPieceCategory && <><span><bdi>{format(totals.boxesCount)}</bdi> كرتون</span><span><bdi>{format(totals.palletsCount)}</bdi> طبلية</span></>}</div>
  </section>;
};
export default React.memo(SummaryCards);
