import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface MotionModalProps {
  children: React.ReactNode;
  className?: string;
  backdropClassName?: string;
  onClick?: (e: React.MouseEvent) => void;
  showHandle?: boolean;
}

export function MotionModal({ 
  children, 
  className = '', 
  backdropClassName = 'fixed inset-0 bg-black/65 backdrop-blur-sm flex flex-col justify-end sm:justify-center sm:items-center z-[300] p-0 sm:p-4 overflow-hidden', 
  onClick,
  showHandle = true
}: MotionModalProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={backdropClassName} dir="rtl" onClick={onClick}>
      <motion.div
        className="absolute inset-0 z-[-1]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      />
      <motion.div
        className={className}
        onClick={(e) => e.stopPropagation()}
        initial={
          reduceMotion
            ? { opacity: 0 }
            : { opacity: 0, y: '100%' }
        }
        animate={{ opacity: 1, y: 0 }}
        exit={
          reduceMotion
            ? { opacity: 0 }
            : { opacity: 0, y: '100%' }
        }
        transition={{ type: 'spring', damping: 28, stiffness: 300, mass: 0.8 }}
      >
        {showHandle && (
          <div className="pt-2.5 pb-1 sm:hidden flex justify-center shrink-0">
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-neutral-700" />
          </div>
        )}
        {children}
      </motion.div>
    </div>
  );
}
