export type CustomFieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'fixed';

export interface CustomFieldOption {
  id: string;
  label: string;
  value: string;
}

export interface CustomCategoryField {
  id: string;
  // الاسم الظاهر في الفورم
  label: string;
  type: CustomFieldType;
  required?: boolean;
  // مثل: سم / ملم / لتر
  suffix?: string;
  placeholder?: string;
  // فقط للـselect
  options?: CustomFieldOption[];
  // فقط للـfixed
  fixedValue?: string;
  // هل يدخل هذا الحقل في الاسم التلقائي للصنف؟
  includeInItemName?: boolean;
  order?: number;
}

export type UnitType = 'meters' | 'pieces';

export type CategoryTheme = 'sky' | 'rose' | 'emerald' | 'amber' | 'violet' | 'indigo' | 'fuchsia';

export type CategoryTemplate = 'porcelain' | 'ceramic' | 'shower_box' | 'mixers' | 'sanitary' | 'general';

export interface CustomFieldDefinition {
  id: string;
  name: string;
}

export interface CategoryFieldConfig {
  hasImage: boolean;
  hasSize: boolean;
  hasItemType: boolean; // نوع القطعة / الكابينة
  hasMaterial: boolean; // المادة / الزجاج
  hasColor: boolean; // اللون / البروفايل
  hasBrand: boolean; // الماركة
  hasBoxCalc: boolean; // حساب الكراتين والطبليات
}

export interface Category {
  id: string;
  name: string;
  themeColor: CategoryTheme;
  defaultUnit?: UnitType;
  iconType?: 'tiles' | 'ceramics' | 'shower' | 'mixer' | 'sanitary' | 'general';
  template?: CategoryTemplate;
  fieldsConfig?: CategoryFieldConfig;
  visibleToEmployees?: boolean;
  hiddenForStaff?: boolean;
  customFields?: CustomCategoryField[];
  itemNameLabel?: string;
  isSystemCategory?: boolean;
}

export interface Reservation {
  id: string;
  customerName: string;
  meters: number; // For pieces, this represents quantity of pieces
  notes: string;
  date: string;
}

export interface Tile {
  id: string;
  categoryId: string;
  name: string;
  
  // Unit Mode
  unitType?: UnitType; // 'meters' (default for tiles) or 'pieces' (for showers, mixers, etc.)
  
  // Common Attributes
  quality?: string; // 'نخب أول' | 'نخب ثاني' | 'درجة أولى' | etc.
  shade?: string; // كود الشيد أو الموديل
  size?: string; // المقاس / الأبعاد (مثل 120*60, 90*90, 80*120)
  surface?: string; // السطح (لامع / مطفي / ستانلس / كروم / سيكوريت)
  
  // Quantity metrics
  boxes: number; // كراتين (لو بالمتر)
  meters: number; // الأمتار (لو بالمتر) أو عدد القطع الإجمالي (لو بالقطعة)
  pallets: number; // طبليات (لو بالمتر)
  
  // Specialized Customization Fields
  color?: string; // اللون (أسود مطفي، كروم، ذهبي، ذهبي مطفي، رمادي غان ميتال، أبيض، برونزي)
  itemType?: string; // النوع/الموديل (ضرفة واحدة، ضرفتين سحاب، زاوية، خلاط مغسلة، دش مدفون، كرسي معلق)
  materialOrGlass?: string; // نوع الزجاج أو المادة (سيكوريت شفاف 8 ملم، مثلج، مضلع، نحاس نقي)
  brand?: string; // الماركة / بلد المنشأ (إيطالي، ألماني، إسباني، تركي، صيني نخب أول)
  
  image: string;
  hiddenForStaff?: boolean;
  reservations?: Reservation[];
  isReserved?: boolean;
  notes?: string;
  customValues?: Record<string, string | number>;
  customFieldSnapshot?: Array<{
    fieldId: string;
    label: string;
    value: string | number;
    suffix?: string;
  }>;

  // Audit metadata. Old inventory documents may not have these fields.
  createdAt?: any;
  createdBy?: string;
  createdByUid?: string;
  updatedAt?: any;
  updatedBy?: string;
  updatedByUid?: string;
}

export interface LogEntry {
  id: string;
  timestamp: any;
  user: string;
  action: string;
  tileName: string;
  details: string;
  userEmail?: string;
  categoryId?: string;
  actorUid?: string;
}

export type StaffRole = 'admin' | 'employee';

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  phone?: string;
  email?: string;
  status: 'active' | 'inactive';
  createdAt: any;
  lastActive?: any;
  isPrimaryAdmin?: boolean;
  createdBy?: string;
}

export interface BackupData {
  version: string;
  exportDate: string;
  exportedBy: string;
  tiles: Tile[];
  ceramics: Tile[];
  inventory: Tile[];
  categories: Category[];
  staff: StaffMember[];
  logs: LogEntry[];
  summary: {
    totalItems: number;
    totalCategories: number;
    totalStaff: number;
  };
}

export type ViewMode = 'dashboard' | 'inventory' | 'logs' | 'settings' | 'staff' | 'backup';
