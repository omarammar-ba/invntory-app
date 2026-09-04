import React from 'react';
import {
  useEffect,
  useState,
} from 'react';

import {
  MotionModal,
} from '@/components/motion/MotionModal';

import {
  StaffMember,
  StaffRole,
} from '@/types';

import {
  db,
} from '@/services/firebase';
import { staffService } from './staff.service';

import {
  CheckCircleIcon,
  CheckIcon,
  DeleteIcon,
  EditIcon,
  ShieldIcon,
  UserPlusIcon,
  UsersIcon,
} from '@/components/ui/Icons';

interface StaffManagerModalProps {
  isOpen?: boolean;
  isPage?: boolean;
  onClose: () => void;
  currentStaff: StaffMember | null;
}

const StaffManagerModal:
  React.FC<
    StaffManagerModalProps
  > = ({
    isOpen = true,
    isPage = false,
    onClose,
    currentStaff,
  }) => {
    const [
      staffList,
      setStaffList,
    ] = useState<
      StaffMember[]
    >([]);

    const [
      isAdding,
      setIsAdding,
    ] = useState(false);

    const [
      editingStaffId,
      setEditingStaffId,
    ] = useState<
      string | null
    >(null);

    const [
      name,
      setName,
    ] = useState('');

    const [
      role,
      setRole,
    ] = useState<
      StaffRole
    >('employee');

    const [
      phone,
      setPhone,
    ] = useState('');

    const [
      email,
      setEmail,
    ] = useState('');

    const [
      password,
      setPassword,
    ] = useState('');

    const [
      errorMessage,
      setErrorMessage,
    ] = useState('');

    const [
      successMessage,
      setSuccessMessage,
    ] = useState('');

    const [
      deleteTargetId,
      setDeleteTargetId,
    ] = useState<
      string | null
    >(null);

    const [
      warningMessage,
      setWarningMessage,
    ] = useState<
      string | null
    >(null);

    useEffect(() => {
      if (
        !isOpen &&
        !isPage
      ) {
        return;
      }

      const unsubscribe =
        db
          .collection(
            'staff',
          )
          .onSnapshot(
            snapshot => {
              if (
                snapshot.empty
              ) {
                setStaffList(
                  [],
                );

                return;
              }

              setStaffList(
                snapshot.docs.map(
                  doc => ({
                    id:
                      doc.id,

                    ...doc.data(),
                  }),
                ) as StaffMember[],
              );
            },
          );

      return () =>
        unsubscribe();
    }, [
      isOpen,
      isPage,
    ]);

    if (
      !isOpen &&
      !isPage
    ) {
      return null;
    }

    if (
      currentStaff?.role !==
      'admin'
    ) {
      return (
        <div className="flex flex-col items-center justify-center p-12 opacity-50">
          <p className="text-base font-bold">
            غير مصرح لك بالدخول
            لهذه الصفحة
          </p>
        </div>
      );
    }

    const resetForm =
      () => {
        setName('');
        setRole(
          'employee',
        );
        setPhone('');
        setEmail('');
        setPassword('');
        setIsAdding(
          false,
        );
        setEditingStaffId(
          null,
        );
        setErrorMessage(
          '',
        );
      };

    const handleSaveStaff =
      async (
        event:
          React.FormEvent,
      ) => {
        event.preventDefault();

        if (
          !name.trim()
        ) {
          setErrorMessage(
            'يرجى إدخال اسم الموظف',
          );

          return;
        }

        setErrorMessage('');

        try {
          if (
            editingStaffId
          ) {
            await db
              .collection(
                'staff',
              )
              .doc(
                editingStaffId,
              )
              .update({
                name:
                  name.trim(),

                phone:
                  phone.trim(),
              });

            setSuccessMessage(
              'تم تحديث بيانات الموظف بنجاح',
            );
          } else {
            if (
              !email.trim() ||
              !password.trim()
            ) {
              setErrorMessage(
                'يجب إدخال البريد الإلكتروني وكلمة المرور لإنشاء حساب جديد',
              );

              return;
            }
            await staffService.createStaff({
              name: name.trim(),
              email: email.trim(),
              password,
              phone: phone.trim(),
              role,
            });

            setSuccessMessage(
              'تمت إضافة الموظف الجديد بنجاح',
            );
          }

          resetForm();

          window.setTimeout(
            () =>
              setSuccessMessage(
                '',
              ),
            3000,
          );
        } catch (
          error: any
        ) {
          console.error(
            error,
          );

          setErrorMessage(
            error.message ||
              'حدث خطأ أثناء حفظ بيانات الموظف',
          );
        }
      };

    const handleEdit =
      (
        staff:
          StaffMember,
      ) => {
        setName(
          staff.name,
        );

        setRole(
          staff.role,
        );

        setPhone(
          staff.phone || '',
        );

        setEmail(
          staff.email || '',
        );

        setPassword('');

        setEditingStaffId(
          staff.id,
        );

        setIsAdding(true);

        setWarningMessage(
          null,
        );

        setDeleteTargetId(
          null,
        );
      };

    const handleDelete =
      (
        staffId: string,
      ) => {
        const targetStaff =
          staffList.find(
            staff =>
              staff.id ===
              staffId,
          );

        if (
          targetStaff?.isPrimaryAdmin === true ||
          targetStaff?.id ===
            currentStaff?.id
        ) {
          setWarningMessage(
            'حفظاً لصلاحيات الأمان: لا يمكن تعطيل حساب المدير الرئيسي أو حسابك النشط الحالي.',
          );

          return;
        }

        if (
          staffList.length <=
          1
        ) {
          setWarningMessage(
            'يجب أن يبقى موظف أو مدير واحد على الأقل في النظام.',
          );

          return;
        }

        setDeleteTargetId(
          staffId,
        );
      };

    const confirmDeleteAction =
      async () => {
        if (
          !deleteTargetId
        ) {
          return;
        }

        try {
          await staffService.setStaffStatus(deleteTargetId, 'inactive');

          setDeleteTargetId(
            null,
          );

          setSuccessMessage(
            'تم تعطيل حساب الموظف بنجاح.',
          );

          window.setTimeout(
            () =>
              setSuccessMessage(
                '',
              ),
            3000,
          );
        } catch (
          error: any
        ) {
          console.error(
            error,
          );

          setErrorMessage(
            error.message ||
              'حدث خطأ أثناء محاولة تعطيل الحساب.',
          );
        }
      };

    const reactivateStaff =
      async (
        staffId: string,
      ) => {
        try {
          await staffService.setStaffStatus(staffId, 'active');

          setSuccessMessage(
            'تم إعادة تفعيل الموظف بنجاح.',
          );

          window.setTimeout(
            () =>
              setSuccessMessage(
                '',
              ),
            3000,
          );
        } catch (
          error: any
        ) {
          console.error(
            error,
          );

          setErrorMessage(
            error.message ||
              'حدث خطأ أثناء محاولة إعادة تفعيل الحساب.',
          );

          window.setTimeout(
            () =>
              setErrorMessage(
                '',
              ),
            4000,
          );
        }
      };

    const activeAdmins =
      staffList.filter(
        staff =>
          staff.role ===
            'admin' &&
          staff.status ===
            'active',
      );

    const activeEmployees =
      staffList.filter(
        staff =>
          staff.role ===
            'employee' &&
          staff.status ===
            'active',
      );

    const inactiveStaff =
      staffList.filter(
        staff =>
          staff.status ===
          'inactive',
      );

    const activeCount =
      activeAdmins.length +
      activeEmployees.length;

    const renderStaffRow =
      (
        staff:
          StaffMember,
      ) => {
        const isAdmin =
          staff.role ===
          'admin';

        const isCurrent =
          currentStaff?.id ===
          staff.id;

        return (
          <div
            key={
              staff.id
            }
            className="group flex min-h-[72px] items-center justify-between gap-3 px-3.5 py-3 transition-colors hover:bg-slate-50/80 dark:hover:bg-neutral-800/45 sm:px-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={`
                  flex
                  h-10
                  w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-[14px]
                  text-sm
                  font-black
                  shadow-sm
                  ${
                    isAdmin
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/55 dark:text-violet-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/55 dark:text-emerald-300'
                  }
                `}
              >
                {staff.name.charAt(
                  0,
                ) || '؟'}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="break-words text-[13px] font-extrabold text-slate-900 dark:text-white">
                    {
                      staff.name
                    }
                  </span>

                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                      isAdmin
                        ? 'bg-violet-50 text-violet-600 dark:bg-violet-950/35 dark:text-violet-300'
                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/35 dark:text-emerald-300'
                    }`}
                  >
                    {isAdmin
                      ? 'مدير'
                      : 'موظف'}
                  </span>

                  {isCurrent && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-neutral-800 dark:text-slate-400">
                      حسابك
                    </span>
                  )}

                  {staff.isPrimaryAdmin && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                      المدير الرئيسي
                    </span>
                  )}
                </div>

                <p className="mt-1 break-all text-[10px] font-medium leading-4 text-slate-400 dark:text-slate-500">
                  {staff.email ||
                    'بدون بريد مسجل'}

                  {staff.phone
                    ? ` • ${staff.phone}`
                    : ''}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  handleEdit(
                    staff,
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-slate-200/70 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 dark:border-white/[0.07] dark:bg-neutral-900 dark:text-slate-400 dark:hover:bg-neutral-800 dark:hover:text-white"
                title="تعديل"
                aria-label={`تعديل ${staff.name}`}
              >
                <EditIcon className="h-4 w-4" />
              </button>

              {!staff.isPrimaryAdmin && !isCurrent && (
                <button
                  type="button"
                  onClick={() => handleDelete(staff.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-rose-100 bg-rose-50/70 text-rose-500 transition hover:bg-rose-100 hover:text-rose-600 dark:border-rose-900/35 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/35"
                  title="تعطيل"
                  aria-label={`تعطيل ${staff.name}`}
                >
                  <DeleteIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );
      };

    const content = (
      <div
        className="space-y-4"
        dir="rtl"
      >
        {successMessage && (
          <div className="flex items-center gap-2.5 rounded-[14px] border border-emerald-200/70 bg-emerald-50 px-3.5 py-3 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircleIcon className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-[14px] border border-rose-200/70 bg-rose-50 px-3.5 py-3 text-[11px] font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        {warningMessage && (
          <div className="flex items-center justify-between gap-3 rounded-[14px] border border-amber-200/70 bg-amber-50 px-3.5 py-3 dark:border-amber-900/50 dark:bg-amber-950/25">
            <p className="text-[10px] font-semibold leading-5 text-amber-800 dark:text-amber-300">
              {warningMessage}
            </p>
            <button
              type="button"
              onClick={() => setWarningMessage(null)}
              className="shrink-0 rounded-[9px] px-2 py-1 text-[10px] font-bold text-amber-700 transition hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-950/45"
            >
              إغلاق
            </button>
          </div>
        )}

        {deleteTargetId && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-rose-200/70 bg-rose-50 px-3.5 py-3 dark:border-rose-900/50 dark:bg-rose-950/25">
            <p className="text-[10px] font-semibold text-rose-700 dark:text-rose-300">
              تعطيل حساب{' '}
              {staffList.find(staff => staff.id === deleteTargetId)?.name || 'الموظف'}؟
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={confirmDeleteAction}
                className="rounded-[10px] bg-rose-600 px-3.5 py-2 text-[10px] font-bold text-white transition active:scale-[0.98]"
              >
                تعطيل
              </button>
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-2 text-[10px] font-bold text-slate-500 transition hover:bg-slate-50 dark:border-white/[0.07] dark:bg-neutral-800 dark:text-slate-300"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {isAdding ? (
          <form
            onSubmit={handleSaveStaff}
            className="overflow-hidden rounded-[20px] border border-slate-200/70 bg-white shadow-sm dark:border-white/[0.07] dark:bg-neutral-900"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-white/[0.05] sm:px-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-indigo-50 text-indigo-600 dark:bg-indigo-950/35 dark:text-indigo-300">
                  <UserPlusIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-[13px] font-extrabold text-slate-900 dark:text-white">
                    {editingStaffId ? 'تعديل الموظف' : 'إضافة موظف جديد'}
                  </h3>
                  <p className="mt-0.5 text-[9px] font-medium text-slate-400 dark:text-slate-500">
                    {editingStaffId ? 'عدّل الاسم أو رقم الهاتف ثم احفظ.' : 'أدخل بيانات الحساب والصلاحية الأساسية.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-[10px] px-2.5 py-1.5 text-[10px] font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-neutral-800 dark:hover:text-slate-200"
              >
                إلغاء
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5">
              <div>
                <label className="mb-1.5 block text-[10px] font-bold text-slate-600 dark:text-slate-300">اسم الموظف *</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder="مثال: أحمد محمد"
                  className="h-11 w-full rounded-[13px] border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 dark:border-white/[0.08] dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-800"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold text-slate-600 dark:text-slate-300">الصلاحية *</label>
                <select
                  value={role}
                  onChange={event => setRole(event.target.value as StaffRole)}
                  disabled={!!editingStaffId}
                  className="h-11 w-full rounded-[13px] border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[0.08] dark:bg-neutral-800 dark:text-white"
                >
                  <option value="employee">موظف</option>
                  <option value="admin">مدير</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold text-slate-600 dark:text-slate-300">البريد الإلكتروني *</label>
                <input
                  type="email"
                  required={!editingStaffId}
                  autoComplete="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="employee@example.com"
                  disabled={!!editingStaffId}
                  className="h-11 w-full rounded-[13px] border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[0.08] dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-800"
                />
              </div>

              {!editingStaffId && (
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold text-slate-600 dark:text-slate-300">كلمة المرور *</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="h-11 w-full rounded-[13px] border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 dark:border-white/[0.08] dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-800"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-[10px] font-bold text-slate-600 dark:text-slate-300">رقم الهاتف</label>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={40}
                  value={phone}
                  onChange={event => setPhone(event.target.value)}
                  placeholder="059xxxxxxx"
                  className="h-11 w-full rounded-[13px] border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 dark:border-white/[0.08] dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-800"
                />
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 px-4 py-3.5 dark:border-white/[0.05] sm:px-5">
              <button
                type="submit"
                className="flex h-10 items-center justify-center gap-1.5 rounded-[12px] bg-slate-900 px-5 text-xs font-bold text-white shadow-sm transition active:scale-[0.98] dark:bg-white dark:text-slate-900"
              >
                <CheckIcon className="h-4 w-4" />
                {editingStaffId ? 'حفظ التعديل' : 'حفظ الموظف'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">إدارة الموظفين</h2>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">{activeCount} نشط</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                  <span>{activeAdmins.length} مدير</span>
                  <span>•</span>
                  <span>{activeEmployees.length} موظف</span>
                  {inactiveStaff.length > 0 && (<><span>•</span><span>{inactiveStaff.length} معطل</span></>)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="flex h-10 items-center gap-2 rounded-[12px] bg-slate-900 px-4 text-[11px] font-bold text-white shadow-sm transition active:scale-[0.98] dark:bg-white dark:text-slate-900"
              >
                <UserPlusIcon className="h-4 w-4" />
                إضافة موظف
              </button>
            </div>

            <section className="overflow-hidden rounded-[20px] border border-slate-200/70 bg-white shadow-sm dark:border-white/[0.07] dark:bg-neutral-900">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/65 px-3.5 py-2.5 dark:border-white/[0.05] dark:bg-neutral-800/35 sm:px-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-violet-100 text-violet-600 dark:bg-violet-950/45 dark:text-violet-300"><ShieldIcon className="h-3.5 w-3.5" /></div>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">المدراء</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{activeAdmins.length}</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">{activeAdmins.map(renderStaffRow)}</div>

              <div className="flex items-center justify-between gap-2 border-y border-slate-100 bg-slate-50/65 px-3.5 py-2.5 dark:border-white/[0.05] dark:bg-neutral-800/35 sm:px-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-emerald-100 text-emerald-600 dark:bg-emerald-950/45 dark:text-emerald-300"><UsersIcon className="h-3.5 w-3.5" /></div>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">الموظفون</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{activeEmployees.length}</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                {activeEmployees.length > 0 ? activeEmployees.map(renderStaffRow) : (
                  <div className="px-4 py-6 text-center text-[10px] font-medium text-slate-400">لا يوجد موظفون إضافيون حالياً</div>
                )}
              </div>
            </section>

            {inactiveStaff.length > 0 && (
              <section className="overflow-hidden rounded-[20px] border border-slate-200/70 bg-white shadow-sm dark:border-white/[0.07] dark:bg-neutral-900">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/65 px-3.5 py-2.5 dark:border-white/[0.05] dark:bg-neutral-800/35 sm:px-4">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">الحسابات المعطلة</span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{inactiveStaff.length}</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {inactiveStaff.map(staff => (
                    <div key={staff.id} className="flex min-h-[64px] items-center justify-between gap-3 px-3.5 py-3 sm:px-4">
                      <div className="flex min-w-0 items-center gap-3 opacity-70">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-slate-100 text-xs font-black text-slate-400 dark:bg-neutral-800">{staff.name.charAt(0) || '؟'}</div>
                        <div className="min-w-0">
                          <span className="break-words text-xs font-bold text-slate-600 dark:text-slate-300">{staff.name}</span>
                          <p className="mt-0.5 break-all text-[9px] font-medium text-slate-400 dark:text-slate-500">{staff.email || 'حساب معطل'}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => reactivateStaff(staff.id)}
                        className="rounded-[10px] bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-700 transition hover:bg-emerald-100 active:scale-[0.98] dark:bg-emerald-950/35 dark:text-emerald-300"
                      >
                        إعادة تفعيل
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    );

    if (isPage) {
      return (
        <div className="mt-2 animate-fade-in">
          {content}
        </div>
      );
    }

    return (
      <MotionModal
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-[22px] border border-slate-200/70 bg-slate-50 shadow-2xl dark:border-white/[0.07] dark:bg-neutral-950"
        backdropClassName="fixed inset-0 z-[280] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 bg-white px-4 py-3.5 dark:border-white/[0.06] dark:bg-neutral-900">
          <div className="flex items-center gap-2.5">
            <UsersIcon className="h-4 w-4 text-violet-500" />

            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              الموظفين
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] px-2.5 py-1.5 text-[10px] font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-neutral-800 dark:hover:text-slate-200"
          >
            إغلاق
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {content}
        </div>
      </MotionModal>
    );
  };

export default StaffManagerModal;
