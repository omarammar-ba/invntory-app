import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'motion/react';
import { X as CloseIcon } from 'lucide-react';

export interface DesktopDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  maxWidth?: string;
  children: React.ReactNode;
  contentClassName?: string;
}

export const DesktopDialog: React.FC<DesktopDialogProps> = ({
  open,
  onClose,
  title,
  maxWidth = 'max-w-2xl',
  children,
  contentClassName = 'p-6',
}) => {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    const onKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener(
      'keydown',
      onKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        'keydown',
        onKeyDown,
      );
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="
            fixed
            inset-0
            z-[300]
            flex
            items-center
            justify-center
            p-6
          "
        >
          <motion.button
            type="button"
            aria-label="إغلاق النافذة"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration:
                prefersReducedMotion
                  ? 0
                  : 0.16,
            }}
            onClick={onClose}
            className="
              absolute
              inset-0
              h-full
              w-full
              bg-black/40
              backdrop-blur-[2px]
              dark:bg-black/60
            "
          />

          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={title || 'نافذة'}
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    y: 8,
                    scale: 0.985,
                  }
            }
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    y: 6,
                    scale: 0.985,
                  }
            }
            transition={{
              duration:
                prefersReducedMotion
                  ? 0
                  : 0.2,
              ease: [0.22, 1, 0.36, 1],
            }}
            className={`
              relative
              z-[301]
              flex
              max-h-[90vh]
              w-full
              ${maxWidth}
              flex-col
              overflow-hidden
              rounded-[20px]
              border
              border-slate-200/70
              bg-white
              shadow-2xl
              dark:border-white/[0.08]
              dark:bg-neutral-900
            `}
          >
            <div
              className="
                flex
                min-h-16
                shrink-0
                items-center
                justify-between
                gap-4
                border-b
                border-slate-100
                px-6
                dark:border-white/[0.05]
              "
            >
              <h2
                className="
                  min-w-0
                  truncate
                  text-lg
                  font-bold
                  text-slate-900
                  dark:text-white
                "
              >
                {title}
              </h2>

              <button
                type="button"
                onClick={onClose}
                className="
                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  bg-slate-100
                  text-slate-500
                  transition-colors
                  hover:bg-slate-200
                  dark:bg-neutral-800
                  dark:text-slate-300
                  dark:hover:bg-neutral-700
                "
                aria-label="إغلاق"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <div
              className={`
                min-h-0
                flex-1
                overflow-y-auto
                ${contentClassName}
              `}
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