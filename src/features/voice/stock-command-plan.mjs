import { editableFields } from "../../../voice-api/src/stock-command.mjs";
import { normalizeStockCode } from "../../../voice-api/src/inventory-transcript.mjs";
import { convertQuantity, validAmount } from "./voice-quantity.mjs";

const normalize = (value) =>
  normalizeStockCode(value)
    .normalize("NFKC")
    .replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 15))
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

export function isExactStockMatch(item, command) {
  return Boolean(command.target) && normalize(item.name) === normalize(command.target);
}

export function matchStockItems(items, command) {
  const target = normalize(command.target);
  if (!target) return [];
  const scoped = items.filter(
    (item) => !command.categoryId || item.categoryId === command.categoryId,
  );
  const exact = scoped.filter((item) => isExactStockMatch(item, command));
  if (exact.length) return exact;
  // Partial matches must be selected explicitly, never used as a write target automatically.
  return scoped.filter((item) => normalize(item.name).includes(target));
}

const labels = {
  name: "الاسم / الكود",
  size: "المقاس",
  shade: "الشيد",
  quality: "النخب",
  surface: "السطح",
  color: "اللون",
  itemType: "النوع",
  materialOrGlass: "المادة / الزجاج",
  brand: "الماركة",
  notes: "الملاحظات",
  meters: "الكمية",
  boxes: "الكراتين",
  pallets: "الطبالي",
};
const rounded = (n) => Number(n.toFixed(6));
const hasReservations = (item) =>
  item.isReserved === true || Boolean(item.reservations?.length);
export function stockPlan(item, command, category) {
  const unit = item.unitType || category.defaultUnit || "meters";
  if (!["pieces", "meters"].includes(unit))
    throw new Error("وحدة الصنف غير معروفة. راجع الصنف يدوياً.");
  if (command.action === "delete") {
    if (hasReservations(item))
      throw new Error("هذا الصنف عليه حجوزات. راجع الحجوزات قبل الحذف.");
    return { action: "delete", patch: {}, changes: [] };
  }

  let patch = {};
  if (command.action === "edit") {
    for (const key of editableFields) {
      const value = command[key];
      if (
        typeof value === "string" &&
        value.trim() &&
        value.trim() !== item[key]
      ) {
        if (
          key === "size" &&
          unit === "meters" &&
          (item.packing || ["tiles", "ceramics"].includes(category.id))
        ) {
          throw new Error(
            "عدّل المقاس والتعبئة معاً من نموذج الصنف حتى تبقى حسابات المخزون صحيحة.",
          );
        }
        if (
          key === "name" &&
          category.customFields?.some((field) => field.includeInItemName)
        )
          throw new Error(
            "اسم هذا الصنف مبني من حقول القسم. عدّله من نموذج الصنف.",
          );
        patch[key] = value.trim().slice(0, key === "notes" ? 1000 : 200);
      }
    }
  } else if (command.action === "quantity") {
    const packing = item.packing;
    const preset =
      packing &&
      validAmount(packing.mBox) &&
      packing.mBox > 0 &&
      Number.isSafeInteger(packing.bPallet) &&
      packing.bPallet > 0
        ? packing
        : null;
    const { amount, mode, unit: spokenUnit } = command;
    if (
      !validAmount(amount) ||
      !["set", "increase", "decrease"].includes(mode) ||
      !spokenUnit ||
      (amount === 0 && mode !== "set")
    )
      throw new Error("حدد نوع تغيير الكمية والرقم والوحدة.");
    if (
      (spokenUnit === "pieces" || spokenUnit === "boxes") &&
      !Number.isInteger(amount)
    )
      throw new Error("عدد القطع أو الكراتين يجب أن يكون صحيحاً.");
    if (unit === "meters" && !preset && (item.boxes > 0 || item.pallets > 0))
      throw new Error("بيانات تعبئة الصنف ناقصة. أكملها من نموذج الصنف أولاً.");
    const converted = convertQuantity(
      { quantityInput: amount, quantityUnit: spokenUnit },
      preset,
      unit,
    );
    if (converted.error || converted.meters === null)
      throw new Error(converted.error || "تعذر حساب الكمية.");
    if (!validAmount(item.meters))
      throw new Error("الكمية الحالية غير صالحة. راجع الصنف يدوياً.");
    const next = rounded(
      mode === "set"
        ? converted.meters
        : item.meters +
            (mode === "increase" ? converted.meters : -converted.meters),
    );
    if (!validAmount(next) || (unit === "pieces" && !Number.isInteger(next)))
      throw new Error("الكمية الناتجة غير صالحة. راجع الرقم والوحدة.");
    const reservations = item.reservations || [];
    if (
      !Array.isArray(reservations) ||
      reservations.some((r) => !validAmount(r?.meters)) ||
      (item.isReserved && reservations.length === 0)
    )
      throw new Error("راجع حجوزات الصنف يدوياً قبل تغيير الكمية.");
    if (next < rounded(reservations.reduce((sum, r) => sum + r.meters, 0)))
      throw new Error("الكمية الجديدة أقل من الكمية المحجوزة.");
    patch = { meters: next };
    if (preset && unit === "meters") {
      const boxes = Math.ceil(next / preset.mBox - 1e-9);
      const pallets = Number((boxes / preset.bPallet).toFixed(2));
      if (!validAmount(boxes) || !validAmount(pallets))
        throw new Error("نتيجة التعبئة تتجاوز الحد المسموح.");
      patch = { ...patch, boxes, pallets };
    }
  } else throw new Error("هذا الإجراء لا يغيّر صنفاً موجوداً.");

  const changes = Object.entries(patch)
    .filter(([key, next]) => next !== item[key])
    .map(([key, after]) => ({
      key,
      label:
        key === "meters"
          ? unit === "pieces"
            ? "الكمية (قطعة)"
            : "الكمية (م²)"
          : labels[key],
      before: item[key] ?? "—",
      after,
    }));
  if (!changes.length) throw new Error("لا يوجد تغيير على بيانات الصنف.");
  return {
    action: command.action,
    patch: Object.fromEntries(changes.map(({ key, after }) => [key, after])),
    changes,
  };
}

// All saved fields are checked, including changes made by another client without audit fields.
export function stockFingerprint(value) {
  return JSON.stringify(value, (_key, entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      return entry;
    return Object.fromEntries(
      Object.keys(entry)
        .sort()
        .map((key) => [key, entry[key]]),
    );
  });
}
