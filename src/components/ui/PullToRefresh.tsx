import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  threshold?: number;
}

// Exact Instagram / iOS Asterisk Spinner with 8 radial spokes
const InstagramSpinner: React.FC<{ progress: number; isRefreshing: boolean }> = ({
  progress,
  isRefreshing,
}) => {
  const spokesCount = 8;

  return (
    <div
      className={`relative w-7 h-7 flex items-center justify-center ${
        isRefreshing ? 'animate-spin' : ''
      }`}
      style={{
        animationDuration: '0.85s',
        animationTimingFunction: 'linear',
      }}
    >
      {Array.from({ length: spokesCount }).map((_, i) => {
        const angle = i * (360 / spokesCount);
        // During dragging, spokes illuminate sequentially as user pulls down
        const thresholdPerSpoke = (i + 1) / spokesCount;
        let spokeOpacity = 0.15;

        if (isRefreshing) {
          // Classic iOS stepped fading gradient around circle
          spokeOpacity = 0.2 + ((i + 1) / spokesCount) * 0.8;
        } else if (progress >= thresholdPerSpoke) {
          spokeOpacity = 0.35 + ((i + 1) / spokesCount) * 0.65;
        } else if (progress > (i / spokesCount)) {
          spokeOpacity = 0.25;
        }

        return (
          <span
            key={i}
            className="absolute w-[2.2px] h-[6px] rounded-full bg-slate-600 dark:bg-slate-300 pointer-events-none"
            style={{
              transform: `rotate(${angle}deg) translate(0, -9.5px)`,
              opacity: spokeOpacity,
              transition: isRefreshing ? 'none' : 'opacity 0.12s ease-out',
            }}
          />
        );
      })}
    </div>
  );
};

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false,
  className = '',
  threshold = 65,
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  // Elastic damping curve (authentic iOS bounce)
  const calculateDistance = (dy: number) => {
    if (dy <= 0) return 0;
    return Math.min(Math.pow(dy, 0.76) * 1.65, 80);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;

    const scrollTop =
      window.scrollY ||
      document.documentElement.scrollTop ||
      containerRef.current?.scrollTop ||
      0;

    if (scrollTop <= 2) {
      startYRef.current = e.touches[0].clientY;
      isDraggingRef.current = true;
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current || disabled || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const dy = currentY - startYRef.current;
    const scrollTop =
      window.scrollY ||
      document.documentElement.scrollTop ||
      containerRef.current?.scrollTop ||
      0;

    if (dy > 0 && scrollTop <= 2) {
      const dist = calculateDistance(dy);
      setPullDistance(dist);

      if (e.cancelable && dist > 10) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
    }
  }, [disabled, isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDraggingRef.current || disabled || isRefreshing) {
      isDraggingRef.current = false;
      return;
    }
    isDraggingRef.current = false;

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      if (navigator.vibrate) {
        try {
          navigator.vibrate(12);
        } catch {
          // ignore
        }
      }

      setPullDistance(48);

      try {
        await Promise.resolve(onRefresh());
        // Natural brief resting period like Instagram
        await new Promise((r) => setTimeout(r, 450));
      } catch (err) {
        console.error('Refresh error:', err);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [disabled, isRefreshing, onRefresh, pullDistance, threshold]);

  const progress = Math.min(pullDistance / threshold, 1);
  const isVisible = pullDistance > 6 || isRefreshing;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative min-h-full ${className}`}
    >
      {/* Instagram-Style Pure Spinner (No container, no border, no card) */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{
              opacity: isRefreshing ? 1 : Math.max(0.2, progress),
              scale: isRefreshing ? 1 : Math.max(0.8, Math.min(progress * 1.05, 1)),
              y: isRefreshing ? 14 : Math.min(pullDistance * 0.45, 26),
            }}
            exit={{
              opacity: 0,
              scale: 0.75,
              y: -8,
              transition: { duration: 0.2, ease: 'easeOut' },
            }}
            transition={{
              type: 'spring',
              stiffness: 420,
              damping: 30,
            }}
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-40 flex items-center justify-center pt-2"
          >
            <InstagramSpinner progress={progress} isRefreshing={isRefreshing} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keep the page fixed; refresh feedback floats above it instead of moving layout. */}
      <div className="w-full">
        {children}
      </div>
    </div>
  );
};
