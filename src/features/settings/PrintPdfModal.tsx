import { MotionModal } from '@/components/motion/MotionModal';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Tile, Category, StaffMember } from '@/types';
import { PrintIcon, CancelIcon } from '@/components/ui/Icons';

interface PrintPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  activeCategoryId: string;
  allItems: Tile[];
  currentStaff?: StaffMember | null;
}

const PrintPdfModal: React.FC<PrintPdfModalProps> = ({
  isOpen,
  onClose,
  categories,
  activeCategoryId,
  allItems,
  currentStaff
}) => {
  const [selectedCategoryScope, setSelectedCategoryScope] = useState<string>(activeCategoryId || 'all');
  const [stockFilter, setStockFilter] = useState<'all' | 'available' | 'reserved'>('all');
  const [reportType, setReportType] = useState<'detailed' | 'summary' | 'reservations'>('detailed');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isPreparingReport, setIsPreparingReport] = useState<boolean>(true);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setIsPreparingReport(true);

    const firstFrame = window.requestAnimationFrame(() => {
      const secondFrame = window.requestAnimationFrame(() => {
        window.setTimeout(() => {
          if (!cancelled) setIsPreparingReport(false);
        }, 40);
      });

      if (cancelled) window.cancelAnimationFrame(secondFrame);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(firstFrame);
    };
  }, []);

  const waitForPaint = async () => {
    await new Promise<void>(resolve =>
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => resolve())
      )
    );
  };

  // Filter items according to choices
  const filteredData = useMemo(() => {
    let list = [...allItems];

    if (selectedCategoryScope !== 'all') {
      list = list.filter(t => (t.categoryId || 'tiles') === selectedCategoryScope);
    }

    if (stockFilter === 'available') {
      list = list.filter(t => {
        const reserved = t.reservations?.reduce((sum, r) => sum + r.meters, 0) || 0;
        return (t.meters - reserved) > 0;
      });
    } else if (stockFilter === 'reserved') {
      list = list.filter(t => {
        const reserved = t.reservations?.reduce((sum, r) => sum + r.meters, 0) || 0;
        return reserved > 0;
      });
    }

    return list;
  }, [allItems, selectedCategoryScope, stockFilter]);

  // Group items by category for nicely segmented report
  const groupedByCategory = useMemo(() => {
    const map = new Map<string, { category: Category; items: Tile[] }>();

    categories.forEach(cat => {
      map.set(cat.id, { category: cat, items: [] });
    });

    filteredData.forEach(item => {
      const catId = item.categoryId || 'tiles';
      if (!map.has(catId)) {
        const fallbackCat = categories.find(c => c.id === catId) || {
          id: catId,
          name: catId === 'tiles' ? 'بورسلان' : catId === 'ceramics' ? 'سيراميك' : 'قسم إضافي',
          iconName: 'folder',
          themeColor: 'sky',
          defaultUnit: 'meters'
        };
        map.set(catId, { category: fallbackCat, items: [] });
      }
      map.get(catId)!.items.push(item);
    });

    // Only return groups that have items or if single category selected
    return Array.from(map.values()).filter(g => g.items.length > 0);
  }, [categories, filteredData]);

  // Totals calculations
  const totals = useMemo(() => {
    let totalMeters = 0;
    let totalPieces = 0;
    let totalReservedMeters = 0;
    let totalReservedPieces = 0;
    let totalItemsCount = filteredData.length;

    filteredData.forEach(item => {
      const isPiece = item.unitType === 'pieces' || item.categoryId === 'shower_box' || item.categoryId === 'mixers' || item.categoryId === 'sanitary';
      const reserved = item.reservations?.reduce((sum, r) => sum + r.meters, 0) || 0;
      
      if (isPiece) {
        totalPieces += item.meters || 0;
        totalReservedPieces += reserved;
      } else {
        totalMeters += item.meters || 0;
        totalReservedMeters += reserved;
      }
    });

    return {
      totalMeters: totalMeters.toFixed(1),
      totalPieces,
      totalReservedMeters: totalReservedMeters.toFixed(1),
      totalReservedPieces,
      totalItemsCount
    };
  }, [filteredData]);

  const handleNativePrint = async () => {
    if (isPreparingReport || isPrinting) return;

    setIsPrinting(true);
    await waitForPaint();

    const root = document.documentElement;
    const cleanup = () => {
      root.classList.remove('printing-official-report');
      window.removeEventListener('afterprint', cleanup);
      setIsPrinting(false);
    };

    root.classList.add('printing-official-report');
    window.addEventListener('afterprint', cleanup, { once: true });

    try {
      window.print();
    } finally {
      // Browsers that do not fire afterprint still get cleaned up.
      window.setTimeout(cleanup, 1500);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      await waitForPaint();
      // Dynamically load html2pdf if needed
      const element = document.getElementById('official-pdf-report-content');
      if (!element) return;

      const html2pdfModule = (await import('html2pdf.js')).default;
      const opt = {
        margin: [10, 10, 12, 10] as [number, number, number, number],
        filename: `Inventory_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg' as 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as 'portrait' }
      };

      await html2pdfModule().set(opt).from(element).save();
    } catch (err) {
      console.error("PDF generation error, fallback to browser print:", err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!isOpen) return null;

  const currentCategoryName = selectedCategoryScope === 'all' 
    ? 'كافة أقسام المعرض' 
    : categories.find(c => c.id === selectedCategoryScope)?.name || 'القسم المحدد';



  return (
    <MotionModal
      showHandle={false}
      className="bg-white dark:bg-neutral-900 rounded-[22px] shadow-2xl border border-slate-200/60 dark:border-white/[0.07] overflow-hidden flex flex-col max-h-[96dvh] min-w-0 print:max-h-none print:h-auto print:border-none print:shadow-none print:rounded-none print:bg-white"
      backdropClassName="fixed inset-0 z-[420] overflow-hidden bg-black/75 backdrop-blur-sm flex justify-center items-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:overflow-visible"
    >
      <div
        className="flex min-h-0 w-full flex-1 flex-col overflow-hidden"
        style={{ width: 'min(1180px, calc(100vw - 16px))', maxWidth: '1180px' }}
      >
      
      {/* Container Dialog */}
        
        {/* Modal Controls Header (Hidden in Print) */}
        <div className="p-4 sm:p-5 bg-white dark:bg-neutral-900 border-b border-slate-100 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-slate-900 dark:bg-neutral-800 text-white flex items-center justify-center shadow-2xs">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">نظام تصدير وطباعة تقارير PDF</h2>
              <p className="text-[11px] text-slate-400 font-normal mt-0.5">كشف مخزون مقسم وااحترافي معد للطباعة والمشاركة</p>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf || isPreparingReport || isPrinting}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-[0.97] text-white rounded-[12px] font-semibold text-xs shadow-2xs transition-all flex items-center gap-2 cursor-pointer"
            >
              {isGeneratingPdf ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white dark:border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                  <span>جاري التصدير...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>تحميل كملف PDF</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleNativePrint}
              disabled={isPreparingReport || isPrinting || isGeneratingPdf}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-800 dark:bg-neutral-800 hover:bg-slate-700 dark:hover:bg-neutral-700 active:scale-[0.97] text-white rounded-[12px] font-semibold text-xs shadow-2xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <PrintIcon />
              <span>{isPrinting ? 'جاري تجهيز الطباعة...' : 'طباعة فورية'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-[12px] hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer active:scale-[0.97]"
              aria-label="إغلاق"
            >
              <CancelIcon />
            </button>
          </div>
        </div>

        {/* Options Toolbar (Hidden in Print) */}
        <div className="p-3.5 bg-slate-50/70 dark:bg-neutral-800 border-b border-slate-200/60 dark:border-white/[0.05] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-semibold no-print">
          
          {/* Category Scope Selection */}
          <div className="flex flex-col gap-1">
            <label className="text-slate-600 dark:text-slate-400 text-[11px] font-semibold">نطاق التقرير:</label>
            <select
              value={selectedCategoryScope}
              onChange={(e) => setSelectedCategoryScope(e.target.value)}
              className="p-2 rounded-[12px] bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-white/[0.08] text-slate-800 dark:text-white shadow-2xs focus:border-slate-400 dark:focus:border-slate-500 text-xs font-semibold outline-none"
            >
              <option value="all">كافة أقسام المعرض (تقرير شامل)</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>قسم: {cat.name}</option>
              ))}
            </select>
          </div>

          {/* Stock Filter Selection */}
          <div className="flex flex-col gap-1">
            <label className="text-slate-600 dark:text-slate-400 text-[11px] font-semibold">حالة المخزون:</label>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="p-2 rounded-[12px] bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-white/[0.08] text-slate-800 dark:text-white shadow-2xs focus:border-slate-400 dark:focus:border-slate-500 text-xs font-semibold outline-none"
            >
              <option value="all">كافة الأصناف (متوفر + محجوز)</option>
              <option value="available">الأصناف المتوفرة للبيع فقط</option>
              <option value="reserved">الأصناف المحجوزة فقط</option>
            </select>
          </div>

          {/* Report Type */}
          <div className="flex flex-col gap-1">
            <label className="text-slate-600 dark:text-slate-400 text-[11px] font-semibold">نوع التقرير:</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="p-2 rounded-[12px] bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-white/[0.08] text-slate-800 dark:text-white shadow-2xs focus:border-slate-400 dark:focus:border-slate-500 text-xs font-semibold outline-none"
            >
              <option value="detailed">كشف جرد تفصيلي (بالمواصفات والقياسات)</option>
              <option value="summary">كشف جرد سريع (ملخص الكميات)</option>
            </select>
          </div>
        </div>

        {/* Scrollable Document Preview Area & Real Printable Section */}
        <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-6 lg:p-8 bg-slate-100/60 dark:bg-neutral-950 custom-scrollbar print:p-0 print:bg-white print:overflow-visible">
          
          {isPreparingReport ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[16px] border border-slate-200/70 bg-white px-6 text-center shadow-sm dark:border-white/[0.07] dark:bg-neutral-900">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700 dark:border-neutral-700 dark:border-t-slate-200" />
              <p className="mt-4 text-sm font-bold text-slate-700 dark:text-slate-200">جاري تجهيز كشف المخزون...</p>
            </div>
          ) : (
          <>
          {/* The Page Container - Matches exact A4 dimensions */}
          <div 
            id="official-pdf-report-content"
            ref={printAreaRef}
            className="bg-white text-slate-900 w-full max-w-4xl mx-auto p-5 sm:p-8 lg:p-10 rounded-[16px] shadow-sm print:shadow-none print:border-none print:p-0 print:max-w-none print:w-full print:rounded-none"
            style={{ minHeight: '297mm', fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >

            {/* Header: Clean, Minimalist & Professional Letterhead */}
            <div className="border-b-2 border-slate-800 pb-3 mb-6 flex items-end justify-between">
              {/* Right: Section Name */}
              <div>
                <span className="text-xs uppercase tracking-widest text-slate-500 font-bold block mb-1">كشف حركة ومخزون</span>
                <h1 className="text-xl font-black text-slate-900 tracking-tight m-0">{currentCategoryName}</h1>
              </div>

              {/* Left: Minimal Clean Metadata (Day, Date, Staff - NO TIME, NO BOXES) */}
              <div className="text-left text-xs text-slate-700 font-medium leading-tight space-y-1">
                <div><span className="text-slate-400 font-normal">اليوم:</span> <strong className="text-slate-900">{new Date().toLocaleDateString('ar-EG', { weekday: 'long' })}</strong></div>
                <div><span className="text-slate-400 font-normal">التاريخ:</span> <strong className="text-slate-900">{new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></div>
                <div><span className="text-slate-400 font-normal">المسؤول:</span> <strong className="text-slate-900">{currentStaff?.name || 'الموظف'}</strong></div>
              </div>
            </div>

            {/* Overview Metric Row - Clean Minimal Border Top/Bottom without boxes */}
            <div className="flex items-center justify-around py-3 mb-6 border-y border-slate-200 text-slate-900">
              <div className="text-center px-4 border-l border-slate-200 last:border-l-0">
                <span className="block text-[11px] text-slate-500 font-medium">إجمالي الأصناف</span>
                <span className="text-sm font-black text-slate-900">{totals.totalItemsCount} صنف</span>
              </div>
              <div className="text-center px-4 border-l border-slate-200 last:border-l-0">
                <span className="block text-[11px] text-slate-500 font-medium">إجمالي البلاط المتوفر</span>
                <span className="text-sm font-black text-slate-900">{totals.totalMeters} م²</span>
              </div>
              <div className="text-center px-4">
                <span className="block text-[11px] text-slate-500 font-medium">إجمالي القطع والتجهيزات</span>
                <span className="text-sm font-black text-slate-900">{totals.totalPieces} قطعة</span>
              </div>
            </div>

            {/* Segmented Category Sections */}
            {groupedByCategory.length === 0 ? (
              <div className="py-12 text-center text-slate-600 font-bold text-sm border border-dashed border-slate-400 rounded">
                لا توجد أصناف تطابق شروط الفلترة المحددة.
              </div>
            ) : (
              groupedByCategory.map(({ category, items }, catIdx) => {
                const isPiece = category.defaultUnit === 'pieces' || category.id === 'shower_box' || category.id === 'mixers' || category.id === 'sanitary';
                const catTotalQty = items.reduce((sum, i) => sum + (i.meters || 0), 0);

                return (
                  <div key={category.id} className="mb-8 break-inside-avoid">
                    
                    {/* Category Divider Header */}
                    <div className="flex items-center justify-between border-2 border-slate-900 bg-white text-slate-900 px-3.5 py-2 rounded-t font-bold text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black">{category.name}</span>
                        <span className="text-slate-600 text-[11px]">({items.length} صنف مسجل)</span>
                      </div>
                      <div className="text-[11px] font-bold text-slate-900">
                        <span>إجمالي الكمية: </span>
                        <span className="font-black">{isPiece ? catTotalQty : catTotalQty.toFixed(1)} {isPiece ? 'قطعة' : 'م²'}</span>
                      </div>
                    </div>

                    {/* Table for this Category */}
                    <div className="border-x border-b border-slate-900 rounded-b overflow-hidden">
                      <table className="w-full text-right text-xs border-collapse">
                        <thead>
                          {reportType === 'summary' ? (
                            <tr className="bg-slate-100 border-b border-slate-900 text-slate-900 font-black">
                              <th className="py-2 px-2.5 w-10 text-center border-l border-slate-900">#</th>
                              <th className="py-2 px-2.5 border-l border-slate-900">اسم الصنف والموديل</th>
                              <th className="py-2 px-2.5 text-center font-black">الكمية المتوفرة</th>
                            </tr>
                          ) : (
                            <tr className="bg-slate-100 border-b border-slate-900 text-slate-900 font-black">
                              <th className="py-2 px-2.5 w-10 text-center border-l border-slate-900">#</th>
                              <th className="py-2 px-2.5 border-l border-slate-900">اسم الصنف والموديل</th>
                              <th className="py-2 px-2.5 text-center border-l border-slate-900">النوع / المقاس</th>
                              <th className="py-2 px-2.5 text-center border-l border-slate-900">{isPiece ? 'المواصفات / اللون' : 'اللون / السطح'}</th>
                              {!isPiece && <th className="py-2 px-2.5 text-center border-l border-slate-900">الطبليات</th>}
                              <th className="py-2 px-2.5 text-center font-black">الكمية المتوفرة</th>
                            </tr>
                          )}
                        </thead>
                        <tbody className="divide-y divide-slate-400 text-slate-900 font-medium">
                          {items.map((tile, idx) => {
                            const isTilePiece = tile.unitType === 'pieces' || isPiece;

                            if (reportType === 'summary') {
                              return (
                                <tr key={tile.id} className="border-b border-slate-300">
                                  <td className="py-2 px-2.5 text-center font-bold text-slate-700 border-l border-slate-300">{idx + 1}</td>
                                  <td className="py-2 px-2.5 font-bold border-l border-slate-300">{tile.name}</td>
                                  <td className="py-2 px-2.5 text-center font-black text-slate-900">
                                    {tile.meters} {isTilePiece ? 'قطعة' : 'م²'}
                                  </td>
                                </tr>
                              );
                            }

                            return (
                              <tr key={tile.id} className="border-b border-slate-300">
                                <td className="py-2 px-2.5 text-center font-bold text-slate-700 border-l border-slate-300">{idx + 1}</td>
                                <td className="py-2 px-2.5 font-bold border-l border-slate-300">
                                  <div>{tile.name}</div>
                                  {tile.brand && <span className="text-[10px] text-slate-600 font-normal">{tile.brand}</span>}
                                </td>
                                <td className="py-2 px-2.5 text-center border-l border-slate-300">
                                  {tile.size || tile.itemType || '-'}
                                </td>
                                <td className="py-2 px-2.5 text-center border-l border-slate-300">
                                  {[tile.color, tile.surface, tile.materialOrGlass, tile.quality].filter(Boolean).join(' • ') || '-'}
                                </td>
                                {!isPiece && (
                                  <td className="py-2 px-2.5 text-center text-slate-700 border-l border-slate-300">
                                    {tile.pallets ? `${tile.pallets} ط` : '-'}
                                  </td>
                                )}
                                <td className="py-2 px-2.5 text-center font-black text-slate-900">
                                  <span>
                                    {tile.meters} {isTilePiece ? 'قطعة' : 'م²'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                  </div>
                );
              })
            )}

          </div>
          </>
          )}

        </div>
      </div>

      </MotionModal>
  );
};

export default React.memo(PrintPdfModal);
