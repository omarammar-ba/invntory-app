import React, { useRef, useState } from 'react';

import { MotionModal } from '@/components/motion/MotionModal';
import { ResponsiveOverlay } from '@/components/ui/ResponsiveOverlay';
import {
  AlertCircleIcon,
  CancelIcon,
  CheckCircleIcon,
  DatabaseIcon,
  DownloadIcon,
  UploadIcon,
} from '@/components/ui/Icons';
import { StaffRole, Tile } from '@/types';
import {
  backupService,
  InventoryBackupData,
} from './backup.service';

interface BackupModalProps {
  isOpen?: boolean;
  isPage?: boolean;
  onClose: () => void;
  userRole?: StaffRole;
  userName?: string;
  onDataRestored: () => void;
  exportData: () => any;
}

const getItemsForCategory = (
  backup: InventoryBackupData,
  categoryId: string,
): Tile[] => {
  if (categoryId === 'tiles') return backup.tiles || [];
  if (categoryId === 'ceramics') return backup.ceramics || [];
  return (backup.inventory || []).filter(item => item.categoryId === categoryId);
};

const buildPreviewSections = (backup: InventoryBackupData) => {
  const sections = backup.categories.map(category => ({
    id: category.id,
    name: category.name,
    items: getItemsForCategory(backup, category.id),
  }));

  const ids = new Set(sections.map(section => section.id));
  if (!ids.has('tiles') && backup.tiles.length > 0) {
    sections.unshift({ id: 'tiles', name: 'بورسلان', items: backup.tiles });
  }
  if (!ids.has('ceramics') && backup.ceramics.length > 0) {
    sections.unshift({ id: 'ceramics', name: 'سيراميك', items: backup.ceramics });
  }

  const orphanInventory = backup.inventory.filter(item => !ids.has(item.categoryId));
  if (orphanInventory.length > 0) {
    sections.push({ id: 'other', name: 'أقسام أخرى', items: orphanInventory });
  }

  return sections;
};

const BackupModal: React.FC<BackupModalProps> = ({
  isOpen = true,
  isPage = false,
  onClose,
  userRole,
  userName = 'المدير',
  onDataRestored,
  exportData,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [previewBackup, setPreviewBackup] = useState<InventoryBackupData | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');

  if (!isOpen && !isPage) return null;

  const canUseBackup = userRole === 'admin' || userRole === 'employee';

  const clearMessages = () => {
    setSuccessMessage('');
    setErrorMessage('');
  };

  const closePreview = () => {
    if (isImporting) return;
    setPreviewBackup(null);
    setPreviewFileName('');
  };

  const handleExportBackup = async () => {
    if (!canUseBackup || isExporting) return;

    try {
      setIsExporting(true);
      clearMessages();

      const backup = await backupService.downloadCategoryBackup(
        exportData(),
        userName,
      );

      setSuccessMessage(
        `تم تنزيل النسخة بنجاح (${backup.summary.totalItems} صنف، ${backup.summary.totalCategories} قسم).`,
      );
    } catch (error: any) {
      console.error('Backup export error:', error);
      setErrorMessage(error?.message || 'حدث خطأ أثناء إنشاء النسخة الاحتياطية.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    clearMessages();
    closePreview();

    if (!canUseBackup) {
      setErrorMessage('تعذر التحقق من صلاحية النسخ الاحتياطي.');
      return;
    }

    try {
      const parsed = await backupService.parseBackupFile(file);
      setPreviewBackup(parsed);
      setPreviewFileName(file.name);
    } catch (error: any) {
      console.error('Backup parse error:', error);
      setErrorMessage(error?.message || 'ملف النسخة الاحتياطية غير صالح.');
    }
  };

  const handleConfirmRestore = async () => {
    if (!previewBackup || !canUseBackup || isImporting) return;

    try {
      setIsImporting(true);
      clearMessages();

      const result = await backupService.restoreMergeOnly(previewBackup, { userRole, userName });

      if (result.added === 0 && result.categoriesMerged === 0) {
        setSuccessMessage('النسخة سليمة، لكن كل بياناتها موجودة مسبقًا ولم يتم استبدال أي شيء.');
      } else {
        const categoryPart = result.categoriesAdded > 0
          ? ` و${result.categoriesAdded} قسم جديد`
          : '';
        const mergedPart = result.categoriesMerged > 0
          ? `، وتمت استعادة إعدادات ${result.categoriesMerged} قسم أساسي فارغ`
          : '';

        setSuccessMessage(
          `تم الدمج بنجاح: أضيف ${result.itemsAdded} صنف${categoryPart}${mergedPart}.`,
        );
      }

      setPreviewBackup(null);
      setPreviewFileName('');
      if (result.added > 0 || result.categoriesMerged > 0) {
        onDataRestored();
      }
    } catch (error: any) {
      console.error('Backup restore error:', error);
      setErrorMessage(error?.message || 'حدث خطأ أثناء دمج النسخة الاحتياطية.');
    } finally {
      setIsImporting(false);
    }
  };

  const content = (
    <div className="space-y-4" dir="rtl">
      {successMessage && (
        <div className="flex items-center gap-2 rounded-[13px] border border-emerald-200/70 bg-emerald-50 px-3 py-2.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircleIcon />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-[13px] border border-rose-200/70 bg-rose-50 px-3 py-2.5 text-[11px] font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertCircleIcon />
          <span>{errorMessage}</span>
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">النسخ الاحتياطي</h2>
        <p className="mt-0.5 text-[10px] font-medium text-slate-400">
          احفظ نسخة من بياناتك أو استرجع نسخة سابقة عند الحاجة.
        </p>
      </div>

      <section className="overflow-hidden rounded-[18px] border border-slate-200/70 bg-white shadow-sm divide-y divide-slate-100 dark:border-white/[0.07] dark:bg-neutral-900 dark:divide-white/[0.05]">
        <div className="flex items-center justify-between gap-3 px-3.5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-slate-300">
              <DownloadIcon />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">تصدير نسخة</h3>
              <p className="mt-0.5 text-[9px] font-medium leading-4 text-slate-400">
                ZIP مرتب، وملف Excel مستقل لكل قسم.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportBackup}
            disabled={!canUseBackup || isExporting}
            className="h-9 shrink-0 rounded-[10px] bg-slate-900 px-3 text-[10px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            {isExporting ? 'جاري التجهيز...' : 'تحميل'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 px-3.5 py-3.5">
          <input
            type="file"
            accept=".zip,.json,application/zip,application/json"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-slate-300">
              <UploadIcon />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">استرجاع نسخة</h3>
              <p className="mt-0.5 text-[9px] font-medium leading-4 text-slate-400">
                اختر ZIP أو JSON لمراجعة محتواه قبل الدمج.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!canUseBackup || isImporting}
            className="h-9 shrink-0 rounded-[10px] border border-slate-200/70 bg-slate-50 px-3 text-[10px] font-bold text-slate-600 transition hover:bg-slate-100 active:scale-[0.98] disabled:opacity-50 dark:border-white/[0.07] dark:bg-neutral-800 dark:text-slate-300"
          >
            اختيار ملف
          </button>
        </div>
      </section>

      {!canUseBackup && (
        <div className="rounded-[13px] border border-amber-200/70 bg-amber-50 px-3 py-2.5 text-[10px] font-semibold text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          تعذر التحقق من صلاحية النسخ الاحتياطي.
        </div>
      )}
    </div>
  );

  const previewSections = previewBackup ? buildPreviewSections(previewBackup) : [];

  const previewOverlay = (
    <ResponsiveOverlay
      open={Boolean(previewBackup)}
      onClose={closePreview}
      title="مراجعة النسخة الاحتياطية"
      mobileSnap="large"
      desktopMaxWidth="max-w-lg"
      contentClassName="p-4"
    >
      {previewBackup && (
        <div className="space-y-4" dir="rtl">
          <div className="rounded-[16px] border border-slate-200/70 bg-slate-50 px-3.5 py-3 dark:border-white/[0.07] dark:bg-neutral-800/50">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-bold text-slate-500 dark:text-slate-300">
                  {previewFileName || 'نسخة احتياطية'}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-900 dark:text-white">
                  {previewBackup.summary.totalCategories} قسم • {previewBackup.summary.totalItems} صنف
                </p>
              </div>
              <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-500" />
            </div>
          </div>

          <div className="space-y-2">
            {previewSections.map(section => (
              <div
                key={section.id}
                className="rounded-[14px] border border-slate-200/70 bg-white px-3 py-2.5 dark:border-white/[0.07] dark:bg-neutral-900"
              >
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-[11px] font-bold text-slate-900 dark:text-white">
                    {section.name}
                  </strong>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500 dark:bg-neutral-800 dark:text-slate-300">
                    {section.items.length} صنف
                  </span>
                </div>

                {section.items.length > 0 && (
                  <p className="mt-1.5 line-clamp-2 text-[9px] font-medium leading-4 text-slate-400">
                    {section.items.slice(0, 4).map(item => item.name).filter(Boolean).join(' • ')}
                    {section.items.length > 4 ? ` • +${section.items.length - 4}` : ''}
                  </p>
                )}
              </div>
            ))}
          </div>

          <p className="text-center text-[9px] font-medium leading-4 text-slate-400">
            الدمج لا يحذف الأصناف الموجودة ولا يستبدلها.
          </p>

          <button
            type="button"
            onClick={handleConfirmRestore}
            disabled={isImporting}
            className="h-11 w-full rounded-[12px] bg-emerald-600 px-4 text-xs font-bold text-white transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
          >
            {isImporting ? 'جاري الدمج...' : 'دمج النسخة'}
          </button>
        </div>
      )}
    </ResponsiveOverlay>
  );

  if (isPage) {
    return (
      <>
        <div className="mt-2 animate-fade-in">{content}</div>
        {previewOverlay}
      </>
    );
  }

  return (
    <>
      {!previewBackup && (
      <MotionModal
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[22px] border border-slate-200/70 bg-slate-50 shadow-2xl dark:border-white/[0.07] dark:bg-neutral-950"
        backdropClassName="fixed inset-0 z-[290] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 bg-white px-4 py-3.5 dark:border-white/[0.06] dark:bg-neutral-900" dir="rtl">
          <div className="flex items-center gap-2.5">
            <DatabaseIcon className="h-4 w-4 text-emerald-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">النسخ الاحتياطي</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[9px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-neutral-800 dark:hover:text-slate-200"
            aria-label="إغلاق"
          >
            <CancelIcon />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{content}</div>
      </MotionModal>
      )}
      {previewOverlay}
    </>
  );
};

export default BackupModal;