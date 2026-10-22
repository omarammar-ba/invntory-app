import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { motionEase } from '@/styles/motion';

interface Props {
  children: React.ReactNode;
  index: number;
  maxAnimatedItems?: number;
  className?: string;
  as?: 'div' | 'tr' | 'li';
}

export function StaggerItem({ children, index, maxAnimatedItems = 8, className = '', as = 'div' }: Props) {
  const reduceMotion = useReducedMotion();

  // Rows beyond the entrance sequence do not need a motion wrapper at all.
  // This keeps long inventory tables cheap while retaining the same elements.
  if (reduceMotion || index >= maxAnimatedItems) {
    const Element = as;
    return <Element className={className}>{children}</Element>;
  }

  const delay = reduceMotion
    ? 0
    : index < maxAnimatedItems
      ? Math.min(index * 0.035, 0.24)
      : 0;

  const MotionComponent = motion[as] as any;

  return (
    <MotionComponent
      className={className}
      initial={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, y: 8 }
      }
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.22,
        delay,
        ease: motionEase,
      }}
    >
      {children}
    </MotionComponent>
  );
}
