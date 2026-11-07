import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpLeft, Keyboard, RotateCcw, Square, X } from "lucide-react";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { ResponsiveOverlay } from "@/components/ui/ResponsiveOverlay";
import type { Category, PackingOption, StaffMember, Tile } from "@/types";
import {
  analyzeVoice,
  analyzeStockCommand,
  draftValues,
  voiceEndpoint,
  type VoiceAnalysis,
  type VoiceCorrectionField,
} from "./voice.service";

import StockCommandReview from "./StockCommandReview";
import { VoiceOrb } from "./VoiceOrb";
import { createVoicePreview, transcribeVoicePreview } from "./voice-preview";
import type { previewVoiceItem } from "./stock-command.service";
import type { StockAnalysis } from "./stock-command.types";
import VoiceDraftReview from "./VoiceDraftReview";
import { quantitySource, convertQuantity } from "./voice-quantity.mjs";
import { isAppleMobile, requestVoiceCapture, type VoiceCapture } from "./voice-capture";
import { hasPackingAnswer, routeVoiceAddition, sizeMention, sizeOnlyRequest, spokenDraftSize } from "./voice-category.mjs";
import { useLiveTranscript } from "./useLiveTranscript";
import { voiceLabels } from "./voice-guide";
import { presetsFor, resolvePreset, voicePackingKey } from "./voice-presets.mjs";

function voiceError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  if (
    /Importing binding|does not provide an export|dynamically imported module|Importing a module script failed/i.test(
      error.message,
    )
  ) {
    return "تعذر تحميل ملفات الصوت المحدثة. حدّث الصفحة ثم أعد المحاولة.";
  }
  if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError")
    return "ما لقينا مايك. وصّل مايك أو اكتب طلبك.";
  if (error.name === "NotReadableError" || error.name === "TrackStartError")
    return "المايك مش متاح هسا. سكّر التطبيق اللي يستخدمه وحاول مرة ثانية.";
  if (/failed to fetch|load failed|networkerror|network request failed/i.test(error.message))
    return "الاتصال انقطع. تأكد من النت وأعد المحاولة.";
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
  staff,
  items,
  onSaved,
  onClose,
  onContinue,
  title = "مساعد المخزون",
  packingOptionsFor = presetsFor,
  previewItem,
  initialCapture,
}: {
  staff: StaffMember;
  initialCapture?: VoiceCapture;
  title?: string;
  packingOptionsFor?: (categoryId: string) => PackingOption[];
  previewItem?: typeof previewVoiceItem;
  items: Tile[];
  onSaved: (deleted: boolean) => void;
  categories: Category[];
  categoryId: string | null;
  onClose: () => void;
  onContinue: (values: Partial<Tile>, categoryId: string) => void;
}) {
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [commandResult, setCommandResult] = useState<StockAnalysis | null>(
    null,
  );
  const [typedCommand, setTypedCommand] = useState("");
  const editSubject = useRef<Tile>();
  const commitBusy = useRef(false);
  const requestingMic = useRef(false);
  const isMobile = useIsMobile();
  const live = useLiveTranscript();
  const applePreview = useRef<ReturnType<typeof createVoicePreview> & { unavailable: () => void }>();
  const [previewText, setPreviewText] = useState("");
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const [visualStream, setVisualStream] = useState<MediaStream | null>(null);
  const [heardText, setHeardText] = useState("");
  const [textScope, setTextScope] = useState<VoiceCorrectionField | null>(null);
  const [phase, setPhase] = useState<
    "transcribing" | "extracting" | "processing"
  >("transcribing");
  const [stage, setStage] = useState<
    "ready" | "recording" | "analyzing" | "photo" | "command"
  >("ready");
  const pendingAudio = useRef<Blob | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [micStatus, setMicStatus] = useState("");
  const signal = useRef({ detected: false, sampledMs: 0, notice: false });
  const clearTrackWatch = useRef<() => void>();
  const onLevel = useCallback((level: number, elapsed: number) => {
    const input = signal.current;
    input.sampledMs = elapsed;
    if (level > 0.002) {
      if (input.notice) setMicStatus("");
      input.detected = true;
      input.notice = false;
    } else if (!input.detected && elapsed >= 2400 && !input.notice) {
      input.notice = true;
      setMicStatus("لسّه ما وصل صوت. احكِ قريب من المايك أو أعد تشغيله.");
    }
  }, []);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<VoiceAnalysis | null>(null);
  const [selectedCategory, setSelectedCategory] = useState(categoryId || "");
  const [correctionField, setCorrectionField] =
    useState<VoiceCorrectionField | null>(null);
  const [packingChoice, setPackingChoice] = useState("");
  const [categoryQuestion, setCategoryQuestion] = useState("");
  const [suggestedPacking, setSuggestedPacking] = useState<PackingOption[]>([]);
  const routingContext = useRef<ReturnType<typeof routeVoiceAddition> | null>(null);
  const activeCategory = categories.find(
    (c) => c.id === (categoryId || selectedCategory),
  );

  const [photo, setPhoto] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [permissionPending, setPermissionPending] = useState(Boolean(initialCapture));
  const captureRef = useRef<VoiceCapture | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const controller = useRef<AbortController | null>(null);
  const processingRef = useRef(false);
  const alive = useRef(true);
  const interval = useRef<ReturnType<typeof setInterval>>();
  const maxTimer = useRef<ReturnType<typeof setTimeout>>();
  const fileRef = useRef<HTMLInputElement>(null),
    cameraRef = useRef<HTMLInputElement>(null);
  const cleanupAudio = useCallback(() => {
    clearTrackWatch.current?.();
    clearTrackWatch.current = undefined;
    applePreview.current?.stop();
    applePreview.current = undefined;
    live.stop();
    const rec = recorder.current;
    recorder.current = null;
    if (rec) {
      rec.ondataavailable = rec.onstop = rec.onerror = null;
      if (rec.state !== "inactive") {
        try { rec.stop(); } catch { /* The stream may already be closed. */ }
      }
    }
    clearInterval(interval.current);
    clearTimeout(maxTimer.current);
    captureRef.current?.cancel();
    captureRef.current = null;
    if (alive.current) setVisualStream(null);
  }, [live.stop]);
  const close = useCallback(() => {
    if (commitBusy.current) return;
    controller.current?.abort();
    cleanupAudio();
    onClose();
  }, [cleanupAudio, onClose]);
  React.useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
      cleanupAudio();
    };
  }, [cleanupAudio]);
  const processInput = async (
    input: Blob | string,
    targetField: VoiceCorrectionField | null = correctionField,
    keepPhoto = false,
  ) => {
    if (processingRef.current || commitBusy.current) return;
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
      const report: Parameters<typeof analyzeStockCommand>[4] = (progress) => {
        if (alive.current && controller.current === abort) {
          setPhase(progress.phase);
          if (progress.transcript) setHeardText(progress.transcript);
        }
      };
      const subject = targetField || keepPhoto ? undefined : editSubject.current;
      const scope = subject?.categoryId || categoryId || (targetField || keepPhoto ? selectedCategory : "") || null;
      let result: VoiceAnalysis;
      if (targetField || keepPhoto) {
        result = await analyzeVoice(
          input,
          categories,
          scope,
          abort.signal,
          targetField || undefined,
          report,
        );
      } else {
        const interpreted = await analyzeStockCommand(
          input,
          categories,
          scope,
          abort.signal,
          report,
          subject?.name,
        );
        if (!alive.current || controller.current !== abort) return;
        setHeardText(interpreted.transcript);
        const { command } = interpreted;
        const sizeOnly = sizeOnlyRequest(interpreted.transcript);
        if (subject || (command.action !== "add" && !sizeOnly)) {
          setCommandResult(interpreted);
          setAnalysis(null);
          setStage("command");
          return;
        }
        const warnings = [];
        if (sizeOnly || command.amount === null || !command.unit)
          warnings.push("الكمية غير واضحة");
        if (sizeOnly || !command.name) warnings.push("اسم أو كود الصنف غير واضح");
        result = {
          transcript: interpreted.transcript,
          draft: {
            categoryId: sizeOnly ? null : command.categoryId,
            name: sizeOnly ? null : command.name,
            size: sizeOnly ? null : command.size,
            shade: sizeOnly ? null : command.shade,
            quality: sizeOnly ? null : command.quality,
            surface: sizeOnly ? null : command.surface,
            color: sizeOnly ? null : command.color,
            itemType: sizeOnly ? null : command.itemType,
            materialOrGlass: sizeOnly ? null : command.materialOrGlass,
            brand: sizeOnly ? null : command.brand,
            notes: sizeOnly ? null : command.notes,
            quantity: null,
            quantityInput: !sizeOnly && command.unit ? command.amount : null,
            quantityUnit: sizeOnly ? null : command.unit,
            uncertainties: warnings,
          },
        };
      }
      if (!alive.current || controller.current !== abort) return;
      setHeardText(result.transcript);
      if (targetField && analysis) {
        if (targetField === "size" && (sizeMention(result.transcript).size ||
          (analysis.draft.size && hasPackingAnswer(
            result.transcript, categories.flatMap(category => packingOptionsFor(category.id)),
          )))) {
          const route = routeVoiceAddition(
            analysis.draft, result.transcript, categories, packingOptionsFor,
            categoryId || (routingContext.current ? routingContext.current.explicitCategory || "" : selectedCategory),
            routingContext.current ?? { hints: {} },
          );
          routingContext.current = route;
          setAnalysis({
            ...analysis,
            transcript: `${analysis.transcript}\nتصحيح المقاس والتعبئة: ${result.transcript}`,
            draft: {
              ...analysis.draft, size: route.size, categoryId: route.categoryId,
              quality: route.preset?.quality || analysis.draft.quality,
            },
          });
          setSelectedCategory(route.categoryId || "");
          setCategoryQuestion(route.question);
          setSuggestedPacking(route.options);
          setPackingChoice(route.preset ? voicePackingKey(route.preset) : "");
          setCorrectionField(null);
          setStage("photo");
          return;
        }
        const value = targetField === "size"
          ? spokenDraftSize(result.transcript, result.draft.size)
          : result.draft[targetField];
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
        if (targetField === "size" || targetField === "quality") {
          const id = activeCategory?.id || "";
          const preset = resolvePreset(
            { ...analysis.draft, [targetField]: value }, id, result.transcript, packingOptionsFor(id),
          );
          setPackingChoice(preset ? voicePackingKey(preset) : "");
        }
      } else {
        const route = routeVoiceAddition(
          result.draft, result.transcript, categories, packingOptionsFor,
          categoryId || (keepPhoto ? selectedCategory : ""),
        );
        const id = route.categoryId || "";
        const draft = {
          ...result.draft,
          size: route.size,
          categoryId: route.categoryId,
          quality: route.preset?.quality || result.draft.quality,
          uncertainties: result.draft.uncertainties.filter((warning) => warning !== "يجب اختيار القسم"),
        };
        const preset = route.preset || (!route.question ? resolvePreset(draft, id, result.transcript, packingOptionsFor(id)) : null);
        routingContext.current = route;
        setSuggestedPacking(route.options);
        setAnalysis({ ...result, draft });
        setSelectedCategory(id);
        setCategoryQuestion(route.question);
        if (!keepPhoto) setPhoto("");
        setPackingChoice(preset ? voicePackingKey(preset) : "");
      }
      setCorrectionField(null);
      setStage("photo");
    } catch (e) {
      if (alive.current) {
        if (typeof input !== "string" && !analysis && !commandResult && live.snapshot()) {
          setTypedCommand(live.snapshot());
          setShowKeyboard(true);
        }
        setStage(
          analysis
            ? "photo"
            : commandResult
              ? "command"
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
  const start = async (providedCapture?: VoiceCapture, restarting = false) => {
    if (
      requestingMic.current ||
      processingRef.current ||
      commitBusy.current ||
      (stage === "recording" && !restarting) ||
      stage === "analyzing"
    )
      return;
    if (!voiceEndpoint) {
      setError("ميزة الصوت غير مفعّلة حاليًا. يمكنك الإضافة يدويًا.");
      return;
    }
    if (restarting) {
      cleanupAudio();
      setStage("ready");
    }
    setError("");
    setMicStatus("");
    signal.current = { detected: false, sampledMs: 0, notice: false };
    setHeardText("");
    setPreviewText("");
    setPreviewUnavailable(false);
    pendingAudio.current = null;
    setTextScope(correctionField);
    requestingMic.current = true;
    setPermissionPending(true);
    const capture = providedCapture ?? requestVoiceCapture();
    captureRef.current = capture;
    try {
      const media = await capture.promise;
      if (!alive.current || captureRef.current !== capture) {
        capture.cancel();
        return;
      }
      const track = media.getAudioTracks()[0];
      if (!track || track.readyState !== "live") throw new Error("المايك انقطع. جرّب مرة ثانية.");

      const apple = isAppleMobile();
      const mimeType = (apple
        ? ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"]
        : ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]
      ).find((t) => MediaRecorder.isTypeSupported?.(t));
      const rec = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder.current = rec;
      const chunks: BlobPart[] = [];
      let bytes = 0;
      rec.ondataavailable = (event) => {
        if (recorder.current === rec && event.data.size) {
          chunks.push(event.data);
          bytes += event.data.size;
          if (bytes > 4 * 1024 * 1024 && rec.state === "recording") rec.stop();
        }
      };
      rec.onerror = () => {
        if (recorder.current !== rec) return;
        cleanupAudio();
        if (alive.current) {
          setStage("ready");
          setError("انقطع التسجيل. حاول مرة أخرى.");
        }
      };
      rec.onstop = async () => {
        if (!alive.current || recorder.current !== rec) return;
        const preview = live.snapshot();
        const input = signal.current;
        cleanupAudio();
        if (preview) setHeardText(preview);
        const audio = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (audio.size < 150 || audio.size > 4 * 1024 * 1024) {
          if (preview && !correctionField) {
            setTypedCommand(preview);
            setShowKeyboard(true);
          }
          setStage("ready");
          setError(
            "التسجيل قصير جدًا أو كبير. سجّل وصفًا واضحًا لمدة أقل من 45 ثانية.",
          );
          return;
        }
        if (apple && !preview && input.sampledMs >= 2400 && !input.detected) {
          setStage("ready");
          setError("التسجيل ما التقط صوت. اضغط ابدأ التسجيل وحاول مرة ثانية.");
          return;
        }
        pendingAudio.current = audio;
        await processInput(audio);
      };
      let muteTimer: number | undefined;
      const muted = () => {
        window.clearTimeout(muteTimer);
        muteTimer = window.setTimeout(() => {
          if (recorder.current === rec && track.muted) {
            setMicStatus("الجهاز أوقف وصول الصوت للمايك. أعد تشغيله من هون.");
          }
        }, 900);
      };
      const unmuted = () => {
        window.clearTimeout(muteTimer);
        setMicStatus("");
      };
      const ended = () => {
        if (recorder.current !== rec) return;
        if (signal.current.detected && rec.state === "recording") {
          rec.stop();
          return;
        }
        cleanupAudio();
        setStage("ready");
        setError("انقطع اتصال المايك. اضغط ابدأ التسجيل وحاول مرة ثانية.");
      };
      track.addEventListener("mute", muted);
      track.addEventListener("unmute", unmuted);
      track.addEventListener("ended", ended);
      clearTrackWatch.current = () => {
        window.clearTimeout(muteTimer);
        track.removeEventListener("mute", muted);
        track.removeEventListener("unmute", unmuted);
        track.removeEventListener("ended", ended);
      };
      if (apple) rec.start(); // Use one complete native recording before uploading.
      else rec.start(500);
      if (apple) {
        const unavailable = () => {
          if (recorder.current === rec) setPreviewUnavailable(true);
        };
        applePreview.current = {
          ...createVoicePreview(transcribeVoicePreview, text => {
            if (recorder.current === rec && rec.state === "recording") {
              setPreviewUnavailable(false);
              setPreviewText(text);
            }
          }, unavailable),
          unavailable,
        };
      }
      if (track.muted) muted();
      setVisualStream(media);
      live.start(track);
      setSeconds(0);
      setStage("recording");
      interval.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      maxTimer.current = setTimeout(() => {
        if (rec.state === "recording") rec.stop();
      }, 45000);
    } catch (e) {
      if (!alive.current || captureRef.current !== capture) return;
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
      requestingMic.current = false;
      if (alive.current) setPermissionPending(false);
    }
  };
  // The first Strict Mode effect setup is cleaned up before it can claim the stream.
  useEffect(() => {
    if (!initialCapture) return;
    const task = window.setTimeout(() => void start(initialCapture), 0);
    return () => window.clearTimeout(task);
  }, [initialCapture]);

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
  const needsPackingChoice = suggestedPacking.length > 1 && !packingChoice;
  const next = () => {
    if (needsPackingChoice) return;
    const category = categories.find((c) => c.id === selectedCategory);
    if (!category || !analysis) {
      setError("اختر القسم أولًا.");
      return;
    }
    try {
      onContinue(
        {
          ...draftValues(analysis.draft, category, packingChoice, packingOptionsFor(category.id)),
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
              : ".stock-voice-record",
      );
      if (stage === "command")
        sessionRef.current?.parentElement?.scrollTo({ top: 0 });
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [stage, isMobile]);
  const immersive = stage === "recording" || stage === "analyzing";
  const packingOptions = packingOptionsFor(selectedCategory);
  const selectedPreset = analysis
    ? packingChoice
      ? packingOptions.find((p) => voicePackingKey(p) === packingChoice)
      : resolvePreset(analysis.draft, selectedCategory, "", packingOptions)
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
      onClose={close}
      title={title}
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
                needsPackingChoice ||
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
          </div>
        ) : undefined
      }
      contentClassName={`voice-modal-content ${immersive ? "voice-immersive-content" : stage === "photo" ? "voice-review-content" : stage === "command" ? "stock-voice-command-content" : "voice-setup-content"}`}
    >
      <section ref={sessionRef} className="voice-modal" dir="rtl">
        {error && (
          <div className="stock-voice-feedback" role="alert">
            <strong>{stage === "ready" ? "ما زبطت هالمرة" : "راجع هالتفصيل"}</strong>
            <p>{error}</p>
          </div>
        )}
        {immersive ? (
          <div className="voice-surface is-immersive stock-voice-session">
            <div className="stock-voice-session-orb">
              <VoiceOrb state={stage === "recording" ? "listening" : "thinking"} stream={visualStream} onLevel={onLevel} preview={applePreview.current} />
              <strong role="status">
                {stage === "recording" ? "أسمعك…" : phase === "transcribing" ? "نحوّل الصوت لكلام…" : "نفهم طلبك…"}
              </strong>
              {stage === "recording" && (
                <time className="voice-session-time" dir="ltr">0:{String(seconds).padStart(2, "0")}</time>
              )}
            </div>
            <div className="voice-session-copy voice-live-text">
              <p>{stage === "recording"
                ? live.text || previewText || (correctionField ? voiceLabels[correctionField] : "احكِ بطريقتك")
                : heardText}</p>
              {stage === "recording" && !live.available && !live.text && (
                <small>{previewText ? "نص مبدئي" : applePreview.current && !previewUnavailable
                  ? "النص بيظهر هون وأنت بتحكي."
                  : "الكلام بيظهر بعد التحليل."}</small>
              )}
            </div>
            {stage === "recording" && micStatus && (
              <div className="stock-voice-feedback">
                <p role="status">{micStatus}</p>
                <button type="button" className="stock-voice-quiet" onClick={() => void start(undefined, true)}>
                  <RotateCcw size={17} aria-hidden="true" /> أعد تشغيل المايك
                </button>
              </div>
            )}
            {stage === "recording" && !correctionField && (
              <button type="button" className="stock-voice-quiet stock-voice-type-instead"
                onClick={() => { cleanupAudio(); setShowKeyboard(true); setStage("ready"); }}>
                <Keyboard size={18} aria-hidden="true" /> اكتب بدل التسجيل
              </button>
            )}
            <div className="voice-session-actions">
              {stage === "recording" && (
                <button type="button" className="voice-stop-button" aria-label="إنهاء وتحليل"
                  onClick={() => {
                    if (recorder.current?.state === "recording") recorder.current.stop();
                  }}>
                  <Square size={14} fill="currentColor" aria-hidden="true" /> تحليل
                </button>
              )}
              <button type="button" className="voice-close-button" aria-label="إلغاء التسجيل" onClick={close}>
                <X size={22} aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : stage === "command" && commandResult ? (
          <StockCommandReview
            result={commandResult}
            items={items}
            categories={categories}
            staff={staff}
            editSubject={editSubject.current}
            recordingPending={permissionPending}
            onContinueEdit={(item, text) => {
              editSubject.current = item;
              if (text) void processInput(text, null);
              else void start();
            }}
            previewItem={previewItem}
            onCommitBusy={(busy) => {
              commitBusy.current = busy;
            }}
            onSaved={onSaved}
            onRetry={() => {
              editSubject.current = undefined;
              setCommandResult(null);
              setHeardText("");
              setTypedCommand("");
              setShowKeyboard(false);
              setError("");
              pendingAudio.current = null;
              setStage("ready");
            }}
            onReanalyze={(text) => void processInput(text, null)}
          />
        ) : stage === "photo" && analysis ? (
          <VoiceDraftReview
            analysis={analysis}
            categories={categories}
            selectedCategory={selectedCategory}
            categoryQuestion={categoryQuestion}
            locked={Boolean(categoryId)}
            packingChoice={packingChoice}
            packingOptions={suggestedPacking.length > 1 ? suggestedPacking : packingOptions}
            photo={photo}
            busy={photoBusy}
            heardText={heardText}
            onCategory={(id) => {
              const route = id ? routeVoiceAddition(
                analysis.draft, "", categories, packingOptionsFor, id,
                routingContext.current ?? { hints: {} },
              ) : null;
              setCategoryQuestion(route?.question || "");
              setSuggestedPacking(route?.options || []);
              routingContext.current = route;
              setAnalysis(previous => previous ? {
                ...previous,
                draft: { ...previous.draft, categoryId: id || null, size: route?.size ?? previous.draft.size },
              } : previous);
              setSelectedCategory(id);
              setPackingChoice(route?.preset ? voicePackingKey(route.preset) : "");
            }}
            onDraft={(draft) => {
              if (draft.size !== analysis.draft.size || draft.quality !== analysis.draft.quality) {
                setPackingChoice("");
                setSuggestedPacking([]);
                setCategoryQuestion("");
                routingContext.current = null;
              }
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
              const preset = packingOptions.find((option) => voicePackingKey(option) === choice);
              setPackingChoice(choice);
              if (preset) setCategoryQuestion("");
              if (preset)
                setAnalysis((previous) => previous ? {
                  ...previous,
                  draft: { ...previous.draft, size: preset.desc, quality: preset.quality || previous.draft.quality },
                } : previous);
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
        ) : (
          <div className="stock-voice-start">
            <button type="button" className="stock-voice-record" onClick={() => void start()}
              disabled={permissionPending} aria-label="ابدأ التسجيل">
              <VoiceOrb state="idle" />
              <strong>{permissionPending ? "جارٍ فتح المايك…" : "ابدأ التسجيل"}</strong>
            </button>
            <p>{correctionField
              ? `احكِ ${voiceLabels[correctionField]} فقط`
              : "مثلاً: زيد طبلية على الصنف 12044"}</p>
            {error && pendingAudio.current && (
              <button type="button" className="stock-voice-quiet" disabled={permissionPending}
                onClick={() => void processInput(pendingAudio.current!)}>
                <RotateCcw size={17} aria-hidden="true" /> أعد تحليل نفس التسجيل
              </button>
            )}
            {correctionField ? (
              <button type="button" className="stock-voice-quiet" disabled={permissionPending}
                onClick={() => { setCorrectionField(null); setStage("photo"); setError(""); }}>
                الرجوع للمسودة
              </button>
            ) : (
              <>
                <button type="button" className="stock-voice-quiet" aria-expanded={showKeyboard}
                  disabled={permissionPending} onClick={() => setShowKeyboard((value) => !value)}>
                  <Keyboard size={18} aria-hidden="true" /> اكتب طلبك
                </button>
                {showKeyboard && (
                  <form className="stock-voice-rephrase" onSubmit={(event) => {
                    event.preventDefault();
                    if (!requestingMic.current && typedCommand.trim()) void processInput(typedCommand, null);
                  }}>
                    <textarea aria-label="طلبك" placeholder="اكتب طلبك…" rows={2} maxLength={4000}
                      value={typedCommand} disabled={permissionPending} onChange={(e) => setTypedCommand(e.target.value)} />
                    <button type="submit" className="voice-primary" disabled={permissionPending || !typedCommand.trim()}>
                      تحليل الطلب <ArrowUpLeft size={17} aria-hidden="true" />
                    </button>
                  </form>
                )}
              </>
            )}
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
