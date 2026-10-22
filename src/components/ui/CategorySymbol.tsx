import React from 'react';
import { PackageOpen, PanelsTopLeft, ShowerHead, Toilet } from 'lucide-react';
import type { Category } from '@/types';

const themes = new Set(['sky', 'rose', 'emerald', 'amber', 'violet', 'indigo', 'fuchsia']);

export function categoryTone(category: Category): string {
  if (themes.has(category.themeColor)) return `category-tone-${category.themeColor}`;
  return category.id === 'ceramics' ? 'category-tone-rose'
    : category.id === 'tiles' ? 'category-tone-sky' : 'category-tone-indigo';
}

/** One vector language for the same department wherever it appears. */
export function CategorySymbol({ category, size = 30 }: { category: Category; size?: number }) {
  const porcelain = category.id === 'tiles' || category.template === 'porcelain';
  const ceramic = category.id === 'ceramics' || category.template === 'ceramic';
  if (porcelain) return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="8" y="3" width="12" height="15" rx="1.8" fill="currentColor" fillOpacity=".08" />
    <path d="M5 7H4.5A1.5 1.5 0 0 0 3 8.5v11A1.5 1.5 0 0 0 4.5 21h10a1.5 1.5 0 0 0 1.5-1.5V18" />
    <path d="m12 13 4-6" opacity=".55" />
  </svg>;
  if (ceramic) return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" fill="currentColor" fillOpacity=".08" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" fill="currentColor" fillOpacity=".08" />
  </svg>;
  if (/مجالي|مغاسل/.test(category.name)) return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12.5h18c-.8 5-3.8 7.5-9 7.5s-8.2-2.5-9-7.5Z" fill="currentColor" fillOpacity=".08" />
    <path d="M12 12.5v-7a2.5 2.5 0 0 1 5 0V7 M15.5 7H19 M12 20v2" />
  </svg>;
  if (category.iconType === 'mixer' || category.template === 'mixers') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 21h12 M8 21V11h4v10 M10 11V7h8a3 3 0 0 1 3 3v3 M7 3h6 M10 3v4 M19.5 16h3" />
  </svg>;
  const Icon = /مقاعد|كراسي|مرحاض/.test(category.name) || category.template === 'sanitary' ? Toilet
    : category.template === 'shower_box' ? PanelsTopLeft
    : category.iconType === 'shower' ? ShowerHead : PackageOpen;
  return <Icon size={size} strokeWidth={1.65} aria-hidden="true" />;
}
