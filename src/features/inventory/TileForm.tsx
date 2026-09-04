import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Tile,
  UnitType,
  Category,
  CustomCategoryField,
} from '@/types';

import {
  SaveIcon,
  CameraIcon,
  SettingsIcon,
} from '@/components/ui/Icons';

import {
  isSystemCategory,
  buildNameFromCustomFields,
} from '@/features/categories';

import {
  Image as ImageIcon,
  Calculator,
  Info,
} from 'lucide-react';

import {
  ResponsiveOverlay,
} from '@/components/ui/ResponsiveOverlay';

import {
  AppChoiceField,
  AppChoiceOption,
} from '@/components/ui/AppChoiceField';

interface TileFormProps {
  onSave: (tile: any) => Promise<void>;
  editingTile: Tile | null;
  onCancel: () => void;
  onViewImage: (src: string) => void;
  activeCategoryId?: string;
  category?: Category;
  categories?: Category[];
  onSelectCategory?: (
    catId: string,
  ) => void;
  onCustomizeCategory?: () => void;
  allowCategorySwitch?: boolean;
  canManageVisibility?: boolean;
}

const PORCELAIN_PRESETS = [
  {
    label: '120×60 سم',
    desc: '120*60',
    mBox: 2.16,
    bPallet: 44,
  },
  {
    label: '60×60 سم',
    desc: '60*60',
    mBox: 1.8,
    bPallet: 36,
  },
];

const CERAMIC_PRESETS = [
  {
    label:
      '60*60 - فاشون (1.46 م² - 36 كرتونة)',
    desc:
      '60*60 - فاشون',
    mBox: 1.46,
    bPallet: 36,
  },
  {
    label:
      '60*60 - بريما - قص ليزر (1.41 م² - 36 كرتونة)',
    desc:
      '60*60 - بريما - قص ليزر',
    mBox: 1.41,
    bPallet: 36,
  },
  {
    label:
      '60*60 - بريما - قص عادي (1.44 م² - 36 كرتونة)',
    desc:
      '60*60 - بريما - قص عادي',
    mBox: 1.44,
    bPallet: 36,
  },
  {
    label:
      '60*60 - 14 ملم (1.08 م² - 36 كرتونة)',
    desc:
      '60*60 - 14 ملم',
    mBox: 1.08,
    bPallet: 36,
  },
  {
    label:
      '30*60 - بريما (1.62 م² - 48 كرتونة)',
    desc:
      '30*60 - بريما',
    mBox: 1.62,
    bPallet: 48,
  },
  {
    label:
      '30*60 - فاشون (1.62 م² - 32 كرتونة)',
    desc:
      '30*60 - فاشون',
    mBox: 1.62,
    bPallet: 32,
  },
  {
    label:
      '50*50 (1.50 م² - 32 كرتونة)',
    desc:
      '50*50',
    mBox: 1.5,
    bPallet: 32,
  },
];

const DEFAULT_IMAGES: Record<
  string,
  string
> = {
  tiles: '',
  ceramics: '',
  shower_box: '',
  general: '',
};

interface FormState {
  name: string;
  unitType: UnitType;
  quality: string;
  shade: string;
  size: string;
  surface: string;
  boxes: number | string;
  meters: number | string;
  pallets: number | string;
  color: string;
  itemType: string;
  materialOrGlass: string;
  brand: string;
  image: string;
  notes: string;
  hiddenForStaff?: boolean;
}

const TileForm:
  React.FC<TileFormProps> = ({
    onSave,
    editingTile,
    onCancel,
    onViewImage,
    activeCategoryId = 'tiles',
    category,
    categories = [],
    onSelectCategory,
    onCustomizeCategory,
    allowCategorySwitch = false,
    canManageVisibility = true,
  }) => {
    const [
      selectedCatId,
      setSelectedCatId,
    ] = useState<string>(
      () => {
        return (
          editingTile?.categoryId ||
          activeCategoryId ||
          'tiles'
        );
      },
    );

    useEffect(() => {
      if (
        editingTile?.categoryId
      ) {
        setSelectedCatId(
          editingTile.categoryId,
        );
      } else if (
        activeCategoryId
      ) {
        setSelectedCatId(
          activeCategoryId,
        );
      }
    }, [
      editingTile,
      activeCategoryId,
    ]);

    const effectiveCategory =
      React.useMemo<Category>(
        () => {
          if (
            categories &&
            categories.length >
              0
          ) {
            const found =
              categories.find(
                c =>
                  c.id ===
                  selectedCatId,
              );

            if (found) {
              return found;
            }
          }

          if (
            category &&
            category.id ===
              selectedCatId
          ) {
            return category;
          }

          if (
            selectedCatId ===
            'tiles'
          ) {
            return {
              id: 'tiles',
              name: 'بورسلان',
              themeColor:
                'sky' as const,
              defaultUnit:
                'meters' as UnitType,
              isSystemCategory:
                true,
            };
          }

          if (
            selectedCatId ===
            'ceramics'
          ) {
            return {
              id: 'ceramics',
              name: 'سيراميك',
              themeColor:
                'rose' as const,
              defaultUnit:
                'meters' as UnitType,
              isSystemCategory:
                true,
            };
          }

          return {
            id:
              selectedCatId,
            name:
              selectedCatId,
            themeColor:
              'indigo' as const,
            defaultUnit:
              'pieces' as UnitType,
            isSystemCategory:
              false,
          };
        },
        [
          selectedCatId,
          categories,
          category,
        ],
      );

    const isSystem =
      isSystemCategory(
        selectedCatId,
      );

    const isPorcelain =
      selectedCatId ===
      'tiles';

    const isCeramic =
      selectedCatId ===
      'ceramics';

    const activeCustomFields:
      CustomCategoryField[] =
      React.useMemo(
        () => {
          if (
            effectiveCategory
              ?.customFields &&
            Array.isArray(
              effectiveCategory.customFields,
            )
          ) {
            return [
              ...effectiveCategory.customFields,
            ].sort(
              (
                a,
                b,
              ) =>
                (a.order ??
                  0) -
                (b.order ??
                  0),
            );
          }

          return [];
        },
        [
          effectiveCategory,
        ],
      );

    const showImageField =
      effectiveCategory
        .fieldsConfig
        ?.hasImage !==
      false;

    const showSizeField =
      !isSystem ||
      effectiveCategory
        .fieldsConfig
        ?.hasSize !==
        false;

    const showItemTypeField =
      isSystem &&
      effectiveCategory
        .fieldsConfig
        ?.hasItemType ===
        true;

    const showMaterialField =
      isSystem &&
      effectiveCategory
        .fieldsConfig
        ?.hasMaterial ===
        true;

    const showColorField =
      isSystem &&
      effectiveCategory
        .fieldsConfig
        ?.hasColor ===
        true;

    const showBrandField =
      isSystem &&
      effectiveCategory
        .fieldsConfig
        ?.hasBrand ===
        true;

    const defaultUnit:
      UnitType =
      effectiveCategory
        ?.defaultUnit ||
      (isSystem
        ? 'meters'
        : 'pieces');

    const [
      formState,
      setFormState,
    ] = useState<FormState>(
      () => {
        return {
          name: '',
          unitType:
            defaultUnit,
          quality:
            'نخب أول',
          shade: '',

          size:
            isPorcelain
              ? PORCELAIN_PRESETS[0]
                  .desc
              : isCeramic
                ? CERAMIC_PRESETS[0]
                    .desc
                : '',

          surface:
            'لامع',

          boxes: '',
          meters: '',
          pallets: '',

          color: '',
          itemType: '',
          materialOrGlass:
            '',
          brand: '',

          image:
            DEFAULT_IMAGES[
              selectedCatId
            ] ||
            DEFAULT_IMAGES
              .general,

          notes: '',

          hiddenForStaff:
            false,
        };
      },
    );

    const [
      customValues,
      setCustomValues,
    ] = useState<
      Record<
        string,
        string | number
      >
    >(() => {
      if (
        editingTile?.customValues
      ) {
        return {
          ...editingTile.customValues,
        };
      }

      const initial:
        Record<
          string,
          string | number
        > = {};

      activeCustomFields.forEach(
        field => {
          if (
            field.type ===
              'fixed' &&
            field.fixedValue
          ) {
            initial[
              field.id
            ] =
              field.fixedValue;
          }
        },
      );

      return initial;
    });

    const [
      selectedPresetIdx,
      setSelectedPresetIdx,
    ] =
      useState<number>(0);

    const [
      metersPerBox,
      setMetersPerBox,
    ] =
      useState<number>(
        () => {
          if (
            isPorcelain
          ) {
            return PORCELAIN_PRESETS[0]
              .mBox;
          }

          if (
            isCeramic
          ) {
            return CERAMIC_PRESETS[0]
              .mBox;
          }

          return 1.44;
        },
      );

    const [
      boxesPerPallet,
      setBoxesPerPallet,
    ] =
      useState<number>(
        () => {
          if (
            isPorcelain
          ) {
            return PORCELAIN_PRESETS[0]
              .bPallet;
          }

          if (
            isCeramic
          ) {
            return CERAMIC_PRESETS[0]
              .bPallet;
          }

          return 32;
        },
      );

    const [
      isCustomSize,
      setIsCustomSize,
    ] = useState(false);

    const [
      isCompressing,
      setIsCompressing,
    ] = useState(false);

    const [
      isSaving,
      setIsSaving,
    ] = useState(false);

    const fileInputRef =
      useRef<HTMLInputElement>(
        null,
      );

    const cameraInputRef =
      useRef<HTMLInputElement>(
        null,
      );

    useEffect(() => {
      if (editingTile) {
        setFormState({
          name:
            editingTile.name ||
            '',

          unitType:
            editingTile.unitType ||
            defaultUnit,

          quality:
            editingTile.quality ||
            'نخب أول',

          shade:
            editingTile.shade ||
            '',

          size:
            editingTile.size ||
            '',

          surface:
            editingTile.surface ||
            'لامع',

          boxes:
            editingTile.boxes ===
            0
              ? ''
              : editingTile.boxes,

          meters:
            editingTile.meters ===
            0
              ? ''
              : editingTile.meters,

          pallets:
            editingTile.pallets ===
            0
              ? ''
              : editingTile.pallets,

          color:
            editingTile.color ||
            '',

          itemType:
            editingTile.itemType ||
            '',

          materialOrGlass:
            editingTile.materialOrGlass ||
            '',

          brand:
            editingTile.brand ||
            '',

          image:
            editingTile.image ||
            DEFAULT_IMAGES[
              selectedCatId
            ] ||
            DEFAULT_IMAGES
              .general,

          notes:
            editingTile.notes ||
            '',

          hiddenForStaff:
            editingTile.hiddenForStaff ||
            false,
        });

        if (
          editingTile.customValues
        ) {
          setCustomValues({
            ...editingTile.customValues,
          });
        } else {
          const initial:
            Record<
              string,
              string | number
            > = {};

          activeCustomFields.forEach(
            field => {
              if (
                field.type ===
                  'fixed' &&
                field.fixedValue
              ) {
                initial[
                  field.id
                ] =
                  field.fixedValue;
              }
            },
          );

          setCustomValues(
            initial,
          );
        }

        if (
          isPorcelain
        ) {
          const presetIndex =
            PORCELAIN_PRESETS.findIndex(
              preset =>
                preset.desc ===
                editingTile.size,
            );

          if (
            presetIndex >=
            0
          ) {
            setSelectedPresetIdx(
              presetIndex,
            );

            setMetersPerBox(
              PORCELAIN_PRESETS[
                presetIndex
              ].mBox,
            );

            setBoxesPerPallet(
              PORCELAIN_PRESETS[
                presetIndex
              ].bPallet,
            );

            setIsCustomSize(
              false,
            );
          } else {
            setIsCustomSize(
              true,
            );
          }
        } else if (
          isCeramic
        ) {
          const presetIndex =
            CERAMIC_PRESETS.findIndex(
              preset =>
                preset.desc ===
                editingTile.size,
            );

          if (
            presetIndex >=
            0
          ) {
            setSelectedPresetIdx(
              presetIndex,
            );

            setMetersPerBox(
              CERAMIC_PRESETS[
                presetIndex
              ].mBox,
            );

            setBoxesPerPallet(
              CERAMIC_PRESETS[
                presetIndex
              ].bPallet,
            );

            setIsCustomSize(
              false,
            );
          } else {
            setIsCustomSize(
              true,
            );
          }
        }
      } else {
        const initialSize =
          isPorcelain
            ? PORCELAIN_PRESETS[0]
                .desc
            : isCeramic
              ? CERAMIC_PRESETS[0]
                  .desc
              : '';

        setFormState(
          previous => ({
            ...previous,

            unitType:
              defaultUnit,

            size:
              previous.size ||
              initialSize,

            image:
              previous.image ||
              DEFAULT_IMAGES[
                selectedCatId
              ] ||
              DEFAULT_IMAGES
                .general,
          }),
        );

        const initial:
          Record<
            string,
            string | number
          > = {};

        activeCustomFields.forEach(
          field => {
            if (
              field.type ===
                'fixed' &&
              field.fixedValue
            ) {
              initial[
                field.id
              ] =
                field.fixedValue;
            }
          },
        );

        setCustomValues(
          initial,
        );

        setSelectedPresetIdx(
          0,
        );

        if (
          isPorcelain
        ) {
          setMetersPerBox(
            PORCELAIN_PRESETS[0]
              .mBox,
          );

          setBoxesPerPallet(
            PORCELAIN_PRESETS[0]
              .bPallet,
          );
        } else if (
          isCeramic
        ) {
          setMetersPerBox(
            CERAMIC_PRESETS[0]
              .mBox,
          );

          setBoxesPerPallet(
            CERAMIC_PRESETS[0]
              .bPallet,
          );
        }

        setIsCustomSize(
          false,
        );
      }
    }, [
      editingTile,
      selectedCatId,
      effectiveCategory,
      isSystem,
      activeCustomFields,
    ]);

    const handleCategorySwitch =
      (
        newCatId: string,
      ) => {
        setSelectedCatId(
          newCatId,
        );

        onSelectCategory?.(
          newCatId,
        );

        const isNowPorcelain =
          newCatId ===
          'tiles';

        const isNowCeramic =
          newCatId ===
          'ceramics';

        const isNowSystem =
          isSystemCategory(
            newCatId,
          );

        const categoryObject =
          categories.find(
            c =>
              c.id ===
              newCatId,
          );

        const newUnit:
          UnitType =
          categoryObject
            ?.defaultUnit ||
          (isNowSystem
            ? 'meters'
            : 'pieces');

        setFormState(
          previous => ({
            ...previous,

            unitType:
              newUnit,

            size:
              isNowPorcelain
                ? PORCELAIN_PRESETS[0]
                    .desc
                : isNowCeramic
                  ? CERAMIC_PRESETS[0]
                      .desc
                  : '',
          }),
        );

        if (
          isNowPorcelain
        ) {
          setMetersPerBox(
            PORCELAIN_PRESETS[0]
              .mBox,
          );

          setBoxesPerPallet(
            PORCELAIN_PRESETS[0]
              .bPallet,
          );

          setSelectedPresetIdx(
            0,
          );

          setIsCustomSize(
            false,
          );
        } else if (
          isNowCeramic
        ) {
          setMetersPerBox(
            CERAMIC_PRESETS[0]
              .mBox,
          );

          setBoxesPerPallet(
            CERAMIC_PRESETS[0]
              .bPallet,
          );

          setSelectedPresetIdx(
            0,
          );

          setIsCustomSize(
            false,
          );
        }
      };

    const compressImage =
      (
        base64: string,
      ): Promise<string> => {
        return new Promise(
          (resolve, reject) => {
            const image =
              new Image();

            image.src =
              base64;

            image.onerror =
              () =>
                reject(
                  new Error('تعذر قراءة الصورة المحددة.'),
                );

            image.onload =
              () => {
                const canvas =
                  document.createElement(
                    'canvas',
                  );

                const MAX_WIDTH =
                  600;
                const MAX_HEIGHT =
                  900;

                let width =
                  image.width;

                let height =
                  image.height;

                const scale = Math.min(
                  1,
                  MAX_WIDTH / Math.max(width, 1),
                  MAX_HEIGHT / Math.max(height, 1),
                );

                width = Math.max(
                  1,
                  Math.round(width * scale),
                );
                height = Math.max(
                  1,
                  Math.round(height * scale),
                );

                canvas.width =
                  width;

                canvas.height =
                  height;

                const context =
                  canvas.getContext(
                    '2d',
                  );

                if (!context) {
                  reject(
                    new Error('تعذر تجهيز الصورة على هذا الجهاز.'),
                  );
                  return;
                }

                context.drawImage(
                  image,
                  0,
                  0,
                  width,
                  height,
                );

                resolve(
                  canvas.toDataURL(
                    'image/jpeg',
                    0.7,
                  ),
                );
              };
          },
        );
      };

    const handleImageCapture =
      (
        event:
          React.ChangeEvent<HTMLInputElement>,
      ) => {
        const file =
          event.target.files?.[0];

        if (!file) {
          return;
        }

        setIsCompressing(
          true,
        );

        const reader =
          new FileReader();

        reader.onloadend =
          async () => {
            try {
              const compressed =
                await compressImage(
                  reader.result as string,
                );

              setFormState(
                previous => ({
                  ...previous,
                  image:
                    compressed,
                }),
              );
            } catch (error) {
              console.error('Image compression error:', error);
              alert(
                error instanceof Error
                  ? error.message
                  : 'تعذر تجهيز الصورة. جرّب صورة أخرى.',
              );
            } finally {
              setIsCompressing(
                false,
              );
            }
          };

        reader.onerror =
          () => {
            setIsCompressing(false);
            alert('تعذر قراءة ملف الصورة.');
          };

        reader.readAsDataURL(
          file,
        );
      };

    const handleSelectPreset =
      (
        index: number,
        porcelain: boolean,
      ) => {
        setSelectedPresetIdx(
          index,
        );

        const preset =
          porcelain
            ? PORCELAIN_PRESETS[
                index
              ]
            : CERAMIC_PRESETS[
                index
              ];

        setIsCustomSize(
          false,
        );

        setMetersPerBox(
          preset.mBox,
        );

        setBoxesPerPallet(
          preset.bPallet,
        );

        setFormState(
          previous => {
            const nextState = {
              ...previous,
              size:
                preset.desc,
            };

            const meters =
              parseFloat(
                String(
                  previous.meters,
                ),
              );

            if (
              !Number.isNaN(
                meters,
              ) &&
              meters > 0 &&
              preset.mBox > 0
            ) {
              const boxes =
                Math.ceil(
                  meters /
                    preset.mBox,
                );

              const pallets =
                preset.bPallet >
                0
                  ? parseFloat(
                      (
                        boxes /
                        preset.bPallet
                      ).toFixed(
                        2,
                      ),
                    )
                  : '';

              nextState.boxes =
                boxes;

              nextState.pallets =
                pallets;
            }

            return nextState;
          },
        );
      };

    const handleMetersChange =
      (
        value: string,
      ) => {
        const meters =
          parseFloat(
            value,
          );

        if (
          Number.isNaN(
            meters,
          ) ||
          meters <= 0
        ) {
          setFormState(
            previous => ({
              ...previous,
              meters:
                value,
              boxes: '',
              pallets: '',
            }),
          );

          return;
        }

        const boxes =
          metersPerBox >
          0
            ? Math.ceil(
                meters /
                  metersPerBox,
              )
            : '';

        const pallets =
          boxes !== '' &&
          boxesPerPallet >
            0
            ? parseFloat(
                (
                  Number(
                    boxes,
                  ) /
                  boxesPerPallet
                ).toFixed(
                  2,
                ),
              )
            : '';

        setFormState(
          previous => ({
            ...previous,
            meters:
              value,
            boxes,
            pallets,
          }),
        );
      };

    const handleBoxesChange =
      (
        value: string,
      ) => {
        const boxes =
          parseFloat(
            value,
          );

        if (
          Number.isNaN(
            boxes,
          ) ||
          boxes <= 0
        ) {
          setFormState(
            previous => ({
              ...previous,
              boxes:
                value,
              meters: '',
              pallets: '',
            }),
          );

          return;
        }

        const meters =
          metersPerBox >
          0
            ? parseFloat(
                (
                  boxes *
                  metersPerBox
                ).toFixed(
                  2,
                ),
              )
            : '';

        const pallets =
          boxesPerPallet >
          0
            ? parseFloat(
                (
                  boxes /
                  boxesPerPallet
                ).toFixed(
                  2,
                ),
              )
            : '';

        setFormState(
          previous => ({
            ...previous,
            boxes:
              value,
            meters,
            pallets,
          }),
        );
      };

    const handlePalletsChange =
      (
        value: string,
      ) => {
        const pallets =
          parseFloat(
            value,
          );

        if (
          Number.isNaN(
            pallets,
          ) ||
          pallets <= 0
        ) {
          setFormState(
            previous => ({
              ...previous,
              pallets:
                value,
            }),
          );

          return;
        }

        const boxes =
          boxesPerPallet >
          0
            ? Math.ceil(
                pallets *
                  boxesPerPallet,
              )
            : '';

        const meters =
          boxes !== '' &&
          metersPerBox >
            0
            ? parseFloat(
                (
                  Number(
                    boxes,
                  ) *
                  metersPerBox
                ).toFixed(
                  2,
                ),
              )
            : '';

        setFormState(
          previous => ({
            ...previous,
            pallets:
              value,
            boxes,
            meters,
          }),
        );
      };

    const handleCustomFieldChange =
      (
        fieldId: string,
        value:
          | string
          | number,
      ) => {
        setCustomValues(
          previous => ({
            ...previous,
            [fieldId]:
              value,
          }),
        );
      };

    const buildSnapshotForSave =
      () => {
        const currentFieldIds =
          new Set(
            activeCustomFields.map(
              field =>
                field.id,
            ),
          );

        const preservedLegacy =
          (
            editingTile
              ?.customFieldSnapshot ||
            []
          ).filter(
            snapshot =>
              !currentFieldIds.has(
                snapshot.fieldId,
              ),
          );

        const currentSnapshots =
          activeCustomFields
            .map(
              field => {
                const rawValue =
                  field.type ===
                  'fixed'
                    ? field.fixedValue ||
                      ''
                    : customValues[
                        field.id
                      ];

                if (
                  rawValue ===
                    undefined ||
                  rawValue ===
                    null ||
                  String(
                    rawValue,
                  ).trim() ===
                    ''
                ) {
                  return null;
                }

                let displayValue:
                  | string
                  | number =
                  rawValue;

                if (
                  field.type ===
                  'select'
                ) {
                  const selectedOption =
                    field.options?.find(
                      option =>
                        option.value ===
                        String(
                          rawValue,
                        ),
                    );

                  if (
                    selectedOption
                  ) {
                    displayValue =
                      selectedOption.label;
                  }
                }

                return {
                  fieldId:
                    field.id,

                  label:
                    field.label,

                  value:
                    displayValue,

                  suffix:
                    field.type ===
                    'fixed'
                      ? undefined
                      : field.suffix,
                };
              },
            )
            .filter(
              Boolean,
            ) as Tile['customFieldSnapshot'];

        return [
          ...preservedLegacy,
          ...(currentSnapshots ||
            []),
        ];
      };

    const saveTileSafely =
      async (tileToSave: any) => {
        setIsSaving(true);

        try {
          await onSave(tileToSave);
        } catch (error) {
          console.error('Item save failed:', error);

          const message =
            error instanceof Error && error.message
              ? error.message
              : 'تعذر حفظ الصنف. تحقق من الاتصال ثم حاول مرة أخرى.';

          alert(message);
          setIsSaving(false);
          return false;
        }

        return true;
      };

    const handleSubmit =
      async (
        event:
          React.FormEvent,
      ) => {
        event.preventDefault();

        if (isSaving || isCompressing) {
          return;
        }

        if (!isSystem) {
          const fieldCount =
            activeCustomFields.length;

          const missingRequiredField =
            activeCustomFields.find(field => {
              if (!field.required) return false;

              if (field.type === 'fixed') {
                return !String(field.fixedValue || '').trim();
              }

              const value = customValues[field.id];
              return value === undefined || String(value).trim() === '';
            });

          if (missingRequiredField) {
            alert(`يرجى تعبئة الحقل المطلوب: ${missingRequiredField.label}`);
            return;
          }

          let finalName =
            formState.name.trim();

          if (
            fieldCount >
            0
          ) {
            const hasAnyValue =
              activeCustomFields.some(
                field => {
                  const value =
                    customValues[
                      field.id
                    ];

                  return (
                    value !==
                      undefined &&
                    String(
                      value,
                    ).trim() !==
                      ''
                  );
                },
              );

            if (
              !hasAnyValue &&
              !finalName
            ) {
              alert(
                'يرجى إدخال اسم الصنف أو تعبئة أحد الخصائص المميزة',
              );

              return;
            }

            const autoGenerated =
              buildNameFromCustomFields(
                activeCustomFields,
                customValues,
              );

            if (
              autoGenerated
            ) {
              finalName =
                autoGenerated;
            }
          }

          if (
            !finalName
          ) {
            alert(
              'يرجى تحديد أو كتابة اسم الصنف',
            );

            return;
          }

          const quantityValue =
            Number(
              formState.meters,
            );

          if (
            formState.meters ===
              '' ||
            !Number.isFinite(
              quantityValue,
            ) ||
            quantityValue < 0
          ) {
            alert(
              'يرجى إدخال كمية متوفرة صحيحة',
            );

            return;
          }

          if (
            formState.unitType ===
              'pieces' &&
            !Number.isInteger(
              quantityValue,
            )
          ) {
            alert(
              'كمية الأصناف بالقطعة يجب أن تكون عدداً صحيحاً.',
            );

            return;
          }

          const tileToSave:
            any = {
            ...formState,

            name:
              finalName,

            categoryId:
              selectedCatId,

            image:
              formState.image ||
              editingTile
                ?.image ||
              '',

            customValues: {
              ...customValues,
            },

            customFieldSnapshot:
              buildSnapshotForSave(),

            boxes:
              formState.unitType ===
              'pieces'
                ? 0
                : Number(
                    formState.boxes,
                  ) ||
                  0,

            meters:
              Number(
                formState.meters,
              ) ||
              0,

            pallets:
              formState.unitType ===
              'pieces'
                ? 0
                : Number(
                    formState.pallets,
                  ) ||
                  0,

            hiddenForStaff:
              !!formState.hiddenForStaff,
          };

          if (
            editingTile
          ) {
            tileToSave.id =
              editingTile.id;
          }

          if (
            editingTile &&
            editingTile.reservations
          ) {
            tileToSave.reservations =
              editingTile.reservations;
          }

          await saveTileSafely(
            tileToSave,
          );

          return;
        }

        if (
          formState.meters ===
            '' &&
          formState.boxes ===
            ''
        ) {
          alert(
            'يرجى إدخال الكمية أو الأمتار',
          );

          return;
        }

        const numericMeters =
          formState.meters === ''
            ? 0
            : Number(formState.meters);
        const numericBoxes =
          formState.boxes === ''
            ? 0
            : Number(formState.boxes);
        const numericPallets =
          formState.pallets === ''
            ? 0
            : Number(formState.pallets);

        if (
          !Number.isFinite(numericMeters) ||
          !Number.isFinite(numericBoxes) ||
          !Number.isFinite(numericPallets) ||
          numericMeters < 0 ||
          numericBoxes < 0 ||
          numericPallets < 0
        ) {
          alert(
            'تأكد أن الكميات والكراتين والطبالي أرقام صحيحة وغير سالبة.',
          );
          return;
        }

        if (
          !formState.name.trim()
        ) {
          alert(
            'يرجى إدخال اسم الموديل أو الصنف',
          );

          return;
        }

        const tileToSave:
          any = {
          ...formState,

          name:
            formState.name.trim(),

          categoryId:
            selectedCatId,

          image:
            formState.image ||
            editingTile?.image ||
            '',

          customValues: {
            ...customValues,
          },

          customFieldSnapshot:
            buildSnapshotForSave(),

          boxes:
            Number(
              formState.boxes,
            ) ||
            0,

          meters:
            Number(
              formState.meters,
            ) ||
            0,

          pallets:
            Number(
              formState.pallets,
            ) ||
            0,

          hiddenForStaff:
            !!formState.hiddenForStaff,
        };

        if (
          editingTile
        ) {
          tileToSave.id =
            editingTile.id;
        }

        if (
          editingTile &&
          editingTile.reservations
        ) {
          tileToSave.reservations =
            editingTile.reservations;
        }

        await saveTileSafely(
          tileToSave,
        );
      };

    const allAvailableCats:
      Category[] =
      React.useMemo(
        () => {
          if (
            categories &&
            categories.length >
              0
          ) {
            return categories;
          }

          return [
            {
              id: 'tiles',
              name: 'بورسلان',
              themeColor:
                'sky',
              defaultUnit:
                'meters',
            },
            {
              id:
                'ceramics',
              name:
                'سيراميك',
              themeColor:
                'rose',
              defaultUnit:
                'meters',
            },
          ];
        },
        [
          categories,
        ],
      );

    const qualityOptions:
      AppChoiceOption[] = [
      {
        id: 'q1',
        value: 'نخب أول',
        label: 'نخب أول',
      },
      {
        id: 'q2',
        value: 'نخب ثاني',
        label: 'نخب ثاني',
      },
    ];

    const surfaceOptions:
      AppChoiceOption[] = [
      {
        id: 's1',
        value: 'لامع',
        label: 'لامع',
      },
      {
        id: 's2',
        value: 'مطفي',
        label: 'مطفي',
      },
    ];

    const presetOptions:
      AppChoiceOption[] =
      (
        isPorcelain
          ? PORCELAIN_PRESETS
          : CERAMIC_PRESETS
      ).map(
        (
          preset,
          index,
        ) => ({
          id:
            `preset-${index}`,

          value:
            index,

          label:
            isPorcelain
              ? preset.label
              : preset.desc.replace(
                  /\*/g,
                  '×',
                ),
        }),
      );

    const renderSystemAdditionalFields =
      () => {
        if (
          !isSystem ||
          activeCustomFields.length ===
            0
        ) {
          return null;
        }

        return (
          <div
            className="
              space-y-3
              rounded-2xl
              border
              border-slate-200/80
              bg-slate-50/80
              p-4
              dark:border-white/[0.06]
              dark:bg-neutral-800/40
            "
          >
            <div
              className="
                flex
                items-center
                justify-between
                gap-3
                border-b
                border-slate-200/60
                pb-2
                dark:border-neutral-700/60
              "
            >
              <div>
                <span className="block text-xs font-black text-slate-800 dark:text-slate-200">
                  تفاصيل إضافية
                </span>

                <span className="mt-0.5 block text-[9px] font-medium text-slate-400">
                  الحقول التي خصصتها لهذا القسم
                </span>
              </div>

              {onCustomizeCategory && (
                <button
                  type="button"
                  onClick={
                    onCustomizeCategory
                  }
                  className="rounded-[9px] px-2.5 py-1.5 text-[10px] font-bold text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
                >
                  تعديل الحقول
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {activeCustomFields.map(
                field => {
                  const value =
                    customValues[
                      field.id
                    ] ??
                    (
                      field.type ===
                      'fixed'
                        ? field.fixedValue ||
                          ''
                        : ''
                    );

                  if (
                    field.type ===
                    'fixed'
                  ) {
                    return (
                      <div
                        key={
                          field.id
                        }
                        className="flex min-h-11 items-center justify-between gap-3 rounded-[13px] border border-slate-200/70 bg-white px-3.5 py-2.5 dark:border-white/[0.07] dark:bg-neutral-900"
                      >
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          {
                            field.label
                          }
                        </span>

                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {field.fixedValue ||
                            '—'}
                        </span>
                      </div>
                    );
                  }

                  if (
                    field.type ===
                    'select'
                  ) {
                    return (
                      <AppChoiceField
                        mobilePresentation="inline"
                        key={
                          field.id
                        }
                        label={
                          field.label
                        }
                        value={
                          String(
                            value,
                          )
                        }
                        required={
                          field.required
                        }
                        placeholder={`اختر ${field.label}`}
                        options={(
                          field.options ||
                          []
                        ).map(
                          option => ({
                            id:
                              option.id,
                            label:
                              option.label,
                            value:
                              option.value,
                          }),
                        )}
                        onChange={
                          nextValue =>
                            handleCustomFieldChange(
                              field.id,
                              nextValue,
                            )
                        }
                      />
                    );
                  }

                  return (
                    <div
                      key={
                        field.id
                      }
                    >
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {
                          field.label
                        }

                        {field.required && (
                          <span className="text-rose-500">
                            {' '}*
                          </span>
                        )}
                      </label>

                      <input
                        type={
                          field.type ===
                          'number'
                            ? 'number'
                            : 'text'
                        }
                        value={
                          value
                        }
                        onChange={event =>
                          handleCustomFieldChange(
                            field.id,
                            event.target.value,
                          )
                        }
                        placeholder={
                          field.placeholder ||
                          `أدخل ${field.label}...`
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 dark:border-white/[0.08] dark:bg-neutral-900 dark:text-white"
                      />
                    </div>
                  );
                },
              )}
            </div>
          </div>
        );
      };

    return (
      <ResponsiveOverlay
        open={true}
        onClose={
          onCancel
        }
        title={
          editingTile
            ? 'تعديل الصنف'
            : 'إضافة صنف'
        }
        mobileSnap="compact"
        desktopMaxWidth="max-w-2xl"
        contentClassName="p-0"
      >
        <div
          className="
            border-b
            border-slate-100
            bg-white
            px-4
            py-3
            dark:border-white/[0.05]
            dark:bg-neutral-900
            sm:px-6
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
            <div className="min-w-0">
              <span
                className="
                  inline-flex
                  rounded-full
                  border
                  border-indigo-100
                  bg-indigo-50
                  px-2.5
                  py-1
                  text-[10px]
                  font-bold
                  text-indigo-700
                  dark:border-indigo-800/40
                  dark:bg-indigo-950/40
                  dark:text-indigo-300
                "
              >
                {
                  effectiveCategory.name
                }
              </span>
            </div>

            {onCustomizeCategory && (
                <button
                  type="button"
                  onClick={
                    onCustomizeCategory
                  }
                  className="
                    flex h-9 items-center gap-1.5 rounded-full
                    border border-slate-200/70 bg-slate-50 px-3
                    text-[10px] font-bold text-slate-600 shadow-sm
                    transition active:scale-[0.98]
                    hover:bg-slate-100 dark:border-white/[0.07]
                    dark:bg-neutral-800 dark:text-slate-300
                    dark:hover:bg-neutral-700
                  "
                >
                  <SettingsIcon className="h-3.5 w-3.5" />
                  تخصيص القسم
                </button>
              )}
          </div>

          {allowCategorySwitch &&
            !editingTile && (
              <div
                className="
                  mt-3
                  flex
                  items-center
                  gap-2
                  overflow-x-auto
                  pb-1
                "
              >
                <span
                  className="
                    shrink-0
                    text-[10px]
                    font-bold
                    text-slate-500
                    dark:text-slate-400
                  "
                >
                  اختر القسم
                </span>

                {allAvailableCats.map(
                  cat => {
                    const selected =
                      cat.id ===
                      selectedCatId;

                    return (
                      <button
                        key={
                          cat.id
                        }
                        type="button"
                        onClick={() =>
                          handleCategorySwitch(
                            cat.id,
                          )
                        }
                        className={`
                          h-9
                          shrink-0
                          rounded-full
                          px-3
                          text-xs
                          font-bold
                          transition-colors
                          ${
                            selected
                              ? `
                                bg-slate-900
                                text-white
                                dark:bg-white
                                dark:text-slate-900
                              `
                              : `
                                border
                                border-slate-200
                                bg-white
                                text-slate-600
                                dark:border-white/[0.07]
                                dark:bg-neutral-800
                                dark:text-slate-300
                              `
                          }
                        `}
                      >
                        {
                          cat.name
                        }
                      </button>
                    );
                  },
                )}
              </div>
            )}
        </div>

        <form
          id="tile-form"
          onSubmit={
            handleSubmit
          }
          className="
            space-y-4
            p-4
            sm:p-6
          "
        >
          {isSystem ? (
            <>
              <div
                className="
                  space-y-3.5
                  rounded-2xl
                  border
                  border-slate-200/80
                  bg-slate-50/80
                  p-4
                  dark:border-white/[0.06]
                  dark:bg-neutral-800/40
                "
              >
                <div
                  className="
                    flex
                    items-center
                    gap-2
                    border-b
                    border-slate-200/60
                    pb-2
                    dark:border-neutral-700/60
                  "
                >
                  <Info
                    className="
                      h-4
                      w-4
                      text-indigo-600
                      dark:text-indigo-400
                    "
                  />

                  <span
                    className="
                      text-xs
                      font-black
                      text-slate-800
                      dark:text-slate-200
                    "
                  >
                    البيانات والمواصفات الأساسية
                  </span>
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
                        text-xs
                        font-bold
                        text-slate-700
                        dark:text-slate-300
                      "
                    >
                      اسم الموديل / الصنف

                      <span className="text-rose-500">
                        {' '}*
                      </span>
                    </label>

                    <input
                      type="text"
                      value={
                        formState.name
                      }
                      onChange={event =>
                        setFormState(
                          previous => ({
                            ...previous,

                            name:
                              event.target.value,
                          }),
                        )
                      }
                      placeholder="مثال: رويال ماربل، بيج كلاسيك..."
                      required
                      className="
                        w-full
                        rounded-xl
                        border
                        border-slate-200
                        bg-white
                        px-3.5
                        py-2.5
                        text-sm
                        font-semibold
                        text-slate-800
                        outline-none
                        transition-all
                        placeholder:text-slate-400
                        focus:border-indigo-500
                        focus:ring-2
                        focus:ring-indigo-500/20
                        dark:border-white/[0.08]
                        dark:bg-neutral-900
                        dark:text-white
                      "
                    />
                  </div>

                  <AppChoiceField
                    mobilePresentation="inline"
                    label="النخب"
                    value={
                      formState.quality
                    }
                    options={
                      qualityOptions
                    }
                    onChange={value =>
                      setFormState(
                        previous => ({
                          ...previous,

                          quality:
                            String(
                              value,
                            ),
                        }),
                      )
                    }
                  />
                </div>

                {showSizeField && (
                  <div>
                    <AppChoiceField
                      mobilePresentation="inline"
                      label={
                        isPorcelain
                          ? 'المقاس'
                          : 'المواصفات (الشركة - القص - المقاس)'
                      }
                      value={
                        selectedPresetIdx
                      }
                      options={
                        presetOptions
                      }
                      onChange={value =>
                        handleSelectPreset(
                          Number(
                            value,
                          ),
                          isPorcelain,
                        )
                      }
                      placeholder="اختر المقاس"
                    />

                    {isCustomSize &&
                      editingTile && (
                      <div
                        className="
                          mt-2.5
                          grid
                          grid-cols-1
                          gap-2.5
                          rounded-xl
                          border
                          border-indigo-200
                          bg-white
                          p-3
                          dark:border-indigo-900/40
                          dark:bg-neutral-900
                          sm:grid-cols-3
                        "
                      >
                        <div>
                          <label
                            className="
                              mb-1
                              block
                              text-[11px]
                              font-bold
                              text-slate-600
                              dark:text-slate-400
                            "
                          >
                            المقاس المكتوب
                          </label>

                          <input
                            type="text"
                            value={
                              formState.size
                            }
                            onChange={event =>
                              setFormState(
                                previous => ({
                                  ...previous,

                                  size:
                                    event.target.value,
                                }),
                              )
                            }
                            placeholder="مثال: 80*80"
                            className="
                              w-full
                              rounded-lg
                              border
                              border-slate-200
                              bg-slate-50
                              px-2.5
                              py-1.5
                              text-xs
                              font-bold
                              outline-none
                              dark:border-neutral-700
                              dark:bg-neutral-800
                            "
                          />
                        </div>

                        <div>
                          <label
                            className="
                              mb-1
                              block
                              text-[11px]
                              font-bold
                              text-slate-600
                              dark:text-slate-400
                            "
                          >
                            أمتار الكرتونة (م²)
                          </label>

                          <input
                            type="number"
                            step="any"
                            value={
                              metersPerBox
                            }
                            onChange={event =>
                              setMetersPerBox(
                                parseFloat(
                                  event.target.value,
                                ) ||
                                  0,
                              )
                            }
                            className="
                              w-full
                              rounded-lg
                              border
                              border-slate-200
                              bg-slate-50
                              px-2.5
                              py-1.5
                              text-xs
                              font-bold
                              outline-none
                              dark:border-neutral-700
                              dark:bg-neutral-800
                            "
                          />
                        </div>

                        <div>
                          <label
                            className="
                              mb-1
                              block
                              text-[11px]
                              font-bold
                              text-slate-600
                              dark:text-slate-400
                            "
                          >
                            كرتون بالطبلية
                          </label>

                          <input
                            type="number"
                            value={
                              boxesPerPallet
                            }
                            onChange={event =>
                              setBoxesPerPallet(
                                parseFloat(
                                  event.target.value,
                                ) ||
                                  0,
                              )
                            }
                            className="
                              w-full
                              rounded-lg
                              border
                              border-slate-200
                              bg-slate-50
                              px-2.5
                              py-1.5
                              text-xs
                              font-bold
                              outline-none
                              dark:border-neutral-700
                              dark:bg-neutral-800
                            "
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div
                  className="
                    grid
                    grid-cols-1
                    gap-3
                    sm:grid-cols-2
                  "
                >
                  <AppChoiceField
                    mobilePresentation="inline"
                    label="السطح"
                    value={
                      formState.surface ===
                      'مات (مطفي)'
                        ? 'مطفي'
                        : formState.surface
                    }
                    options={
                      surfaceOptions
                    }
                    onChange={value =>
                      setFormState(
                        previous => ({
                          ...previous,

                          surface:
                            String(
                              value,
                            ),
                        }),
                      )
                    }
                  />

                  <div>
                    <label
                      className="
                        mb-1
                        block
                        text-xs
                        font-bold
                        text-slate-700
                        dark:text-slate-300
                      "
                    >
                      كود الشيد
                    </label>

                    <input
                      type="text"
                      value={
                        formState.shade
                      }
                      onChange={event =>
                        setFormState(
                          previous => ({
                            ...previous,

                            shade:
                              event.target.value,
                          }),
                        )
                      }
                      placeholder="مثال: A14, T32, 5B..."
                      className="
                        w-full
                        rounded-xl
                        border
                        border-slate-200
                        bg-white
                        px-3.5
                        py-2.5
                        text-sm
                        font-semibold
                        text-slate-800
                        outline-none
                        placeholder:text-slate-400
                        focus:border-indigo-500
                        dark:border-white/[0.08]
                        dark:bg-neutral-900
                        dark:text-white
                      "
                    />
                  </div>
                </div>

                {(showItemTypeField ||
                  showMaterialField ||
                  showColorField ||
                  showBrandField) && (
                  <div className="grid grid-cols-1 gap-3 border-t border-slate-200/60 pt-3 dark:border-neutral-700/60 sm:grid-cols-2">
                    {showItemTypeField && (
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                          النوع
                        </label>

                        <input
                          type="text"
                          value={
                            formState.itemType
                          }
                          onChange={event =>
                            setFormState(
                              previous => ({
                                ...previous,

                                itemType:
                                  event.target.value,
                              }),
                            )
                          }
                          placeholder="مثال: أرضي، جداري، موديل خاص..."
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 dark:border-white/[0.08] dark:bg-neutral-900 dark:text-white"
                        />
                      </div>
                    )}

                    {showMaterialField && (
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                          المادة / الخامة
                        </label>

                        <input
                          type="text"
                          value={
                            formState.materialOrGlass
                          }
                          onChange={event =>
                            setFormState(
                              previous => ({
                                ...previous,

                                materialOrGlass:
                                  event.target.value,
                              }),
                            )
                          }
                          placeholder="اكتب المادة أو الخامة..."
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 dark:border-white/[0.08] dark:bg-neutral-900 dark:text-white"
                        />
                      </div>
                    )}

                    {showColorField && (
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                          اللون
                        </label>

                        <input
                          type="text"
                          value={
                            formState.color
                          }
                          onChange={event =>
                            setFormState(
                              previous => ({
                                ...previous,

                                color:
                                  event.target.value,
                              }),
                            )
                          }
                          placeholder="اكتب اللون..."
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 dark:border-white/[0.08] dark:bg-neutral-900 dark:text-white"
                        />
                      </div>
                    )}

                    {showBrandField && (
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                          الماركة / المنشأ
                        </label>

                        <input
                          type="text"
                          value={
                            formState.brand
                          }
                          onChange={event =>
                            setFormState(
                              previous => ({
                                ...previous,

                                brand:
                                  event.target.value,
                              }),
                            )
                          }
                          placeholder="اكتب الماركة أو المنشأ..."
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 dark:border-white/[0.08] dark:bg-neutral-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div
                className="
                  space-y-3
                  rounded-2xl
                  border
                  border-slate-200/80
                  bg-slate-50/80
                  p-4
                  dark:border-white/[0.06]
                  dark:bg-neutral-800/40
                "
              >
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    border-b
                    border-slate-200/60
                    pb-2
                    dark:border-neutral-700/60
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      gap-2
                    "
                  >
                    <Calculator
                      className="
                        h-4
                        w-4
                        text-emerald-600
                        dark:text-emerald-400
                      "
                    />

                    <span
                      className="
                        text-xs
                        font-black
                        text-slate-800
                        dark:text-slate-200
                      "
                    >
                      الكميات والحسابات الفورية
                    </span>
                  </div>
                </div>

                <div
                  className="
                    grid
                    grid-cols-3
                    gap-2.5
                  "
                >
                  <div>
                    <label
                      className="
                        mb-1
                        block
                        text-[11px]
                        font-bold
                        text-slate-700
                        dark:text-slate-300
                      "
                    >
                      الأمتار (م²)

                      <span className="text-rose-500">
                        {' '}*
                      </span>
                    </label>

                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={
                        formState.meters
                      }
                      onChange={event =>
                        handleMetersChange(
                          event.target.value,
                        )
                      }
                      placeholder="0.00"
                      className="
                        w-full
                        rounded-xl
                        border
                        border-slate-200
                        bg-white
                        px-3
                        py-2.5
                        text-center
                        text-sm
                        font-black
                        text-slate-900
                        outline-none
                        focus:border-emerald-500
                        dark:border-white/[0.08]
                        dark:bg-neutral-900
                        dark:text-white
                      "
                    />
                  </div>

                  <div>
                    <label
                      className="
                        mb-1
                        block
                        text-[11px]
                        font-bold
                        text-slate-700
                        dark:text-slate-300
                      "
                    >
                      الكراتين
                    </label>

                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={
                        formState.boxes
                      }
                      onChange={event =>
                        handleBoxesChange(
                          event.target.value,
                        )
                      }
                      placeholder="0"
                      className="
                        w-full
                        rounded-xl
                        border
                        border-slate-200
                        bg-white
                        px-3
                        py-2.5
                        text-center
                        text-sm
                        font-black
                        text-slate-900
                        outline-none
                        focus:border-emerald-500
                        dark:border-white/[0.08]
                        dark:bg-neutral-900
                        dark:text-white
                      "
                    />
                  </div>

                  <div>
                    <label
                      className="
                        mb-1
                        block
                        text-[11px]
                        font-bold
                        text-slate-700
                        dark:text-slate-300
                      "
                    >
                      الطبالي
                    </label>

                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={
                        formState.pallets
                      }
                      onChange={event =>
                        handlePalletsChange(
                          event.target.value,
                        )
                      }
                      placeholder="0.0"
                      className="
                        w-full
                        rounded-xl
                        border
                        border-slate-200
                        bg-white
                        px-3
                        py-2.5
                        text-center
                        text-sm
                        font-black
                        text-slate-900
                        outline-none
                        focus:border-emerald-500
                        dark:border-white/[0.08]
                        dark:bg-neutral-900
                        dark:text-white
                      "
                    />
                  </div>
                </div>
              </div>

              {renderSystemAdditionalFields()}
            </>
          ) : (
            <>
              <div
                className="
                  space-y-3.5
                  rounded-2xl
                  border
                  border-slate-200/80
                  bg-slate-50/80
                  p-4
                  dark:border-white/[0.06]
                  dark:bg-neutral-800/40
                "
              >
                <div
                  className="
                    flex
                    items-center
                    gap-2
                    border-b
                    border-slate-200/60
                    pb-2
                    dark:border-neutral-700/60
                  "
                >
                  <Info
                    className="
                      h-4
                      w-4
                      text-indigo-600
                      dark:text-indigo-400
                    "
                  />

                  <span
                    className="
                      text-xs
                      font-black
                      text-slate-800
                      dark:text-slate-200
                    "
                  >
                    مواصفات وخصائص{' '}
                    {
                      effectiveCategory.name
                    }
                  </span>
                </div>

                {activeCustomFields.length >
                0 ? (
                  <div
                    className="
                      grid
                      grid-cols-1
                      gap-3
                      sm:grid-cols-2
                    "
                  >
                    {activeCustomFields.map(
                      field => {
                        const value =
                          customValues[
                            field.id
                          ] ??
                          '';

                        if (
                          field.type ===
                          'fixed'
                        ) {
                          return (
                            <div
                              key={
                                field.id
                              }
                              className="
                                flex
                                min-h-11
                                items-center
                                justify-between
                                gap-3
                                rounded-[13px]
                                border
                                border-slate-200/70
                                bg-slate-100/80
                                px-3.5
                                py-2.5
                                dark:border-white/[0.06]
                                dark:bg-neutral-800/60
                              "
                            >
                              <span
                                className="
                                  text-xs
                                  font-bold
                                  text-slate-600
                                  dark:text-slate-300
                                "
                              >
                                {
                                  field.label
                                }
                              </span>

                              <span
                                className="
                                  text-xs
                                  font-black
                                  text-slate-900
                                  dark:text-white
                                "
                              >
                                {field.fixedValue ||
                                  '—'}
                              </span>
                            </div>
                          );
                        }

                        if (
                          field.type ===
                          'select'
                        ) {
                          return (
                            <AppChoiceField
                              mobilePresentation="inline"
                              key={
                                field.id
                              }
                              label={
                                field.label
                              }
                              value={String(
                                value,
                              )}
                              required={
                                field.required
                              }
                              placeholder={`اختر ${field.label}`}
                              options={(
                                field.options ||
                                []
                              ).map(
                                option => ({
                                  id:
                                    option.id,

                                  label:
                                    option.label,

                                  value:
                                    option.value,
                                }),
                              )}
                              onChange={
                                nextValue =>
                                  handleCustomFieldChange(
                                    field.id,
                                    nextValue,
                                  )
                              }
                            />
                          );
                        }

                        return (
                          <div
                            key={
                              field.id
                            }
                          >
                            <label
                              className="
                                mb-1
                                block
                                text-xs
                                font-bold
                                text-slate-700
                                dark:text-slate-300
                              "
                            >
                              {
                                field.label
                              }

                              {field.required && (
                                <span className="text-rose-500">
                                  {' '}*
                                </span>
                              )}
                            </label>

                            <input
                              type={
                                field.type ===
                                'number'
                                  ? 'number'
                                  : 'text'
                              }
                              value={
                                value
                              }
                              onChange={event =>
                                handleCustomFieldChange(
                                  field.id,
                                  event.target.value,
                                )
                              }
                              placeholder={`أدخل ${field.label}...`}
                              className="
                                w-full
                                rounded-xl
                                border
                                border-slate-200
                                bg-white
                                px-3.5
                                py-2.5
                                text-sm
                                font-semibold
                                text-slate-800
                                outline-none
                                focus:border-indigo-500
                                dark:border-white/[0.08]
                                dark:bg-neutral-900
                                dark:text-white
                              "
                            />
                          </div>
                        );
                      },
                    )}
                  </div>
                ) : (
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
                          text-xs
                          font-bold
                          text-slate-700
                          dark:text-slate-300
                        "
                      >
                        اسم الصنف / الموديل

                        <span className="text-rose-500">
                          {' '}*
                        </span>
                      </label>

                      <input
                        type="text"
                        value={
                          formState.name
                        }
                        onChange={event =>
                          setFormState(
                            previous => ({
                              ...previous,

                              name:
                                event.target.value,
                            }),
                          )
                        }
                        placeholder="أدخل اسم الصنف..."
                        required
                        className="
                          w-full
                          rounded-xl
                          border
                          border-slate-200
                          bg-white
                          px-3.5
                          py-2.5
                          text-sm
                          font-semibold
                          text-slate-800
                          outline-none
                          focus:border-indigo-500
                          dark:border-white/[0.08]
                          dark:bg-neutral-900
                          dark:text-white
                        "
                      />
                    </div>

                    <div>
                      <label
                        className="
                          mb-1
                          block
                          text-xs
                          font-bold
                          text-slate-700
                          dark:text-slate-300
                        "
                      >
                        النوع / الفئة
                      </label>

                      <input
                        type="text"
                        value={
                          formState.itemType
                        }
                        onChange={event =>
                          setFormState(
                            previous => ({
                              ...previous,

                              itemType:
                                event.target.value,
                            }),
                          )
                        }
                        placeholder="مثال: مغسلة، دش، حوض..."
                        className="
                          w-full
                          rounded-xl
                          border
                          border-slate-200
                          bg-white
                          px-3.5
                          py-2.5
                          text-sm
                          font-semibold
                          text-slate-800
                          outline-none
                          focus:border-indigo-500
                          dark:border-white/[0.08]
                          dark:bg-neutral-900
                          dark:text-white
                        "
                      />
                    </div>
                  </div>
                )}
              </div>

              <div
                className="
                  space-y-3
                  rounded-2xl
                  border
                  border-slate-200/80
                  bg-slate-50/80
                  p-4
                  dark:border-white/[0.06]
                  dark:bg-neutral-800/40
                "
              >
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    border-b
                    border-slate-200/60
                    pb-2
                    dark:border-neutral-700/60
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      gap-2
                    "
                  >
                    <Calculator
                      className="
                        h-4
                        w-4
                        text-emerald-600
                        dark:text-emerald-400
                      "
                    />

                    <span
                      className="
                        text-xs
                        font-black
                        text-slate-800
                        dark:text-slate-200
                      "
                    >
                      الكمية المتوفرة ووحدة القياس
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    className="
                      mb-1 flex items-center justify-between gap-3
                      text-xs font-bold text-slate-700 dark:text-slate-300
                    "
                  >
                    <span>
                      الكمية المتوفرة
                      <span className="text-rose-500">{' '}*</span>
                    </span>

                    <span
                      className="
                        rounded-full bg-slate-100 px-2 py-0.5
                        text-[9px] font-bold text-slate-500
                        dark:bg-neutral-800 dark:text-slate-400
                      "
                    >
                      {formState.unitType === 'pieces' ? 'قطعة' : 'متر مربع'}
                    </span>
                  </label>

                  <div className="relative">
                    <input
                      type="number"
                      step={formState.unitType === 'pieces' ? '1' : 'any'}
                      min="0"
                      value={formState.meters}
                      onChange={event =>
                        setFormState(previous => ({
                          ...previous,
                          meters: event.target.value,
                        }))
                      }
                      placeholder="0"
                      required
                      className="
                        w-full rounded-xl border border-slate-200 bg-white
                        px-3.5 py-2.5 pl-20 text-base font-black
                        text-slate-900 outline-none focus:border-emerald-500
                        dark:border-white/[0.08] dark:bg-neutral-900 dark:text-white
                      "
                    />

                    <span
                      className="
                        pointer-events-none absolute left-3 top-1/2
                        -translate-y-1/2 text-[10px] font-bold
                        text-slate-400 dark:text-slate-500
                      "
                    >
                      {formState.unitType === 'pieces' ? 'قطعة' : 'م²'}
                    </span>
                  </div>

                  <p className="mt-1 text-[9px] font-medium text-slate-400 dark:text-slate-500">
                    وحدة القياس مأخوذة تلقائياً من إعدادات القسم.
                  </p>
                </div>
              </div>
            </>
          )}

          <div
            className="
              space-y-3.5
              rounded-2xl
              border
              border-slate-200/80
              bg-slate-50/80
              p-4
              dark:border-white/[0.06]
              dark:bg-neutral-800/40
            "
          >
            <div
              className="
                flex
                items-center
                justify-between
                gap-3
                border-b
                border-slate-200/60
                pb-2
                dark:border-neutral-700/60
              "
            >
              <span
                className="
                  text-xs
                  font-black
                  text-slate-800
                  dark:text-slate-200
                "
              >
                {showImageField
                  ? 'صورة الصنف وإعدادات الظهور'
                  : 'إعدادات الظهور'}
              </span>

              {!showImageField &&
                formState.image && (
                  <span
                    className="
                      text-[9px]
                      font-medium
                      text-slate-400
                      dark:text-slate-500
                    "
                  >
                    الصورة القديمة محفوظة ولن تُحذف
                  </span>
                )}
            </div>

            {showImageField && (
              <div>
                <label
                  className="
                    mb-1.5
                    block
                    text-xs
                    font-bold
                    text-slate-700
                    dark:text-slate-300
                  "
                >
                  صورة الصنف
                </label>

                <div
                  className="
                    flex
                    flex-wrap
                    items-center
                    gap-3
                  "
                >
                  {formState.image ? (
                    <div
                      className="
                        group
                        relative
                        h-14
                        w-14
                        shrink-0
                        overflow-hidden
                        rounded-xl
                        border
                        border-slate-200
                        dark:border-neutral-700
                      "
                    >
                      <img
                        src={
                          formState.image
                        }
                        alt="الصنف"
                        className="
                          h-full
                          w-full
                          cursor-pointer
                          object-cover
                        "
                        onClick={() =>
                          onViewImage(
                            formState.image,
                          )
                        }
                      />
                    </div>
                  ) : (
                    <div
                      className="
                        flex
                        h-14
                        w-14
                        shrink-0
                        items-center
                        justify-center
                        rounded-xl
                        border
                        border-dashed
                        border-slate-200
                        bg-white
                        text-slate-400
                        dark:border-neutral-700
                        dark:bg-neutral-900
                      "
                    >
                      <ImageIcon
                        className="
                          h-5
                          w-5
                          opacity-40
                        "
                      />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="file"
                        ref={
                          fileInputRef
                        }
                        accept="image/*"
                        onChange={
                          handleImageCapture
                        }
                        className="hidden"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          fileInputRef.current?.click()
                        }
                        disabled={
                          isCompressing
                        }
                        className="
                          flex
                          items-center
                          gap-1.5
                          rounded-xl
                          border
                          border-slate-200
                          bg-white
                          px-3
                          py-2
                          text-xs
                          font-bold
                          text-slate-700
                          shadow-sm
                          transition
                          hover:bg-slate-100
                          disabled:opacity-50
                          dark:border-white/[0.08]
                          dark:bg-neutral-900
                          dark:text-slate-200
                        "
                      >
                        <ImageIcon className="h-3.5 w-3.5" />

                        {formState.image
                          ? 'تغيير الصورة'
                          : 'من الجهاز'}
                      </button>

                      <input
                        type="file"
                        ref={
                          cameraInputRef
                        }
                        accept="image/*"
                        capture="environment"
                        onChange={
                          handleImageCapture
                        }
                        className="hidden"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          cameraInputRef.current?.click()
                        }
                        disabled={
                          isCompressing
                        }
                        className="
                          flex
                          items-center
                          gap-1.5
                          rounded-xl
                          border
                          border-slate-200
                          bg-white
                          px-3
                          py-2
                          text-xs
                          font-bold
                          text-slate-700
                          shadow-sm
                          transition
                          hover:bg-slate-100
                          disabled:opacity-50
                          dark:border-white/[0.08]
                          dark:bg-neutral-900
                          dark:text-slate-200
                        "
                      >
                        <CameraIcon />
                        بالكاميرا
                      </button>
                    </div>

                    {editingTile?.image && (
                      <p className="mt-2 text-[9px] font-medium text-slate-400 dark:text-slate-500">
                        الصورة الأصلية تبقى محفوظة. يمكنك استبدالها بصورة جديدة، وإخفاء حقل الصورة من تخصيص القسم لا يمسحها.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {canManageVisibility && (
            <div
              className={`
                flex
                items-center
                gap-2
                ${
                  showImageField
                    ? 'border-t border-slate-200/60 pt-2 dark:border-neutral-700/60'
                    : ''
                }
              `}
            >
              <input
                type="checkbox"
                id="hiddenForStaffCheckbox"
                checked={
                  formState.hiddenForStaff ||
                  false
                }
                onChange={event =>
                  setFormState(
                    previous => ({
                      ...previous,

                      hiddenForStaff:
                        event.target.checked,
                    }),
                  )
                }
                className="
                  h-4
                  w-4
                  cursor-pointer
                  rounded
                  border-slate-300
                  text-indigo-600
                  focus:ring-indigo-500
                  dark:border-neutral-700
                "
              />

              <label
                htmlFor="hiddenForStaffCheckbox"
                className="
                  cursor-pointer
                  select-none
                  text-xs
                  font-bold
                  text-slate-700
                  dark:text-slate-300
                "
              >
                إخفاء هذا الصنف عن شاشة الموظفين (عرض للمدير فقط)
              </label>
            </div>
            )}
          </div>
        </form>

        <div
          className="
            flex
            shrink-0
            items-center
            gap-2.5
            border-t
            border-slate-200/80
            bg-slate-50/95
            p-3.5
            backdrop-blur-md
            dark:border-white/[0.08]
            dark:bg-neutral-900/95
            sm:p-4
          "
        >
          <button
            type="button"
            onClick={
              onCancel
            }
            disabled={isSaving}
            className="
              flex-1
              cursor-pointer
              rounded-2xl
              px-4
              py-3
              text-center
              text-xs
              font-bold
              text-slate-600
              transition-colors
              hover:bg-slate-200
              dark:text-slate-300
              dark:hover:bg-neutral-800
              sm:flex-none
            "
          >
            إلغاء
          </button>

          <button
            type="submit"
            form="tile-form"
            disabled={isSaving || isCompressing}
            className="
              flex
              flex-[2]
              cursor-pointer
              items-center
              justify-center
              gap-2
              rounded-2xl
              bg-emerald-600
              px-5
              py-3
              text-xs
              font-black
              text-white
              shadow-md
              transition-all
              hover:bg-emerald-700
              active:scale-[0.98]
              disabled:cursor-not-allowed
              disabled:opacity-60
              sm:flex-1
            "
          >
            <SaveIcon />

            <span>
              {isSaving
                ? 'جاري الحفظ...'
                : editingTile
                  ? 'حفظ وتحديث الصنف'
                  : 'حفظ وإضافة الصنف الجديد'}
            </span>
          </button>
        </div>
      </ResponsiveOverlay>
    );
  };

export default TileForm;