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
export const voicePackingKey = (option) =>
  option.quality ? JSON.stringify([option.desc, option.quality]) : option.desc;

export function resolvePreset(draft, id, transcript = "", presets = presetsFor(id)) {
  const size = normalize(draft.size);
  const exact = presets.filter((p) => normalize(p.desc) === size);
  if (exact.length === 1 && !exact[0].quality) return exact[0];
  const quality = normalize(draft.quality);
  const withQuality = (p) => !p.quality || normalize(p.quality) === quality;
  if (exact.length > 1 || exact.some((p) => p.quality)) {
    const matchingQuality = exact.filter((p) => p.quality && withQuality(p));
    return matchingQuality.length === 1 ? matchingQuality[0] : null;
  }
  const dimensions = size.match(/\d+(?:\.\d+)?\*\d+(?:\.\d+)?/)?.[0];
  const reversed = dimensions?.split("*").reverse().join("*");
  const candidates = presets.filter((p) => {
    const configured = normalize(p.desc.split(" - ")[0]);
    return configured === dimensions || configured === reversed;
  });
  if (candidates.length === 1 && withQuality(candidates[0])) return candidates[0];
  const hint = normalize(
    [draft.size, draft.brand, transcript].filter(Boolean).join(" "),
  );
  const specified = candidates.filter((p) =>
    withQuality(p) && p.desc
      .split(" - ")
      .slice(1)
      .every((part) => hint.includes(normalize(part))),
  );
  if (specified.length === 1) return specified[0];
  return null; // Same dimensions can have different real packaging. Never choose the first one.
}
export function packingValues(draft, id, choice = "", presets = presetsFor(id)) {
  const preset = choice
    ? presets.find((p) => voicePackingKey(p) === choice)
    : resolvePreset(draft, id, "", presets);
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
