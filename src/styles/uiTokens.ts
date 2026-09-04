// Design Tokens for UI/UX Consistency
export const ui = {
  page: 'px-3 sm:px-4',
  surface: 'bg-white dark:bg-neutral-900 border border-slate-200/70 dark:border-white/[0.07]',
  card: 'bg-white dark:bg-neutral-900 border border-slate-200/70 dark:border-white/[0.07] rounded-[18px] shadow-sm',
  softCard: 'bg-slate-50/80 dark:bg-neutral-800/70 border border-slate-200/50 dark:border-white/[0.05] rounded-[14px]',
  input: 'h-11 rounded-[14px] bg-white dark:bg-neutral-900 border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white px-3.5 text-xs sm:text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400',
  primaryButton: 'h-10 px-4 rounded-[13px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm transition-all duration-150 active:scale-[0.97] shadow-xs cursor-pointer flex items-center justify-center gap-1.5',
  secondaryButton: 'h-10 px-4 rounded-[13px] bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm transition-all duration-150 active:scale-[0.97] border border-slate-200/60 dark:border-white/[0.06] cursor-pointer flex items-center justify-center gap-1.5',
  dangerButton: 'h-10 px-4 rounded-[13px] bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 font-bold text-xs sm:text-sm transition-all duration-150 active:scale-[0.97] border border-rose-200/50 dark:border-rose-800/30 cursor-pointer flex items-center justify-center gap-1.5',
  iconBox: 'w-9 h-9 rounded-[12px] flex items-center justify-center flex-shrink-0',
  sectionTitle: 'text-base sm:text-lg font-bold text-slate-900 dark:text-white',
  cardTitle: 'text-xs sm:text-sm font-bold text-slate-900 dark:text-white',
  secondaryText: 'text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500',
  metadata: 'text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500'
} as const;

export const CATEGORY_THEME_STYLES: Record<string, string> = {
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
  indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400',
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  slate: 'bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-slate-300'
};
