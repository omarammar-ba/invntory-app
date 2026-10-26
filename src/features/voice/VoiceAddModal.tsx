import React, { useEffect, useRef, useState } from "react";
import { Info, Mic, Square, X } from "lucide-react";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { ResponsiveOverlay } from "@/components/ui/ResponsiveOverlay";
import type { Category, Tile } from "@/types";
import {
  analyzeVoice,
  draftValues,
  voiceEndpoint,
  type VoiceAnalysis,
  type VoiceCorrectionField,
} from "./voice.service";

import VoiceSurface from "./VoiceSurface";
import VoiceDraftReview from "./VoiceDraftReview";
import { quantitySource, convertQuantity } from "./voice-quantity.mjs";
import { useLiveTranscript } from "./useLiveTranscript";
import { useVoiceQuota } from "./voice-quota";
import { voiceLabels, guideFields } from "./voice-guide";
import { presetsFor, resolvePreset } from "./voice-presets.mjs";

function voiceError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  if (/Importing binding|does not provide an export|dynamically imported module|Importing a module script failed/i.test(error.message)) {
    return "تعذر تحميل ملفات الصوت المحدثة. حدّث الصفحة ثم أعد المحاولة.";
  }
  return error.message || fallback;
}

async function readPhoto(file: File): Promise<string> {
  if (
    !file.type.startsWith("image/") ||
    file.type === "image/svg+xml" ||
    file.size > 12 * 1024 * 1024
  )
    throw new Error("اختر صورة من الكاميرا أو المعرض بحجم أقل من 12 ميجابايت.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const ratio = Math.min(
      1,
      600 / Math.max(1, image.naturalWidth),
      900 / Math.max(1, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("تعذر تجهيز الصورة.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.7);
    if (data.length > 650000)
      throw new Error("الصورة كبيرة بعد الضغط. اختر صورة أصغر.");
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export default function VoiceAddModal({
  categories,
  categoryId,
  userId,
  onClose,
  onContinue,
}: {
  userId?: string;
  categories: Category[];
  categoryId: string | null;
  onClose: () => void;
  onContinue: (values: Partial<Tile>, categoryId: string) => void;
}) {
  const quota = useVoiceQuota(userId);
  const isMobile = useIsMobile();
  const live = useLiveTranscript();
  const [visualStream, setVisualStream] = useState<MediaStream | null>(null);
  const [heardText, setHeardText] = useState("");
  const [textScope, setTextScope] = useState<VoiceCorrectionField | null>(null);
  const [phase, setPhase] = useState<
    "transcribing" | "extracting" | "processing"
  >("transcribing");
  const [stage, setStage] = useState<
    "ready" | "recording" | "analyzing" | "transcript" | "photo"
  >("ready");
  const [transcriptionMode, setTranscriptionMode] = useState<
    "recording" | "browser"
  >("recording");
  const pendingAudio = useRef<Blob | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<VoiceAnalysis | null>(null);
  const [selectedCategory, setSelectedCategory] = useState(categoryId || "");
  const [correctionField, setCorrectionField] =
    useState<VoiceCorrectionField | null>(null);
  const [packingChoice, setPackingChoice] = useState("");
  const activeCategory = categories.find(
    (c) => c.id === (categoryId || selectedCategory),
  );
  const requiredFields = guideFields(activeCategory);
  const [photo, setPhoto] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [permissionPending, setPermissionPending] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const controller = useRef<AbortController | null>(null);
  const processingRef = useRef(false);
  const alive = useRef(true);
  const interval = useRef<ReturnType<typeof setInterval>>();
  const maxTimer = useRef<ReturnType<typeof setTimeout>>();
  const fileRef = useRef<HTMLInputElement>(null),
    cameraRef = useRef<HTMLInputElement>(null);
  const cleanupAudio = () => {
    live.stop();
    if (alive.current) setVisualStream(null);
    clearInterval(interval.current);
    clearTimeout(maxTimer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
      if (recorder.current?.state === "recording") recorder.current.stop();
      cleanupAudio();
    };
  }, []);
  const processInput = async (
    input: Blob | string,
    targetField: VoiceCorrectionField | null = correctionField,
    keepPhoto = false,
  ) => {
    if (processingRef.current) return;
    if (typeof input === "string" && (!input.trim() || input.length > 4000)) {
      setError("راجع النص قبل التحليل.");
      return;
    }
    if (typeof input !== "string") pendingAudio.current = input;
    processingRef.current = true;
    setTextScope(targetField);
    setError("");
    setPhase(typeof input === "string" ? "extracting" : "transcribing");
    setStage("analyzing");
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 75000);
    try {
      const result = await analyzeVoice(
        input,
        categories,
        categoryId || selectedCategory || null,
        abort.signal,
        targetField || undefined,
        (progress) => {
          if (alive.current && controller.current === abort) {
            setPhase(progress.phase);
            if (progress.transcript) setHeardText(progress.transcript);
          }
        },
      );
      if (!alive.current || controller.current !== abort) return;
      setHeardText(result.transcript);
      if (targetField && analysis) {
        const value = result.draft[targetField];
        if (
          (value === null || value === "") &&
          !(
            targetField === "quantity" &&
            quantitySource(result.draft, activeCategory?.defaultUnit)
          )
        ) {
          setError(
            `لم نفهم ${voiceLabels[targetField]} بوضوح. أعد تسجيل هذه الخانة فقط أو أكملها في النموذج.`,
          );
          setStage("photo");
          return;
        }
        // Only the requested field may change. The model cannot replace the rest of the draft.
        const resolvedDefault =
          targetField === "name"
            ? "اسم أو كود الصنف غير واضح"
            : targetField === "quantity"
              ? "الكمية غير واضحة"
              : "";
        const unrelatedDefaults = [
          "يجب اختيار القسم",
          ...(targetField !== "name" ? ["اسم أو كود الصنف غير واضح"] : []),
          ...(targetField !== "quantity" ? ["الكمية غير واضحة"] : []),
        ];
        const warnings = [
          ...new Set([
            ...result.draft.uncertainties.filter(
              (w) => !unrelatedDefaults.includes(w),
            ),
            ...analysis.draft.uncertainties.filter(
              (w) => !resolvedDefault || w !== resolvedDefault,
            ),
          ]),
        ].slice(0, 10);
        setAnalysis({
          transcript:
            analysis.transcript +
            `\nتصحيح ${voiceLabels[targetField]}: ` +
            result.transcript,
          draft: {
            ...analysis.draft,
            [targetField]: value,
            ...(targetField === "quantity"
              ? {
                  quantityInput: result.draft.quantityInput ?? null,
                  quantityUnit: result.draft.quantityUnit ?? null,
                }
              : {}),
            uncertainties: warnings,
          },
        });
        if (targetField === "size")
          setPackingChoice(
            resolvePreset(
              { ...analysis.draft, size: value },
              activeCategory?.id,
              result.transcript,
            )?.desc || "",
          );
      } else {
        setAnalysis(result);
        setSelectedCategory(
          categoryId || selectedCategory || result.draft.categoryId || "",
        );
        if (!keepPhoto) setPhoto("");
        setPackingChoice(
          resolvePreset(
            result.draft,
            categoryId || selectedCategory || result.draft.categoryId,
            result.transcript,
          )?.desc || "",
        );
      }
      setCorrectionField(null);
      setStage("photo");
    } catch (e) {
      if (alive.current) {
        setStage(
          analysis
            ? "photo"
            : typeof input === "string" && pendingAudio.current
              ? "transcript"
              : "ready",
        );
        setError(
          abort.signal.aborted
            ? "انتهت مهلة التحليل. حاول بتسجيل أقصر."
            : voiceError(e, "تعذر تحليل الصوت."),
        );
      }
    } finally {
      clearTimeout(timeout);
      processingRef.current = false;
    }
  };
  const start = async () => {
    if (permissionPending || stage === "recording" || stage === "analyzing")
      return;
    if (!voiceEndpoint) {
      setError("ميزة الصوت غير مفعّلة حاليًا. يمكنك الإضافة يدويًا.");
      return;
    }
    setError("");
    setHeardText("");
    pendingAudio.current = null;
    setTextScope(correctionField);
    setPermissionPending(true);
    live.start();
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          "المتصفح لا يدعم تسجيل الصوت هنا. افتح الموقع في Safari أو Chrome عبر اتصال آمن.",
        );
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      if (!alive.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      setVisualStream(media);
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/webm",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder.current = rec;
      const chunks: BlobPart[] = [];
      let bytes = 0;
      let failed = false;
      rec.ondataavailable = (event) => {
        if (event.data.size) {
          chunks.push(event.data);
          bytes += event.data.size;
          if (bytes > 4 * 1024 * 1024 && rec.state === "recording") rec.stop();
        }
      };
      rec.onerror = () => {
        failed = true;
        cleanupAudio();
        if (alive.current) {
          setStage("ready");
          setError("انقطع التسجيل. حاول مرة أخرى.");
        }
      };
      rec.onstop = async () => {
        const previewText = live.snapshot();
        cleanupAudio();
        if (!alive.current || failed) return;
        const audio = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (audio.size < 150 || audio.size > 4 * 1024 * 1024) {
          setStage("ready");
          setError(
            "التسجيل قصير جدًا أو كبير. سجّل وصفًا واضحًا لمدة أقل من 45 ثانية.",
          );
          return;
        }
        pendingAudio.current = audio;
        if (transcriptionMode === "browser") {
          setHeardText(previewText);
          setStage("transcript");
          if (!previewText.trim())
            setError(
              "لم يصل نص مباشر من المتصفح. يمكنك تفريغ التسجيل أو الكتابة هنا.",
            );
        } else await processInput(audio);
      };
      rec.start(500);
      setSeconds(0);
      setStage("recording");
      interval.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      maxTimer.current = setTimeout(() => {
        if (rec.state === "recording") rec.stop();
      }, 45000);
    } catch (e) {
      cleanupAudio();
      if (alive.current) {
        setStage("ready");
        setError(
          e instanceof DOMException &&
            ["NotAllowedError", "PermissionDeniedError"].includes(e.name)
            ? "اسمح باستخدام المايك من إعدادات المتصفح ثم حاول مرة أخرى."
            : voiceError(e, "تعذر تشغيل المايك."),
        );
      }
    } finally {
      if (alive.current) setPermissionPending(false);
    }
  };
  const selectPhoto = async (file?: File) => {
    if (!file || photoBusy) return;
    setPhotoBusy(true);
    setError("");
    try {
      const data = await readPhoto(file);
      if (alive.current) setPhoto(data);
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error ? e.message : "تعذر فتح الصورة. اختر صورة أخرى.",
        );
    } finally {
      if (alive.current) setPhotoBusy(false);
    }
  };
  const next = () => {
    const category = categories.find((c) => c.id === selectedCategory);
    if (!category || !analysis) {
      setError("اختر القسم أولًا.");
      return;
    }
    try {
      onContinue(
        {
          ...draftValues(analysis.draft, category, packingChoice),
          ...(photo ? { image: photo } : {}),
        },
        category.id,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "راجع الكمية قبل المتابعة.");
    }
  };
  const sessionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const target = sessionRef.current?.querySelector<HTMLElement>(
        stage === "recording"
          ? ".voice-stop-button"
          : stage === "analyzing"
            ? ".voice-close-button"
            : stage === "photo"
              ? ".voice-draft-heading"
              : ".voice-primary",
      );
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [stage, isMobile]);
  const immersive = stage === "recording" || stage === "analyzing";
  const selectedPreset = analysis
    ? packingChoice
      ? presetsFor(selectedCategory).find((p) => p.desc === packingChoice)
      : resolvePreset(analysis.draft, selectedCategory)
    : null;
  const conversion = analysis
    ? convertQuantity(
        analysis.draft,
        selectedPreset,
        activeCategory?.defaultUnit || "meters",
      )
    : null;
  return (
    <ResponsiveOverlay
      open
      onClose={onClose}
      title="إضافة بالصوت"
      mobileSnap={immersive ? "expanded" : "large"}
      desktopMaxWidth="max-w-md"
      footer={
        stage === "photo" && analysis ? (
          <div className="voice-review-footer" dir="rtl">
            <button
              type="button"
              className="voice-primary"
              disabled={
                photoBusy ||
                !selectedCategory ||
                Boolean(
                  conversion?.error &&
                    (conversion.source || conversion.invalid),
                )
              }
              onClick={next}
            >
              {photoBusy ? "جارٍ تجهيز الصورة…" : "متابعة إلى نموذج الإضافة"}
            </button>
            <small>الحفظ يتم من النموذج بعد مراجعتك.</small>
          </div>
        ) : undefined
      }
      contentClassName={`voice-modal-content ${immersive ? "voice-immersive-content" : stage === "photo" ? "voice-review-content" : "voice-setup-content"}`}
    >
      <section ref={sessionRef} className="voice-modal" dir="rtl">
        {error && (
          <p className="voice-error" role="alert">
            {error}
          </p>
        )}
        {immersive ? (
          <VoiceSurface
            stream={visualStream}
            recording={stage === "recording"}
            processing={stage === "analyzing"}
            phase={phase}
          >
            <div className="voice-session-heading">
              <span>{stage === "recording" ? "أسمعك" : "لحظة واحدة"}</span>
              <span className="voice-session-time">
                {stage === "recording"
                  ? `0:${String(seconds).padStart(2, "0")} / 0:45`
                  : ""}
              </span>
            </div>
            <div
              className="voice-session-copy voice-live-text"
              role={stage === "recording" ? "status" : undefined}
              aria-live={stage === "recording" ? "polite" : undefined}
            >
              <p>
                {stage === "recording"
                  ? live.text || "احكِ تفاصيل الصنف…"
                  : heardText || "نجهّز تسجيلك…"}
              </p>
              {stage === "recording" && !live.available && (
                <small>
                  {live.status ||
                    "المعاينة المباشرة بانتظار الكلام. سيظهر النص النهائي بعد إنهاء التسجيل."}
                </small>
              )}
            </div>
            <div className="voice-session-footer">
              <span className="voice-session-context">
                {correctionField
                  ? voiceLabels[correctionField]
                  : activeCategory?.name || "صنف جديد"}
              </span>
              <div className="voice-session-actions">
                {stage === "recording" && (
                  <button
                    type="button"
                    className="voice-stop-button"
                    aria-label={
                      transcriptionMode === "browser"
                        ? "إنهاء التسجيل"
                        : "إنهاء وتحليل"
                    }
                    onClick={() => {
                      if (recorder.current?.state === "recording")
                        recorder.current.stop();
                    }}
                  >
                    <Square size={16} fill="currentColor" />
                    <span>
                      {transcriptionMode === "browser" ? "إنهاء" : "تحليل"}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  className="voice-close-button"
                  aria-label="إلغاء التسجيل"
                  title="إلغاء"
                  onClick={onClose}
                >
                  <X size={22} />
                </button>
              </div>
            </div>
          </VoiceSurface>
        ) : stage === "photo" && analysis ? (
          <VoiceDraftReview
            analysis={analysis}
            categories={categories}
            selectedCategory={selectedCategory}
            locked={Boolean(categoryId)}
            packingChoice={packingChoice}
            photo={photo}
            busy={photoBusy}
            heardText={heardText}
            onCategory={(id) => {
              setSelectedCategory(id);
              setPackingChoice("");
            }}
            onDraft={(draft) => {
              if (draft.size !== analysis.draft.size) setPackingChoice("");
              const warnings = draft.uncertainties.filter(
                (w) =>
                  !(draft.name?.trim() && w === "اسم أو كود الصنف غير واضح") &&
                  !(
                    quantitySource(draft, activeCategory?.defaultUnit) &&
                    w === "الكمية غير واضحة"
                  ),
              );
              setAnalysis((previous) =>
                previous
                  ? {
                      ...previous,
                      draft: { ...draft, uncertainties: warnings },
                    }
                  : previous,
              );
            }}
            onPacking={(choice) => {
              setPackingChoice(choice);
              if (choice)
                setAnalysis((previous) =>
                  previous
                    ? {
                        ...previous,
                        draft: { ...previous.draft, size: choice },
                      }
                    : previous,
                );
            }}
            onCorrect={(field) => {
              setCorrectionField(field);
              setStage("ready");
              setError("");
            }}
            onCamera={() => cameraRef.current?.click()}
            onPhoto={() => fileRef.current?.click()}
            onRemovePhoto={() => setPhoto("")}
            onRetry={() => {
              setAnalysis(null);
              setCorrectionField(null);
              setPhoto("");
              setHeardText("");
              setTextScope(null);
              setPackingChoice("");
              setStage("ready");
              setError("");
            }}
            textScope={textScope}
            onText={setHeardText}
            onReanalyze={() => void processInput(heardText, textScope, true)}
          />
        ) : stage === "transcript" ? (
          <div className="voice-setup">
            <header>
              <span className="voice-setup-icon">
                <Mic size={29} strokeWidth={1.5} />
              </span>
              <h3>راجع الكلام</h3>
              <p>راجع الكلام وعدّله إذا لزم، ثم اضغط تحليل النص.</p>
            </header>
            <label htmlFor="voice-heard-text" className="sr-only">
              النص المسموع
            </label>
            <textarea
              className="voice-transcript-editor"
              id="voice-heard-text"
              rows={6}
              maxLength={4000}
              value={heardText}
              onChange={(e) => setHeardText(e.target.value)}
            />
            <footer>
              <button
                type="button"
                className="voice-primary"
                disabled={!heardText.trim()}
                onClick={() => void processInput(heardText)}
              >
                تحليل النص
              </button>
              {pendingAudio.current && (
                <button
                  type="button"
                  className="voice-retry"
                  onClick={() => void processInput(pendingAudio.current!)}
                >
                  استخراج الكلام من التسجيل بدلًا من المعاينة
                </button>
              )}
              <button
                type="button"
                className="voice-retry"
                onClick={() => {
                  setStage("ready");
                  setError("");
                }}
              >
                إعادة التسجيل
              </button>
            </footer>
          </div>
        ) : (
          <div className="voice-setup">
            <header>
              <span className="voice-setup-icon">
                <Mic size={29} strokeWidth={1.5} />
              </span>
              <h3>
                {correctionField
                  ? `أعد تسجيل ${voiceLabels[correctionField]} فقط`
                  : "احكِ الصنف بطريقتك"}
              </h3>
              <p>
                {correctionField
                  ? "باقي البيانات والصورة محفوظة."
                  : "الكود والمقاس والمواصفات والكمية؛ بالمتر أو الكراتين أو الطبالي."}
              </p>
            </header>
            <div className="voice-setup-body">
              {!correctionField && (
                <>
                  <label className="voice-category">
                    القسم
                    <select
                      aria-label="قسم التسجيل"
                      value={categoryId || selectedCategory}
                      disabled={Boolean(categoryId) || permissionPending}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                      <option value="">تحديده من الكلام</option>
                      {categories.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div
                    className="voice-checklist"
                    aria-label="المواصفات المطلوبة"
                  >
                    {requiredFields.map((field) => (
                      <span key={field}>{voiceLabels[field]}</span>
                    ))}
                  </div>
                </>
              )}
              <details className="voice-help">
                <summary><Info size={16} />طريقة الاستخدام وخيارات التسجيل</summary>
                <p>احكِ عن صنف واحد: القسم، الكود أو الاسم، المقاس، المواصفات، ثم الكمية ووحدتها. مثال: بورسلان كود 12044، مقاس 120 في 60، مطفي، ثلاث طبالي.</p>
                <p>بعد التحليل راجع الخانات، واختر صورة الآن أو لاحقًا. لن يُحفظ الصنف إلا عندما تؤكد الإضافة في النموذج.</p>
                {live.supported && (
                  <label className="voice-source-choice">
                    طريقة التسجيل
                    <select
                      aria-label="طريقة التسجيل"
                      disabled={permissionPending}
                      value={transcriptionMode}
                      onChange={e => setTranscriptionMode(e.target.value as "recording" | "browser")}
                    >
                      <option value="recording">تسجيل الصوت ثم تحليله — الموصى به</option>
                      <option value="browser">مراجعة الكلام المكتوب قبل التحليل</option>
                    </select>
                  </label>
                )}
                <p>الخيار الموصى به يحلل التسجيل الصوتي عند الانتهاء. الخيار الثاني يستخدم خدمة التعرف على الكلام في متصفحك، لتعدّل النص قبل إرساله للتحليل؛ توفره ودقته يختلفان حسب الجهاز والمتصفح، وليس ربطًا مباشرًا بخدمة Google.</p>
                <p>الكلام الظاهر أثناء التسجيل معاينة وقد يختلف عن تفريغ التسجيل النهائي. إذا لم يظهر، يمكنك إكمال التسجيل وتحليله كالمعتاد.</p>
              </details>
            </div>
            <footer>
              <button
                type="button"
                className="voice-primary"
                disabled={permissionPending}
                onClick={start}
              >
                <Mic size={19} />
                {permissionPending ? "جارٍ فتح المايك…" : "ابدأ التسجيل"}
              </button>
              {error && pendingAudio.current && (
                <button
                  type="button"
                  className="voice-retry"
                  disabled={permissionPending}
                  onClick={() => void processInput(pendingAudio.current!)}
                >
                  إعادة تحليل التسجيل السابق
                </button>
              )}
              {correctionField && (
                <button
                  type="button"
                  className="voice-retry"
                  disabled={permissionPending}
                  onClick={() => {
                    setCorrectionField(null);
                    setStage("photo");
                    setError("");
                  }}
                >
                  الرجوع للمسودة
                </button>
              )}
              <small className="voice-privacy">
                راجع التفاصيل قبل الحفظ. مدة التسجيل القصوى 45 ثانية.
              </small>
              <details className="voice-quota">
                <summary>
                  <Info size={14} />
                  {quota.analysis?.remaining != null
                    ? `آخر رصيد: ${quota.analysis.remaining} طلب تحليل`
                    : "معلومات الاستخدام"}
                </summary>
                <p>
                  الصوت: {quota.speech?.remaining ?? "غير متاح"} · التحليل:{" "}
                  {quota.analysis?.remaining ?? "غير متاح"}. الرصيد مشترك للحساب
                  وتوجد حدود للتوكن ومدة الصوت.
                </p>
              </details>
            </footer>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void selectPhoto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            void selectPhoto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </section>
    </ResponsiveOverlay>
  );
}
