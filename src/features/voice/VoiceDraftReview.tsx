import React from "react";
import { Camera, ImagePlus, Mic, X } from "lucide-react";
import type { Category } from "@/types";
import type {
  VoiceAnalysis,
  VoiceCorrectionField,
  VoiceDraft,
} from "./voice.service";
import { guideFields, voiceLabels } from "./voice-guide";
import {
  convertQuantity,
  quantitySource,
  quantityUnitLabel,
} from "./voice-quantity.mjs";
import { presetsFor, resolvePreset } from "./voice-presets.mjs";

type Props = {
  analysis: VoiceAnalysis;
  categories: Category[];
  selectedCategory: string;
  locked: boolean;
  packingChoice: string;
  photo: string;
  busy: boolean;
  heardText: string;
  onCategory: (id: string) => void;
  onDraft: (draft: VoiceDraft) => void;
  onPacking: (choice: string) => void;
  onCorrect: (field: VoiceCorrectionField) => void;
  onCamera: () => void;
  onPhoto: () => void;
  onRemovePhoto: () => void;
  onRetry: () => void;
  textScope?: VoiceCorrectionField | null;
  onText: (text: string) => void;
  onReanalyze: () => void;
};
export default function VoiceDraftReview(props: Props) {
  const { analysis, categories, selectedCategory, packingChoice, photo, busy } =
    props;
  const draft = analysis.draft;
  const category = categories.find((c) => c.id === selectedCategory);
  const preset = packingChoice
    ? presetsFor(selectedCategory).find((p) => p.desc === packingChoice)
    : resolvePreset(draft, selectedCategory);
  const quantities = convertQuantity(
    draft,
    preset,
    category?.defaultUnit || "meters",
  );
  const source = quantitySource(draft, category?.defaultUnit || "meters");
  const fields = guideFields(category).filter((f) => f !== "quantity");
  return (
    <div className="voice-review">
      <header className="voice-review-heading">
        <h3 className="voice-draft-heading" tabIndex={-1}>
          راجع الصنف
        </h3>
        <p>عدّل أي خانة، وأضف الصورة الآن أو لاحقًا.</p>
      </header>
      <label className="voice-category">
        القسم
        <select
          aria-label="قسم المسودة"
          disabled={props.locked || busy}
          value={selectedCategory}
          onChange={(e) => props.onCategory(e.target.value)}
        >
          <option value="">اختر القسم</option>
          {categories.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="voice-calculated voice-packing" aria-live="polite">
        {quantities.error ? (
          <p className="voice-warning">{quantities.error}</p>
        ) : (
          <>
            <dl>
              <div>
                <dt>
                  {category?.defaultUnit === "pieces" ? "القطع" : "الأمتار"}
                </dt>
                <dd>
                  {quantities.meters ?? "—"}{" "}
                  <small>
                    {category?.defaultUnit === "pieces" ? "قطعة" : "م²"}
                  </small>
                </dd>
              </div>
              {category?.defaultUnit !== "pieces" && (
                <>
                  <div>
                    <dt>الكراتين</dt>
                    <dd>{quantities.boxes ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>الطبالي</dt>
                    <dd>{quantities.pallets ?? "—"}</dd>
                  </div>
                </>
              )}
            </dl>
            {source && (
              <small>
                المسموع: {source.value} {quantityUnitLabel(source.unit)}
                {preset
                  ? ` · ${preset.mBox} م² للكرتونة، ${preset.bPallet} كرتونة للطبلية`
                  : ""}
              </small>
            )}
          </>
        )}
      </div>
      <div className="voice-review-fields">
        {fields.map((field) => (
          <label className="voice-edit-field" key={field}>
            <span>{voiceLabels[field]}</span>
            <div>
              <input
                aria-label={`مراجعة ${voiceLabels[field]}`}
                dir={field === "size" || field === "shade" ? "ltr" : "auto"}
                disabled={busy}
                value={draft[field] ?? ""}
                placeholder="لم يُذكر"
                onChange={(e) =>
                  props.onDraft({ ...draft, [field]: e.target.value || null })
                }
              />
              <button
                type="button"
                disabled={busy}
                aria-label={`إعادة تسجيل ${voiceLabels[field]}`}
                onClick={() => props.onCorrect(field)}
              >
                <Mic size={16} />
              </button>
            </div>
          </label>
        ))}
      </div>
      <div className="voice-amount-heading">
        <strong>كمية المخزون</strong>
        <button
          type="button"
          disabled={busy}
          aria-label="إعادة تسجيل الكمية"
          onClick={() => props.onCorrect("quantity")}
        >
          <Mic size={16} />
          <span>تصحيح بالصوت</span>
        </button>
      </div>
      <div className="voice-amount-input">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          max="1000000000"
          step="any"
          aria-label="الكمية المسموعة"
          disabled={busy}
          value={source?.value ?? ""}
          placeholder="الكمية"
          onChange={(e) => {
            const value = e.target.value === "" ? null : Number(e.target.value);
            const unit = source?.unit || category?.defaultUnit || "meters";
            props.onDraft({
              ...draft,
              quantityInput: value,
              quantityUnit: unit,
              quantity: unit === "meters" || unit === "pieces" ? value : null,
            });
          }}
        />
        <select
          aria-label="وحدة الكمية المسموعة"
          disabled={busy}
          value={source?.unit || category?.defaultUnit || "meters"}
          onChange={(e) => {
            const unit = e.target.value as VoiceDraft["quantityUnit"];
            const amount = source?.value ?? null;
            props.onDraft({
              ...draft,
              quantityInput: amount,
              quantityUnit: unit,
              quantity: unit === "meters" || unit === "pieces" ? amount : null,
            });
          }}
        >
          <option value="meters">متر مربع</option>
          <option value="boxes">كراتين / صناديق</option>
          <option value="pallets">طبالي</option>
          <option value="pieces">قطع</option>
        </select>
      </div>
      {presetsFor(selectedCategory).length > 0 && (
        <label className="voice-category">
          تعبئة المقاس
          <select
            aria-label="تعبئة المقاس"
            disabled={busy}
            value={preset?.desc || ""}
            onChange={(e) => props.onPacking(e.target.value)}
          >
            <option value="">اختر التعبئة للحساب</option>
            {presetsFor(selectedCategory).map((p) => (
              <option key={p.desc} value={p.desc}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {draft.uncertainties.length > 0 && (
        <p className="voice-warning">
          للتأكد: {draft.uncertainties.join("، ")}
        </p>
      )}
      <section className="voice-image-row" aria-label="صورة الصنف">
        <div>
          <strong>صورة الصنف</strong>
          <small>اختيارية؛ يمكنك إضافتها لاحقًا.</small>
        </div>
        {photo && (
          <div className="voice-photo">
            <img src={photo} alt="صورة الصنف المختارة" />
            <button
              type="button"
              disabled={busy}
              aria-label="إزالة الصورة المختارة"
              onClick={props.onRemovePhoto}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="voice-photo-actions">
          <button type="button" disabled={busy} onClick={props.onCamera}>
            <Camera size={19} />
            <span>الكاميرا</span>
          </button>
          <button type="button" disabled={busy} onClick={props.onPhoto}>
            <ImagePlus size={19} />
            <span>اختيار صورة</span>
          </button>
        </div>
      </section>
      <details className="voice-text-review">
        <summary>
          {props.textScope
            ? `نص تصحيح ${voiceLabels[props.textScope]}`
            : "النص الذي فهمناه"}
        </summary>
        <label className="sr-only" htmlFor="voice-heard-text">
          النص المسموع
        </label>
        <textarea
          id="voice-heard-text"
          maxLength={4000}
          value={props.heardText}
          disabled={busy}
          onChange={(e) => props.onText(e.target.value)}
          rows={3}
        />
        <button
          type="button"
          className="home-secondary-button"
          disabled={busy || !props.heardText.trim()}
          onClick={props.onReanalyze}
        >
          إعادة تحليل النص
        </button>
      </details>
      <div className="voice-review-actions">
        <button
          type="button"
          className="voice-retry"
          disabled={busy}
          onClick={props.onRetry}
        >
          إعادة التسجيل
        </button>
      </div>
    </div>
  );
}
