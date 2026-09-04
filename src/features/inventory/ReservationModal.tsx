import React, { useState } from 'react';
import { Plus, User } from 'lucide-react';
import { Reservation, Tile } from '@/types';

import {
  DeleteIcon,
  EditIcon,
  SaveIcon,
  WarningIcon
} from '@/components/ui/Icons';

import {
  ResponsiveOverlay
} from '@/components/ui/ResponsiveOverlay';

interface ReservationModalProps {
  tile: Tile;
  onClose: () => void;
  onUpdateReservations: (
    reservations: Reservation[]
  ) => Promise<void>;
}

const ReservationModal:
  React.FC<
    ReservationModalProps
  > = ({
    tile,
    onClose,
    onUpdateReservations
  }) => {
    const [
      reservations,
      setReservations
    ] = useState<
      Reservation[]
    >(
      tile.reservations ||
        []
    );

    const [
      newName,
      setNewName
    ] = useState('');

    const [
      newQty,
      setNewQty
    ] = useState('');

    const [
      newNotes,
      setNewNotes
    ] = useState('');

    const [
      showAddForm,
      setShowAddForm
    ] = useState(false);

    const [
      editingId,
      setEditingId
    ] = useState<
      string | null
    >(null);

    const [
      confirmDeleteId,
      setConfirmDeleteId
    ] = useState<
      string | null
    >(null);

    const [
      isSaving,
      setIsSaving
    ] = useState(false);

    const isPieceUnit =
      tile.unitType ===
      'pieces';

    const unitLabel =
      isPieceUnit
        ? 'قطعة'
        : 'م²';

    const totalStock =
      Number(
        tile.meters || 0
      );

    const totalReserved =
      reservations.reduce(
        (
          sum,
          reservation
        ) =>
          sum +
          Number(
            reservation.meters ||
              0
          ),
        0
      );

    const availableStock =
      Math.max(
        0,
        totalStock -
          totalReserved
      );

    const resetForm = () => {
      setNewName('');
      setNewQty('');
      setNewNotes('');
      setEditingId(null);
      setShowAddForm(false);
    };

    const handleAddOrUpdate =
      () => {
        if (
          !newName.trim() ||
          !newQty
        ) {
          return;
        }

        const quantity =
          Number.parseFloat(
            newQty
          );

        if (
          !Number.isFinite(
            quantity
          ) ||
          quantity <= 0
        ) {
          alert('أدخل كمية حجز صحيحة أكبر من صفر.');
          return;
        }

        if (
          isPieceUnit &&
          !Number.isInteger(quantity)
        ) {
          alert('حجز الأصناف بالقطعة يجب أن يكون بعدد صحيح من القطع.');
          return;
        }

        const editingReservation =
          editingId
            ? reservations.find(
                reservation => reservation.id === editingId
              )
            : null;

        const maxAllowed =
          availableStock +
          Number(editingReservation?.meters || 0);

        if (quantity > maxAllowed) {
          alert(
            `الكمية المطلوبة أكبر من المتوفر. الحد الأقصى ${maxAllowed} ${unitLabel}.`
          );
          return;
        }

        if (editingId) {
          setReservations(
            previous =>
              previous.map(
                reservation =>
                  reservation.id ===
                  editingId
                    ? {
                        ...reservation,
                        customerName:
                          newName.trim(),
                        meters:
                          quantity,
                        notes:
                          newNotes.trim(),
                      }
                    : reservation
              )
          );
        } else {
          const reservation:
            Reservation = {
            id:
              `res_${Date.now().toString(36)}_` +
              Math.random()
                .toString(36)
                .slice(2, 7),

            customerName:
              newName.trim(),

            meters:
              quantity,

            notes:
              newNotes.trim(),

            date:
              new Date().toLocaleDateString(
                'ar-EG'
              ),
          };

          setReservations(
            previous => [
              ...previous,
              reservation
            ]
          );
        }

        resetForm();
      };

    const handleEdit = (
      reservation: Reservation
    ) => {
      setEditingId(
        reservation.id
      );

      setNewName(
        reservation.customerName
      );

      setNewQty(
        String(
          reservation.meters
        )
      );

      setNewNotes(
        reservation.notes ||
          ''
      );

      setShowAddForm(true);
    };

    const confirmDeleteReservation =
      () => {
        if (
          !confirmDeleteId
        ) {
          return;
        }

        setReservations(
          previous =>
            previous.filter(
              reservation =>
                reservation.id !==
                confirmDeleteId
            )
        );

        setConfirmDeleteId(
          null
        );
      };

    const handleSaveReservations =
      async () => {
        if (isSaving) return;

        setIsSaving(true);

        try {
          await onUpdateReservations(
            reservations
          );
        } catch (error) {
          console.error('Reservation save failed:', error);
          alert(
            error instanceof Error && error.message
              ? error.message
              : 'تعذر حفظ الحجوزات. حاول مرة أخرى.'
          );
          setIsSaving(false);
        }
      };

    return (
      <ResponsiveOverlay
        open={true}
        onClose={onClose}
        title="حجوزات الصنف"
        mobileSnap={
          showAddForm
            ? 'expanded'
            : 'compact'
        }
        desktopMaxWidth="max-w-xl"
        contentClassName="p-0"
      >
        <div
          className="
            space-y-4
            p-4
            sm:p-6
          "
        >
          <div>
            <h3
              className="
                break-words
                text-sm
                font-black
                text-slate-900
                dark:text-white
              "
            >
              {tile.name}
            </h3>

            {tile.size && (
              <p
                className="
                  mt-0.5
                  text-[10px]
                  font-semibold
                  text-slate-500
                  dark:text-slate-400
                "
              >
                {tile.size.replace(
                  /\*/g,
                  '×'
                )}
              </p>
            )}
          </div>

          <div
            className="
              grid
              grid-cols-3
              overflow-hidden
              rounded-[14px]
              border
              border-slate-200/70
              bg-slate-50
              divide-x
              divide-x-reverse
              divide-slate-200/70
              dark:border-white/[0.07]
              dark:bg-neutral-800/60
              dark:divide-white/[0.06]
            "
          >
            <div
              className="
                px-1.5
                py-2.5
                text-center
              "
            >
              <span
                className="
                  block
                  text-[9px]
                  font-bold
                  text-slate-500
                  dark:text-slate-400
                "
              >
                الكلي
              </span>

              <strong
                className="
                  mt-0.5
                  block
                  text-sm
                  font-black
                  text-slate-900
                  dark:text-white
                "
              >
                {isPieceUnit
                  ? totalStock.toFixed(
                      0
                    )
                  : totalStock.toFixed(
                      2
                    )}
              </strong>

              <span
                className="
                  text-[9px]
                  text-slate-400
                "
              >
                {unitLabel}
              </span>
            </div>

            <div
              className="
                px-1.5
                py-2.5
                text-center
              "
            >
              <span
                className="
                  block
                  text-[9px]
                  font-bold
                  text-slate-500
                  dark:text-slate-400
                "
              >
                المحجوز
              </span>

              <strong
                className="
                  mt-0.5
                  block
                  text-sm
                  font-black
                  text-rose-600
                  dark:text-rose-400
                "
              >
                {isPieceUnit
                  ? totalReserved.toFixed(
                      0
                    )
                  : totalReserved.toFixed(
                      2
                    )}
              </strong>

              <span
                className="
                  text-[9px]
                  text-slate-400
                "
              >
                {unitLabel}
              </span>
            </div>

            <div
              className="
                px-1.5
                py-2.5
                text-center
              "
            >
              <span
                className="
                  block
                  text-[9px]
                  font-bold
                  text-slate-500
                  dark:text-slate-400
                "
              >
                المتاح
              </span>

              <strong
                className="
                  mt-0.5
                  block
                  text-sm
                  font-black
                  text-emerald-600
                  dark:text-emerald-400
                "
              >
                {isPieceUnit
                  ? availableStock.toFixed(
                      0
                    )
                  : availableStock.toFixed(
                      2
                    )}
              </strong>

              <span
                className="
                  text-[9px]
                  text-slate-400
                "
              >
                {unitLabel}
              </span>
            </div>
          </div>

          {showAddForm ? (
            <div
              className="
                space-y-3
                rounded-[16px]
                border
                border-indigo-200/70
                bg-indigo-50/40
                p-3.5
                dark:border-indigo-900/50
                dark:bg-indigo-950/20
              "
            >
              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-3
                "
              >
                <div
                  className="
                    flex
                    items-center
                    gap-1.5
                    text-xs
                    font-black
                    text-indigo-700
                    dark:text-indigo-300
                  "
                >
                  <User
                    className="
                      h-3.5
                      w-3.5
                    "
                  />

                  {editingId
                    ? 'تعديل الحجز'
                    : 'حجز جديد'}
                </div>

                <button
                  type="button"
                  onClick={
                    resetForm
                  }
                  className="
                    text-[11px]
                    font-bold
                    text-slate-500
                    hover:text-slate-700
                    dark:text-slate-400
                    dark:hover:text-slate-200
                  "
                >
                  إلغاء
                </button>
              </div>

              <div
                className="
                  grid
                  grid-cols-1
                  gap-2.5
                  sm:grid-cols-2
                "
              >
                <div>
                  <label
                    className="
                      mb-1
                      block
                      text-[10px]
                      font-bold
                      text-slate-700
                      dark:text-slate-300
                    "
                  >
                    اسم الزبون / الهاتف *
                  </label>

                  <input
                    type="text"
                    value={newName}
                    onChange={event =>
                      setNewName(
                        event.target
                          .value
                      )
                    }
                    placeholder="مثال: أحمد خالد - 059..."
                    className="
                      h-11
                      w-full
                      rounded-[13px]
                      border
                      border-slate-200
                      bg-white
                      px-3
                      text-xs
                      font-bold
                      text-slate-900
                      outline-none
                      focus:border-indigo-400
                      dark:border-white/[0.08]
                      dark:bg-neutral-900
                      dark:text-white
                    "
                  />
                </div>

                <div>
                  <label
                    className="
                      mb-1
                      block
                      text-[10px]
                      font-bold
                      text-slate-700
                      dark:text-slate-300
                    "
                  >
                    الكمية المحجوزة ({unitLabel}) *
                  </label>

                  <input
                    type="number"
                    value={newQty}
                    onChange={event =>
                      setNewQty(
                        event.target
                          .value
                      )
                    }
                    placeholder="0"
                    step={
                      isPieceUnit
                        ? '1'
                        : 'any'
                    }
                    min="0"
                    className="
                      h-11
                      w-full
                      rounded-[13px]
                      border
                      border-slate-200
                      bg-white
                      px-3
                      text-xs
                      font-bold
                      text-slate-900
                      outline-none
                      focus:border-indigo-400
                      dark:border-white/[0.08]
                      dark:bg-neutral-900
                      dark:text-white
                    "
                  />
                </div>
              </div>

              <div>
                <label
                  className="
                    mb-1
                    block
                    text-[10px]
                    font-bold
                    text-slate-700
                    dark:text-slate-300
                  "
                >
                  ملاحظات الحجز
                </label>

                <input
                  type="text"
                  value={newNotes}
                  onChange={event =>
                    setNewNotes(
                      event.target.value
                    )
                  }
                  placeholder="العربون، موعد التسليم..."
                  className="
                    h-11
                    w-full
                    rounded-[13px]
                    border
                    border-slate-200
                    bg-white
                    px-3
                    text-xs
                    font-semibold
                    text-slate-900
                    outline-none
                    focus:border-indigo-400
                    dark:border-white/[0.08]
                    dark:bg-neutral-900
                    dark:text-white
                  "
                />
              </div>

              <button
                type="button"
                onClick={
                  handleAddOrUpdate
                }
                className="
                  h-11
                  w-full
                  rounded-[12px]
                  bg-indigo-600
                  px-4
                  text-xs
                  font-bold
                  text-white
                  transition
                  hover:bg-indigo-700
                  active:scale-[0.98]
                "
              >
                {editingId
                  ? 'حفظ تعديل الحجز'
                  : 'إضافة الحجز'}
              </button>
            </div>
          ) : (
            <div
              className="
                flex
                items-center
                justify-between
                gap-3
              "
            >
              <span
                className="
                  text-xs
                  font-black
                  text-slate-800
                  dark:text-white
                "
              >
                الحجوزات (
                {reservations.length}
                )
              </span>

              <button
                type="button"
                onClick={() =>
                  setShowAddForm(
                    true
                  )
                }
                className="
                  flex
                  h-9
                  items-center
                  gap-1.5
                  rounded-[11px]
                  bg-slate-900
                  px-3
                  text-[11px]
                  font-bold
                  text-white
                  transition
                  active:scale-[0.98]
                  dark:bg-white
                  dark:text-slate-900
                "
              >
                <Plus
                  className="
                    h-3.5
                    w-3.5
                  "
                />
                حجز جديد
              </button>
            </div>
          )}

          {confirmDeleteId && (
            <div
              className="
                flex
                items-center
                justify-between
                gap-3
                rounded-[14px]
                border
                border-rose-200
                bg-rose-50
                p-3
                dark:border-rose-900/50
                dark:bg-rose-950/30
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-2
                  text-[11px]
                  font-bold
                  text-rose-700
                  dark:text-rose-300
                "
              >
                <WarningIcon />
                حذف هذا الحجز؟
              </div>

              <div
                className="
                  flex
                  items-center
                  gap-1.5
                "
              >
                <button
                  type="button"
                  onClick={
                    confirmDeleteReservation
                  }
                  className="
                    rounded-[8px]
                    bg-rose-600
                    px-2.5
                    py-1.5
                    text-[10px]
                    font-bold
                    text-white
                  "
                >
                  حذف
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setConfirmDeleteId(
                      null
                    )
                  }
                  className="
                    rounded-[8px]
                    bg-white
                    px-2.5
                    py-1.5
                    text-[10px]
                    font-bold
                    text-slate-600
                    dark:bg-neutral-800
                    dark:text-slate-300
                  "
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {reservations.length ===
            0 &&
          !showAddForm ? (
            <div
              className="
                rounded-[14px]
                border
                border-dashed
                border-slate-200
                py-6
                text-center
                text-xs
                font-medium
                text-slate-400
                dark:border-white/[0.08]
                dark:text-slate-500
              "
            >
              لا توجد حجوزات مسجلة لهذا الصنف.
            </div>
          ) : (
            <div
              className="
                overflow-hidden
                rounded-[16px]
                border
                border-slate-200/70
                bg-white
                divide-y
                divide-slate-100
                dark:border-white/[0.07]
                dark:bg-neutral-900
                dark:divide-white/[0.05]
              "
            >
              {reservations.map(
                reservation => (
                  <div
                    key={
                      reservation.id
                    }
                    className="
                      flex
                      items-center
                      justify-between
                      gap-3
                      px-3
                      py-2.5
                    "
                  >
                    <div
                      className="
                        min-w-0
                        flex-1
                      "
                    >
                      <div
                        className="
                          flex
                          flex-wrap
                          items-center
                          gap-2
                        "
                      >
                        <span
                          className="
                            break-words
                            text-xs
                            font-extrabold
                            text-slate-900
                            dark:text-white
                          "
                        >
                          {
                            reservation.customerName
                          }
                        </span>

                        <span
                          className="
                            rounded-full
                            bg-rose-50
                            px-2
                            py-0.5
                            text-[10px]
                            font-black
                            text-rose-700
                            dark:bg-rose-950/40
                            dark:text-rose-300
                          "
                        >
                          {
                            reservation.meters
                          }{' '}
                          {
                            unitLabel
                          }
                        </span>
                      </div>

                      <div
                        className="
                          mt-1
                          flex
                          flex-wrap
                          items-center
                          gap-x-2
                          gap-y-0.5
                          text-[10px]
                          font-medium
                          text-slate-400
                        "
                      >
                        <span>
                          {
                            reservation.date
                          }
                        </span>

                        {reservation.notes && (
                          <span>
                            {
                              reservation.notes
                            }
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      className="
                        flex
                        shrink-0
                        items-center
                        gap-1
                      "
                    >
                      <button
                        type="button"
                        onClick={() =>
                          handleEdit(
                            reservation
                          )
                        }
                        className="
                          flex
                          h-8
                          w-8
                          items-center
                          justify-center
                          rounded-[10px]
                          bg-slate-100
                          text-slate-500
                          dark:bg-neutral-800
                          dark:text-slate-300
                        "
                        aria-label="تعديل الحجز"
                      >
                        <EditIcon
                          className="
                            h-3.5
                            w-3.5
                          "
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDeleteId(
                            reservation.id
                          )
                        }
                        className="
                          flex
                          h-8
                          w-8
                          items-center
                          justify-center
                          rounded-[10px]
                          bg-rose-50
                          text-rose-500
                          dark:bg-rose-900/25
                          dark:text-rose-400
                        "
                        aria-label="حذف الحجز"
                      >
                        <DeleteIcon
                          className="
                            h-3.5
                            w-3.5
                          "
                        />
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <div
          className="
            sticky
            bottom-0
            flex
            items-center
            gap-2
            border-t
            border-slate-200/70
            bg-white/95
            p-3
            backdrop-blur-md
            dark:border-white/[0.07]
            dark:bg-neutral-900/95
            sm:px-6
          "
        >
          <button
            type="button"
            onClick={onClose}
            className="
              h-11
              flex-1
              rounded-[12px]
              bg-slate-100
              px-4
              text-xs
              font-bold
              text-slate-600
              dark:bg-neutral-800
              dark:text-slate-300
            "
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={
              handleSaveReservations
            }
            disabled={isSaving}
            className="
              flex
              h-11
              flex-[2]
              items-center
              justify-center
              gap-2
              rounded-[12px]
              bg-emerald-600
              px-4
              text-xs
              font-black
              text-white
              transition
              hover:bg-emerald-700
              active:scale-[0.98]
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            <SaveIcon />
            {isSaving ? 'جاري الحفظ...' : 'حفظ الحجوزات'}
          </button>
        </div>
      </ResponsiveOverlay>
    );
  };

export default ReservationModal;