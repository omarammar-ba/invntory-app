import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const shownThisSession = new Set<string>();
interface Target { x: number; y: number; width: number; height: number; radius: number; messageTop: number; messageLeft: number; messageWidth: number; messageMaxHeight: number; above: boolean; }

/** A dismissible first-use spotlight. It never submits a search or opens the keyboard. */
export default function SearchCoachmark({ searchRef, active, userId = 'local' }: {
  searchRef: React.RefObject<HTMLInputElement>; active: boolean; userId?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  const pending = useRef(false);
  const key = `inventory-search-spotlight-v2:${userId}`;
  const id = useId().replace(/:/g, '');
  const remember = useCallback(() => {
    shownThisSession.add(key);
    try { localStorage.setItem(key, 'seen'); } catch { /* Session fallback remains available. */ }
  }, [key]);
  const dismiss = useCallback(() => {
    pending.current = false; window.clearTimeout(timer.current); remember(); setVisible(false);
  }, [remember]);

  useEffect(() => {
    setVisible(false); setTarget(null);
    let seen = shownThisSession.has(key);
    try { seen ||= localStorage.getItem(key) === 'seen'; } catch { /* Restricted storage. */ }
    const input = searchRef.current;
    if (input === document.activeElement) { remember(); seen = true; }
    pending.current = !seen;
    const reveal = () => {
      if (document.hidden || !pending.current || document.body.style.overflow === 'hidden' || document.querySelector('dialog[open], [aria-modal="true"]')) return;
      const field = input?.closest('.home-search-glass');
      const rect = field?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.top < 0 || rect.bottom > window.innerHeight) return;
      pending.current = false; remember(); setVisible(true);
    };
    if (!seen) timer.current = window.setTimeout(reveal, 700);
    input?.addEventListener('focus', dismiss);
    document.addEventListener('visibilitychange', reveal);
    window.addEventListener('scroll', reveal, { passive: true });
    return () => {
      pending.current = false; window.clearTimeout(timer.current);
      input?.removeEventListener('focus', dismiss);
      document.removeEventListener('visibilitychange', reveal); window.removeEventListener('scroll', reveal);
    };
  }, [key, searchRef, remember, dismiss]);
  useEffect(() => { if (active) dismiss(); }, [active, dismiss]);

  useLayoutEffect(() => {
    if (!visible) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal(); dialog.focus({ preventScroll: true });
    const measure = () => {
      const field = searchRef.current?.closest('.home-search-glass');
      if (!field) return;
      const rect = field.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 40);
      const height = window.visualViewport?.height || window.innerHeight;
      const messageHeight = messageRef.current?.scrollHeight || 150;
      const below = height - rect.bottom - 28;
      const above = below < messageHeight && rect.top - 28 >= messageHeight;
      const space = Math.max(64, above ? rect.top - 28 : below);
      setTarget({ x: rect.left - 5, y: rect.top - 5, width: rect.width + 10, height: rect.height + 10,
        radius: parseFloat(getComputedStyle(field).borderRadius) + 5,
        messageTop: above ? rect.top - Math.min(space, messageHeight) - 23 : rect.bottom + 23,
        messageLeft: Math.max(20, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 20)),
        messageWidth: width, messageMaxHeight: space, above });
    };
    measure();
    window.addEventListener('resize', measure); window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('resize', measure);
      dialog.close(); document.body.style.overflow = previousOverflow;
    };
  }, [visible, searchRef]);

  if (!visible) return null;
  return createPortal(<dialog ref={dialogRef} className="search-spotlight" tabIndex={-1} aria-labelledby={`${id}-title`} aria-describedby={`${id}-copy`}
    onCancel={event => { event.preventDefault(); dismiss(); }} onClick={dismiss} dir="rtl">
    {target && <>
      <svg className="search-spotlight-mask" width="100%" height="100%" aria-hidden="true">
        <defs><mask id={`${id}-mask`}><rect width="100%" height="100%" fill="white" /><rect x={target.x} y={target.y} width={target.width} height={target.height} rx={target.radius} fill="black" /></mask></defs>
        <rect className="search-spotlight-shade" width="100%" height="100%" mask={`url(#${id}-mask)`} />
      </svg>
      <div className="search-spotlight-ring" aria-hidden="true" style={{ left: target.x, top: target.y, width: target.width, height: target.height, borderRadius: target.radius }} />
    </>}
    <div ref={messageRef} className={`search-spotlight-message${target?.above ? ' is-above' : ''}`} style={{ visibility: target ? 'visible' : 'hidden', top: target?.messageTop, left: target?.messageLeft, width: target?.messageWidth || 300, maxHeight: target?.messageMaxHeight }}>
      <h2 id={`${id}-title`}>يمكنك البحث هنا</h2>
      <p id={`${id}-copy`}>ابحث عن أي صنف بالاسم، الرقم، الكود أو المقاس.</p>
      <button type="button">المس أي مكان للمتابعة</button>
    </div>
  </dialog>, document.body);
}
