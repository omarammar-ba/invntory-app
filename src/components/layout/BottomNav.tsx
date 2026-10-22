import React, { type RefObject, useEffect, useRef, useState } from 'react';
import { House, Layers3, Plus, History, Search } from 'lucide-react';

export type BottomNavKey = 'home' | 'add' | 'inventory' | 'history' | 'search';
interface BottomNavProps {
  view: string;
  isAddingNew?: boolean;
  isSearching?: boolean;
  onHome: () => void;
  onAdd: () => void;
  onInventory: () => void;
  onSearch?: () => void;
  onHistory?: () => void;
  onLogs?: () => void;
  onMenu?: () => void;
  scrollContainerRef?: RefObject<HTMLElement | null>;
}

export default function BottomNav({ view, isAddingNew = false, isSearching = false, onHome, onAdd, onInventory, onSearch, onHistory, onLogs }: BottomNavProps) {
  const [compact, setCompact] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const scrollState = useRef({ lastY: 0, direction: 0, distance: 0 });
  useEffect(() => {
    scrollState.current.lastY = Math.max(0, window.scrollY);
    let frame = 0;
    let focusTimer = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const current = Math.min(maxScroll, Math.max(0, window.scrollY));
        const state = scrollState.current;
        const focused = document.activeElement;
        const typing = focused instanceof HTMLTextAreaElement || (focused instanceof HTMLInputElement && !['button', 'submit', 'radio', 'checkbox', 'file'].includes(focused.type));
        if (document.body.style.overflow === 'hidden' || typing) { state.lastY = current; state.direction = 0; state.distance = 0; frame = 0; return; }
        const delta = current - state.lastY;
        if (Math.abs(delta) >= 2) {
          const direction = Math.sign(delta);
          state.distance = direction === state.direction ? state.distance + Math.abs(delta) : Math.abs(delta);
          state.direction = direction;
          state.lastY = current;
          if (current < 50) { setCompact(false); state.distance = 0; }
          else if (direction > 0 && current > 140 && state.distance >= 36) { setCompact(true); state.distance = 0; }
          else if (direction < 0 && state.distance >= 28) { setCompact(false); state.distance = 0; }
        }
        frame = 0;
      });
    };
    const onFocus = () => {
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        const element = document.activeElement;
        const isTextInput = element instanceof HTMLTextAreaElement || (element instanceof HTMLInputElement && !['button', 'submit', 'radio', 'checkbox', 'file'].includes(element.type));
        setKeyboardOpen(window.matchMedia('(pointer: coarse)').matches && isTextInput);
      }, 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onFocus);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onFocus);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(focusTimer);
    };
  }, []);
  useEffect(() => { setCompact(false); scrollState.current = { lastY: Math.max(0, window.scrollY), direction: 0, distance: 0 }; }, [view, isAddingNew]);
  const active = isAddingNew ? 'add' : isSearching && view === 'dashboard' ? 'search'
    : view === 'dashboard' ? 'home' : view === 'inventory' ? 'inventory' : view === 'logs' ? 'history' : '';
  const links = [
    { key: 'home', label: 'الرئيسية', icon: House, action: onHome },
    { key: 'inventory', label: 'الأصناف', icon: Layers3, action: onInventory },
    { key: 'search', label: 'بحث', icon: Search, action: onSearch || onInventory },
    { key: 'history', label: 'الحركات', icon: History, action: onHistory || onLogs || (() => {}) },
    { key: 'add', label: 'إضافة', icon: Plus, action: onAdd },
  ];
  return <nav className={`atelier-nav${compact ? ' is-compact' : ''}${keyboardOpen ? ' is-keyboard-open' : ''}`} aria-label="التنقل الرئيسي" dir="rtl">
    <div className="atelier-nav-glass">
      {links.map(({ key, label, icon: Icon, action }) => <button key={key} type="button" onClick={action}
        className={`atelier-nav-link${key === 'search' ? ' atelier-nav-search' : ''}${active === key ? ' is-active' : ''}`}
        aria-label={key === 'add' ? 'إضافة صنف جديد' : key === 'search' ? 'البحث عن صنف' : label}
        aria-current={active === key && key !== 'add' && key !== 'search' ? 'page' : undefined}
        aria-pressed={key === 'search' ? active === key : undefined}>
        {active === key && key !== 'search' && <span className="atelier-nav-active" aria-hidden="true" />}
        <span className="atelier-nav-icon"><Icon size={25} strokeWidth={active === key ? 1.9 : 1.65} fill="none" /></span>
        <span className="atelier-nav-label">{label}</span>
      </button>)}
    </div>
  </nav>;
}
