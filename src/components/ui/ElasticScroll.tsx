import { useEffect, useRef, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';

interface ElasticScrollProps {
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

const MAX_STRETCH = 54;

function hasNestedScroller(target: EventTarget | null, boundary: HTMLElement): boolean {
  let element = target instanceof Element ? target : null;

  while (element && element !== boundary) {
    if (element instanceof HTMLElement) {
      const overflowY = window.getComputedStyle(element).overflowY;
      if (
        (overflowY === 'auto' || overflowY === 'scroll') &&
        element.scrollHeight > element.clientHeight + 2
      ) {
        return true;
      }
    }
    element = element.parentElement;
  }

  return false;
}

function pageEdges() {
  const root = document.scrollingElement ?? document.documentElement;
  const top = window.scrollY || root.scrollTop;
  const bottom = root.scrollHeight - top - window.innerHeight;
  return { atTop: top <= 2, atBottom: bottom <= 2 };
}

export function ElasticScroll({ children, disabled = false, className = '' }: ElasticScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stretch = useMotionValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let startX = 0;
    let startY = 0;
    let canStretchTop = false;
    let canStretchBottom = false;
    let active = false;
    let spring: ReturnType<typeof animate> | undefined;

    const settle = () => {
      if (!active && stretch.get() === 0) return;
      active = false;
      canStretchTop = false;
      canStretchBottom = false;
      spring?.stop();
      spring = animate(stretch, 0, {
        type: 'spring',
        stiffness: 420,
        damping: 32,
        mass: 0.75,
      });
    };

    const onStart = (event: TouchEvent) => {
      if (disabled || reduceMotion || event.touches.length !== 1) return;
      if (hasNestedScroller(event.target, container)) return;
      if (
        event.target instanceof Element &&
        event.target.closest('input, textarea, select, [contenteditable="true"], [data-no-elastic]')
      ) return;

      const edges = pageEdges();
      if (!edges.atTop && !edges.atBottom) return;

      spring?.stop();
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      canStretchTop = edges.atTop;
      canStretchBottom = edges.atBottom;
      active = true;
    };

    const onMove = (event: TouchEvent) => {
      if (!active || event.touches.length !== 1) return;

      const dx = event.touches[0].clientX - startX;
      const dy = event.touches[0].clientY - startY;
      if (Math.abs(dy) < 5 || Math.abs(dy) <= Math.abs(dx) * 1.15) return;

      const edges = pageEdges();
      const stretchingTop = dy > 0 && canStretchTop && edges.atTop;
      const stretchingBottom = dy < 0 && canStretchBottom && edges.atBottom;

      if (!stretchingTop && !stretchingBottom) {
        if (stretch.get() !== 0) settle();
        return;
      }

      if (event.cancelable) event.preventDefault();
      const distance = Math.min(MAX_STRETCH, Math.pow(Math.abs(dy), 0.78) * 1.25);
      stretch.set(Math.sign(dy) * distance);
    };

    container.addEventListener('touchstart', onStart, { passive: true });
    container.addEventListener('touchmove', onMove, { passive: false });
    container.addEventListener('touchend', settle, { passive: true });
    container.addEventListener('touchcancel', settle, { passive: true });

    return () => {
      container.removeEventListener('touchstart', onStart);
      container.removeEventListener('touchmove', onMove);
      container.removeEventListener('touchend', settle);
      container.removeEventListener('touchcancel', settle);
      spring?.stop();
      stretch.set(0);
    };
  }, [disabled, reduceMotion, stretch]);

  return (
    <div ref={containerRef} className={`relative min-h-full ${className}`}>
      <motion.div style={{ y: stretch }} className="w-full">
        {children}
      </motion.div>
    </div>
  );
}
