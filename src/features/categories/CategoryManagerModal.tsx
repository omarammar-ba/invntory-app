import { AnimatePresence, motion } from 'motion/react';
import React, { useState } from 'react';

import {
  Category,
  UnitType,
  CategoryTheme,
  CustomCategoryField,
  CustomFieldType,
  CustomFieldOption,
  CategoryFieldConfig,
} from '@/types';

import {
  CancelIcon,
  PlusIcon,
  DeleteIcon,
  EditIcon,
} from '@/components/ui/Icons';

import {
  isSystemCategory,
  makeConfigId,
} from './customFields';

import { db } from '@/services/firebase';

import {
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Plus,
  Check,
  Type,
  Hash,
  ListFilter,
  Lock,
  AlertCircle,
  Pencil,
  Trash2,
} from 'lucide-react';

import {
  ResponsiveOverlay,
} from '@/components/ui/ResponsiveOverlay';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  initialEditingCategoryId?: string | null;
  initialEditId?: string | null;

  onSaveCategory?: (
    category: Category,
  ) => void;

  onDeleteCategory?: (
    categoryId: string,
  ) => void | Promise<void>;

  canManageVisibility?: boolean;
}

const THEME_COLORS: {
  id: CategoryTheme;
  name: string;
  bg: string;
  text: string;
  ring: string;
}[] = [
  {
    id: 'sky',
    name: 'رمادي فحم',
    bg: 'bg-slate-700',
    text: 'text-slate-600',
    ring: 'ring-slate-300',
  },
  {
    id: 'emerald',
    name: 'زمردي',
    bg: 'bg-emerald-500',
    text: 'text-emerald-600',
    ring: 'ring-emerald-200',
  },
  {
    id: 'amber',
    name: 'ذهبي / برتقالي',
    bg: 'bg-amber-500',
    text: 'text-amber-600',
    ring: 'ring-amber-200',
  },
  {
    id: 'rose',
    name: 'وردي / ياقوتي',
    bg: 'bg-rose-500',
    text: 'text-rose-600',
    ring: 'ring-rose-200',
  },
  {
    id: 'violet',
    name: 'بنفسجي',
    bg: 'bg-violet-500',
    text: 'text-violet-600',
    ring: 'ring-violet-200',
  },
  {
    id: 'indigo',
    name: 'أسود دافئ',
    bg: 'bg-neutral-800',
    text: 'text-neutral-700',
    ring: 'ring-neutral-400',
  },
  {
    id: 'fuchsia',
    name: 'فوشيا',
    bg: 'bg-fuchsia-500',
    text: 'text-fuchsia-600',
    ring: 'ring-fuchsia-200',
  },
];

type EditableFieldFlags = Pick<
  CategoryFieldConfig,
  | 'hasImage'
  | 'hasSize'
  | 'hasItemType'
  | 'hasMaterial'
  | 'hasColor'
  | 'hasBrand'
>;

const buildFieldsConfig = (
  category: Category | undefined,
  flags: EditableFieldFlags,
  systemCategory: boolean,
): CategoryFieldConfig => ({
  hasImage: flags.hasImage,

  hasSize: systemCategory
    ? flags.hasSize
    : category?.fieldsConfig?.hasSize ?? false,

  hasItemType: systemCategory
    ? flags.hasItemType
    : category?.fieldsConfig?.hasItemType ?? false,

  hasMaterial: systemCategory
    ? flags.hasMaterial
    : category?.fieldsConfig?.hasMaterial ?? false,

  hasColor: systemCategory
    ? flags.hasColor
    : category?.fieldsConfig?.hasColor ?? false,

  hasBrand: systemCategory
    ? flags.hasBrand
    : category?.fieldsConfig?.hasBrand ?? false,

  // حساب الكراتين والطبليات جزء من محرك البورسلان/السيراميك
  // ولا يتم تعطيله من التخصيص.
  hasBoxCalc: systemCategory
    ? true
    : category?.fieldsConfig?.hasBoxCalc ?? false,
});

const FIELD_TYPES: {
  id: CustomFieldType;
  label: string;
  desc: string;
  icon: React.ElementType;
}[] = [
  {
    id: 'text',
    label: 'نص',
    desc: 'إدخال نص حر أو كتابة يدوية',
    icon: Type,
  },
  {
    id: 'number',
    label: 'رقم',
    desc: 'إدخال أرقام وقياسات',
    icon: Hash,
  },
  {
    id: 'select',
    label: 'قائمة خيارات',
    desc: 'اختيار من خيارات محددة مسبقاً',
    icon: ListFilter,
  },
  {
    id: 'fixed',
    label: 'قيمة ثابتة',
    desc: 'قيمة غير قابلة للتعديل عند الإضافة',
    icon: Lock,
  },
];


const EMPTY_CUSTOM_FIELD_OPTIONS: CustomFieldOption[] = [];

const splitSimpleOptions = (value: string): string[] => {
  const seen = new Set<string>();

  return value
    .split(/[،,;\n]+/)
    .map(item => item.trim())
    .filter(item => {
      if (!item) return false;
      const key = item.toLocaleLowerCase('ar');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const makeSimpleOptions = (
  parentOptions: CustomFieldOption[],
  drafts: Record<string, string>,
): CustomFieldOption[] =>
  parentOptions.flatMap(parentOption =>
    splitSimpleOptions(drafts[parentOption.value] || '').map(label => ({
      id: makeConfigId('opt'),
      label,
      value: label,
      parentValue: parentOption.value,
    })),
  );

const CategoryManagerModal:
  React.FC<CategoryManagerModalProps> = ({
    isOpen,
    onClose,
    categories,
    initialEditingCategoryId,
    initialEditId,
    onSaveCategory,
    onDeleteCategory,
    canManageVisibility = true,
  }) => {
    const targetId =
      initialEditingCategoryId ||
      initialEditId ||
      null;

    const [
      editingCatId,
      setEditingCatId,
    ] = useState<string | null>(
      targetId,
    );

    const [
      isAddingNew,
      setIsAddingNew,
    ] = useState(false);

    const [
      newCatName,
      setNewCatName,
    ] = useState('');

    const [
      itemNameLabel,
      setItemNameLabel,
    ] = useState('');

    const [
      selectedColor,
      setSelectedColor,
    ] = useState<CategoryTheme>(
      'emerald',
    );

    const [
      selectedUnit,
      setSelectedUnit,
    ] = useState<UnitType>(
      'pieces',
    );

    const [
      hiddenForStaff,
      setHiddenForStaff,
    ] = useState(false);

    const [
      hasImage,
      setHasImage,
    ] = useState(true);

    const [
      hasSize,
      setHasSize,
    ] = useState(true);

    const [
      hasItemType,
      setHasItemType,
    ] = useState(false);

    const [
      hasMaterial,
      setHasMaterial,
    ] = useState(false);

    const [
      hasColor,
      setHasColor,
    ] = useState(false);

    const [
      hasBrand,
      setHasBrand,
    ] = useState(false);

    const [
      customFields,
      setCustomFields,
    ] = useState<
      CustomCategoryField[]
    >([]);

    const [
      isEditingField,
      setIsEditingField,
    ] = useState(false);

    const [
      editingFieldId,
      setEditingFieldId,
    ] = useState<
      string | null
    >(null);

    const [
      fieldLabel,
      setFieldLabel,
    ] = useState('');

    const [
      fieldType,
      setFieldType,
    ] = useState<
      CustomFieldType
    >('select');

    const [
      fieldRequired,
      setFieldRequired,
    ] = useState(true);

    const [
      fieldSuffix,
      setFieldSuffix,
    ] = useState('');

    const [
      fieldPlaceholder,
      setFieldPlaceholder,
    ] = useState('');

    const [
      fieldFixedValue,
      setFieldFixedValue,
    ] = useState('');

    const [
      fieldIncludeInItemName,
      setFieldIncludeInItemName,
    ] = useState(true);

    const [
      fieldOptionsList,
      setFieldOptionsList,
    ] = useState<
      CustomFieldOption[]
    >([]);

    const [
      fieldDependsOnId,
      setFieldDependsOnId,
    ] = useState('');

    const [
      newOptionParentValue,
      setNewOptionParentValue,
    ] = useState('');

    const [
      newOptionInput,
      setNewOptionInput,
    ] = useState('');

    const [
      dependentOptionsText,
      setDependentOptionsText,
    ] = useState<Record<string, string>>({});

    const [
      optionError,
      setOptionError,
    ] = useState<
      string | null
    >(null);

    const [
      confirmDeleteId,
      setConfirmDeleteId,
    ] = useState<
      string | null
    >(null);

    const [
      deleteFieldConfirmId,
      setDeleteFieldConfirmId,
    ] = useState<
      string | null
    >(null);

    const [
      error,
      setError,
    ] = useState<
      string | null
    >(null);

    const [
      isSuccess,
      setIsSuccess,
    ] = useState(false);

    React.useEffect(() => {
      if (
        isOpen &&
        targetId
      ) {
        const found =
          categories.find(
            category =>
              category.id ===
              targetId,
          );

        if (found) {
          handleStartEdit(
            found,
          );
        }
      } else if (
        isOpen &&
        !targetId
      ) {
        handleCancelEdit();
      }
    }, [
      isOpen,
      targetId,
    ]);

    const handleStartEdit = (
      cat: Category,
    ) => {
      setEditingCatId(
        cat.id,
      );

      setIsAddingNew(false);

      setNewCatName(
        cat.name,
      );

      setItemNameLabel(
        cat.itemNameLabel ||
          'اسم الصنف',
      );

      setSelectedColor(
        cat.themeColor ||
          'sky',
      );

      setSelectedUnit(
        cat.defaultUnit ||
          (
            isSystemCategory(
              cat.id,
            )
              ? 'meters'
              : 'pieces'
          ),
      );

      setHiddenForStaff(
        cat.visibleToEmployees ===
          false ||
          !!cat.hiddenForStaff,
      );

      setHasImage(
        cat.fieldsConfig?.hasImage !==
          false,
      );

      const systemCategory =
        isSystemCategory(
          cat.id,
        );

      setHasSize(
        cat.fieldsConfig?.hasSize ??
          systemCategory,
      );

      setHasItemType(
        cat.fieldsConfig?.hasItemType ??
          false,
      );

      setHasMaterial(
        cat.fieldsConfig?.hasMaterial ??
          false,
      );

      setHasColor(
        cat.fieldsConfig?.hasColor ??
          false,
      );

      setHasBrand(
        cat.fieldsConfig?.hasBrand ??
          false,
      );

      if (
        cat.customFields &&
        Array.isArray(
          cat.customFields,
        )
      ) {
        setCustomFields(
          cat.customFields,
        );
      } else {
        setCustomFields([]);
      }

      setIsEditingField(
        false,
      );

      setEditingFieldId(
        null,
      );

      setError(null);
    };

    const handleCancelEdit =
      () => {
        setEditingCatId(
          null,
        );

        setIsAddingNew(
          false,
        );

        setNewCatName('');

        setItemNameLabel(
          'اسم الصنف',
        );

        setSelectedColor(
          'emerald',
        );

        setSelectedUnit(
          'pieces',
        );

        setHiddenForStaff(
          false,
        );

        setHasImage(true);
        setHasSize(true);
        setHasItemType(false);
        setHasMaterial(false);
        setHasColor(false);
        setHasBrand(false);

        setCustomFields([]);

        setIsEditingField(
          false,
        );

        setEditingFieldId(
          null,
        );

        setConfirmDeleteId(
          null,
        );

        setDeleteFieldConfirmId(
          null,
        );

        setError(null);
      };

    const isEditingSystemCategory =
      isSystemCategory(
        editingCatId,
      );

    const editingFieldOrder =
      editingFieldId
        ? customFields.find(
            field => field.id === editingFieldId,
          )?.order ?? customFields.length
        : customFields.length;

    const dependencyParentCandidates =
      customFields.filter(
        field =>
          field.id !== editingFieldId &&
          field.type === 'select' &&
          ((field.order ?? 0) < editingFieldOrder || field.id === fieldDependsOnId),
      );

    const selectedDependencyParent =
      dependencyParentCandidates.find(
        field => field.id === fieldDependsOnId,
      );

    const dependencyParentOptions =
      selectedDependencyParent?.options || EMPTY_CUSTOM_FIELD_OPTIONS;

    React.useEffect(() => {
      if (!fieldDependsOnId) {
        setDependentOptionsText({});
        return;
      }

      setDependentOptionsText(previous => {
        const next: Record<string, string> = {};
        const allLabels = Array.from(
          new Set(fieldOptionsList.map(option => option.label.trim()).filter(Boolean)),
        );
        const sharedLabels = fieldOptionsList
          .filter(option => !option.parentValue)
          .map(option => option.label.trim())
          .filter(Boolean);

        dependencyParentOptions.forEach(parentOption => {
          if (Object.prototype.hasOwnProperty.call(previous, parentOption.value)) {
            next[parentOption.value] = previous[parentOption.value];
            return;
          }

          const scopedLabels = fieldOptionsList
            .filter(option => option.parentValue === parentOption.value)
            .map(option => option.label.trim())
            .filter(Boolean);

          const seed = Array.from(
            new Set(
              scopedLabels.length > 0 || sharedLabels.length > 0
                ? [...sharedLabels, ...scopedLabels]
                : allLabels,
            ),
          );

          next[parentOption.value] = seed.join('، ');
        });

        return next;
      });
    }, [fieldDependsOnId, dependencyParentOptions, fieldOptionsList]);

    React.useEffect(() => {
      if (
        !editingFieldId ||
        customFields.some(
          field =>
            field.id ===
            editingFieldId
        )
      ) {
        return;
      }

      setIsEditingField(false);
      setEditingFieldId(null);
      setDeleteFieldConfirmId(null);
      setOptionError(null);
    }, [
      customFields,
      editingFieldId
    ]);

    const handleOpenAddField =
      () => {
        setEditingFieldId(
          null,
        );

        setFieldLabel('');

        setFieldType(
          'select',
        );

        setFieldRequired(
          true,
        );

        setFieldSuffix('');

        setFieldPlaceholder(
          '',
        );

        setFieldFixedValue(
          '',
        );

        setFieldIncludeInItemName(
          true,
        );

        setFieldOptionsList(
          [],
        );

        setFieldDependsOnId(
          '',
        );

        setNewOptionParentValue(
          '',
        );

        setNewOptionInput(
          '',
        );

        setDependentOptionsText({});

        setOptionError(null);

        setIsEditingField(
          true,
        );
      };

    const handleOpenEditField =
      (
        field:
          CustomCategoryField,
      ) => {
        setEditingFieldId(
          field.id,
        );

        setFieldLabel(
          field.label,
        );

        setFieldType(
          field.type,
        );

        setFieldRequired(
          field.required ??
            false,
        );

        setFieldSuffix(
          field.suffix ||
            '',
        );

        setFieldPlaceholder(
          field.placeholder ||
            '',
        );

        setFieldFixedValue(
          field.fixedValue ||
            '',
        );

        setFieldIncludeInItemName(
          field.includeInItemName ??
            false,
        );

        setFieldOptionsList(
          field.options
            ? [
                ...field.options,
              ]
            : [],
        );

        setFieldDependsOnId(
          field.dependsOnFieldId || '',
        );

        setNewOptionParentValue(
          '',
        );

        setNewOptionInput(
          '',
        );

        setDependentOptionsText({});

        setOptionError(null);

        setIsEditingField(
          true,
        );
      };

    const handleCancelFieldEdit =
      () => {
        setIsEditingField(
          false,
        );

        setEditingFieldId(
          null,
        );

        setFieldDependsOnId('');
        setNewOptionParentValue('');
        setDependentOptionsText({});
        setOptionError(null);
      };

    const handleAddOption =
      () => {
        const val =
          newOptionInput.trim();

        if (!val) {
          setOptionError(
            'يرجى كتابة نص الخيار أولاً.',
          );

          return;
        }

        const scopedParentValue =
          fieldDependsOnId
            ? newOptionParentValue
            : '';

        const exists =
          fieldOptionsList.some(
            option => {
              const sameText =
                option.value.toLowerCase() === val.toLowerCase() ||
                option.label.toLowerCase() === val.toLowerCase();

              if (!sameText) return false;
              if (!fieldDependsOnId) return true;

              const existingScope = option.parentValue || '';
              if (!existingScope || !scopedParentValue) return true;

              return existingScope === scopedParentValue;
            },
          );

        if (exists) {
          setOptionError(
            'هذا الخيار موجود مسبقاً لنفس الحالة.',
          );

          return;
        }

        setFieldOptionsList(
          previous => [
            ...previous,
            {
              id:
                makeConfigId(
                  'opt',
                ),

              label: val,
              value: val,
              parentValue:
                fieldDependsOnId && scopedParentValue
                  ? scopedParentValue
                  : undefined,
            },
          ],
        );

        setNewOptionInput(
          '',
        );

        setOptionError(null);
      };

    const handleRemoveOption =
      (
        optionId: string,
      ) => {
        setFieldOptionsList(
          previous =>
            previous.filter(
              option =>
                option.id !==
                optionId,
            ),
        );
      };

    const handleOptionParentValueChange =
      (optionId: string, nextParentValue: string) => {
        const target = fieldOptionsList.find(option => option.id === optionId);
        if (!target) return;

        const conflict = fieldOptionsList.some(option => {
          if (option.id === optionId) return false;

          const sameText =
            option.value.toLowerCase() === target.value.toLowerCase() ||
            option.label.toLowerCase() === target.label.toLowerCase();

          if (!sameText) return false;

          const existingScope = option.parentValue || '';
          if (!existingScope || !nextParentValue) return true;
          return existingScope === nextParentValue;
        });

        if (conflict) {
          setOptionError('نفس الخيار موجود مسبقاً لهذه الحالة.');
          return;
        }

        setFieldOptionsList(previous =>
          previous.map(option =>
            option.id === optionId
              ? {
                  ...option,
                  parentValue: nextParentValue || undefined,
                }
              : option,
          ),
        );
        setOptionError(null);
      };

    const handleMoveOption =
      (
        index: number,
        direction:
          | 'up'
          | 'down',
      ) => {
        const newIndex =
          direction === 'up'
            ? index - 1
            : index + 1;

        if (
          newIndex < 0 ||
          newIndex >=
            fieldOptionsList.length
        ) {
          return;
        }

        const nextList = [
          ...fieldOptionsList,
        ];

        const temp =
          nextList[index];

        nextList[index] =
          nextList[newIndex];

        nextList[newIndex] =
          temp;

        setFieldOptionsList(
          nextList,
        );
      };

    const handleSaveFieldToCategory =
      () => {
        const trimmedLabel =
          fieldLabel.trim();

        if (
          !trimmedLabel
        ) {
          setOptionError(
            'يرجى إدخال اسم الحقل.',
          );

          return;
        }

        const effectiveOptions =
          fieldType === 'select'
            ? fieldDependsOnId
              ? makeSimpleOptions(
                  dependencyParentOptions,
                  dependentOptionsText,
                )
              : fieldOptionsList
            : [];

        if (
          fieldType ===
            'select' &&
          effectiveOptions.length ===
            0
        ) {
          setOptionError(
            'يرجى إضافة خيار واحد على الأقل للقائمة.',
          );

          return;
        }

        if (
          fieldType ===
            'fixed' &&
          !fieldFixedValue.trim()
        ) {
          setOptionError(
            'يرجى تحديد القيمة الثابتة للحقل.',
          );

          return;
        }

        const fieldData:
          CustomCategoryField = {
          id:
            editingFieldId ||
            makeConfigId(
              'fld',
            ),

          label:
            trimmedLabel,

          type:
            fieldType,

          required:
            fieldRequired,

          suffix:
            fieldType !==
              'fixed' &&
            fieldSuffix.trim()
              ? fieldSuffix.trim()
              : undefined,

          placeholder:
            (
              fieldType ===
                'text' ||
              fieldType ===
                'number'
            ) &&
            fieldPlaceholder.trim()
              ? fieldPlaceholder.trim()
              : undefined,

          options:
            fieldType ===
            'select'
              ? effectiveOptions.map(option => ({
                  id: option.id,
                  label: option.label,
                  value: option.value,
                  parentValue:
                    fieldDependsOnId && option.parentValue
                      ? option.parentValue
                      : undefined,
                }))
              : undefined,

          dependsOnFieldId:
            fieldType === 'select' && fieldDependsOnId
              ? fieldDependsOnId
              : undefined,

          fixedValue:
            fieldType ===
            'fixed'
              ? fieldFixedValue.trim()
              : undefined,

          includeInItemName:
            fieldIncludeInItemName,

          order:
            editingFieldId
              ? (
                  customFields.find(
                    field =>
                      field.id ===
                      editingFieldId,
                  )?.order ??
                  customFields.length
                )
              : customFields.length,
        };

        if (
          editingFieldId
        ) {
          setCustomFields(
            previous => {
              const updated = previous.map(
                field =>
                  field.id === editingFieldId
                    ? fieldData
                    : field,
              );

              if (fieldData.type === 'select') {
                return updated;
              }

              return updated.map(field => {
                if (field.dependsOnFieldId !== editingFieldId) {
                  return field;
                }

                return {
                  ...field,
                  dependsOnFieldId: undefined,
                  options: field.options?.map(option => ({
                    id: option.id,
                    label: option.label,
                    value: option.value,
                  })),
                };
              });
            },
          );
        } else {
          setCustomFields(
            previous => [
              ...previous,
              fieldData,
            ],
          );
        }

        setIsEditingField(
          false,
        );

        setEditingFieldId(
          null,
        );

        setOptionError(null);
      };

    const handleMoveField =
      (
        index: number,
        direction:
          | 'up'
          | 'down',
      ) => {
        const targetIndex =
          direction === 'up'
            ? index - 1
            : index + 1;

        if (
          targetIndex < 0 ||
          targetIndex >=
            customFields.length
        ) {
          return;
        }

        const reordered = [
          ...customFields,
        ];

        const [moved] =
          reordered.splice(
            index,
            1,
          );

        reordered.splice(
          targetIndex,
          0,
          moved,
        );

        const updated =
          reordered.map(
            (
              field,
              currentIndex,
            ) => ({
              ...field,
              order:
                currentIndex,
            }),
          );

        setCustomFields(
          updated,
        );
      };

    const handleRequestDeleteField =
      (
        fieldId: string,
      ) => {
        if (
          editingFieldId ===
          fieldId
        ) {
          handleCancelFieldEdit();
        }

        setDeleteFieldConfirmId(
          fieldId,
        );
      };

    const handleDeleteField =
      (
        fieldId: string,
      ) => {
        const filtered =
          customFields
            .filter(
              field =>
                field.id !==
                fieldId,
            )
            .map(
              (
                field,
                index,
              ) => ({
                ...field,
                order: index,
                ...(field.dependsOnFieldId === fieldId
                  ? {
                      dependsOnFieldId: undefined,
                      options: field.options?.map(option => ({
                        id: option.id,
                        label: option.label,
                        value: option.value,
                      })),
                    }
                  : {}),
              }),
            );

        setCustomFields(
          filtered,
        );

        setDeleteFieldConfirmId(
          null,
        );

        if (
          editingFieldId ===
          fieldId
        ) {
          handleCancelFieldEdit();
        }
      };

    const handleSaveCategory =
      async (
        event:
          React.FormEvent,
      ) => {
        event.preventDefault();

        setError(null);

        const nameTrimmed =
          newCatName.trim();

        if (
          !nameTrimmed
        ) {
          setError(
            'يرجى كتابة اسم القسم.',
          );

          return;
        }

        if (
          !editingCatId &&
          categories.some(
            category =>
              category.name.toLowerCase() ===
              nameTrimmed.toLowerCase(),
          )
        ) {
          setError(
            'هذا القسم موجود بالفعل!',
          );

          return;
        }

        const cleanedCustomFields =
          customFields.map(
            (
              field,
              index,
            ) => ({
              ...field,

              order: index,

              options:
                field.type ===
                'select'
                  ? field.options?.map(option => ({
                      id: option.id,
                      label: option.label,
                      value: option.value,
                      parentValue:
                        field.dependsOnFieldId && option.parentValue
                          ? option.parentValue
                          : undefined,
                    }))
                  : undefined,

              dependsOnFieldId:
                field.type === 'select' && field.dependsOnFieldId
                  ? field.dependsOnFieldId
                  : undefined,

              fixedValue:
                field.type ===
                'fixed'
                  ? field.fixedValue
                  : undefined,

              placeholder:
                (
                  field.type ===
                    'text' ||
                  field.type ===
                    'number'
                )
                  ? field.placeholder
                  : undefined,

              suffix:
                field.type !==
                'fixed'
                  ? field.suffix
                  : undefined,
            }),
          );

        try {
          let savedCategory:
            Category;

          if (
            editingCatId
          ) {
            const existing =
              categories.find(
                category =>
                  category.id ===
                  editingCatId,
              );

            const effectiveHiddenForStaff =
              canManageVisibility
                ? hiddenForStaff
                : (
                    existing?.visibleToEmployees === false ||
                    !!existing?.hiddenForStaff
                  );

            savedCategory = {
              id:
                editingCatId,

              template:
                existing?.template ||
                (
                  isEditingSystemCategory
                    ? (
                        editingCatId ===
                        'tiles'
                          ? 'porcelain'
                          : 'ceramic'
                      )
                    : 'general'
                ),

              name:
                nameTrimmed,

              itemNameLabel:
                itemNameLabel.trim() ||
                'اسم الصنف',

              themeColor:
                selectedColor,

              defaultUnit:
                selectedUnit,

              fieldsConfig:
                buildFieldsConfig(
                  existing,
                  {
                    hasImage,
                    hasSize,
                    hasItemType,
                    hasMaterial,
                    hasColor,
                    hasBrand,
                  },
                  isEditingSystemCategory,
                ),

              customFields:
                cleanedCustomFields,

              visibleToEmployees:
                !effectiveHiddenForStaff,

              hiddenForStaff:
                effectiveHiddenForStaff,

              isSystemCategory:
                isEditingSystemCategory,
            };

            await db
              .collection(
                'categories',
              )
              .doc(
                editingCatId,
              )
              .set(
                savedCategory,
                {
                  merge: true,
                },
              );
          } else {
            const newId =
              'cat_' +
              Date.now().toString(
                36,
              ) +
              '_' +
              Math.random()
                .toString(36)
                .substr(
                  2,
                  5,
                );

            const effectiveHiddenForStaff =
              canManageVisibility
                ? hiddenForStaff
                : false;

            savedCategory = {
              id:
                newId,

              template:
                'general',

              name:
                nameTrimmed,

              itemNameLabel:
                itemNameLabel.trim() ||
                'اسم الصنف',

              themeColor:
                selectedColor,

              defaultUnit:
                selectedUnit,

              fieldsConfig:
                buildFieldsConfig(
                  undefined,
                  {
                    hasImage,
                    hasSize,
                    hasItemType,
                    hasMaterial,
                    hasColor,
                    hasBrand,
                  },
                  false,
                ),

              customFields:
                cleanedCustomFields,

              visibleToEmployees:
                !effectiveHiddenForStaff,

              hiddenForStaff:
                effectiveHiddenForStaff,

              isSystemCategory:
                false,
            };

            await db
              .collection(
                'categories',
              )
              .doc(newId)
              .set(
                savedCategory,
              );
          }

          onSaveCategory?.(
            savedCategory,
          );

          setIsSuccess(
            true,
          );

          window.setTimeout(
            () =>
              setIsSuccess(
                false,
              ),
            2000,
          );

          handleCancelEdit();
        } catch (saveError) {
          console.error(
            'Error saving category:',
            saveError,
          );

          setError(
            'حدث خطأ أثناء حفظ القسم.',
          );
        }
      };

    const handleExecuteDelete =
      async (
        categoryId: string,
      ) => {
        if (
          isSystemCategory(
            categoryId,
          )
        ) {
          setError(
            'لا يمكن حذف الأقسام الأساسية للنظام (البورسلان والسيراميك).',
          );

          setConfirmDeleteId(
            null,
          );

          return;
        }

        try {
          if (!onDeleteCategory) {
            throw new Error(
              'تعذر تنفيذ حذف القسم بأمان.',
            );
          }

          await onDeleteCategory(
            categoryId,
          );

          setConfirmDeleteId(
            null,
          );

          if (
            editingCatId ===
            categoryId
          ) {
            handleCancelEdit();
          }
        } catch (
          deleteError
        ) {
          console.error(
            'Error deleting category:',
            deleteError,
          );

          setError(
            deleteError instanceof Error
              ? deleteError.message
              : 'فشل في حذف القسم.',
          );
        }
      };

    const isEditing =
      editingCatId !==
        null ||
      isAddingNew;

    if (!isOpen) {
      return null;
    }

    return (
      <ResponsiveOverlay
        open={isOpen}
        onClose={onClose}
        title={
          isEditing
            ? (
                editingCatId
                  ? 'تعديل القسم'
                  : 'إضافة قسم'
              )
            : 'إدارة الأقسام'
        }
        mobileSnap="large"
        desktopMaxWidth="max-w-3xl"
      >
        {!isEditing && (
          <div>
            <div
              className="
                mb-3
                flex
                items-center
                justify-between
                gap-3
              "
            >
              <span
                className="
                  text-xs
                  font-bold
                  text-slate-500
                  dark:text-slate-400
                "
              >
                الأقسام (
                {categories.length}
                )
              </span>

              <button
                type="button"
                onClick={() => {
                  setIsAddingNew(
                    true,
                  );

                  setNewCatName(
                    '',
                  );

                  setItemNameLabel(
                    'اسم الصنف',
                  );

                  setSelectedColor(
                    'emerald',
                  );

                  setSelectedUnit(
                    'pieces',
                  );

                  setHiddenForStaff(
                    false,
                  );

                  setHasImage(true);
                  setHasSize(false);
                  setHasItemType(false);
                  setHasMaterial(false);
                  setHasColor(false);
                  setHasBrand(false);

                  setCustomFields(
                    [],
                  );
                }}
                className="
                  flex
                  h-9
                  items-center
                  justify-center
                  gap-1.5
                  rounded-[11px]
                  bg-slate-900
                  px-3
                  text-[11px]
                  font-bold
                  text-white
                  transition-all
                  active:scale-[0.98]
                  dark:bg-white
                  dark:text-slate-900
                "
              >
                <Plus
                  className="
                    h-3.5
                    w-3.5
                  "
                />

                <span>
                  إضافة قسم
                </span>
              </button>
            </div>

            <div
              className="
                overflow-hidden
                rounded-[16px]
                border
                border-slate-200/70
                bg-white
                divide-y
                divide-slate-100
                dark:border-white/[0.07]
                dark:bg-neutral-900
                dark:divide-white/[0.05]
              "
            >
              {categories.map(
                category => {
                  const colorInfo =
                    THEME_COLORS.find(
                      color =>
                        color.id ===
                        category.themeColor,
                    ) ||
                    THEME_COLORS[0];

                  const isConfirming =
                    confirmDeleteId ===
                    category.id;

                  const isSystem =
                    isSystemCategory(
                      category.id,
                    );

                  return (
                    <div
                      key={
                        category.id
                      }
                      className="
                        flex
                        min-h-[58px]
                        items-center
                        justify-between
                        gap-3
                        bg-white
                        px-3
                        py-2.5
                        transition-colors
                        hover:bg-slate-50/70
                        dark:bg-neutral-900
                        dark:hover:bg-neutral-800/40
                      "
                    >
                      <div
                        className="
                          flex
                          min-w-0
                          items-center
                          gap-2.5
                        "
                      >
                        <span
                          className={`
                            h-3
                            w-3
                            shrink-0
                            rounded-full
                            ${colorInfo.bg}
                          `}
                        />

                        <div
                          className="
                            min-w-0
                            text-right
                          "
                        >
                          <div
                            className="
                              flex
                              flex-wrap
                              items-center
                              gap-1.5
                            "
                          >
                            <span
                              className="
                                break-words
                                text-xs
                                font-bold
                                text-slate-800
                                dark:text-white
                              "
                            >
                              {
                                category.name
                              }
                            </span>

                            {isSystem && (
                              <span
                                className="
                                  rounded
                                  bg-amber-100
                                  px-1.5
                                  py-0.5
                                  text-[9px]
                                  font-bold
                                  text-amber-800
                                  dark:bg-amber-950/40
                                  dark:text-amber-300
                                "
                              >
                                أساسي
                              </span>
                            )}
                          </div>

                          <span
                            className="
                              mt-0.5
                              block
                              text-[10px]
                              font-normal
                              text-slate-400
                            "
                          >
                            {category.defaultUnit ===
                            'pieces'
                              ? 'بالقطعة'
                              : 'بالمتر (م²)'}

                            {!isSystem &&
                              category.customFields &&
                              category.customFields.length >
                                0 &&
                              ` • ${category.customFields.length} حقول`}
                          </span>
                        </div>
                      </div>

                      <div
                        className="
                          flex
                          shrink-0
                          items-center
                          gap-1
                        "
                      >
                        {isConfirming ? (
                          <div
                            className="
                              flex
                              items-center
                              gap-1
                              rounded-[10px]
                              border
                              border-rose-200
                              bg-rose-50
                              p-1
                              dark:border-rose-900
                              dark:bg-rose-950/60
                            "
                          >
                            <button
                              type="button"
                              onClick={() =>
                                handleExecuteDelete(
                                  category.id,
                                )
                              }
                              className="
                                rounded-[6px]
                                bg-rose-600
                                px-2
                                py-1
                                text-[10px]
                                font-semibold
                                text-white
                              "
                            >
                              تأكيد
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDeleteId(
                                  null,
                                )
                              }
                              className="
                                rounded-[6px]
                                px-1.5
                                py-1
                                text-[10px]
                                font-semibold
                                text-slate-600
                                dark:text-slate-300
                              "
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                handleStartEdit(
                                  category,
                                )
                              }
                              className="
                                flex h-8 w-8 items-center justify-center
                                rounded-full border border-slate-200/70
                                bg-slate-50 text-slate-500 shadow-sm
                                transition hover:bg-slate-100 hover:text-slate-800
                                active:scale-95 dark:border-white/[0.07]
                                dark:bg-neutral-800 dark:text-slate-300
                                dark:hover:bg-neutral-700 dark:hover:text-white
                              "
                              title="تعديل وتخصيص القسم"
                              aria-label={`تعديل ${category.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>

                            {!isSystem && (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDeleteId(
                                    category.id,
                                  )
                                }
                                className="
                                  flex h-8 w-8 items-center justify-center
                                  rounded-full border border-transparent
                                  text-slate-400 transition
                                  hover:border-rose-100 hover:bg-rose-50
                                  hover:text-rose-600 active:scale-95
                                  dark:hover:border-rose-900/40
                                  dark:hover:bg-rose-950/25 dark:hover:text-rose-400
                                "
                                aria-label={`حذف ${category.name}`}
                                title="حذف القسم"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        )}

        {isEditing && (
          <div>
            <button
              type="button"
              onClick={
                handleCancelEdit
              }
              className="
                mb-4
                flex
                h-9
                items-center
                gap-1.5
                rounded-[10px]
                px-2
                text-xs
                font-bold
                text-slate-500
                transition
                hover:bg-slate-100
                hover:text-slate-700
                dark:text-slate-400
                dark:hover:bg-neutral-800
                dark:hover:text-white
              "
            >
              <ArrowRight
                className="
                  h-4
                  w-4
                "
              />

              العودة للأقسام
            </button>

            <form
              onSubmit={
                handleSaveCategory
              }
              className="
                space-y-4
                text-right
              "
            >
              <div
                className="
                  space-y-4
                  rounded-[18px]
                  border
                  border-slate-200/60
                  bg-slate-50/80
                  p-4
                  dark:border-white/[0.05]
                  dark:bg-neutral-800/60
                "
              >
                {isEditingSystemCategory && (
                  <div
                    className="
                      flex
                      items-start
                      gap-2
                      rounded-[12px]
                      border
                      border-amber-200/60
                      bg-amber-50
                      p-2.5
                      dark:border-amber-900/40
                      dark:bg-amber-950/20
                    "
                  >
                    <AlertCircle
                      className="
                        mt-0.5
                        h-4
                        w-4
                        shrink-0
                        text-amber-600
                        dark:text-amber-400
                      "
                    />

                    <p
                      className="
                        text-[10px]
                        font-medium
                        leading-5
                        text-amber-800
                        dark:text-amber-300
                      "
                    >
                      البورسلان والسيراميك محميان من حذف القسم فقط. تقدر تخصّص الحقول وتضيف وتعدّل وتحذف حقول النموذج مثل أي قسم، مع بقاء حساب الأمتار والكراتين والطبليات محفوظاً.
                    </p>
                  </div>
                )}

                <div
                  className="
                    grid
                    grid-cols-1
                    gap-4
                    sm:grid-cols-2
                  "
                >
                  <div>
                    <label
                      className="
                        mb-1.5
                        block
                        text-[11px]
                        font-semibold
                        text-slate-500
                        dark:text-slate-400
                      "
                    >
                      اسم القسم *
                    </label>

                    <input
                      type="text"
                      required
                      value={
                        newCatName
                      }
                      onChange={
                        event =>
                          setNewCatName(
                            event.target.value,
                          )
                      }
                      placeholder="اكتب اسم القسم..."
                      className="
                        h-11
                        w-full
                        rounded-[12px]
                        border
                        border-slate-200
                        bg-white
                        px-3.5
                        text-xs
                        font-semibold
                        text-slate-800
                        outline-none
                        focus:border-indigo-400
                        dark:border-white/[0.08]
                        dark:bg-neutral-900
                        dark:text-white
                      "
                    />
                  </div>

                  <div>
                    <label
                      className="
                        mb-1.5
                        block
                        text-[11px]
                        font-semibold
                        text-slate-500
                        dark:text-slate-400
                      "
                    >
                      لون القسم
                    </label>

                    <div
                      className="
                        flex
                        min-h-11
                        flex-wrap
                        items-center
                        gap-2.5
                      "
                    >
                      {THEME_COLORS.map(
                        color => (
                          <button
                            key={
                              color.id
                            }
                            type="button"
                            title={
                              color.name
                            }
                            onClick={() =>
                              setSelectedColor(
                                color.id,
                              )
                            }
                            className={`
                              h-6
                              w-6
                              rounded-full
                              ${color.bg}
                              transition
                              ${
                                selectedColor ===
                                color.id
                                  ? 'ring-4 ring-slate-300 ring-offset-2 dark:ring-neutral-600 dark:ring-offset-neutral-900'
                                  : 'hover:scale-110'
                              }
                            `}
                          />
                        ),
                      )}
                    </div>
                  </div>

                  <div>
                    <label
                      className="
                        mb-1.5
                        block
                        text-[11px]
                        font-semibold
                        text-slate-500
                        dark:text-slate-400
                      "
                    >
                      مسمى اسم الصنف
                    </label>

                    <input
                      type="text"
                      value={
                        itemNameLabel
                      }
                      onChange={
                        event =>
                          setItemNameLabel(
                            event.target.value,
                          )
                      }
                      placeholder="مثال: اسم الموديل"
                      className="
                        h-11
                        w-full
                        rounded-[12px]
                        border
                        border-slate-200
                        bg-white
                        px-3.5
                        text-xs
                        font-semibold
                        text-slate-800
                        outline-none
                        focus:border-indigo-400
                        dark:border-white/[0.08]
                        dark:bg-neutral-900
                        dark:text-white
                      "
                    />
                  </div>

                  <div>
                    <label
                      className="
                        mb-1.5
                        block
                        text-[11px]
                        font-semibold
                        text-slate-500
                        dark:text-slate-400
                      "
                    >
                      وحدة القياس
                    </label>

                    <div
                      className="
                        grid
                        grid-cols-2
                        gap-2
                      "
                    >
                      <button
                        type="button"
                        disabled={
                          isEditingSystemCategory
                        }
                        onClick={() =>
                          setSelectedUnit(
                            'pieces',
                          )
                        }
                        className={`
                          h-11
                          rounded-[12px]
                          border
                          text-xs
                          font-semibold
                          transition
                          ${
                            selectedUnit ===
                            'pieces'
                              ? 'border-transparent bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                              : 'border-slate-200 bg-white text-slate-600 dark:border-white/[0.08] dark:bg-neutral-900 dark:text-slate-300'
                          }
                          ${
                            isEditingSystemCategory
                              ? 'cursor-not-allowed opacity-60'
                              : ''
                          }
                        `}
                      >
                        قطعة
                      </button>

                      <button
                        type="button"
                        disabled={
                          isEditingSystemCategory
                        }
                        onClick={() =>
                          setSelectedUnit(
                            'meters',
                          )
                        }
                        className={`
                          h-11
                          rounded-[12px]
                          border
                          text-xs
                          font-semibold
                          transition
                          ${
                            selectedUnit ===
                            'meters'
                              ? 'border-transparent bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                              : 'border-slate-200 bg-white text-slate-600 dark:border-white/[0.08] dark:bg-neutral-900 dark:text-slate-300'
                          }
                          ${
                            isEditingSystemCategory
                              ? 'cursor-not-allowed opacity-60'
                              : ''
                          }
                        `}
                      >
                        متر مربع
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    className="
                      flex
                      cursor-pointer
                      items-center
                      justify-between
                      gap-3
                      rounded-[13px]
                      border
                      border-slate-200/70
                      bg-white
                      px-3.5
                      py-3
                      dark:border-white/[0.07]
                      dark:bg-neutral-900
                    "
                  >
                    <div>
                      <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                        صورة الصنف
                      </span>

                      <span className="mt-0.5 block text-[10px] font-medium text-slate-400">
                        إخفاؤها يوقف عرض حقل الصورة فقط، ولا يحذف أي صورة محفوظة مسبقاً.
                      </span>
                    </div>

                    <input
                      type="checkbox"
                      checked={
                        hasImage
                      }
                      onChange={event =>
                        setHasImage(
                          event.target.checked,
                        )
                      }
                      className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>

                  {isEditingSystemCategory && (
                    <div className="rounded-[13px] border border-slate-200/70 bg-white p-3 dark:border-white/[0.07] dark:bg-neutral-900">
                      <div className="mb-2">
                        <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                          تفاصيل البورسلان / السيراميك
                        </span>

                        <span className="mt-0.5 block text-[10px] font-medium text-slate-400">
                          فعّل فقط التفاصيل التي تريد ظهورها في نموذج الصنف. إخفاء أي حقل لا يمسح بياناته القديمة.
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {[
                          [
                            'المقاس',
                            hasSize,
                            setHasSize,
                          ],
                          [
                            'النوع',
                            hasItemType,
                            setHasItemType,
                          ],
                          [
                            'المادة / الزجاج',
                            hasMaterial,
                            setHasMaterial,
                          ],
                          [
                            'اللون',
                            hasColor,
                            setHasColor,
                          ],
                          [
                            'الماركة',
                            hasBrand,
                            setHasBrand,
                          ],
                        ].map(
                          ([
                            label,
                            checked,
                            setter,
                          ]) => (
                            <label
                              key={
                                String(label)
                              }
                              className="flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-[10px] bg-slate-50 px-2.5 py-2 dark:bg-neutral-800"
                            >
                              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                {
                                  String(label)
                                }
                              </span>

                              <input
                                type="checkbox"
                                checked={
                                  Boolean(checked)
                                }
                                onChange={event =>
                                  (
                                    setter as React.Dispatch<
                                      React.SetStateAction<boolean>
                                    >
                                  )(
                                    event.target.checked,
                                  )
                                }
                                className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                            </label>
                          ),
                        )}
                      </div>

                      <p className="mt-2 text-[9px] font-medium text-slate-400">
                        حساب الأمتار والكراتين والطبليات يبقى ثابتاً للنظام ولا يتم تعطيله.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div
                className="
                  space-y-3
                  rounded-[18px]
                  border
                  border-slate-200/60
                  bg-slate-50/80
                  p-4
                  dark:border-white/[0.05]
                  dark:bg-neutral-800/60
                "
              >
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-3
                  "
                >
                  <div>
                    <h5
                      className="
                        text-xs
                        font-bold
                        text-slate-800
                        dark:text-white
                      "
                    >
                      تخصيص حقول إضافة الصنف
                    </h5>

                    <p
                      className="
                        mt-0.5
                        text-[10px]
                        text-slate-400
                      "
                    >
                      {customFields.length}{' '}
                      حقول
                    </p>
                  </div>

                  {!isEditingField && (
                    <button
                      type="button"
                      onClick={
                        handleOpenAddField
                      }
                      className="
                        flex
                        h-9
                        items-center
                        gap-1.5
                        rounded-[10px]
                        bg-slate-900
                        px-3
                        text-[11px]
                        font-bold
                        text-white
                        active:scale-95
                        dark:bg-white
                        dark:text-slate-900
                      "
                    >
                      <Plus
                        className="
                          h-3.5
                          w-3.5
                        "
                      />

                      إضافة حقل
                    </button>
                  )}
                </div>

                {isEditingField && (
                  <motion.div
                    initial={{
                      opacity: 0,
                      y: 5,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    className="
                      space-y-4
                      rounded-[16px]
                      border
                      border-slate-300
                      bg-white
                      p-4
                      dark:border-neutral-600
                      dark:bg-neutral-900
                    "
                  >
                    <div
                      className="
                        flex
                        items-center
                        justify-between
                        gap-3
                      "
                    >
                      <span
                        className="
                          text-xs
                          font-bold
                          text-slate-800
                          dark:text-white
                        "
                      >
                        {editingFieldId
                          ? 'تعديل الحقل'
                          : 'إضافة حقل'}
                      </span>

                      <button
                        type="button"
                        onClick={
                          handleCancelFieldEdit
                        }
                        className="
                          text-[11px]
                          font-bold
                          text-slate-400
                        "
                      >
                        إلغاء
                      </button>
                    </div>

                    <div
                      className="
                        grid
                        grid-cols-1
                        gap-3
                        sm:grid-cols-2
                      "
                    >
                      <div>
                        <label
                          className="
                            mb-1
                            block
                            text-[11px]
                            font-semibold
                            text-slate-500
                          "
                        >
                          اسم الحقل *
                        </label>

                        <input
                          type="text"
                          value={
                            fieldLabel
                          }
                          onChange={
                            event =>
                              setFieldLabel(
                                event.target.value,
                              )
                          }
                          placeholder="مثال: اللون، القياس، النوع"
                          className="
                            h-11
                            w-full
                            rounded-[11px]
                            border
                            border-slate-200
                            bg-slate-50
                            px-3
                            text-xs
                            font-semibold
                            text-slate-800
                            outline-none
                            focus:border-indigo-400
                            dark:border-white/[0.08]
                            dark:bg-neutral-800
                            dark:text-white
                          "
                        />
                      </div>

                      {fieldType !==
                        'fixed' && (
                        <div>
                          <label
                            className="
                              mb-1
                              block
                              text-[11px]
                              font-semibold
                              text-slate-500
                            "
                          >
                            الوحدة / اللاحقة
                          </label>

                          <input
                            type="text"
                            value={
                              fieldSuffix
                            }
                            onChange={
                              event =>
                                setFieldSuffix(
                                  event.target.value,
                                )
                            }
                            placeholder="مثال: سم، ملم"
                            className="
                              h-11
                              w-full
                              rounded-[11px]
                              border
                              border-slate-200
                              bg-slate-50
                              px-3
                              text-xs
                              font-semibold
                              text-slate-800
                              outline-none
                              dark:border-white/[0.08]
                              dark:bg-neutral-800
                              dark:text-white
                            "
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label
                        className="
                          mb-2
                          block
                          text-[11px]
                          font-semibold
                          text-slate-500
                        "
                      >
                        نوع الحقل
                      </label>

                      <div
                        className="
                          grid
                          grid-cols-2
                          gap-2
                          sm:grid-cols-4
                        "
                      >
                        {FIELD_TYPES.map(
                          type => {
                            const Icon =
                              type.icon;

                            const active =
                              fieldType ===
                              type.id;

                            return (
                              <button
                                key={
                                  type.id
                                }
                                type="button"
                                onClick={() => {
                                  setFieldType(
                                    type.id,
                                  );

                                  if (type.id !== 'select') {
                                    setFieldDependsOnId('');
                                    setNewOptionParentValue('');
                                  }

                                  setOptionError(
                                    null,
                                  );
                                }}
                                className={`
                                  rounded-[11px]
                                  border
                                  p-2.5
                                  text-right
                                  transition
                                  ${
                                    active
                                      ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-950/30'
                                      : 'border-slate-200 hover:bg-slate-50 dark:border-white/[0.06] dark:hover:bg-neutral-800'
                                  }
                                `}
                              >
                                <div
                                  className="
                                    mb-1
                                    flex
                                    items-center
                                    gap-1.5
                                  "
                                >
                                  <Icon
                                    className="
                                      h-3.5
                                      w-3.5
                                      text-slate-500
                                    "
                                  />

                                  <span
                                    className="
                                      text-[11px]
                                      font-bold
                                      text-slate-800
                                      dark:text-white
                                    "
                                  >
                                    {
                                      type.label
                                    }
                                  </span>
                                </div>

                                <p
                                  className="
                                    text-[9px]
                                    leading-4
                                    text-slate-400
                                  "
                                >
                                  {
                                    type.desc
                                  }
                                </p>
                              </button>
                            );
                          },
                        )}
                      </div>
                    </div>

                    {(fieldType ===
                      'text' ||
                      fieldType ===
                        'number') && (
                      <div>
                        <label
                          className="
                            mb-1
                            block
                            text-[11px]
                            font-semibold
                            text-slate-500
                          "
                        >
                          نص مساعد داخل الحقل
                        </label>

                        <input
                          type="text"
                          value={
                            fieldPlaceholder
                          }
                          onChange={
                            event =>
                              setFieldPlaceholder(
                                event.target.value,
                              )
                          }
                          placeholder="اختياري"
                          className="
                            h-11
                            w-full
                            rounded-[11px]
                            border
                            border-slate-200
                            bg-slate-50
                            px-3
                            text-xs
                            font-semibold
                            outline-none
                            dark:border-white/[0.08]
                            dark:bg-neutral-800
                          "
                        />
                      </div>
                    )}

                    {fieldType ===
                      'fixed' && (
                      <div>
                        <label
                          className="
                            mb-1
                            block
                            text-[11px]
                            font-semibold
                            text-slate-500
                          "
                        >
                          القيمة الثابتة *
                        </label>

                        <input
                          type="text"
                          value={
                            fieldFixedValue
                          }
                          onChange={
                            event =>
                              setFieldFixedValue(
                                event.target.value,
                              )
                          }
                          placeholder="مثال: 6 ملم"
                          className="
                            h-11
                            w-full
                            rounded-[11px]
                            border
                            border-slate-200
                            bg-slate-50
                            px-3
                            text-xs
                            font-semibold
                            outline-none
                            dark:border-white/[0.08]
                            dark:bg-neutral-800
                          "
                        />
                      </div>
                    )}

                    {fieldType ===
                      'select' && (
                      <div
                        className="
                          space-y-3
                          rounded-[12px]
                          border
                          border-slate-200
                          bg-slate-50
                          p-3
                          dark:border-white/[0.06]
                          dark:bg-neutral-800
                        "
                      >
                        {dependencyParentCandidates.length > 0 && (
                          <div>
                            <label
                              className="
                                mb-1
                                block
                                text-[11px]
                                font-semibold
                                text-slate-500
                              "
                            >
                              يعتمد على
                            </label>

                            <select
                              value={fieldDependsOnId}
                              onChange={event => {
                                const nextId = event.target.value;

                                if (nextId !== fieldDependsOnId && fieldDependsOnId) {
                                  const mergedLabels = Array.from(
                                    new Set(
                                      Object.values(dependentOptionsText)
                                        .flatMap(splitSimpleOptions),
                                    ),
                                  );

                                  if (mergedLabels.length > 0) {
                                    setFieldOptionsList(
                                      mergedLabels.map(label => ({
                                        id: makeConfigId('opt'),
                                        label,
                                        value: label,
                                      })),
                                    );
                                  }
                                }

                                setFieldDependsOnId(nextId);
                                setDependentOptionsText({});
                                setOptionError(null);
                              }}
                              className="
                                h-10
                                w-full
                                rounded-[10px]
                                border
                                border-slate-200
                                bg-white
                                px-3
                                text-xs
                                font-semibold
                                text-slate-700
                                outline-none
                                dark:border-white/[0.08]
                                dark:bg-neutral-900
                                dark:text-slate-200
                              "
                            >
                              <option value="">بدون اعتماد</option>
                              {dependencyParentCandidates.map(parentField => (
                                <option key={parentField.id} value={parentField.id}>
                                  {parentField.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <span
                          className="
                            block
                            text-[11px]
                            font-bold
                            text-slate-700
                            dark:text-slate-200
                          "
                        >
                          خيارات القائمة
                        </span>

                        {fieldDependsOnId ? (
                          <div className="space-y-2.5">
                            <p className="text-[9px] font-medium leading-relaxed text-slate-400">
                              اكتب خيارات كل قيمة وافصل بينها بفاصلة.
                            </p>

                            {dependencyParentOptions.map(parentOption => (
                              <div key={parentOption.id}>
                                <label className="mb-1 block text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                  {parentOption.label}
                                </label>
                                <input
                                  type="text"
                                  value={dependentOptionsText[parentOption.value] || ''}
                                  onChange={event =>
                                    setDependentOptionsText(previous => ({
                                      ...previous,
                                      [parentOption.value]: event.target.value,
                                    }))
                                  }
                                  placeholder="مثال: 80، 90، 100"
                                  className="
                                    h-10
                                    w-full
                                    rounded-[10px]
                                    border
                                    border-slate-200
                                    bg-white
                                    px-3
                                    text-xs
                                    font-semibold
                                    outline-none
                                    dark:border-white/[0.08]
                                    dark:bg-neutral-900
                                  "
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            <div
                              className="
                                flex
                                flex-wrap
                                gap-2
                              "
                            >
                              <input
                                type="text"
                                value={newOptionInput}
                                onChange={event =>
                                  setNewOptionInput(event.target.value)
                                }
                                onKeyDown={event => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    handleAddOption();
                                  }
                                }}
                                placeholder="اكتب الخيار..."
                                className="
                                  h-10
                                  min-w-0
                                  flex-1
                                  rounded-[10px]
                                  border
                                  border-slate-200
                                  bg-white
                                  px-3
                                  text-xs
                                  font-semibold
                                  outline-none
                                  dark:border-white/[0.08]
                                  dark:bg-neutral-900
                                "
                              />

                              <button
                                type="button"
                                onClick={handleAddOption}
                                className="
                                  h-10
                                  shrink-0
                                  rounded-[10px]
                                  bg-slate-900
                                  px-3
                                  text-[11px]
                                  font-bold
                                  text-white
                                  dark:bg-white
                                  dark:text-slate-900
                                "
                              >
                                إضافة
                              </button>
                            </div>

                            <div className="space-y-1.5">
                              {fieldOptionsList.map((option, index) => (
                                <div
                                  key={option.id}
                                  className="
                                    flex
                                    min-h-9
                                    items-center
                                    justify-between
                                    gap-2
                                    rounded-[10px]
                                    border
                                    border-slate-200
                                    bg-white
                                    px-2.5
                                    dark:border-white/[0.06]
                                    dark:bg-neutral-900
                                  "
                                >
                                  <span className="min-w-0 flex-1 break-words text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                    {option.label}
                                  </span>

                                  <div className="flex shrink-0 items-center gap-0.5">
                                    {index > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => handleMoveOption(index, 'up')}
                                        className="flex h-7 w-7 items-center justify-center rounded-[8px] text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800"
                                      >
                                        <ArrowUp className="h-3 w-3" />
                                      </button>
                                    )}

                                    {index < fieldOptionsList.length - 1 && (
                                      <button
                                        type="button"
                                        onClick={() => handleMoveOption(index, 'down')}
                                        className="flex h-7 w-7 items-center justify-center rounded-[8px] text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800"
                                      >
                                        <ArrowDown className="h-3 w-3" />
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleRemoveOption(option.id)}
                                      className="flex h-7 w-7 items-center justify-center rounded-[8px] text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                    >
                                      <CancelIcon className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        {optionError && (
                          <p className="text-[10px] font-semibold text-rose-500">
                            {optionError}
                          </p>
                        )}
                      </div>
                    )}

                    <div
                      className="
                        flex
                        flex-wrap
                        gap-x-4
                        gap-y-2
                        border-t
                        border-slate-100
                        pt-3
                        dark:border-white/[0.06]
                      "
                    >
                      <label
                        className="
                          flex
                          cursor-pointer
                          items-center
                          gap-1.5
                        "
                      >
                        <input
                          type="checkbox"
                          checked={
                            fieldRequired
                          }
                          onChange={
                            event =>
                              setFieldRequired(
                                event.target.checked,
                              )
                          }
                          className="
                            h-3.5
                            w-3.5
                            rounded
                            border-slate-300
                            text-indigo-600
                          "
                        />

                        <span
                          className="
                            text-[11px]
                            font-semibold
                            text-slate-600
                            dark:text-slate-300
                          "
                        >
                          إلزامي
                        </span>
                      </label>

                      <label
                        className="
                          flex
                          cursor-pointer
                          items-center
                          gap-1.5
                        "
                      >
                        <input
                          type="checkbox"
                          checked={
                            fieldIncludeInItemName
                          }
                          onChange={
                            event =>
                              setFieldIncludeInItemName(
                                event.target.checked,
                              )
                          }
                          className="
                            h-3.5
                            w-3.5
                            rounded
                            border-slate-300
                            text-indigo-600
                          "
                        />

                        <span
                          className="
                            text-[11px]
                            font-semibold
                            text-slate-600
                            dark:text-slate-300
                          "
                        >
                          يدخل في اسم الصنف
                        </span>
                      </label>
                    </div>

                    <div
                      className="
                        flex
                        justify-end
                        gap-2
                        border-t
                        border-slate-100
                        pt-3
                        dark:border-white/[0.06]
                      "
                    >
                      <button
                        type="button"
                        onClick={
                          handleCancelFieldEdit
                        }
                        className="
                          h-9
                          rounded-[9px]
                          px-3
                          text-xs
                          font-semibold
                          text-slate-500
                          hover:bg-slate-100
                          dark:hover:bg-neutral-800
                        "
                      >
                        إلغاء
                      </button>

                      <button
                        type="button"
                        onClick={
                          handleSaveFieldToCategory
                        }
                        className="
                          flex
                          h-9
                          items-center
                          gap-1
                          rounded-[9px]
                          bg-slate-900
                          px-4
                          text-xs
                          font-semibold
                          text-white
                          dark:bg-white
                          dark:text-slate-900
                        "
                      >
                        <Check
                          className="
                            h-3.5
                            w-3.5
                          "
                        />

                        حفظ الحقل
                      </button>
                    </div>
                  </motion.div>
                )}

                <div
                  className="
                    space-y-2
                  "
                >
                  <AnimatePresence
                    initial={
                      false
                    }
                  >
                    {customFields.length >
                    0 ? (
                      customFields.map(
                        (
                          field,
                          index,
                        ) => {
                          const typeInfo =
                            FIELD_TYPES.find(
                              type =>
                                type.id ===
                                field.type,
                            ) ||
                            FIELD_TYPES[0];

                          const FieldIcon =
                            typeInfo.icon;

                          const isConfirmingDelete =
                            deleteFieldConfirmId ===
                            field.id;

                          return (
                            <motion.div
                              layout
                              key={
                                field.id
                              }
                              initial={{
                                opacity: 0,
                                y: 5,
                              }}
                              animate={{
                                opacity: 1,
                                y: 0,
                              }}
                              exit={{
                                opacity: 0,
                                y: -5,
                              }}
                              className="
                                flex
                                min-h-[58px]
                                items-center
                                justify-between
                                gap-3
                                rounded-[14px]
                                border
                                border-slate-200/60
                                bg-white
                                p-3
                                dark:border-white/[0.06]
                                dark:bg-neutral-900
                              "
                            >
                              <div
                                className="
                                  flex
                                  min-w-0
                                  items-center
                                  gap-2.5
                                "
                              >
                                <div
                                  className="
                                    flex
                                    h-8
                                    w-8
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-[9px]
                                    bg-slate-100
                                    text-slate-600
                                    dark:bg-neutral-800
                                    dark:text-slate-300
                                  "
                                >
                                  <FieldIcon
                                    className="
                                      h-3.5
                                      w-3.5
                                    "
                                  />
                                </div>

                                <div
                                  className="
                                    min-w-0
                                  "
                                >
                                  <div
                                    className="
                                      flex
                                      flex-wrap
                                      items-center
                                      gap-1
                                    "
                                  >
                                    <span
                                      className="
                                        break-words
                                        text-xs
                                        font-semibold
                                        text-slate-800
                                        dark:text-white
                                      "
                                    >
                                      {
                                        field.label
                                      }
                                    </span>

                                    {field.required && (
                                      <span
                                        className="
                                          rounded
                                          bg-rose-50
                                          px-1
                                          py-0.5
                                          text-[9px]
                                          font-bold
                                          text-rose-600
                                          dark:bg-rose-950/30
                                        "
                                      >
                                        إلزامي
                                      </span>
                                    )}

                                    {field.includeInItemName && (
                                      <span
                                        className="
                                          rounded
                                          bg-emerald-50
                                          px-1
                                          py-0.5
                                          text-[9px]
                                          font-bold
                                          text-emerald-600
                                          dark:bg-emerald-950/30
                                        "
                                      >
                                        الاسم
                                      </span>
                                    )}
                                  </div>

                                  <span
                                    className="
                                      mt-0.5
                                      block
                                      break-words
                                      text-[10px]
                                      font-normal
                                      text-slate-400
                                    "
                                  >
                                    {
                                      typeInfo.label
                                    }

                                    {field.suffix &&
                                      ` • ${field.suffix}`}

                                    {field.type ===
                                      'select' &&
                                      field.options &&
                                      ` • ${field.options.length} خيارات`}

                                    {field.type ===
                                      'fixed' &&
                                      ` • ${field.fixedValue}`}
                                  </span>
                                </div>
                              </div>

                              <div
                                className="
                                  flex
                                  shrink-0
                                  items-center
                                  gap-0.5
                                "
                              >
                                {index >
                                  0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleMoveField(
                                        index,
                                        'up',
                                      )
                                    }
                                    className="
                                      flex
                                      h-7
                                      w-7
                                      items-center
                                      justify-center
                                      rounded-[8px]
                                      text-slate-400
                                      hover:bg-slate-100
                                      dark:hover:bg-neutral-800
                                    "
                                  >
                                    <ArrowUp
                                      className="
                                        h-3
                                        w-3
                                      "
                                    />
                                  </button>
                                )}

                                {index <
                                  customFields.length -
                                    1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleMoveField(
                                        index,
                                        'down',
                                      )
                                    }
                                    className="
                                      flex
                                      h-7
                                      w-7
                                      items-center
                                      justify-center
                                      rounded-[8px]
                                      text-slate-400
                                      hover:bg-slate-100
                                      dark:hover:bg-neutral-800
                                    "
                                  >
                                    <ArrowDown
                                      className="
                                        h-3
                                        w-3
                                      "
                                    />
                                  </button>
                                )}

                                {isConfirmingDelete ? (
                                  <div
                                    className="
                                      flex
                                      items-center
                                      gap-1
                                    "
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteField(
                                          field.id,
                                        )
                                      }
                                      className="
                                        rounded-[7px]
                                        bg-rose-600
                                        px-2
                                        py-1
                                        text-[9px]
                                        font-bold
                                        text-white
                                      "
                                    >
                                      تأكيد
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDeleteFieldConfirmId(
                                          null,
                                        )
                                      }
                                      className="
                                        px-1
                                        text-[9px]
                                        font-bold
                                        text-slate-400
                                      "
                                    >
                                      إلغاء
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenEditField(
                                          field,
                                        )
                                      }
                                      className="
                                        flex h-8 w-8 items-center justify-center
                                        rounded-full bg-slate-100 text-slate-500
                                        transition hover:bg-slate-200 hover:text-slate-800
                                        active:scale-95 dark:bg-neutral-800
                                        dark:text-slate-300 dark:hover:bg-neutral-700
                                        dark:hover:text-white
                                      "
                                      title="تعديل الحقل"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRequestDeleteField(
                                          field.id,
                                        )
                                      }
                                      className="
                                        flex h-8 w-8 items-center justify-center
                                        rounded-full text-slate-400 transition
                                        hover:bg-rose-50 hover:text-rose-600
                                        active:scale-95 dark:hover:bg-rose-950/25
                                        dark:hover:text-rose-400
                                      "
                                      title="حذف الحقل"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </motion.div>
                          );
                        },
                      )
                    ) : (
                      <div
                        className="
                          rounded-[14px]
                          border
                          border-dashed
                          border-slate-300
                          bg-white
                          p-4
                          text-center
                          dark:border-white/[0.1]
                          dark:bg-neutral-900
                        "
                      >
                        <p
                          className="
                            text-xs
                            font-semibold
                            text-slate-500
                            dark:text-slate-400
                          "
                        >
                          لا توجد حقول مخصصة بعد. يمكنك إضافة الحقول التي تحتاجها لهذا القسم.
                        </p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {canManageVisibility && (
              <div
                className="
                  rounded-[16px]
                  border
                  border-slate-200/60
                  bg-slate-50/80
                  p-3
                  dark:border-white/[0.05]
                  dark:bg-neutral-800/60
                "
              >
                <label
                  className="
                    flex
                    cursor-pointer
                    items-center
                    gap-2.5
                  "
                >
                  <input
                    type="checkbox"
                    checked={
                      hiddenForStaff
                    }
                    onChange={
                      event =>
                        setHiddenForStaff(
                          event.target.checked,
                        )
                    }
                    className="
                      h-4
                      w-4
                      rounded
                      border-slate-300
                      text-amber-600
                      focus:ring-amber-500
                    "
                  />

                  <div>
                    <span
                      className="
                        block
                        text-xs
                        font-semibold
                        text-slate-800
                        dark:text-slate-200
                      "
                    >
                      إخفاء القسم عن الموظفين
                    </span>

                    <span
                      className="
                        mt-0.5
                        block
                        text-[10px]
                        font-normal
                        text-slate-500
                        dark:text-slate-400
                      "
                    >
                      عند التفعيل لن يظهر القسم أو أصنافه للموظفين.
                    </span>
                  </div>
                </label>
              </div>
              )}

              {error && (
                <p
                  className="
                    rounded-[12px]
                    bg-rose-50
                    p-2.5
                    text-xs
                    font-semibold
                    text-rose-500
                    dark:bg-rose-950/40
                  "
                >
                  {error}
                </p>
              )}

              {isSuccess && (
                <p
                  className="
                    rounded-[12px]
                    bg-emerald-50
                    p-2.5
                    text-xs
                    font-semibold
                    text-emerald-600
                    dark:bg-emerald-950/40
                  "
                >
                  تم حفظ القسم بنجاح
                </p>
              )}

              <div
                className="
                  flex
                  gap-2
                  pt-1
                "
              >
                <button
                  type="submit"
                  className="
                    flex
                    h-11
                    flex-1
                    items-center
                    justify-center
                    gap-2
                    rounded-[12px]
                    bg-slate-900
                    px-4
                    text-xs
                    font-bold
                    text-white
                    transition
                    active:scale-[0.98]
                    dark:bg-white
                    dark:text-slate-900
                  "
                >
                  {editingCatId ? (
                    <EditIcon />
                  ) : (
                    <PlusIcon />
                  )}

                  <span>
                    {editingCatId
                      ? 'حفظ القسم'
                      : 'إضافة القسم'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={
                    handleCancelEdit
                  }
                  className="
                    h-11
                    rounded-[12px]
                    border
                    border-slate-200
                    px-4
                    text-xs
                    font-bold
                    text-slate-600
                    transition
                    hover:bg-slate-50
                    dark:border-white/[0.08]
                    dark:text-slate-300
                    dark:hover:bg-neutral-800
                  "
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        )}
      </ResponsiveOverlay>
    );
  };

export default CategoryManagerModal;