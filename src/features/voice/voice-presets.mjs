import { convertQuantity } from "./voice-quantity.mjs";
export const PORCELAIN_PRESETS = [
  {
    label: "120×60 سم",
    desc: "120*60",
    mBox: 2.16,
    bPallet: 44,
  },
  {
    label: "60×60 سم",
    desc: "60*60",
    mBox: 1.8,
    bPallet: 36,
  },
];

export const CERAMIC_PRESETS = [
  {
    label: "60*60 - فاشون (1.46 م² - 36 كرتونة)",
    desc: "60*60 - فاشون",
    mBox: 1.46,
    bPallet: 36,
  },
  {
    label: "60*60 - بريما - قص ليزر (1.41 م² - 36 كرتونة)",
    desc: "60*60 - بريما - قص ليزر",
    mBox: 1.41,
    bPallet: 36,
  },
  {
    label: "60*60 - بريما - قص عادي (1.44 م² - 36 كرتونة)",
    desc: "60*60 - بريما - قص عادي",
    mBox: 1.44,
    bPallet: 36,
  },
  {
    label: "60*60 - 14 ملم (1.08 م² - 36 كرتونة)",
    desc: "60*60 - 14 ملم",
    mBox: 1.08,
    bPallet: 36,
  },
  {
    label: "30*60 - بريما (1.62 م² - 48 كرتونة)",
    desc: "30*60 - بريما",
    mBox: 1.62,
    bPallet: 48,
  },
  {
    label: "30*60 - فاشون (1.62 م² - 32 كرتونة)",
    desc: "30*60 - فاشون",
    mBox: 1.62,
    bPallet: 32,
  },
  {
    label: "50*50 (1.50 م² - 32 كرتونة)",
    desc: "50*50",
    mBox: 1.5,
    bPallet: 32,
  },
];

export const presetsFor = (id) =>
  id === "tiles" ? PORCELAIN_PRESETS : id === "ceramics" ? CERAMIC_PRESETS : [];
const normalize = (s) =>
  String(s || "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[×xX]/g, "*")
    .replace(/\s/g, "")
    .toLowerCase();
export function resolvePreset(draft, id, transcript = "") {
  const presets = presetsFor(id);
  const size = normalize(draft.size);
  const exact = presets.find((p) => normalize(p.desc) === size);
  if (exact) return exact;
  const dimensions = size.match(/\d+(?:\.\d+)?\*\d+(?:\.\d+)?/)?.[0];
  const candidates = presets.filter(
    (p) => normalize(p.desc.split(" - ")[0]) === dimensions,
  );
  if (candidates.length === 1) return candidates[0];
  const hint = normalize(
    [draft.size, draft.brand, transcript].filter(Boolean).join(" "),
  );
  const specified = candidates.filter((p) =>
    p.desc
      .split(" - ")
      .slice(1)
      .every((part) => hint.includes(normalize(part))),
  );
  if (specified.length === 1) return specified[0];
  return null; // Same dimensions can have different real packaging. Never choose the first one.
}
export function packingValues(draft, id, choice = "") {
  const preset = choice
    ? presetsFor(id).find((p) => p.desc === choice)
    : resolvePreset(draft, id);
  const converted = convertQuantity(draft, preset);
  if (!preset || converted.error || converted.meters === null) return null;
  return {
    size: preset.desc,
    boxes: converted.boxes,
    pallets: converted.pallets,
    mBox: preset.mBox,
    bPallet: preset.bPallet,
  };
}
