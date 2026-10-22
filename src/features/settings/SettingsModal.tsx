import React from 'react';
import { Check, ChevronLeft, DatabaseBackup, FolderCog, Moon, Sun, UserRound, UsersRound, X } from 'lucide-react';
import { MotionModal } from '@/components/motion/MotionModal';
import type { StaffRole } from '@/types';

interface SettingsModalProps {
  isOpen?: boolean;
  isPage?: boolean;
  onClose: () => void;
  userRole?: StaffRole;
  userName?: string;
  theme?: 'light' | 'dark';
  isDarkMode?: boolean;
  currentThemeMode?: 'light' | 'dark';
  onToggleTheme?: (theme?: string) => void;
  onOpenStaffManager?: () => void;
  onOpenBackupModal?: () => void;
  onOpenCategoryManager?: (catId?: string | null) => void;
  categories?: any[];
  currentStaff?: any;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen = true, isPage = false, onClose, userRole = 'admin', userName = 'المدير',
  theme, isDarkMode, currentThemeMode, onToggleTheme, onOpenStaffManager,
  onOpenBackupModal, onOpenCategoryManager, currentStaff,
}) => {
  if (!isOpen && !isPage) return null;
  const name = currentStaff?.name || userName || 'المستخدم';
  const activeTheme = theme || currentThemeMode || (isDarkMode ? 'dark' : 'light');
  const isAdmin = (currentStaff?.role ?? userRole) === 'admin';
  const open = (action: () => void) => { action(); if (!isPage) onClose(); };
  const content = <section className="settings-workspace app-readable" dir="rtl">
    {!isPage && <header className="settings-heading"><div><p>تفضيلات التطبيق</p><h2>الإعدادات</h2></div>
      {!isPage && <button type="button" aria-label="إغلاق" onClick={onClose}><X size={20} /></button>}
    </header>}
    <div className="settings-profile"><UserRound size={27} strokeWidth={1.5} /><div><strong>{name}</strong><span>{isAdmin ? 'مدير النظام' : 'موظف'}</span></div></div>
    <section className="settings-section"><h3>المظهر</h3>
      <div className="settings-appearance">
        <button type="button" onClick={() => onToggleTheme?.('light')} aria-pressed={activeTheme === 'light'}><Sun size={20} strokeWidth={1.6} /><span>فاتح</span>{activeTheme === 'light' && <Check size={17} />}</button>
        <button type="button" onClick={() => onToggleTheme?.('dark')} aria-pressed={activeTheme === 'dark'}><Moon size={20} strokeWidth={1.6} /><span>داكن</span>{activeTheme === 'dark' && <Check size={17} />}</button>
      </div>
    </section>
    <section className="settings-section"><h3>الإدارة</h3>
      {onOpenCategoryManager && <button type="button" className="settings-row" onClick={() => open(() => onOpenCategoryManager())}><FolderCog size={22} strokeWidth={1.5} /><span><strong>الأقسام</strong><small>الحقول والوحدات وإعدادات الظهور</small></span><ChevronLeft size={16} /></button>}
      {isAdmin && onOpenStaffManager && <button type="button" className="settings-row" onClick={() => open(onOpenStaffManager)}><UsersRound size={22} strokeWidth={1.5} /><span><strong>الموظفون</strong><small>الحسابات والصلاحيات</small></span><ChevronLeft size={16} /></button>}
      {onOpenBackupModal && <button type="button" className="settings-row" onClick={() => open(onOpenBackupModal)}><DatabaseBackup size={22} strokeWidth={1.5} /><span><strong>النسخ الاحتياطي</strong><small>حفظ نسخة واسترجاع البيانات</small></span><ChevronLeft size={16} /></button>}
    </section>
  </section>;
  return isPage ? content : <MotionModal className="workspace-admin-dialog w-full max-w-lg overflow-hidden p-5 sm:p-6">{content}</MotionModal>;
};
export default SettingsModal;
