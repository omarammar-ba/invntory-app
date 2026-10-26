// All unit arithmetic is local and deterministic. The model only extracts spoken values.
export const VOICE_UNITS = ["meters", "boxes", "pallets", "pieces"];
export const quantityUnitLabel = (unit) =>
  ({ meters: "م²", boxes: "كرتونة", pallets: "طبلية", pieces: "قطعة" })[unit] ||
  "";
export const validAmount = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1e9;
export function quantitySource(draft, defaultUnit = "meters") {
  if (
    VOICE_UNITS.includes(draft.quantityUnit) &&
    validAmount(draft.quantityInput)
  ) {
    return { value: draft.quantityInput, unit: draft.quantityUnit };
  }
  return validAmount(draft.quantity)
    ? { value: draft.quantity, unit: defaultUnit }
    : null;
}
const round = (n) => Math.round((n + Number.EPSILON) * 1e6) / 1e6;
export function convertQuantity(draft, preset, defaultUnit = "meters") {
  if (
    (draft.quantityInput != null && !validAmount(draft.quantityInput)) ||
    (draft.quantity != null && !validAmount(draft.quantity))
  )
    return {
      source: null,
      meters: null,
      boxes: null,
      pallets: null,
      error: "أدخل كمية من صفر إلى مليار.",
      invalid: true,
    };
  const source = quantitySource(draft, defaultUnit);
  if (!source)
    return {
      source: null,
      meters: null,
      boxes: null,
      pallets: null,
      error: "الكمية لم تتحدد.",
    };
  if (defaultUnit === "pieces")
    return source.unit === "pieces"
      ? {
          source,
          meters: source.value,
          boxes: null,
          pallets: null,
          error: null,
        }
      : {
          source,
          meters: null,
          boxes: null,
          pallets: null,
          error: "هذا القسم بالقطعة؛ راجع وحدة الكمية.",
        };
  if (source.unit === "pieces")
    return {
      source,
      meters: null,
      boxes: null,
      pallets: null,
      error: "هذا القسم بالمتر المربع؛ راجع وحدة الكمية.",
    };
  if (
    !preset ||
    !validAmount(preset.mBox) ||
    preset.mBox === 0 ||
    !validAmount(preset.bPallet) ||
    preset.bPallet === 0
  ) {
    return {
      source,
      meters: source.unit === "meters" ? source.value : null,
      boxes: null,
      pallets: null,
      error:
        source.unit === "meters"
          ? null
          : "اختر تعبئة المقاس لتحويل الكراتين والطبالي إلى أمتار.",
    };
  }
  const boxes =
    source.unit === "meters"
      ? Math.ceil(source.value / preset.mBox)
      : source.unit === "boxes"
        ? source.value
        : round(source.value * preset.bPallet);
  const meters =
    source.unit === "meters" ? source.value : round(boxes * preset.mBox);
  const pallets =
    source.unit === "pallets"
      ? source.value
      : Number((boxes / preset.bPallet).toFixed(2));
  if (![meters, boxes, pallets].every(validAmount))
    return {
      source,
      meters: null,
      boxes: null,
      pallets: null,
      error: "الكمية المحسوبة أكبر من الحد المسموح؛ راجعها.",
    };
  return { source, meters, boxes, pallets, error: null };
}
