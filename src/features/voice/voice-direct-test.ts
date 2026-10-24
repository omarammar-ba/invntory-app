// Temporary, explicitly enabled browser-only test. The API key is PUBLIC in the built app.
import type { Category } from '@/types';
import type { VoiceAnalysis, VoiceCorrectionField, VoiceProgress } from './voice.service';
import { publishVoiceUsage, quotaFromHeaders } from './voice-quota';
import { schema, system, cleanDraft } from './voice-model.mjs';
export async function analyzeDirectTest(audio: Blob | string, categories: Category[], lockedCategoryId: string | null, key: string, signal: AbortSignal, correctionField?: VoiceCorrectionField, onProgress?: (progress:VoiceProgress)=>void): Promise<VoiceAnalysis> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  if (typeof audio !== 'string' && (audio.size < 150 || audio.size > 4 * 1024 * 1024)) throw new Error('التسجيل قصير جدًا أو كبير. أعد تسجيل وصف واحد قصير.');
  if (!categories.length || categories.length > 60) throw new Error('تعذر تجهيز الأقسام للتحليل.');
  if (lockedCategoryId && !categories.some(c => c.id === lockedCategoryId)) throw new Error('القسم المحدد غير متاح.');
  const request = async (path: string, body: FormData | object, json = false) => {
    const response = await fetch('https://api.groq.com/openai/v1/' + path, {
      method: 'POST', signal,
      headers: { Authorization: `Bearer ${key}`, ...(json ? { 'Content-Type': 'application/json' } : {}) },
      body: json ? JSON.stringify(body) : body as FormData,
    });
    publishVoiceUsage({[path.includes('transcriptions') ? 'speech' : 'analysis']:quotaFromHeaders(response.headers)});
    if (!response.ok) {
      if (response.status === 429) throw new Error('وصلت الخدمة للحد المجاني الحالي. انتظر قليلًا ثم حاول.');
      if ([401, 403].includes(response.status)) throw new Error('مفتاح Groq التجريبي مرفوض أو لا يملك صلاحية النموذج.');
      throw new Error(`تعذر التحليل من Groq (${response.status}). حاول بتسجيل أقصر أو أضف الصنف يدويًا.`);
    }
    return response.json();
  };
  let transcript=typeof audio === 'string'?audio.trim():'';
  if(typeof audio !== 'string'){onProgress?.({phase:'transcribing'});
  const file = new FormData();
  file.append('file', audio, audio.type.includes('mp4') ? 'voice.m4a' : 'voice.webm');
  file.append('model', 'whisper-large-v3'); file.append('language', 'ar'); file.append('temperature', '0'); file.append('response_format', 'json');
  file.append('prompt', 'أصناف مخزون: بورسلان، سيراميك، مقاعد، مجالي، شور بكس. أكواد ومقاسات وكميات بالمتر المربع أو القطعة.');
  const stt = await request('audio/transcriptions', file);
  transcript = typeof stt.text === 'string' ? stt.text.trim() : '';
  if (!transcript || transcript.length > 4000) throw new Error('لم نلتقط وصفًا واضحًا. أعد التسجيل قرب المايك.');
  }
  if(!transcript||transcript.length>4000)throw new Error('راجع النص قبل التحليل.');
  onProgress?.({phase:'extracting',transcript});
  const list = categories.map(c => ({ id: c.id, name: c.name, unit: c.defaultUnit || 'meters' }));
  const completion = await request('chat/completions', {
    model: 'openai/gpt-oss-120b', temperature: 0, max_completion_tokens: 2000,
    messages: [{ role: 'system', content: system + (correctionField ? ` هذا تسجيل تصحيح للحقل ${correctionField} فقط. فسّر الكلام باعتباره قيمة هذا الحقل، ولا تطلب بقية بيانات الصنف ولا تستنتجها.` : '') }, { role: 'user', content: JSON.stringify({ transcript, categories: list, lockedCategoryId }) }],
    response_format: { type: 'json_schema', json_schema: { name: 'inventory_voice_draft', strict: true, schema } },
  }, true);
  let parsed: unknown;
  try { parsed = JSON.parse(completion.choices?.[0]?.message?.content || ''); }
  catch { throw new Error('نتيجة التحليل غير مكتملة. أعد التسجيل.'); }
  return { transcript, draft: cleanDraft(parsed, list, lockedCategoryId || '') as VoiceAnalysis['draft'] };
}
