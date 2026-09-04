export const toAuditDate = (value: unknown): Date | null => {
  if (!value) return null;

  try {
    if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof (value as { toDate?: unknown }).toDate === 'function'
    ) {
      const date = (value as { toDate: () => Date }).toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      'seconds' in value &&
      typeof (value as { seconds?: unknown }).seconds === 'number'
    ) {
      const date = new Date((value as { seconds: number }).seconds * 1000);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = value instanceof Date ? value : new Date(value as string | number);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
};

export const formatAuditDate = (value: unknown): string => {
  const date = toAuditDate(value);

  if (!date) {
    return 'غير معروف';
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};
