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

/**
 * Returns whether a custom field should currently be shown. Dependent fields
 * stay hidden until their parent has a value. Missing/legacy parent configs are
 * treated as active so old categories keep working unchanged.
 */
export function isCustomFieldActive(
  field: CustomCategoryField,
  fields: CustomCategoryField[],
  values: Record<string, string | number>,
  visiting: Set<string> = new Set(),
): boolean {
  if (!field.dependsOnFieldId) return true;

  if (visiting.has(field.id)) return true;
  visiting.add(field.id);

  const parent = fields.find(item => item.id === field.dependsOnFieldId);
  if (!parent) return true;

  if (!isCustomFieldActive(parent, fields, values, visiting)) return false;

  const parentValue = values[parent.id];
  return parentValue !== undefined && parentValue !== null && String(parentValue).trim() !== '';
}

/**
 * Filters a select field's options by the currently selected parent value.
 * Options without parentValue are treated as shared/global options.
 */
export function getAvailableCustomFieldOptions(
  field: CustomCategoryField,
  values: Record<string, string | number>,
): CustomFieldOption[] {
  const options = Array.isArray(field.options) ? field.options : [];
  if (!field.dependsOnFieldId) return options;

  const rawParentValue = values[field.dependsOnFieldId];
  if (rawParentValue === undefined || rawParentValue === null || String(rawParentValue).trim() === '') {
    return [];
  }

  const parentValue = String(rawParentValue);
  return options.filter(option => !option.parentValue || option.parentValue === parentValue);
}

/**
 * Clears stale dependent values after a parent changes. This also cascades to
 * grandchildren, so future sections can use more than one dependency level.
 */
export function sanitizeDependentCustomValues(
  fields: CustomCategoryField[],
  values: Record<string, string | number>,
): Record<string, string | number> {
  const next = { ...values };
  const ordered = [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (let pass = 0; pass < ordered.length; pass += 1) {
    let changed = false;

    for (const field of ordered) {
      if (!field.dependsOnFieldId) continue;

      if (!isCustomFieldActive(field, ordered, next)) {
        if (field.id in next) {
          delete next[field.id];
          changed = true;
        }
        continue;
      }

      if (field.type !== 'select') continue;

      const current = next[field.id];
      if (current === undefined || current === null || String(current).trim() === '') continue;

      const allowed = getAvailableCustomFieldOptions(field, next);
      const stillValid = allowed.some(option => option.value === String(current));

      if (!stillValid) {
        delete next[field.id];
        changed = true;
      }
    }

    if (!changed) break;
  }

  return next;
}

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
      if (!field.includeInItemName || !isCustomFieldActive(field, fields, values)) {
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
          getAvailableCustomFieldOptions(field, values).find(
            (o: any) => String(o.value) === String(raw) || String(o.label) === String(raw) || String(o.name || '') === String(raw)
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
