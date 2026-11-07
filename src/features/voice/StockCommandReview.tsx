import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Category, StaffMember, Tile } from "@/types";
import { VoiceOrb } from "./VoiceOrb";
import { isExactStockMatch, matchStockItems } from "./stock-command-plan.mjs";
import { calculateAvailableQuantity, calculateReservedQuantity } from "@/features/inventory/inventoryCalculations";
import {
  previewVoiceItem,
  type VoiceItemReview,
} from "./stock-command.service";
import type { StockAnalysis } from "./stock-command.types";

export default function StockCommandReview({
  result,
  items,
  categories,
  staff,
  onRetry,
  onReanalyze,
  onCommitBusy,
  onSaved,
  editSubject,
  onContinueEdit,
  recordingPending,
  previewItem = previewVoiceItem,
}: {
  result: StockAnalysis;
  items: Tile[];
  categories: Category[];
  staff: StaffMember;
  previewItem?: typeof previewVoiceItem;
  onRetry: () => void;
  onReanalyze: (text: string) => void;
  onCommitBusy: (busy: boolean) => void;
  onSaved: (deleted: boolean) => void;
  editSubject?: Tile;
  onContinueEdit: (item: Tile, text?: string) => void;
  recordingPending: boolean;
}) {
  const { command, transcript } = result;
  const available = useMemo(
    () =>
      categories.filter(
        (c) => staff.role === "admin" || c.visibleToEmployees === true,
      ),
    [categories, staff.role],
  );
  const matches: Tile[] = useMemo(
    () =>
      (editSubject ? items.filter(item => item.id === editSubject.id && item.categoryId === editSubject.categoryId) : items).filter(
          (i) =>
            available.some((c) => c.id === i.categoryId) &&
            (staff.role === "admin" || !i.hiddenForStaff),
        ),
    [items, available, staff.role, editSubject],
  );
  const candidates: Tile[] = useMemo(() => editSubject ? matches : matchStockItems(matches, command), [matches, command, editSubject]);
  const [selected, setSelected] = useState<Tile | null>(null);
  const [changeText, setChangeText] = useState("");
  const [review, setReview] = useState<VoiceItemReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteAccepted, setDeleteAccepted] = useState(false);
  const [editedText, setEditedText] = useState(transcript);
  const [attempted, setAttempted] = useState(false);
  const [needsFreshCommand, setNeedsFreshCommand] = useState(false);
  const busy = useRef(false);
  const active = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const autoReviewed = useRef(false);
  const searching = command.action === "search";
  const awaitingChange = command.action === "clarify" && Boolean(editSubject || (
    command.target && command.question === "اذكر البيانات التي تريد تعديلها."
  ));
  const uniqueExact = candidates.length === 1 && (editSubject || isExactStockMatch(candidates[0], command)) ? candidates[0] : null;
  const selectedCandidate = selected && candidates.find(item => item.id === selected.id && item.categoryId === selected.categoryId);
  const subject = awaitingChange ? selectedCandidate || uniqueExact : null;
  const shown = searching && selectedCandidate ? [selectedCandidate] : candidates;

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [review]);

  async function select(item: Tile) {
    if (busy.current) return;
    const category = available.find((c) => c.id === item.categoryId);
    if (!category) return;
    busy.current = true;
    setLoading(true);
    setError("");
    setDeleteAccepted(false);
    setAttempted(false);
    try {
      const preview = await previewItem(item, command, category, staff);
      if (active.current) setReview(preview);
    } catch (e) {
      if (active.current)
        setError(e instanceof Error ? e.message : "تعذرت قراءة الصنف.");
    } finally {
      busy.current = false;
      if (active.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (autoReviewed.current || !uniqueExact || !["edit", "quantity"].includes(command.action)) return;
    autoReviewed.current = true;
    void select(uniqueExact);
  }, [uniqueExact, command.action]);

  async function confirm() {
    if (
      !review ||
      busy.current ||
      attempted ||
      (review.plan.action === "delete" && !deleteAccepted)
    )
      return;
    busy.current = true;
    setAttempted(true);
    onCommitBusy(true);
    setSaving(true);
    setError("");
    try {
      await review.commit();
      if (active.current) onSaved(review.plan.action === "delete");
    } catch (e) {
      if (active.current) {
        setNeedsFreshCommand(true);
        setError(
          e instanceof Error && e.message.includes("بعد المعاينة")
            ? e.message
            : "تعذّر تأكيد نتيجة التنفيذ. راجع المخزون قبل إرسال أمر جديد.",
        );
      }
    } finally {
      busy.current = false;
      if (active.current) {
        setSaving(false);
        onCommitBusy(false);
      }
    }
  }

  const deleting = review?.plan.action === "delete";
  const needsClarification = command.action === "clarify" && !awaitingChange;
  const noMatches = !needsClarification && candidates.length === 0;
  const title = saving
    ? "جارٍ التنفيذ…"
    : review
      ? deleting
        ? "مراجعة حذف الصنف"
        : "راجع التغيير"
      : needsClarification
        ? "خلّينا نوضح الطلب"
        : noMatches ? "ما لقينا الصنف" : searching
          ? "نتائج البحث"
          : subject ? "شو بدك تعدّل؟" : "اختر الصنف";

  function itemCard(item: Tile) {
    const category = available.find(c => c.id === item.categoryId);
    const unit = (item.unitType || category?.defaultUnit) === "pieces" ? "قطعة" : "م²";
    const count = new Intl.NumberFormat("ar-JO", { maximumFractionDigits: 3 });
    const hasQuantity = typeof item.meters === "number" && Number.isFinite(item.meters);
    const reserved = calculateReservedQuantity(item);
    return <>
      <strong dir="auto">{item.name}</strong>
      <small>{[category?.name, item.size, item.shade && `شيد ${item.shade}`, item.quality, item.surface, item.color].filter(Boolean).join(" · ")}</small>
      {searching && <>
        <span className="stock-voice-available">المتوفر: <b>{hasQuantity ? `${count.format(calculateAvailableQuantity(item))} ${unit}` : "غير معروف"}</b></span>
        {hasQuantity && reserved > 0 && <small>الإجمالي: {count.format(item.meters)} {unit} · المحجوز: {count.format(reserved)} {unit}</small>}
      </>}
    </>;
  }
  const summary = (
    <>
      <header>
        <VoiceOrb state={saving ? "saving" : loading ? "thinking" : "review"} />
        <h3 ref={heading} tabIndex={-1}>
          {title}
        </h3>
        {!(needsClarification || noMatches) && <p className="stock-voice-transcript">{transcript}</p>}
      </header>
      {error && (
        <p role="alert" className="voice-error">
          {error}
        </p>
      )}
      {loading && <p role="status">جارٍ قراءة آخر بيانات الصنف…</p>}
    </>
  );
  return (
    <div className={`stock-voice-review${review ? " is-preview" : ""}`}>
      {!review && summary}
      {review ? (
        <>
          <div className="stock-voice-preview-scroll">
            {summary}
            <div className="stock-voice-item">
              <strong>{review.item.name}</strong>
              <small>
                {available.find((c) => c.id === review.item.categoryId)?.name}{" "}
                {review.item.size && `· ${review.item.size}`}
                {review.item.shade && ` · شيد ${review.item.shade}`}
              </small>
            </div>
            {deleting ? (
              <>
                <p className="stock-voice-danger">
                  سيُحذف هذا الصنف نهائياً من المخزون، مع بقاء سجل العملية.
                </p>
                <label className="stock-voice-accept">
                  <input
                    type="checkbox"
                    checked={deleteAccepted}
                    disabled={saving || attempted}
                    onChange={(e) => setDeleteAccepted(e.target.checked)}
                  />
                  راجعت الصنف وأوافق على حذفه
                </label>
              </>
            ) : (
              <dl className="stock-voice-changes">
                {review.plan.changes.map((change) => (
                  <div key={change.key}>
                    <dt>{change.label}</dt>
                    <dd>
                      <span>{String(change.before)}</span>
                      <span aria-hidden="true">←</span>
                      <strong>{String(change.after)}</strong>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <div className="stock-voice-buttons">
            <button
              type="button"
              className={
                deleting ? "voice-primary stock-voice-delete" : "voice-primary"
              }
              disabled={saving || attempted || (deleting && !deleteAccepted)}
              onClick={() => void confirm()}
            >
              {saving
                ? "جارٍ التنفيذ…"
                : deleting
                  ? "تأكيد حذف الصنف"
                  : "تأكيد التعديل"}
            </button>
            {!saving && (
              <button
                className="voice-retry"
                type="button"
                onClick={() => {
                  if (needsFreshCommand) onRetry();
                  else {
                    setReview(null);
                    setError("");
                  }
                }}
              >
                {needsFreshCommand ? "أمر جديد" : "رجوع دون تنفيذ"}
              </button>
            )}
          </div>
        </>
      ) : subject ? (
        <>
          <div className="stock-voice-item">{itemCard(subject)}</div>
          <form className="stock-voice-rephrase" onSubmit={event => {
            event.preventDefault();
            if (changeText.trim() && !recordingPending) onContinueEdit(subject, changeText.trim());
          }}>
            <label htmlFor="stock-voice-change">احكِ أو اكتب التغيير فقط</label>
            <textarea id="stock-voice-change" value={changeText} onChange={e => setChangeText(e.target.value)}
              maxLength={1000} rows={2} placeholder="مثلاً: خلّي اللون أسود، أو خلّي الكمية 20 متر" />
            <div className="stock-voice-buttons">
              <button type="button" className="voice-primary" disabled={recordingPending} onClick={() => onContinueEdit(subject)}>
                {recordingPending ? "جارٍ فتح المايك…" : "احكِ التغيير"}
              </button>
              <button type="submit" className="voice-retry" disabled={recordingPending || !changeText.trim()}>راجع التغيير</button>
              <button type="button" className="voice-retry" disabled={recordingPending} onClick={() => {
                if (editSubject || !selectedCandidate) onRetry(); else setSelected(null);
              }}>{editSubject || !selectedCandidate ? "طلب جديد" : "اختيار صنف آخر"}</button>
            </div>
          </form>
        </>
      ) : needsClarification ? (
        <div className="stock-voice-feedback">
          <strong>شو ناقص؟</strong>
          <p>{command.question || "اذكر شو بدك تعمل واسم الصنف أو كوده."}</p>
        </div>
      ) : (
        <>
          {searching && !selectedCandidate && candidates.length > 1 && <p>في أكثر من نتيجة. اختَر حسب القسم أو المقاس أو الشيد.</p>}
          {searching && !selectedCandidate && candidates.length > 0 && !candidates.some(item => isExactStockMatch(item, command)) && <p>هاي نتائج قريبة من الكود اللي سمعناه.</p>}
          {candidates.length === 0 ? (
            <div className="stock-voice-feedback">
              <strong>جرّب الكود الكامل</strong>
              <p>مثلاً: دوّر على الصنف 12044.</p>
            </div>
          ) : (
            <ul className="stock-voice-matches">
              {shown.slice(0, 25).map((item) => (
                <li key={`${item.categoryId}/${item.id}`}>
                  {searching && (candidates.length === 1 || selectedCandidate) ? (
                    <div className="stock-voice-item">{itemCard(item)}</div>
                  ) : (
                    <button
                      type="button"
                      className="stock-voice-item"
                      disabled={loading}
                      onClick={() => searching || awaitingChange ? setSelected(item) : void select(item)}
                    >
                      {itemCard(item)}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {searching && selectedCandidate && <button type="button" className="voice-retry" onClick={() => setSelected(null)}>عرض كل النتائج</button>}
          {shown.length > 25 && (
            <small>النتائج كثيرة. اذكر كوداً أو قسماً أدق.</small>
          )}
        </>
      )}
      {!review && !subject && (!searching || noMatches) && (
        <form
          className="stock-voice-rephrase"
          onSubmit={(e) => {
            e.preventDefault();
            if (!loading && editedText.trim()) onReanalyze(editedText);
          }}
        >
          <label htmlFor="stock-voice-rephrase">{needsClarification || noMatches ? "هيك سمعنا الطلب · عدّله هون" : "عدّل الطلب إذا لزم"}</label>
          <textarea
            id="stock-voice-rephrase"
            value={editedText}
            maxLength={4000}
            onChange={(e) => setEditedText(e.target.value)}
            disabled={loading}
            rows={2}
          />
          <div className="stock-voice-buttons">
            <button
              className="voice-primary"
              disabled={loading || !editedText.trim()}
              type="submit"
            >
              تحليل الطلب
            </button>
            <button
              className="voice-retry"
              type="button"
              disabled={loading}
              onClick={onRetry}
            >
              سجّل من جديد
            </button>
          </div>
        </form>
      )}
      {!review && searching && !noMatches && <button type="button" className="voice-retry" onClick={onRetry}>بحث جديد</button>}
    </div>
  );
}
