import type { Category, LogEntry, Tile } from '@/types';

export interface HomeSearchFilters {
  categoryId: string;
  size: string;
  quality: string;
  surface: string;
}

export const EMPTY_HOME_FILTERS: HomeSearchFilters = {
  categoryId: '', size: '', quality: '', surface: '',
};

export function normalizeSearch(value: unknown): string {
  return String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي')
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/\s+/g, ' ').trim();
}

// Only the two main tile departments have priority. All other departments
// retain their configured order, independent of quantities and activity.
export function orderHomeCategories(categories: readonly Category[]): Category[] {
  const priority = (category: Category) => {
    if (category.id === 'tiles' || category.template === 'porcelain') return 0;
    if (category.id === 'ceramics' || category.template === 'ceramic') return 1;
    const name = normalizeSearch(category.name);
    return /بورسلان|بورسيلان/.test(name) ? 0 : /سيراميك/.test(name) ? 1 : 2;
  };
  return categories.map((category, index) => ({ category, index }))
    .sort((a, b) => priority(a.category) - priority(b.category) || a.index - b.index)
    .map(entry => entry.category);
}

export const normalizeSize = (value: string) => normalizeSearch(value)
  .replace(/[×x*✕]/g, 'x').replace(/\s/g, '');

export const activeFilterCount = (filters: HomeSearchFilters) =>
  Object.values(filters).filter(Boolean).length;

function homeSearchText(tile: Tile): string {
  return normalizeSearch([
    tile.name, tile.shade, tile.quality, tile.size, tile.surface, tile.itemType,
    tile.color, tile.brand, tile.materialOrGlass, tile.notes,
    ...Object.values(tile.customValues || {}),
    ...(tile.customFieldSnapshot || []).map(field => `${field.label} ${field.value} ${field.suffix || ''}`),
  ].join(' '));
}

// Build once when inventory changes, rather than normalizing every item's
// Arabic text and custom fields again for every keystroke. Original order stays.
export function createHomeSearchIndex(items: readonly Tile[]) {
  return items.map(tile => {
    const text = homeSearchText(tile);
    return { tile, text, compactText: normalizeSize(text), size: normalizeSize(tile.size || ''),
      quality: normalizeSearch(tile.quality), surface: normalizeSearch(tile.surface) };
  });
}

export function searchHomeIndex(index: ReturnType<typeof createHomeSearchIndex>, query: string, filters: HomeSearchFilters): Tile[] {
  const terms = normalizeSearch(query).split(' ').filter(Boolean).map(text => ({ text, compact: normalizeSize(text) }));
  const size = normalizeSize(filters.size), quality = normalizeSearch(filters.quality), surface = normalizeSearch(filters.surface);
  return index.filter(entry => (!filters.categoryId || entry.tile.categoryId === filters.categoryId)
    && (!filters.size || entry.size === size) && (!filters.quality || entry.quality === quality)
    && (!filters.surface || entry.surface === surface)
    && terms.every(term => entry.text.includes(term.text) || entry.compactText.includes(term.compact)))
    .map(entry => entry.tile);
}

export function matchesHomeSearch(tile: Tile, query: string, filters: HomeSearchFilters): boolean {
  if (filters.categoryId && tile.categoryId !== filters.categoryId) return false;
  if (filters.size && normalizeSize(tile.size || '') !== normalizeSize(filters.size)) return false;
  if (filters.quality && normalizeSearch(tile.quality) !== normalizeSearch(filters.quality)) return false;
  if (filters.surface && normalizeSearch(tile.surface) !== normalizeSearch(filters.surface)) return false;

  const terms = normalizeSearch(query).split(' ').filter(Boolean);
  if (!terms.length) return true;
  const text = homeSearchText(tile);
  return terms.every(term => text.includes(term) || normalizeSize(text).includes(normalizeSize(term)));
}

export function getLogDate(timestamp: LogEntry['timestamp']): Date | null {
  if (timestamp === null || timestamp === undefined || timestamp === '') return null;
  try {
    const date = typeof timestamp.toDate === 'function' ? timestamp.toDate()
      : typeof timestamp.seconds === 'number' ? new Date(timestamp.seconds * 1000)
      : new Date(timestamp);
    return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
  } catch { return null; }
}

// Parse only the app's explicit quantity-change message. Keep all other audit
// text intact: a reservation amount or a date is not a before/after quantity.
export function getQuantityChange(details: string): { before: string; after: string } | null {
  const text = normalizeSearch(details);
  const match = text.match(/الكمي[ةه]\s*:\s*(-?\d+(?:\.\d+)?)\s*(?:->|→)\s*(-?\d+(?:\.\d+)?)/);
  return match ? { before: match[1], after: match[2] } : null;
}

export function relativeLogTime(date: Date | null, now: number): string {
  if (!date) return 'وقت غير محدد';
  const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (seconds < 60) return 'الآن';
  if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} د`;
  if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} س`;
  if (seconds < 604800) return `منذ ${Math.floor(seconds / 86400)} أيام`;
  return date.toLocaleDateString('ar-JO', { day: 'numeric', month: 'short' });
}

export function getLogTone(action: string): 'blue' | 'rose' | 'teal' | 'amber' {
  // Removing a reservation must not look like permanently deleting an item.
  if (/حجز/.test(action)) return 'amber';
  if (/حذف/.test(action)) return 'rose';
  if (/إضافة|اضافة|إنشاء/.test(action)) return 'teal';
  return 'blue';
}
