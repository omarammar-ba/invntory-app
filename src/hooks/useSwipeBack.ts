import { useEffect, useLayoutEffect, useRef } from 'react';

const INTERACTIVE = [
  'button', 'a', 'input', 'select', 'textarea', 'label', 'summary', '[contenteditable]',
  '[role="button"]', '[role="slider"]', '.atelier-stock-row', '.atelier-sidebar',
  '.atelier-menu-backdrop', '.atelier-nav', '.stock-departments', '.home-categories-rail',
].join(',');

const OVERLAY = 'dialog[open], [aria-modal="true"], .atelier-sidebar.is-open';

function isHomeScreenIPhone() {
  return /iPhone/i.test(navigator.userAgent) &&
    ((navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches);
}

export function useSwipeBack(onBack: (() => void) | undefined) {
  const callback = useRef(onBack);
  const enabled = Boolean(onBack);

  useLayoutEffect(() => {
    callback.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!enabled || !isHomeScreenIPhone()) return;

    let start: { id: number; x: number; y: number; time: number } | undefined;
    const cancel = () => { start = undefined; };

    const begin = (event: TouchEvent) => {
      cancel();
      const target = event.target;
      if (event.touches.length !== 1 || !(target instanceof Element) ||
        !target.closest('.atelier-app') || target.closest(INTERACTIVE) ||
        document.querySelector(OVERLAY)) return;

      const finger = event.touches[0];
      if (finger.clientX < window.innerWidth / 3) return;
      start = { id: finger.identifier, x: finger.clientX, y: finger.clientY, time: event.timeStamp };
    };

    const move = (event: TouchEvent) => {
      if (!start) return;
      const finger = event.touches[0];
      if (event.touches.length !== 1 || finger.identifier !== start.id) {
        cancel();
        return;
      }
      const left = start.x - finger.clientX;
      const vertical = Math.abs(start.y - finger.clientY);
      if (left < -20 || (vertical > 26 && vertical > Math.abs(left) * 0.6)) cancel();
    };

    const finish = (event: TouchEvent) => {
      const origin = start;
      cancel();
      if (!origin || event.touches.length || document.querySelector(OVERLAY)) return;
      const finger = Array.from(event.changedTouches).find(touch => touch.identifier === origin.id);
      if (!finger) return;
      const left = origin.x - finger.clientX;
      const vertical = Math.abs(origin.y - finger.clientY);
      if (left >= 72 && vertical <= 42 && left >= vertical * 1.75 && event.timeStamp - origin.time <= 850) {
        callback.current?.();
      }
    };

    document.addEventListener('touchstart', begin, { passive: true });
    document.addEventListener('touchmove', move, { passive: true });
    document.addEventListener('touchend', finish, { passive: true });
    document.addEventListener('touchcancel', cancel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', begin);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', finish);
      document.removeEventListener('touchcancel', cancel);
    };
  }, [enabled]);
}
