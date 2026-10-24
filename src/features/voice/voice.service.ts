import { publishVoiceUsage, type VoiceUsage } from './voice-quota';
import { packingValues } from './voice-presets.mjs';
import { auth } from '@/services/firebase';
import type { Category, Tile } from '@/types';
export interface VoiceDraft { categoryId: string | null; name: string | null; quantity: number | null; size: string | null; shade: string | null; quality: string | null; surface: string | null; color: string | null; itemType: string | null; materialOrGlass: string | null; brand: string | null; notes: string | null; uncertainties: string[]; }
export type VoiceCorrectionField = 'name' | 'quantity' | 'size' | 'shade' | 'quality' | 'surface' | 'color' | 'itemType' | 'materialOrGlass' | 'brand' | 'notes';
export interface VoiceProgress {phase:'transcribing'|'extracting'|'processing';transcript?:string;}
export interface VoiceAnalysis { transcript: string; draft: VoiceDraft; usage?: VoiceUsage; }
const backendEndpoint = String(import.meta.env.VITE_VOICE_API_URL || '').trim();
const directTestKey = import.meta.env.VITE_VOICE_DIRECT_TEST === 'true' ? String(import.meta.env.VITE_GROQ_TEST_KEY || '').trim() : '';
export const voiceEndpoint = backendEndpoint || (directTestKey ? 'direct-groq-test' : '');
export async function analyzeVoice(audio: Blob | string, categories: Category[], categoryId: string | null, signal: AbortSignal, correctionField?: VoiceCorrectionField, onProgress?: (progress:VoiceProgress)=>void): Promise<VoiceAnalysis> {
  if (!voiceEndpoint) throw new Error('ميزة الصوت غير مفعّلة حاليًا. يمكنك الإضافة يدويًا.');
  const user = auth.currentUser;
  if (!user?.getIdToken) throw new Error('أعد تسجيل الدخول قبل استخدام المايك.');
  if (!backendEndpoint && directTestKey) {
    const { analyzeDirectTest } = await import('./voice-direct-test');
    return validateResult(await analyzeDirectTest(audio, categories, categoryId, directTestKey, signal, correctionField, onProgress), categories);
  }
  const url = new URL(backendEndpoint);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('خدمة الصوت تحتاج اتصال HTTPS.');
  const token = await user.getIdToken();
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const body = new FormData();
  if(typeof audio === 'string'){if(!audio.trim()||audio.length>4000)throw new Error('راجع النص قبل التحليل.');body.append('transcript',audio.trim());onProgress?.({phase:'extracting',transcript:audio.trim()});}
  else {body.append('audio', audio, audio.type.includes('mp4') ? 'recording.m4a' : 'recording.webm');onProgress?.({phase:'processing'});}
  body.append('categories', JSON.stringify(categories.map(c => ({ id: c.id, name: c.name, unit: c.defaultUnit || 'meters' }))));
  body.append('categoryId', categoryId || '');
  if (correctionField) body.append('correctionField', correctionField);
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body, signal });
  const result = await res.json().catch(() => ({}));
  if (result.usage) publishVoiceUsage(result.usage);
  if (!res.ok) throw new Error(result.error || 'تعذر تحليل الصوت. حاول مرة أخرى.');
  return validateResult(result, categories);
}
function validateResult(result: any, categories: Category[]): VoiceAnalysis {
  if (!result.draft || typeof result.transcript !== 'string') throw new Error('نتيجة التحليل غير مكتملة. أعد المحاولة.');
  if (result.draft.categoryId && !categories.some(c => c.id === result.draft.categoryId)) throw new Error('القسم المقترح غير متاح لهذا الحساب.');
  if (!Array.isArray(result.draft.uncertainties) || result.draft.uncertainties.some((x: unknown) => typeof x !== 'string') ||
      ['name','size','shade','quality','surface','color','itemType','materialOrGlass','brand','notes'].some(k => result.draft[k] !== null && typeof result.draft[k] !== 'string') ||
      (result.draft.quantity !== null && (typeof result.draft.quantity !== 'number' || !Number.isFinite(result.draft.quantity) || result.draft.quantity < 0))) {
    throw new Error('نتيجة التحليل غير صالحة. أعد التسجيل أو أضف الصنف يدويًا.');
  }
  return result;
}
export function draftValues(draft: VoiceDraft, category: Category, packingChoice = ''): Partial<Tile> {
  const values: Partial<Tile> = { categoryId: category.id, unitType: category.defaultUnit || 'meters', name: (draft.name || '').trim(), boxes: 0, pallets: 0 };
  if (typeof draft.quantity === 'number' && Number.isFinite(draft.quantity) && draft.quantity >= 0) values.meters = draft.quantity;
  for (const key of ['size', 'shade', 'quality', 'surface', 'color', 'itemType', 'materialOrGlass', 'brand', 'notes'] as const) if (typeof draft[key] === 'string') values[key] = draft[key]!.slice(0, key === 'notes' ? 1000 : 200);
  const packing = packingValues(draft, category.id, packingChoice);
  if (packing && category.defaultUnit !== 'pieces') { values.size = packing.size; values.boxes = packing.boxes; values.pallets = packing.pallets; }
  return values;
}
