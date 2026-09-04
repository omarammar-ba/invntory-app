import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X as CloseIcon } from 'lucide-react';

export type AppBottomSheetSnap = 'compact' | 'large' | 'expanded';

export interface AppBottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  initialSnap?: AppBottomSheetSnap;
  children: React.ReactNode;
  contentClassName?: string;
}

const SNAP_HEIGHTS: Record<AppBottomSheetSnap, string> = {
  compact: '56dvh',
  large: '74dvh',
  expanded: '92dvh',
};

export const AppBottomSheet: React.FC<AppBottomSheetProps> = ({
  open,
  onClose,
  title,
  initialSnap = 'expanded',
  children,
  contentClassName = 'p-4',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [snap, setSnap] = useState<AppBottomSheetSnap>(initialSnap);

  useEffect(() => {
    if (open) setSnap(initialSnap);
  }, [open, initialSnap]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  const springConfig = useMemo(
    () =>
      prefersReducedMotion
        ? ({ duration: 0 } as const)
        : ({ type: 'spring', stiffness: 380, damping: 38, mass: 0.8 } as const),
    [prefersReducedMotion],
  );

  const handleDragEnd = (
    _event: unknown,
    info: {
      offset: { y: number };
      velocity: { y: number };
    },
  ) => {
    if (prefersReducedMotion) return;

    const offsetY = info.offset.y;
    const velocityY = info.velocity.y;

    if (snap === 'expanded') {
      if (offsetY > 70 || velocityY > 420) {
        setSnap(initialSnap === 'large' ? 'large' : 'compact');
      }
      return;
    }

    if (snap === 'large') {
      if (offsetY < -60 || velocityY < -420) {
        setSnap('expanded');
        return;
      }

      if (offsetY > 90 || velocityY > 500) {
        setSnap('compact');
      }
      return;
    }

    if (offsetY < -60 || velocityY < -420) {
      setSnap('expanded');
      return;
    }

    if (offsetY > 110 || velocityY > 560) {
      onClose();
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[300]"
          role="presentation"
        >
          <motion.button
            type="button"
            aria-label="إغلاق النافذة"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.16,
            }}
            onClick={onClose}
            className="
              absolute
              inset-0
              h-full
              w-full
              bg-black/[0.34]
              dark:bg-black/[0.56]
            "
          />

          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={title || 'نافذة'}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={springConfig}
            className="
              absolute
              inset-x-0
              bottom-0
              z-[301]
              flex
              w-full
              flex-col
              overflow-hidden
              rounded-t-[26px]
              border-t
              border-slate-200/70
              bg-white
              shadow-2xl
              will-change-transform
              dark:border-white/[0.08]
              dark:bg-neutral-900
            "
            style={{
              height: SNAP_HEIGHTS[snap],
              WebkitBackfaceVisibility: 'hidden',
              backfaceVisibility: 'hidden',
              WebkitTransform: 'translateZ(0)',
              transform: 'translateZ(0)',
            }}
          >
            <motion.div
              drag="y"
              dragConstraints={{
                top: 0,
                bottom: 0,
              }}
              dragElastic={0.18}
              onDragEnd={handleDragEnd}
              className="
                shrink-0
                touch-none
                select-none
                border-b
                border-slate-100
                px-4
                pb-2
                dark:border-white/[0.05]
              "
            >
              <div className="cursor-grab py-3 active:cursor-grabbing">
                <div
                  className="
                    mx-auto
                    h-1
                    w-9
                    rounded-full
                    bg-slate-300
                    dark:bg-neutral-600
                  "
                />
              </div>

              <div
                className="
                  flex
                  min-h-9
                  cursor-grab
                  items-center
                  justify-between
                  gap-3
                  pb-1
                  active:cursor-grabbing
                "
              >
                <h2
                  className="
                    min-w-0
                    truncate
                    px-1
                    text-base
                    font-bold
                    text-slate-900
                    dark:text-white
                  "
                >
                  {title}
                </h2>

                <button
                  type="button"
                  onPointerDown={event =>
                    event.stopPropagation()
                  }
                  onClick={onClose}
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    cursor-pointer
                    items-center
                    justify-center
                    rounded-full
                    bg-slate-100
                    text-slate-500
                    transition-colors
                    hover:bg-slate-200
                    active:scale-95
                    dark:bg-neutral-800
                    dark:text-slate-300
                    dark:hover:bg-neutral-700
                  "
                  aria-label="إغلاق"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            </motion.div>

            <div
              className={`
                min-h-0
                flex-1
                overflow-y-auto
                overflow-x-hidden
                overscroll-contain
                ${contentClassName}
              `}
              style={{
                paddingBottom:
                  'max(1rem, env(safe-area-inset-bottom))',
              }}
            >
              {children}
            </div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
