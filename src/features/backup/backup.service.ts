import { auth, db, getAuditTimestamp } from '@/services/firebase';
import { Category, StaffRole, Tile } from '@/types';

export interface InventoryBackupData {
  version: '3.0';
  backupKind: 'inventory-categories';
  restoreMode: 'merge-only';
  exportDate: string;
  exportedBy: string;
  categories: Category[];
  tiles: Tile[];
  ceramics: Tile[];
  inventory: Tile[];
  summary: {
    totalItems: number;
    totalCategories: number;
  };
}

export interface BackupExportSource {
  categories?: Category[];
  tiles?: Tile[];
  ceramics?: Tile[];
  inventory?: Tile[];
}


export interface RestoreActorContext {
  userRole?: StaffRole;
  userName?: string;
}

export interface RestoreResult {
  added: number;
  skippedExisting: number;
  categoriesAdded: number;
  categoriesMerged: number;
  itemsAdded: number;
}

const MAX_BACKUP_FILE_BYTES = 100 * 1024 * 1024;
const MAX_DOCUMENTS_PER_COLLECTION = 25000;
const MAX_ID_LENGTH = 500;
const MAX_NESTING_DEPTH = 30;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const encoder = new TextEncoder();

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const cloneJsonSafely = (value: unknown, depth = 0): any => {
  if (depth > MAX_NESTING_DEPTH) {
    throw new Error('ملف النسخة الاحتياطية يحتوي تداخلاً غير صالح.');
  }

  if (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  // Firestore Timestamp and native Date values are normalized to ISO text before
  // JSON export. This keeps the backup portable and prevents SDK class instances
  // from being rejected by the strict object validator below.
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error('ملف النسخة الاحتياطية يحتوي تاريخًا غير صالح.');
    }
    return value.toISOString();
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      throw new Error('ملف النسخة الاحتياطية يحتوي تاريخ Firebase غير صالح.');
    }
    return date.toISOString();
  }

  if (Array.isArray(value)) {
    if (value.length > MAX_DOCUMENTS_PER_COLLECTION * 20) {
      throw new Error('ملف النسخة الاحتياطية أكبر من الحد المسموح.');
    }
    return value.map(entry => cloneJsonSafely(entry, depth + 1));
  }

  if (!isPlainObject(value)) {
    throw new Error('ملف النسخة الاحتياطية يحتوي نوع بيانات غير صالح.');
  }

  const output: Record<string, any> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error('تم رفض الملف لأنه يحتوي مفتاحًا غير آمن.');
    }
    output[key] = cloneJsonSafely(entry, depth + 1);
  }
  return output;
};

const validateId = (value: unknown, label: string) => {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > MAX_ID_LENGTH ||
    value.includes('/')
  ) {
    throw new Error(`يوجد ${label} بمعرّف غير صالح داخل النسخة الاحتياطية.`);
  }
};

const normalizeArray = <T,>(value: unknown, label: string): T[] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error(`بيانات ${label} داخل الملف غير صالحة.`);
  }
  if (value.length > MAX_DOCUMENTS_PER_COLLECTION) {
    throw new Error(`عدد سجلات ${label} أكبر من الحد المسموح.`);
  }
  return cloneJsonSafely(value) as T[];
};

const validateBackup = (input: unknown): InventoryBackupData => {
  const parsed = cloneJsonSafely(input);
  if (!isPlainObject(parsed)) {
    throw new Error('الملف المحدد ليس ملف نسخة احتياطية صالح.');
  }

  // يدعم النسخة الجديدة ونسخ JSON القديمة من التطبيق، لكن يتجاهل staff/logs بالكامل.
  const categories = normalizeArray<Category>(
    parsed.categories ?? parsed.db_categories,
    'الأقسام',
  );
  const tiles = normalizeArray<Tile>(parsed.tiles ?? parsed.db_tiles, 'البورسلان');
  const ceramics = normalizeArray<Tile>(
    parsed.ceramics ?? parsed.db_ceramics,
    'السيراميك',
  );
  const inventory = normalizeArray<Tile>(
    parsed.inventory ?? parsed.db_inventory,
    'باقي الأقسام',
  );

  if (categories.length === 0 && tiles.length === 0 && ceramics.length === 0 && inventory.length === 0) {
    throw new Error('لا توجد أقسام أو أصناف صالحة داخل هذا الملف.');
  }

  categories.forEach(category => validateId(category?.id, 'قسم'));
  [...tiles, ...ceramics, ...inventory].forEach(item => validateId(item?.id, 'صنف'));

  return {
    version: '3.0',
    backupKind: 'inventory-categories',
    restoreMode: 'merge-only',
    exportDate:
      typeof parsed.exportDate === 'string'
        ? parsed.exportDate
        : new Date().toISOString(),
    exportedBy:
      typeof parsed.exportedBy === 'string' ? parsed.exportedBy : 'نسخة سابقة',
    categories,
    tiles,
    ceramics,
    inventory,
    summary: {
      totalItems: tiles.length + ceramics.length + inventory.length,
      totalCategories: categories.length,
    },
  };
};

const safeFilename = (value: string, fallback: string) => {
  const cleaned = String(value || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|\.+$/g, '')
    .trim()
    .slice(0, 80);
  return cleaned || fallback;
};

const xmlEscape = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const columnName = (index: number) => {
  let number = index + 1;
  let name = '';
  while (number > 0) {
    const remainder = (number - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    number = Math.floor((number - 1) / 26);
  }
  return name;
};

const numberOrText = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return value === null || value === undefined ? '' : String(value);
};

type SheetRow = Array<string | number | boolean | null | undefined>;

interface WorkbookSheet {
  name: string;
  rows: SheetRow[];
}

const createSheetXml = (rows: SheetRow[]) => {
  const maxColumns = Math.max(1, ...rows.map(row => row.length));
  const maxRows = Math.max(1, rows.length);
  const dimension = `A1:${columnName(maxColumns - 1)}${maxRows}`;

  const rowXml = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((rawValue, columnIndex) => {
          const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
          const style = rowIndex === 0 ? ' s="1"' : '';

          if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
            return `<c r="${ref}"${style}><v>${rawValue}</v></c>`;
          }

          const text =
            typeof rawValue === 'boolean'
              ? rawValue
                ? 'نعم'
                : 'لا'
              : String(rawValue ?? '');

          return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(
            text,
          )}</t></is></c>`;
        })
        .join('');

      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  const widths = Array.from({ length: maxColumns }, (_, index) => {
    const width = index === 1 ? 30 : index === 0 ? 22 : 18;
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join('');

  const autoFilter = rows.length > 0 ? `<autoFilter ref="A1:${columnName(maxColumns - 1)}1"/>` : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimension}"/>
  <sheetViews><sheetView workbookViewId="0" rightToLeft="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${widths}</cols>
  <sheetData>${rowXml}</sheetData>
  ${autoFilter}
</worksheet>`;
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const concatBytes = (parts: Uint8Array[]) => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
};

const makeHeader = (length: number) => new Uint8Array(length);

const write16 = (target: Uint8Array, offset: number, value: number) => {
  new DataView(target.buffer, target.byteOffset, target.byteLength).setUint16(offset, value, true);
};

const write32 = (target: Uint8Array, offset: number, value: number) => {
  new DataView(target.buffer, target.byteOffset, target.byteLength).setUint32(offset, value >>> 0, true);
};

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const createZip = (entries: ZipEntry[]) => {
  if (entries.length > 65535) throw new Error('عدد الملفات داخل النسخة الاحتياطية كبير جدًا.');

  const now = new Date();
  const dosTime =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    ((Math.floor(now.getSeconds() / 2) || 0) & 0x1f);
  const dosDate =
    (((now.getFullYear() - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f);

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const checksum = crc32(entry.data);

    const localHeader = makeHeader(30);
    write32(localHeader, 0, 0x04034b50);
    write16(localHeader, 4, 20);
    write16(localHeader, 6, 0x0800);
    write16(localHeader, 8, 0);
    write16(localHeader, 10, dosTime);
    write16(localHeader, 12, dosDate);
    write32(localHeader, 14, checksum);
    write32(localHeader, 18, entry.data.length);
    write32(localHeader, 22, entry.data.length);
    write16(localHeader, 26, nameBytes.length);
    write16(localHeader, 28, 0);

    localParts.push(localHeader, nameBytes, entry.data);

    const centralHeader = makeHeader(46);
    write32(centralHeader, 0, 0x02014b50);
    write16(centralHeader, 4, 20);
    write16(centralHeader, 6, 20);
    write16(centralHeader, 8, 0x0800);
    write16(centralHeader, 10, 0);
    write16(centralHeader, 12, dosTime);
    write16(centralHeader, 14, dosDate);
    write32(centralHeader, 16, checksum);
    write32(centralHeader, 20, entry.data.length);
    write32(centralHeader, 24, entry.data.length);
    write16(centralHeader, 28, nameBytes.length);
    write16(centralHeader, 30, 0);
    write16(centralHeader, 32, 0);
    write16(centralHeader, 34, 0);
    write16(centralHeader, 36, 0);
    write32(centralHeader, 38, 0);
    write32(centralHeader, 42, localOffset);
    centralParts.push(centralHeader, nameBytes);

    localOffset += localHeader.length + nameBytes.length + entry.data.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const localData = concatBytes(localParts);
  const eocd = makeHeader(22);
  write32(eocd, 0, 0x06054b50);
  write16(eocd, 4, 0);
  write16(eocd, 6, 0);
  write16(eocd, 8, entries.length);
  write16(eocd, 10, entries.length);
  write32(eocd, 12, centralDirectory.length);
  write32(eocd, 16, localData.length);
  write16(eocd, 20, 0);

  return concatBytes([localData, centralDirectory, eocd]);
};

const createXlsx = (sheets: WorkbookSheet[]) => {
  const safeSheets = sheets.length > 0 ? sheets : [{ name: 'البيانات', rows: [['لا توجد بيانات']] }];

  const contentTypeSheets = safeSheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('');

  const workbookSheets = safeSheets
    .map(
      (sheet, index) =>
        `<sheet name="${xmlEscape(sheet.name.slice(0, 31))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join('');

  const worksheetRels = safeSheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join('');

  const stylesRelId = safeSheets.length + 1;

  const entries: ZipEntry[] = [
    {
      name: '[Content_Types].xml',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${contentTypeSheets}
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`),
    },
    {
      name: '_rels/.rels',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    },
    {
      name: 'xl/workbook.xml',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView/></bookViews>
  <sheets>${workbookSheets}</sheets>
</workbook>`),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${worksheetRels}
  <Relationship Id="rId${stylesRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    },
    {
      name: 'xl/styles.xml',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`),
    },
  ];

  safeSheets.forEach((sheet, index) => {
    entries.push({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: encoder.encode(createSheetXml(sheet.rows)),
    });
  });

  return createZip(entries);
};

const hasValue = (value: unknown) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return false;
};

const cellValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const auditDateCell = (value: unknown): string => {
  if (!value) return '';

  try {
    let date: Date;

    if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof (value as { toDate?: unknown }).toDate === 'function'
    ) {
      date = (value as { toDate: () => Date }).toDate();
    } else if (
      typeof value === 'object' &&
      value !== null &&
      'seconds' in value &&
      typeof (value as { seconds?: unknown }).seconds === 'number'
    ) {
      date = new Date((value as { seconds: number }).seconds * 1000);
    } else {
      date = value instanceof Date ? value : new Date(value as string | number);
    }

    return Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
  } catch {
    return '';
  }
};

const categorySettingsRows = (category: Category): SheetRow[] => {
  const rows: SheetRow[] = [
    ['الإعداد', 'القيمة'],
    ['معرّف القسم', category.id],
    ['اسم القسم', category.name],
    ['وحدة القياس', category.defaultUnit === 'pieces' ? 'قطعة' : 'متر'],
    ['القالب', category.template || 'general'],
    ['لون القسم', category.themeColor || ''],
    ['نوع الأيقونة', category.iconType || ''],
    ['قسم نظام', category.isSystemCategory ? 'نعم' : 'لا'],
    ['الصورة مفعلة', category.fieldsConfig?.hasImage === false ? 'لا' : 'نعم'],
    ['المقاس مفعل', category.fieldsConfig?.hasSize === false ? 'لا' : 'نعم'],
    ['النوع مفعل', category.fieldsConfig?.hasItemType ? 'نعم' : 'لا'],
    ['المادة/الزجاج مفعل', category.fieldsConfig?.hasMaterial ? 'نعم' : 'لا'],
    ['اللون مفعل', category.fieldsConfig?.hasColor ? 'نعم' : 'لا'],
    ['الماركة مفعلة', category.fieldsConfig?.hasBrand ? 'نعم' : 'لا'],
    ['حساب الكراتين والطبليات', category.fieldsConfig?.hasBoxCalc ? 'نعم' : 'لا'],
  ];

  const customFields = Array.isArray(category.customFields) ? category.customFields : [];
  if (customFields.length > 0) {
    rows.push([], ['الحقول المخصصة', 'النوع', 'إجباري', 'لاحقة', 'القيمة/الخيارات']);
    customFields
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .forEach(field => {
        const choices =
          field.type === 'select'
            ? (field.options || []).map(option => option.label).join(' | ')
            : field.type === 'fixed'
              ? field.fixedValue || ''
              : '';
        rows.push([
          field.label,
          field.type,
          field.required ? 'نعم' : 'لا',
          field.suffix || '',
          choices,
        ]);
      });
  }

  return rows;
};

type ItemColumn = {
  key: string;
  label: string;
  value: (item: Tile) => unknown;
};

const categoryItemRows = (items: Tile[], category: Category): SheetRow[] => {
  const configuredFields = Array.isArray(category.customFields) ? category.customFields : [];
  const customLabels = new Map<string, string>();
  const customOrder: string[] = [];

  const addCustomField = (id: string, label: string) => {
    if (!id || customLabels.has(id)) return;
    customLabels.set(id, label || id);
    customOrder.push(id);
  };

  configuredFields
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .forEach(field => addCustomField(field.id, field.label));

  items.forEach(item => {
    (item.customFieldSnapshot || []).forEach(field => addCustomField(field.fieldId, field.label));
    Object.keys(item.customValues || {}).forEach(fieldId => addCustomField(fieldId, fieldId));
  });

  const any = (getter: (item: Tile) => unknown) => items.some(item => hasValue(getter(item)));
  const standardColumns: ItemColumn[] = [
    { key: 'name', label: 'اسم الصنف', value: item => item.name },
    { key: 'unitType', label: 'الوحدة', value: item => item.unitType === 'pieces' ? 'قطعة' : 'متر' },
  ];

  const maybeAdd = (condition: boolean, column: ItemColumn) => {
    if (condition) standardColumns.push(column);
  };

  maybeAdd(category.fieldsConfig?.hasSize !== false || any(item => item.size), {
    key: 'size', label: 'المقاس', value: item => item.size || '',
  });
  maybeAdd(any(item => item.quality), {
    key: 'quality', label: 'النخب/الجودة', value: item => item.quality || '',
  });
  maybeAdd(any(item => item.surface), {
    key: 'surface', label: 'السطح', value: item => item.surface || '',
  });
  maybeAdd(any(item => item.shade), {
    key: 'shade', label: 'الشيد/الموديل', value: item => item.shade || '',
  });
  maybeAdd(category.fieldsConfig?.hasItemType === true || any(item => item.itemType), {
    key: 'itemType', label: 'النوع', value: item => item.itemType || '',
  });
  maybeAdd(category.fieldsConfig?.hasMaterial === true || any(item => item.materialOrGlass), {
    key: 'materialOrGlass', label: 'المادة/الزجاج', value: item => item.materialOrGlass || '',
  });
  maybeAdd(category.fieldsConfig?.hasColor === true || any(item => item.color), {
    key: 'color', label: 'اللون', value: item => item.color || '',
  });
  maybeAdd(category.fieldsConfig?.hasBrand === true || any(item => item.brand), {
    key: 'brand', label: 'الماركة', value: item => item.brand || '',
  });
  maybeAdd(category.fieldsConfig?.hasBoxCalc === true || items.some(item => Number(item.boxes || 0) !== 0), {
    key: 'boxes', label: 'الكراتين', value: item => numberOrText(item.boxes),
  });

  standardColumns.push({
    key: 'meters',
    label: category.defaultUnit === 'pieces' ? 'الكمية' : 'الكمية/الأمتار',
    value: item => numberOrText(item.meters),
  });

  maybeAdd(category.fieldsConfig?.hasBoxCalc === true || items.some(item => Number(item.pallets || 0) !== 0), {
    key: 'pallets', label: 'الطبليات', value: item => numberOrText(item.pallets),
  });
  maybeAdd(any(item => item.notes), {
    key: 'notes', label: 'ملاحظات الصنف', value: item => item.notes || '',
  });
  maybeAdd(any(item => item.isReserved || (item.reservations || []).length > 0), {
    key: 'isReserved', label: 'محجوز', value: item => item.isReserved || (item.reservations || []).length > 0 ? 'نعم' : 'لا',
  });
  maybeAdd(category.fieldsConfig?.hasImage !== false || any(item => item.image), {
    key: 'image', label: 'الصورة محفوظة', value: item => item.image ? 'نعم' : 'لا',
  });
  maybeAdd(any(item => item.createdBy), {
    key: 'createdBy', label: 'أضيف بواسطة', value: item => item.createdBy || '',
  });
  maybeAdd(any(item => item.createdAt), {
    key: 'createdAt', label: 'تاريخ الإضافة', value: item => auditDateCell(item.createdAt),
  });
  maybeAdd(any(item => item.updatedBy), {
    key: 'updatedBy', label: 'آخر تعديل بواسطة', value: item => item.updatedBy || '',
  });
  maybeAdd(any(item => item.updatedAt), {
    key: 'updatedAt', label: 'آخر تحديث', value: item => auditDateCell(item.updatedAt),
  });

  const excludedExtraKeys = new Set([
    'id', 'categoryId', 'name', 'unitType', 'quality', 'shade', 'size', 'surface',
    'boxes', 'meters', 'pallets', 'color', 'itemType', 'materialOrGlass', 'brand',
    'image', 'hiddenForStaff', 'reservations', 'isReserved', 'notes',
    'customValues', 'customFieldSnapshot',
    'createdAt', 'createdBy', 'createdByUid', 'updatedAt', 'updatedBy', 'updatedByUid',
  ]);
  const extraKeys: string[] = [];
  const seenExtraKeys = new Set<string>();

  items.forEach(item => {
    Object.keys(item as unknown as Record<string, unknown>).forEach(key => {
      if (excludedExtraKeys.has(key) || seenExtraKeys.has(key)) return;
      const value = (item as unknown as Record<string, unknown>)[key];
      if (!hasValue(value)) return;
      seenExtraKeys.add(key);
      extraKeys.push(key);
    });
  });

  const headers: SheetRow = [
    ...standardColumns.map(column => column.label),
    ...customOrder.map(id => customLabels.get(id) || id),
    ...extraKeys,
    'معرّف الصنف',
  ];

  const rows: SheetRow[] = [headers];
  items.forEach(item => {
    const snapshotMap = new Map(
      (item.customFieldSnapshot || []).map(field => [field.fieldId, field.value]),
    );

    rows.push([
      ...standardColumns.map(column => cellValue(column.value(item))),
      ...customOrder.map(id => cellValue(snapshotMap.get(id) ?? item.customValues?.[id] ?? '')),
      ...extraKeys.map(key => cellValue((item as unknown as Record<string, unknown>)[key])),
      item.id,
    ]);
  });

  return rows;
};

const reservationRows = (items: Tile[]): SheetRow[] => {
  const rows: SheetRow[] = [
    ['اسم الصنف', 'العميل', 'الكمية/الأمتار', 'التاريخ', 'التفاصيل', 'معرّف الحجز', 'معرّف الصنف'],
  ];

  items.forEach(item => {
    (item.reservations || []).forEach(reservation => {
      rows.push([
        item.name,
        reservation.customerName,
        numberOrText(reservation.meters),
        reservation.date,
        reservation.notes || '',
        reservation.id,
        item.id,
      ]);
    });
  });

  return rows;
};

const decodeDataUrl = (dataUrl: string): { bytes: Uint8Array; extension: string } | null => {
  const match = /^data:([^;,]+);base64,([a-z0-9+/=\r\n]+)$/i.exec(dataUrl || '');
  if (!match) return null;

  try {
    const binary = atob(match[2].replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);

    const mime = match[1].toLowerCase();
    const extension =
      mime === 'image/png'
        ? 'png'
        : mime === 'image/webp'
          ? 'webp'
          : mime === 'image/gif'
            ? 'gif'
            : 'jpg';

    return { bytes, extension };
  } catch {
    return null;
  }
};

const getItemsByCategory = (source: BackupExportSource, categoryId: string) => {
  if (categoryId === 'tiles') return Array.isArray(source.tiles) ? source.tiles : [];
  if (categoryId === 'ceramics') return Array.isArray(source.ceramics) ? source.ceramics : [];
  return (Array.isArray(source.inventory) ? source.inventory : []).filter(item => item.categoryId === categoryId);
};

const prepareBackup = (
  source: BackupExportSource,
  exportedBy: string,
): InventoryBackupData => {
  const categories = Array.isArray(source.categories) ? cloneJsonSafely(source.categories) : [];
  const tiles = Array.isArray(source.tiles) ? cloneJsonSafely(source.tiles) : [];
  const ceramics = Array.isArray(source.ceramics) ? cloneJsonSafely(source.ceramics) : [];
  const inventory = Array.isArray(source.inventory) ? cloneJsonSafely(source.inventory) : [];

  return {
    version: '3.0',
    backupKind: 'inventory-categories',
    restoreMode: 'merge-only',
    exportDate: new Date().toISOString(),
    exportedBy,
    categories,
    tiles,
    ceramics,
    inventory,
    summary: {
      totalItems: tiles.length + ceramics.length + inventory.length,
      totalCategories: categories.length,
    },
  };
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const MAX_ARCHIVE_FILE_BYTES = 250 * 1024 * 1024;
const decoder = new TextDecoder('utf-8');

const readUint16 = (view: DataView, offset: number) => view.getUint16(offset, true);
const readUint32 = (view: DataView, offset: number) => view.getUint32(offset, true);

const findEndOfCentralDirectory = (bytes: Uint8Array) => {
  const minOffset = Math.max(0, bytes.length - 65557);
  for (let offset = bytes.length - 22; offset >= minOffset; offset -= 1) {
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 &&
      bytes[offset + 3] === 0x06
    ) {
      return offset;
    }
  }
  return -1;
};

const inflateZipEntry = async (
  compressed: Uint8Array,
  method: number,
  expectedSize: number,
): Promise<Uint8Array> => {
  if (expectedSize > MAX_BACKUP_FILE_BYTES) {
    throw new Error('ملف الاسترجاع داخل ZIP أكبر من الحد المسموح.');
  }

  // ZIP الصادر من التطبيق يستخدم Store (بدون ضغط). رفض الطرق الأخرى
  // يمنع ملفات ZIP المضغوطة الخبيثة من استهلاك ذاكرة ضخمة أثناء الفك.
  if (method !== 0) {
    throw new Error('هذا ZIP ليس من صيغة النسخ التي يصدرها التطبيق. اختر ZIP الأصلي أو ملف JSON الموجود داخله.');
  }

  if (expectedSize && compressed.length !== expectedSize) {
    throw new Error('ملف الاسترجاع داخل ZIP غير مكتمل.');
  }

  return compressed;
};

const extractRestoreJsonFromZip = async (archiveBytes: Uint8Array): Promise<string> => {
  const eocdOffset = findEndOfCentralDirectory(archiveBytes);
  if (eocdOffset < 0) throw new Error('ملف ZIP غير صالح أو غير مكتمل.');

  const view = new DataView(archiveBytes.buffer, archiveBytes.byteOffset, archiveBytes.byteLength);
  const entryCount = readUint16(view, eocdOffset + 10);
  const centralOffset = readUint32(view, eocdOffset + 16);

  if (entryCount > 65535 || centralOffset >= archiveBytes.length) {
    throw new Error('بنية ملف ZIP غير صالحة.');
  }

  type Candidate = {
    name: string;
    method: number;
    crc: number;
    compressedSize: number;
    uncompressedSize: number;
    localOffset: number;
  };

  const jsonCandidates: Candidate[] = [];
  let exactCandidate: Candidate | null = null;
  let offset = centralOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > archiveBytes.length || readUint32(view, offset) !== 0x02014b50) {
      throw new Error('تعذر قراءة محتويات ملف ZIP.');
    }

    const method = readUint16(view, offset + 10);
    const crc = readUint32(view, offset + 16);
    const compressedSize = readUint32(view, offset + 20);
    const uncompressedSize = readUint32(view, offset + 24);
    const fileNameLength = readUint16(view, offset + 28);
    const extraLength = readUint16(view, offset + 30);
    const commentLength = readUint16(view, offset + 32);
    const localOffset = readUint32(view, offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;

    if (nameEnd > archiveBytes.length) throw new Error('اسم ملف داخل ZIP غير صالح.');

    const name = decoder.decode(archiveBytes.slice(nameStart, nameEnd)).replace(/\\/g, '/');
    const baseName = name.split('/').pop() || '';
    const candidate = { name, method, crc, compressedSize, uncompressedSize, localOffset };

    if (['inventory_restore.json', 'ammar_showroom_restore.json'].includes(baseName.toLowerCase())) exactCandidate = candidate;
    if (baseName.toLowerCase().endsWith('.json')) jsonCandidates.push(candidate);

    offset = nameEnd + extraLength + commentLength;
  }

  const candidate = exactCandidate || (jsonCandidates.length === 1 ? jsonCandidates[0] : null);
  if (!candidate) {
    throw new Error('لم أجد ملف Inventory_Restore.json داخل ZIP.');
  }

  if (candidate.localOffset + 30 > archiveBytes.length || readUint32(view, candidate.localOffset) !== 0x04034b50) {
    throw new Error('تعذر قراءة ملف الاسترجاع داخل ZIP.');
  }

  const localNameLength = readUint16(view, candidate.localOffset + 26);
  const localExtraLength = readUint16(view, candidate.localOffset + 28);
  const dataStart = candidate.localOffset + 30 + localNameLength + localExtraLength;
  const dataEnd = dataStart + candidate.compressedSize;

  if (dataStart < 0 || dataEnd > archiveBytes.length || dataEnd < dataStart) {
    throw new Error('بيانات ملف الاسترجاع داخل ZIP غير صالحة.');
  }

  const compressed = archiveBytes.slice(dataStart, dataEnd);
  const restored = await inflateZipEntry(compressed, candidate.method, candidate.uncompressedSize);

  if (candidate.uncompressedSize && restored.length !== candidate.uncompressedSize) {
    throw new Error('ملف الاسترجاع داخل ZIP غير مكتمل.');
  }
  if (crc32(restored) !== candidate.crc) {
    throw new Error('فشل التحقق من سلامة ملف الاسترجاع داخل ZIP.');
  }

  return decoder.decode(restored);
};

const collectionPlan = (backup: InventoryBackupData) => [
  { key: 'tiles', values: backup.tiles },
  { key: 'ceramics', values: backup.ceramics },
  { key: 'inventory', values: backup.inventory },
] as const;

const DEFAULT_CATEGORY_IDS = new Set(['tiles', 'ceramics', 'shower_box']);

const existingItemsForCategory = (
  categoryId: string,
  idsByCollection: Record<'tiles' | 'ceramics' | 'inventory', Set<string>>,
  existingInventoryDocs: Array<{ id: string; data: () => any }>,
) => {
  if (categoryId === 'tiles') return idsByCollection.tiles.size > 0;
  if (categoryId === 'ceramics') return idsByCollection.ceramics.size > 0;
  return existingInventoryDocs.some(doc => doc.data()?.categoryId === categoryId);
};

export const backupService = {
  parseBackupText(content: string): InventoryBackupData {
    if (typeof content !== 'string' || content.length === 0) {
      throw new Error('ملف النسخة الاحتياطية فارغ.');
    }
    if (new Blob([content]).size > MAX_BACKUP_FILE_BYTES) {
      throw new Error('حجم ملف النسخة الاحتياطية أكبر من الحد المسموح.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('تعذر قراءة ملف الاسترجاع.');
    }

    return validateBackup(parsed);
  },

  async parseBackupFile(file: File): Promise<InventoryBackupData> {
    if (!file || file.size === 0) throw new Error('الملف المحدد فارغ.');
    if (file.size > MAX_ARCHIVE_FILE_BYTES) {
      throw new Error('حجم ملف النسخة الاحتياطية أكبر من الحد المسموح.');
    }

    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.json')) {
      return this.parseBackupText(await file.text());
    }

    if (lowerName.endsWith('.zip')) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return this.parseBackupText(await extractRestoreJsonFromZip(bytes));
    }

    throw new Error('اختر ملف ZIP للنسخة الاحتياطية أو ملف Inventory_Restore.json.');
  },

  async downloadCategoryBackup(
    source: BackupExportSource,
    exportedBy = 'المدير',
  ): Promise<InventoryBackupData> {
    const backup = prepareBackup(source, exportedBy);
    const entries: ZipEntry[] = [];

    entries.push({
      name: 'Inventory_Restore.json',
      data: encoder.encode(JSON.stringify(backup, null, 2)),
    });

    const categoryIds = new Set(backup.categories.map(category => category.id));

    backup.categories.forEach((category, index) => {
      const items = getItemsByCategory(backup, category.id);
      const filename = `${String(index + 1).padStart(2, '0')}_${safeFilename(category.name, category.id)}.xlsx`;
      const workbook = createXlsx([
        { name: 'الأصناف', rows: categoryItemRows(items, category) },
        { name: 'الحجوزات', rows: reservationRows(items) },
        { name: 'إعدادات القسم', rows: categorySettingsRows(category) },
      ]);

      entries.push({ name: `الأقسام/${filename}`, data: workbook });

      items.forEach(item => {
        const decoded = decodeDataUrl(item.image || '');
        if (!decoded) return;
        entries.push({
          name: `الصور/${safeFilename(category.name, category.id)}/${safeFilename(item.name, item.id)}_${safeFilename(item.id, 'item')}.${decoded.extension}`,
          data: decoded.bytes,
        });
      });
    });

    const orphanItems = [
      ...backup.inventory.filter(item => !categoryIds.has(item.categoryId)),
      ...(categoryIds.has('tiles') ? [] : backup.tiles),
      ...(categoryIds.has('ceramics') ? [] : backup.ceramics),
    ];

    if (orphanItems.length > 0) {
      const orphanCategory: Category = {
        id: 'uncategorized-backup',
        name: 'غير مصنف',
        themeColor: 'sky',
        defaultUnit: 'pieces',
      };
      entries.push({
        name: 'الأقسام/99_غير_مصنف.xlsx',
        data: createXlsx([
          { name: 'الأصناف', rows: categoryItemRows(orphanItems, orphanCategory) },
          { name: 'الحجوزات', rows: reservationRows(orphanItems) },
        ]),
      });
    }

    const zipBytes = createZip(entries);
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(
      new Blob([zipBytes], { type: 'application/zip' }),
      `Inventory_Backup_${date}.zip`,
    );

    return backup;
  },

  async restoreMergeOnly(
    backupInput: InventoryBackupData,
    actor: RestoreActorContext = {},
  ): Promise<RestoreResult> {
    const backup = validateBackup(backupInput);
    let added = 0;
    let skippedExisting = 0;
    let categoriesAdded = 0;
    let categoriesMerged = 0;
    let itemsAdded = 0;

    const isEmployee = actor.userRole === 'employee';
    const categorySnapshot = await db.collection('categories').get();

    let tileDocs: any[] = [];
    let ceramicDocs: any[] = [];
    let inventoryDocs: any[] = [];

    if (isEmployee) {
      const backupCategoryIds = new Set(
        backup.categories.map(category => String(category.id || '')).filter(Boolean),
      );

      if (backup.tiles.length > 0 || backupCategoryIds.has('tiles')) {
        tileDocs = (await db.collection('tiles').get()).docs;
      }

      if (backup.ceramics.length > 0 || backupCategoryIds.has('ceramics')) {
        ceramicDocs = (await db.collection('ceramics').get()).docs;
      }

      const inventoryCategoryIds = Array.from(
        new Set(
          backup.inventory
            .map(item => String(item.categoryId || '').trim())
            .filter(Boolean),
        ),
      );

      for (const categoryId of inventoryCategoryIds) {
        try {
          const snapshot = await db
            .collection('inventory')
            .where('categoryId', '==', categoryId)
            .get();
          inventoryDocs.push(...snapshot.docs);
        } catch (error: any) {
          if (error?.code === 'permission-denied') {
            throw new Error(`لا تملك صلاحية لاسترجاع بيانات القسم ${categoryId}.`);
          }
          throw error;
        }
      }
    } else {
      const [tilesSnapshot, ceramicsSnapshot, inventorySnapshot] = await Promise.all([
        db.collection('tiles').get(),
        db.collection('ceramics').get(),
        db.collection('inventory').get(),
      ]);
      tileDocs = tilesSnapshot.docs;
      ceramicDocs = ceramicsSnapshot.docs;
      inventoryDocs = inventorySnapshot.docs;
    }

    const existingCategoryIds = new Set<string>(categorySnapshot.docs.map(doc => String(doc.id)));
    const idsByCollection = {
      tiles: new Set<string>(tileDocs.map(doc => String(doc.id))),
      ceramics: new Set<string>(ceramicDocs.map(doc => String(doc.id))),
      inventory: new Set<string>(inventoryDocs.map(doc => String(doc.id))),
    };

    // الأقسام الجديدة تضاف. الأقسام الأساسية الموجودة أصلًا في تطبيق فارغ
    // ندمج إعداداتها فقط حتى ترجع تخصيصات النسخة، بدون حذف أي مفتاح موجود.
    for (const rawCategory of backup.categories) {
      const category = cloneJsonSafely(rawCategory) as Category;
      validateId(category.id, 'قسم');
      const ref = db.collection('categories').doc(category.id);

      if (!existingCategoryIds.has(category.id)) {
        await ref.set(category);
        existingCategoryIds.add(category.id);
        categoriesAdded += 1;
        added += 1;
        continue;
      }

      const isDefaultEmptyCategory =
        DEFAULT_CATEGORY_IDS.has(category.id) &&
        !existingItemsForCategory(category.id, idsByCollection, inventoryDocs);

      if (isDefaultEmptyCategory) {
        await ref.set(category, { merge: true });
        categoriesMerged += 1;
      } else {
        skippedExisting += 1;
      }
    }

    for (const collection of collectionPlan(backup)) {
      const existingIds = idsByCollection[collection.key];

      for (const rawItem of collection.values) {
        const item = cloneJsonSafely(rawItem) as Tile;
        validateId(item.id, 'صنف');

        if (collection.key === 'tiles') {
          item.categoryId = 'tiles';
        } else if (collection.key === 'ceramics') {
          item.categoryId = 'ceramics';
        } else if (!item.categoryId) {
          throw new Error(`الصنف ${item.name || item.id} لا يحتوي معرّف قسم صالح.`);
        }

        if (existingIds.has(item.id)) {
          skippedExisting += 1;
          continue;
        }

        if (isEmployee) {
          const uid = auth.currentUser?.uid;
          const actorName = String(actor.userName || '').trim();
          if (!uid || !actorName) {
            throw new Error('تعذر التحقق من هوية الموظف أثناء الاسترجاع.');
          }

          // Firestore rules require newly restored employee documents to carry
          // the same trusted creation audit metadata as a normal item creation.
          item.createdByUid = uid;
          item.createdBy = actorName;
          item.createdAt = getAuditTimestamp();
        }

        await db.collection(collection.key).doc(item.id).set(item);
        existingIds.add(item.id);
        itemsAdded += 1;
        added += 1;
      }
    }

    return { added, skippedExisting, categoriesAdded, categoriesMerged, itemsAdded };
  },
};