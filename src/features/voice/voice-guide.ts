import type { Category } from '@/types';
import type { VoiceCorrectionField } from './voice.service';
export const voiceLabels: Record<VoiceCorrectionField,string> = {name:'الكود أو اسم الصنف',quantity:'الكمية',size:'المقاس والتعبئة',shade:'كود الشيد',quality:'النخب',surface:'السطح',color:'اللون',itemType:'النوع',materialOrGlass:'الخامة أو الزجاج',brand:'الماركة',notes:'الملاحظات'};
export function guideFields(category?: Category): VoiceCorrectionField[] {
 const fields: VoiceCorrectionField[]=['name','quantity'];
 if(!category)return [...fields,'size','surface','shade','quality'];
 const config=category.fieldsConfig;
 if(category.id==='tiles'||category.id==='ceramics')return [...fields,'size','surface','shade','quality'];
 if(config?.hasSize)fields.push('size');
 if(config?.hasItemType)fields.push('itemType');
 if(config?.hasMaterial)fields.push('materialOrGlass');
 if(config?.hasColor)fields.push('color');
 if(config?.hasBrand)fields.push('brand');
 return fields;
}
