import { Tile } from '@/types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validateTileInput = (data: Partial<Tile>): ValidationResult => {
  const errors: string[] = [];

  if (!data.name || !data.name.trim()) {
    errors.push('اسم الصنف مطلوب.');
  }

  if (data.meters !== undefined && (isNaN(Number(data.meters)) || Number(data.meters) < 0)) {
    errors.push('الكمية يجب أن تكون رقماً موجباً.');
  }

  if (data.boxes !== undefined && (isNaN(Number(data.boxes)) || Number(data.boxes) < 0)) {
    errors.push('عدد الكراتين يجب أن يكون رقماً موجباً.');
  }

  if (data.pallets !== undefined && (isNaN(Number(data.pallets)) || Number(data.pallets) < 0)) {
    errors.push('عدد الطبليات يجب أن يكون رقماً موجباً.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Sanitizes input text from QR/Barcode or user input to prevent injection or corruption
 */
export const sanitizeSearchInput = (input: string): string => {
  if (!input) return '';
  return input.trim().replace(/[<>]/g, '');
};
