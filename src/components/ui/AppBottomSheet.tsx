import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { X as CloseIcon } from 'lucide-react';

export type AppBottomSheetSnap = 'compact' | 'large' | 'expanded';

export interface AppBottomSheetProps {
  open: boolean;
  onClose: () => void;
  onExited?: () => void;
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
  onExited,
  title,
  initialSnap = 'expanded',
  children,
  contentClassName = 'p-4',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const dragControls = useDragControls();
  const [snap, setSnap] = useState<AppBottomSheetSnap>(initialSnap);
  const [isPresent, setIsPresent] = useState(open);

  useEffect(() => {
    if (open) setSnap(initialSnap);
  }, [open, initialSnap]);

  useLayoutEffect(() => {
    if (open) setIsPresent(true);
  }, [open]);

  useLayoutEffect(() => {
    if (!isPresent) return;

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
  }, [isPresent, onClose]);

  const springConfig = useMemo(
    () =>
      prefersReducedMotion
        ? ({ duration: 0 } as const)
        : ({ duration: 0.28, ease: [0.22, 1, 0.36, 1] } as const),
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
    <AnimatePresence onExitComplete={() => {
      setIsPresent(false);
      onExited?.();
    }}>
      {open && (
        <motion.div
          className="fixed inset-0 z-[300]"
          role="presentation"
          initial={false}
          exit={{ opacity: 1 }}
          transition={{ duration: 0.28 }}
        >
          <motion.button
            type="button"
            data-overlay-backdrop
            aria-label="إغلاق النافذة"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.28,
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
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.18}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
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
              transition: prefersReducedMotion
                ? undefined
                : 'height 280ms cubic-bezier(0.22, 1, 0.36, 1)',
              WebkitBackfaceVisibility: 'hidden',
              backfaceVisibility: 'hidden',
            }}
          >
            <div
              onPointerDown={event => {
                event.currentTarget.setPointerCapture(event.pointerId);
                if (!prefersReducedMotion) dragControls.start(event);
              }}
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
            </div>

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
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
