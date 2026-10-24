import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, Mic, Square, X } from 'lucide-react';
import { ResponsiveOverlay } from '@/components/ui/ResponsiveOverlay';
import type { Category, Tile } from '@/types';
import { analyzeVoice, draftValues, voiceEndpoint, type VoiceAnalysis, type VoiceCorrectionField } from './voice.service';

import VoiceSurface from './VoiceSurface';
import {useLiveTranscript} from './useLiveTranscript';
import { useVoiceQuota } from './voice-quota';
import { voiceLabels, guideFields } from './voice-guide';
import { presetsFor, resolvePreset, packingValues } from './voice-presets.mjs';

async function readPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.size > 12 * 1024 * 1024) throw new Error('اختر صورة من الكاميرا أو المعرض بحجم أقل من 12 ميجابايت.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const ratio = Math.min(1, 600 / Math.max(1, image.naturalWidth), 900 / Math.max(1, image.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext('2d'); if (!context) throw new Error('تعذر تجهيز الصورة.');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', .7);
    if (data.length > 650000) throw new Error('الصورة كبيرة بعد الضغط. اختر صورة أصغر.');
    return data;
  } finally { URL.revokeObjectURL(url); }
}
export default function VoiceAddModal({ categories, categoryId, userId, onClose, onContinue }: {
  userId?: string; categories: Category[]; categoryId: string | null; onClose: () => void; onContinue: (values: Partial<Tile>, categoryId: string) => void;
}) {
  const quota = useVoiceQuota(userId);
  const live = useLiveTranscript();
  const [visualStream,setVisualStream]=useState<MediaStream|null>(null);
  const [heardText,setHeardText]=useState('');
  const [textScope,setTextScope]=useState<VoiceCorrectionField|null>(null);
  const [phase,setPhase]=useState<'transcribing'|'extracting'|'processing'>('transcribing');
  const [stage, setStage] = useState<'ready' | 'recording' | 'analyzing' | 'photo'>('ready');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<VoiceAnalysis | null>(null);
  const [selectedCategory, setSelectedCategory] = useState(categoryId || '');
  const [correctionField, setCorrectionField] = useState<VoiceCorrectionField | null>(null);
  const [packingChoice, setPackingChoice] = useState('');
  const activeCategory = categories.find(c => c.id === (categoryId || selectedCategory));
  const requiredFields = guideFields(activeCategory);
  const packing = analysis ? packingValues(analysis.draft, activeCategory?.id, packingChoice) : null;
  const [photo, setPhoto] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [permissionPending, setPermissionPending] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const controller = useRef<AbortController | null>(null);
  const processingRef=useRef(false);
  const alive = useRef(true);
  const interval = useRef<ReturnType<typeof setInterval>>();
  const maxTimer = useRef<ReturnType<typeof setTimeout>>();
  const fileRef = useRef<HTMLInputElement>(null), cameraRef = useRef<HTMLInputElement>(null);
  const cleanupAudio = () => { live.stop();if(alive.current)setVisualStream(null); clearInterval(interval.current); clearTimeout(maxTimer.current); stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; };
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); if (recorder.current?.state === 'recording') recorder.current.stop(); cleanupAudio(); }; }, []);
  const processInput = async (input:Blob|string, targetField:VoiceCorrectionField|null=correctionField, keepPhoto=false) => {
    if(processingRef.current)return;
    if(typeof input==='string'&&(!input.trim()||input.length>4000)){setError('راجع النص قبل التحليل.');return;}
    processingRef.current=true;setTextScope(targetField);setError('');setPhase(typeof input==='string'?'extracting':'transcribing');
        setStage('analyzing'); const abort = new AbortController(); controller.current = abort; const timeout = setTimeout(() => abort.abort(), 75000);
        try {
          const result = await analyzeVoice(input, categories, categoryId || selectedCategory || null, abort.signal, targetField || undefined, progress => {if(alive.current && controller.current===abort){setPhase(progress.phase);if(progress.transcript)setHeardText(progress.transcript);}});
          if (!alive.current || controller.current!==abort) return;
          setHeardText(result.transcript);
          if (targetField && analysis) {
            const value = result.draft[targetField];
            if (value === null || value === '') { setError(`لم نفهم ${voiceLabels[targetField]} بوضوح. أعد تسجيل هذه الخانة فقط أو أكملها في النموذج.`); setStage('photo'); return; }
            // Only the requested field may change. The model cannot replace the rest of the draft.
            const resolvedDefault = targetField === 'name' ? 'اسم أو كود الصنف غير واضح' : targetField === 'quantity' ? 'الكمية غير واضحة' : '';
            const unrelatedDefaults = ['يجب اختيار القسم', ...(targetField !== 'name' ? ['اسم أو كود الصنف غير واضح'] : []), ...(targetField !== 'quantity' ? ['الكمية غير واضحة'] : [])];
            const warnings = [...new Set([...result.draft.uncertainties.filter(w => !unrelatedDefaults.includes(w)), ...analysis.draft.uncertainties.filter(w => !resolvedDefault || w !== resolvedDefault)])].slice(0,10);
            setAnalysis({transcript: analysis.transcript + `\nتصحيح ${voiceLabels[targetField]}: ` + result.transcript, draft: {...analysis.draft, [targetField]:value, uncertainties:warnings}});
            if (targetField === 'size') setPackingChoice(resolvePreset({...analysis.draft,size:value}, activeCategory?.id,result.transcript)?.desc || '');
          } else {
            setAnalysis(result); setSelectedCategory(categoryId || selectedCategory || result.draft.categoryId || ''); if(!keepPhoto)setPhoto(''); setPackingChoice(resolvePreset(result.draft,categoryId || selectedCategory || result.draft.categoryId,result.transcript)?.desc || '');
          }
          setCorrectionField(null); setStage('photo');
        } catch (e) { if (alive.current) { setStage(analysis ? 'photo' : 'ready'); setError(abort.signal.aborted ? 'انتهت مهلة التحليل. حاول بتسجيل أقصر.' : e instanceof Error ? e.message : 'تعذر تحليل الصوت.'); } }
        finally { clearTimeout(timeout);processingRef.current=false; }
  };
  const start = async () => {
    if (permissionPending || stage === 'recording' || stage === 'analyzing') return;
    if (!voiceEndpoint) { setError('ميزة الصوت غير مفعّلة حاليًا. يمكنك الإضافة يدويًا.'); return; }
    setError(''); setHeardText('');setTextScope(correctionField);setPermissionPending(true);live.start();
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('المتصفح لا يدعم تسجيل الصوت هنا. افتح الموقع في Safari أو Chrome عبر اتصال آمن.');
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (!alive.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;setVisualStream(media);
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(media, mimeType ? { mimeType } : undefined); recorder.current = rec;
      const chunks: BlobPart[] = []; let bytes = 0; let failed = false;
      rec.ondataavailable = event => { if (event.data.size) { chunks.push(event.data); bytes += event.data.size; if (bytes > 4 * 1024 * 1024 && rec.state === 'recording') rec.stop(); } };
      rec.onerror = () => { failed = true; cleanupAudio(); if (alive.current) { setStage('ready'); setError('انقطع التسجيل. حاول مرة أخرى.'); } };
      rec.onstop = async () => {
        cleanupAudio(); if (!alive.current || failed) return;
        const audio = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        if (audio.size < 150 || audio.size > 4 * 1024 * 1024) { setStage('ready'); setError('التسجيل قصير جدًا أو كبير. سجّل وصفًا واضحًا لمدة أقل من 45 ثانية.'); return; }
        await processInput(audio);
      };
      rec.start(500); setSeconds(0); setStage('recording');
      interval.current = setInterval(() => setSeconds(s => s + 1), 1000);
      maxTimer.current = setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, 45000);
    } catch (e) { cleanupAudio(); if (alive.current) { setStage('ready'); setError(e instanceof DOMException && ['NotAllowedError','PermissionDeniedError'].includes(e.name) ? 'اسمح باستخدام المايك من إعدادات المتصفح ثم حاول مرة أخرى.' : e instanceof Error ? e.message : 'تعذر تشغيل المايك.'); } }
    finally { if (alive.current) setPermissionPending(false); }
  };
  const selectPhoto = async (file?: File) => {
    if (!file || photoBusy) return; setPhotoBusy(true); setError('');
    try { const data = await readPhoto(file); if (alive.current) setPhoto(data); }
    catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'تعذر فتح الصورة. اختر صورة أخرى.'); }
    finally { if (alive.current) setPhotoBusy(false); }
  };
  const next = () => {
    const category = categories.find(c => c.id === selectedCategory);
    if (!category || !analysis) { setError('اختر القسم أولًا.'); return; }
    onContinue({ ...draftValues(analysis.draft, category, packingChoice), ...(photo ? { image: photo } : {}) }, category.id);
  };
  return <ResponsiveOverlay open onClose={onClose} title="إضافة بالصوت" mobileSnap="compact" desktopMaxWidth="max-w-md" contentClassName="voice-modal-content">
    <section className="voice-modal" dir="rtl">
      <details className="voice-quota" hidden={stage==='recording'||stage==='analyzing'}><summary>{quota.analysis?.remaining != null ? `آخر رصيد: ${quota.analysis.remaining} طلب تحليل` : 'الاستخدام'}</summary><p>الصوت: {quota.speech?.remaining ?? 'غير متاح'} · التحليل: {quota.analysis?.remaining ?? 'غير متاح'} · توكن الدقيقة: {quota.analysis?.tokensPerMinute ?? 'غير متاح'}</p><small>آخر رصيد مُبلّغ عنه، مشترك للحساب. توجد حدود للتوكن ومدة الصوت أيضًا.</small></details>
      {error && <p className="voice-error" role="alert">{error}</p>}
      {stage !== 'photo' ? <>
        <VoiceSurface stream={visualStream} recording={stage==='recording'} processing={stage==='analyzing'} phase={phase}>
          <h3>{stage==='recording'?'جارٍ التسجيل…':correctionField?`أعد تسجيل ${voiceLabels[correctionField]} فقط`:'احكِ تفاصيل الصنف'}</h3>
        </VoiceSurface>
      {stage==='recording' && <div className="voice-live-text" role="status" aria-live="polite"><small>{live.available?'معاينة مباشرة · قابلة للتصحيح':'النص النهائي يظهر بعد إنهاء التسجيل'}</small><p>{live.text || '…'}</p></div>}
        {stage==='analyzing' && heardText && <div className="voice-live-text"><small>النص المسموع</small><p>{heardText}</p></div>}
        {!correctionField && stage === 'ready' && <label className="voice-category">القسم<select aria-label="قسم التسجيل" value={categoryId || selectedCategory} disabled={Boolean(categoryId) || permissionPending} onChange={e => setSelectedCategory(e.target.value)}><option value="">تحديد القسم من الكلام</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
        {!correctionField && stage==='ready' && <ul className="voice-checklist">{requiredFields.map(field => <li key={field}>{voiceLabels[field]}{field === 'quantity' ? activeCategory?.defaultUnit === 'pieces' ? ' بالقطعة' : ' بالمتر المربع' : ''}</li>)}</ul>}
        {categoryId && <span className="voice-context">القسم: {categories.find(c => c.id === categoryId)?.name}</span>}
        
        <div aria-live="polite" className="voice-status">{stage === 'recording' ? `${seconds} / 45 ثانية` : ''}</div>
        {stage === 'recording' ? <button type="button" className="voice-primary" onClick={() => { if (recorder.current?.state === 'recording') recorder.current.stop(); }}><Square size={17} />إنهاء وتحليل</button> : <button type="button" className="voice-primary" disabled={permissionPending || stage === 'analyzing'} onClick={start}><Mic size={18} />{permissionPending ? 'جارٍ فتح المايك…' : stage === 'analyzing' ? 'جارٍ التحليل…' : 'ابدأ التسجيل'}</button>}
        {correctionField && stage === 'ready' && <button type="button" className="voice-retry" disabled={permissionPending} onClick={() => {setCorrectionField(null);setStage('photo');setError('');}}>الرجوع للمسودة</button>}
        <small>الصوت يُرسل إلى Groq عند التحليل. المعاينة المباشرة تستخدم خدمة المتصفح إن توفرت.</small>
      </> : analysis && <>
        <h3>نضيف صورة للصنف؟</h3>
        <label className="voice-category">القسم<select value={selectedCategory} disabled={Boolean(categoryId)} onChange={e => {setSelectedCategory(e.target.value);setPackingChoice('');}}><option value="">اختر القسم</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <div className="voice-draft"><strong>{analysis.draft.name || 'اسم الصنف يحتاج مراجعة'}</strong><span>{[analysis.draft.size, analysis.draft.surface, analysis.draft.quantity === null ? 'الكمية تحتاج مراجعة' : `${analysis.draft.quantity} ${categories.find(c => c.id === selectedCategory)?.defaultUnit === 'pieces' ? 'قطعة' : 'م²'}`].filter(Boolean).join(' · ')}</span></div>
        <div className="voice-review-fields">{requiredFields.map(field => <div key={field}><span>{voiceLabels[field]}<strong>{analysis.draft[field] ?? 'لم يُذكر / غير واضح'}</strong></span><button type="button" disabled={photoBusy} aria-label={`إعادة تسجيل ${voiceLabels[field]}`} onClick={() => {setCorrectionField(field);setStage('ready');setError('');}}><Mic size={15} />تصحيح</button></div>)}</div>
        {presetsFor(activeCategory?.id).length > 0 && <label className="voice-category">تعبئة المقاس<select aria-label="تعبئة المقاس" value={packingChoice || resolvePreset(analysis.draft, activeCategory?.id)?.desc || ''} onChange={e => {const choice=e.target.value;setPackingChoice(choice);if(choice)setAnalysis(previous => previous ? {...previous,draft:{...previous.draft,size:choice}} : previous);}}><option value="">اختر التعبئة إذا لم تتحدد</option>{presetsFor(activeCategory?.id).map(p => <option key={p.desc} value={p.desc}>{p.label}</option>)}</select></label>}
        {packing ? <p className="voice-packing">{analysis.draft.quantity} م² · {packing.boxes} كرتونة · {packing.pallets} طبلية<br/><small>حسب إعدادات المقاس: {packing.mBox} م² للكرتونة، {packing.bPallet} كرتونة للطبلية. الكراتين مقربة للأعلى وفق حساب التطبيق.</small></p> : presetsFor(activeCategory?.id).length > 0 && <p className="voice-warning">الأمتار محفوظة. اختر تعبئة المقاس لحساب الكراتين والطبالي؛ نفس المقاس قد يختلف بين المصانع.</p>}
        {analysis.draft.uncertainties?.length > 0 && <p className="voice-warning">للمراجعة: {analysis.draft.uncertainties.join('، ')}</p>}
        {photo && <div className="voice-photo"><img src={photo} alt="صورة الصنف المختارة" /><button type="button" aria-label="إزالة الصورة المختارة" onClick={() => setPhoto('')}><X size={18} /></button></div>}
        <div className="voice-photo-actions"><button type="button" disabled={photoBusy} onClick={() => cameraRef.current?.click()}><Camera size={19} />الكاميرا</button><button type="button" disabled={photoBusy} onClick={() => fileRef.current?.click()}><ImagePlus size={19} />اختيار صورة</button></div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { void selectPhoto(e.target.files?.[0]); e.target.value = ''; }} /><input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { void selectPhoto(e.target.files?.[0]); e.target.value = ''; }} />
        <button type="button" className="voice-primary" disabled={photoBusy || !selectedCategory} onClick={next}>{photoBusy ? 'جارٍ تجهيز الصورة…' : photo ? 'مراجعة الصنف والصورة' : 'إعداد الصورة لاحقًا ومراجعة الصنف'}</button>
        <button type="button" className="voice-retry" disabled={photoBusy} onClick={() => { setAnalysis(null); setCorrectionField(null); setPhoto('');setHeardText('');setTextScope(null); setPackingChoice(''); setStage('ready'); setError(''); }}>إعادة التسجيل</button>
        
      </>}
      {stage!=='recording' && heardText && <div className="voice-text-review"><label htmlFor="voice-heard-text">{textScope?`النص المسموع — ${voiceLabels[textScope]}`:'النص المسموع'}</label><textarea id="voice-heard-text" value={heardText} maxLength={4000} disabled={stage==='analyzing'||permissionPending||photoBusy} onChange={e=>setHeardText(e.target.value)} rows={3}/><button type="button" className="home-secondary-button" disabled={stage==='analyzing'||permissionPending||photoBusy||!heardText.trim()} onClick={()=>void processInput(heardText,textScope,true)}>إعادة تحليل النص</button></div>}
    </section>
  </ResponsiveOverlay>;
}
