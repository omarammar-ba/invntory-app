export const motionEase = [0.22, 1, 0.36, 1] as const;

export const motionTransition = {
  micro: {
    duration: 0.14,
    ease: 'easeOut',
  },
  fast: {
    duration: 0.18,
    ease: motionEase,
  },
  normal: {
    duration: 0.24,
    ease: motionEase,
  },
  page: {
    duration: 0.28,
    ease: motionEase,
  },
};

export const springTransition = {
  type: 'spring',
  stiffness: 420,
  damping: 36,
  mass: 0.75,
} as const;

export const CATEGORY_ACCENTS: Record<string, { light: string; dark: string }> = {
  sky: { light: '#0EA5E9', dark: '#38BDF8' },
  violet: { light: '#8B5CF6', dark: '#A78BFA' },
  emerald: { light: '#10B981', dark: '#34D399' },
  teal: { light: '#14B8A6', dark: '#2DD4BF' },
  amber: { light: '#F59E0B', dark: '#FBBF24' },
  rose: { light: '#F43F5E', dark: '#FB7185' },
  indigo: { light: '#6366F1', dark: '#818CF8' },
};
