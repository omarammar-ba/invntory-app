import { useEffect, useRef, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';

interface ElasticScrollProps {
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

const MAX_STRETCH = 28;

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
  const interactionDisabled = useRef(disabled || !!reduceMotion);
  interactionDisabled.current = disabled || !!reduceMotion;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let startX = 0;
    let startY = 0;
    let startedAtTop = false;
    let startedAtBottom = false;
    let edgeStartY: number | null = null;
    let edgeSide: 'top' | 'bottom' | null = null;
    let active = false;
    let spring: ReturnType<typeof animate> | undefined;

    const settle = () => {
      if (!active && stretch.get() === 0) return;
      active = false;
      edgeStartY = null;
      edgeSide = null;
      spring?.stop();
      spring = animate(stretch, 0, {
        type: 'spring',
        stiffness: 360,
        damping: 34,
        mass: 0.8,
      });
    };

    const onStart = (event: TouchEvent) => {
      if (interactionDisabled.current || event.touches.length !== 1) return;
      if (hasNestedScroller(event.target, container)) return;
      if (
        event.target instanceof Element &&
        event.target.closest('input, textarea, select, [contenteditable="true"], [data-no-elastic]')
      ) return;

      const edges = pageEdges();
      if (edges.atTop || edges.atBottom) spring?.stop();
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      startedAtTop = edges.atTop;
      startedAtBottom = edges.atBottom;
      edgeStartY = null;
      edgeSide = null;
      active = true;
    };

    const onMove = (event: TouchEvent) => {
      if (!active || event.touches.length !== 1) return;
      if (interactionDisabled.current) { settle(); return; }

      const dx = event.touches[0].clientX - startX;
      const dy = event.touches[0].clientY - startY;
      if (Math.abs(dy) < 5 || Math.abs(dy) <= Math.abs(dx) * 1.15) return;

      const edges = pageEdges();
      const stretchingTop = dy > 0 && edges.atTop;
      const stretchingBottom = dy < 0 && edges.atBottom;

      if (!stretchingTop && !stretchingBottom) {
        if (stretch.get() !== 0) settle();
        return;
      }

      const nextSide = stretchingTop ? 'top' : 'bottom';
      if (edgeSide !== nextSide) {
        edgeSide = nextSide;
        edgeStartY = ((nextSide === 'top' && startedAtTop) ||
          (nextSide === 'bottom' && startedAtBottom))
          ? startY
          : event.touches[0].clientY;
      }

      const pull = event.touches[0].clientY - (edgeStartY ?? startY);
      if ((stretchingTop && pull <= 0) || (stretchingBottom && pull >= 0)) {
        if (stretch.get() !== 0) settle();
        return;
      }
      if (Math.abs(pull) < 5) return;
      if (event.cancelable) event.preventDefault();
      const distance = MAX_STRETCH * (1 - Math.exp(-Math.abs(pull) / 72));
      stretch.set(Math.sign(pull) * distance);
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
  }, [stretch]);

  useEffect(() => {
    if (disabled || reduceMotion) {
      const settle = animate(stretch, 0, { duration: 0.18, ease: 'easeOut' });
      return () => settle.stop();
    }
  }, [disabled, reduceMotion, stretch]);

  return (
    <div ref={containerRef} className={`relative min-h-full ${className}`}>
      <motion.div style={{ y: stretch }} className="w-full">
        {children}
      </motion.div>
    </div>
  );
}
