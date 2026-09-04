import { CustomCategoryField, CustomFieldOption } from '@/types';

/**
 * System categories have fixed, specialized calculation engines (meters, boxes, pallets)
 * and cannot have their core structures deleted or converted to custom form builder.
 */
export const SYSTEM_CATEGORY_IDS = new Set([
  'tiles',
  'ceramics'
]);

export function isSystemCategory(categoryId?: string | null): boolean {
  if (!categoryId) return false;
  return SYSTEM_CATEGORY_IDS.has(categoryId);
}

/**
 * Robust unique ID generator for fields and options
 */
export const makeConfigId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
};

/**
 * Automatically builds an item name by combining the values of custom fields
 * that have `includeInItemName === true`, sorted by field order.
 */
export function buildNameFromCustomFields(
  fields: CustomCategoryField[],
  values: Record<string, string | number>
): string {
  const parts: string[] = [];

  [...fields]
    .sort(
      (a, b) =>
        (a.order ?? 0) -
        (b.order ?? 0)
    )
    .forEach(field => {
      if (!field.includeInItemName) {
        return;
      }

      const raw =
        field.type === 'fixed'
          ? (field.fixedValue || (field as any).value || '')
          : values[field.id];

      if (
        raw === undefined ||
        raw === null ||
        String(raw).trim() === ''
      ) {
        return;
      }

      let label =
        String(raw).trim();

      if (field.type === 'select') {
        const option =
          field.options?.find(
            (o: any) => o.value === raw || o.label === raw || o.name === raw
          );

        if (option) {
          label = typeof option === 'object' ? (option.label || (option as any).name || option.value) : option;
        }
      }

      if (
        field.suffix &&
        field.type !== 'fixed' &&
        !label.endsWith(field.suffix)
      ) {
        label = `${label} ${field.suffix}`;
      }

      parts.push(label);
    });

  return parts.join(' - ');
}

/**
 * Default custom fields configuration for the standard shower_box category
 */
export const DEFAULT_SHOWER_BOX_FIELDS: CustomCategoryField[] = [
  {
    id: 'shower_type',
    label: 'النوع',
    type: 'select',
    required: true,
    includeInItemName: true,
    order: 0,
    options: [
      {
        id: 'secret',
        label: 'قاطع سكريت',
        value: 'قاطع سكريت'
      },
      {
        id: 'sliding_door',
        label: 'باب سحاب',
        value: 'باب سحاب'
      },
      {
        id: 'fixed_panel',
        label: 'قاطع ثابت',
        value: 'قاطع ثابت'
      }
    ]
  },
  {
    id: 'size',
    label: 'القياس',
    type: 'select',
    required: true,
    suffix: 'سم',
    includeInItemName: true,
    order: 1,
    options: [
      { id: '100', label: '100', value: '100' },
      { id: '110', label: '110', value: '110' },
      { id: '120', label: '120', value: '120' },
      { id: '130', label: '130', value: '130' },
      { id: '140', label: '140', value: '140' },
      { id: '150', label: '150', value: '150' },
      { id: '160', label: '160', value: '160' },
      { id: '170', label: '170', value: '170' },
      { id: '180', label: '180', value: '180' },
      { id: '190', label: '190', value: '190' },
      { id: '200', label: '200', value: '200' },
      { id: '210', label: '210', value: '210' },
      { id: '220', label: '220', value: '220' }
    ]
  },
  {
    id: 'finish',
    label: 'اللون / التشطيب',
    type: 'select',
    required: true,
    includeInItemName: true,
    order: 2,
    options: [
      {
        id: 'black',
        label: 'أسود',
        value: 'أسود'
      },
      {
        id: 'black_pattern',
        label: 'أسود مخطط',
        value: 'أسود مخطط'
      },
      {
        id: 'white',
        label: 'أبيض',
        value: 'أبيض'
      }
    ]
  },
  {
    id: 'glass_thickness',
    label: 'سماكة الزجاج',
    type: 'fixed',
    fixedValue: '6 ملم',
    required: true,
    includeInItemName: false,
    order: 3
  }
];
