import { prepareInventoryTranscript } from "../../../voice-api/src/inventory-transcript.mjs";

const canonicalDimensions = (value) => {
  if (!value) return "";
  const parts = value.split("*");
  return parts.map(Number).sort((a, b) => a - b).join("*");
};

export function sizeMention(transcript) {
  const text = prepareInventoryTranscript(transcript || "");
  const matches = [...text.matchAll(/(?<![\p{L}\p{N}.])(\d+(?:\.\d+)?)\s*([*–—-])\s*(\d+(?:\.\d+)?)(?![\p{L}\p{N}]|\.\d|\s*\*\s*\d|[-–—]\d)/gu)];
  const dimensions = matches.filter(({index, 1: a, 3: b}) => {
    if (!(Number(a) > 0 && Number(b) > 0)) return false;
    // A hyphenated SKU must not be mistaken for a size. Preserve explicit negation.
    const prefix = text.slice(0, index).trimEnd();
    if (/\d+\s*[*–—-]$/.test(prefix)) return false;
    return !/(?:كود(?:\s+الصنف)?|الكود|رقم الصنف|رمز(?:\s+الصنف)?|الكمي[ةه]|\bquantity|\bcode|\bsku|مش|مو|وليس|ليس|بدل|\bnot)[\s:#]*$/iu.test(prefix);
  }).map(match => `${match[1]}*${match[3]}`);
  const unique = new Map(dimensions.map(size => [canonicalDimensions(size), size]));
  return { size: unique.size === 1 ? unique.values().next().value : null, multiple: unique.size > 1 };
}

export function sizeOnlyRequest(transcript) {
  const normalized = prepareInventoryTranscript(transcript || "");
  if (!sizeMention(normalized).size) return false;
  const remainder = normalized.replace(/\d+(?:\.\d+)?\s*[*–—-]\s*\d+(?:\.\d+)?/, " ");
  return normalizeWords(remainder).join(" ").replace(
    /(?:^| )(?:مقاس|size|سم|cm|سيراميك|سراميك|ceramic|ceramics|بورسلان|بورسلين|porcelain|فاشون|فاشن|fashion|بريما|بريمه|prima|قص|ليزر|laser|عادي|regular|سماكة|سماكه|14\s*(?:ملم|مم|mm)|نخب اول|نخب ثاني|first grade|second grade)(?= |$)/gu,
    "",
  ).trim() === "";
}

const normalizeWords = (text) => text.toLowerCase()
  .replace(/[\u064B-\u065F\u0670ـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي")
  .split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  .map(word => word.replace(/^(?:[وبفك]?ال|لل)(?=.{2,}$)/u, ""));
const aliases = {
  tiles: ["بورسلان", "بورسلين", "بورسلانا", "porcelain"],
  ceramics: ["سيراميك", "سراميك", "ceramic", "ceramics"],
};
function categoryMentions(transcript, categories) {
  const words = ` ${normalizeWords(transcript).join(" ")} `;
  return categories.filter(category => [category.name, ...(aliases[category.id] || [])].some(name => {
    const term = normalizeWords(name).join(" ");
    return term && words.includes(` ${term} `);
  }));
}

export function spokenDraftSize(transcript, proposedSize) {
  const spoken = sizeMention(transcript).size;
  if (!spoken) return proposedSize;
  const proposed = sizeMention(proposedSize).size;
  // Keep a matching preset description, e.g. "60*60 - فاشون".
  return proposed && canonicalDimensions(proposed) === canonicalDimensions(spoken)
    ? prepareInventoryTranscript(proposedSize).replace(/^\s*\d+(?:\.\d+)?\s*[-–—]\s*\d+(?:\.\d+)?/, proposed)
    : spoken;
}

// A hint is useful only if it describes one of the actual configured options.
const packingTerms = {
  series: {
    fashion: /(?:^| )(?:فاشون|فاشن|fashion)(?: |$)/u,
    prima: /(?:^| )(?:بريما|بريمه|prima)(?: |$)/u,
  },
  cut: {
    laser: /(?:^| )(?:ليزر|laser)(?: |$)/u,
    regular: /^(?:عادي|regular)$|(?:^| )(?:قص عادي|بريما عادي|regular cut)(?: |$)/u,
  },
  thickness: {
    mm14: /(?:^| )14\s*(?:ملم|مم|mm)(?: |$)/u,
  },
  grade: {
    first: /(?:^| )(?:نخب اول|first grade)(?: |$)/u,
    second: /(?:^| )(?:نخب ثاني|second grade)(?: |$)/u,
  },
};

function packingHints(text) {
  const words = normalizeWords(prepareInventoryTranscript(text || "")).join(" ");
  return Object.fromEntries(Object.entries(packingTerms).map(([group, variants]) => [
    group, Object.keys(variants).filter(variant => variants[variant].test(words)),
  ]));
}

const configuredTerms = (option) => option.desc.split(/\s+-\s+/).slice(1)
  .map(part => normalizeWords(part).join(" ")).filter(Boolean);
const mentionedTerms = (transcript, options) => {
  const words = ` ${normalizeWords(transcript).join(" ")} `;
  return [...new Set(options.flatMap(configuredTerms))].filter(term => words.includes(` ${term} `));
};
export function hasPackingAnswer(transcript, options = []) {
  return Object.values(packingHints(transcript)).some(values => values.length > 0)
    || mentionedTerms(transcript, options).length > 0;
}

const optionHint = ({ option }) => packingHints([option.desc, option.quality].filter(Boolean).join(" "));
const variantName = ({ option }) => [
  option.desc.split(/\s+-\s+/).slice(1).join(" - "),
  option.quality,
].filter(Boolean).join("، ") || option.label;

export function routeVoiceAddition(draft, transcript, categories, packingOptionsFor, fixedCategory = "", prior = null) {
  const spoken = sizeMention(transcript);
  const dimensions = spoken.size || (!spoken.multiple && prior ? sizeMention(draft.size).size : null);
  let size = spoken.multiple ? null : dimensions || draft.size;
  const mentions = categoryMentions(transcript, categories);
  const all = dimensions ? categories.flatMap(category =>
    packingOptionsFor(category.id).filter(option => {
      const configured = sizeMention(option.desc).size;
      return configured && canonicalDimensions(configured) === canonicalDimensions(dimensions);
    }).map(option => ({ category, option })),
  ) : [];
  const chosen = fixedCategory || (mentions.length === 1 ? mentions[0].id : null);
  let categoryId = chosen;
  let question = "";
  let preset = null;
  let options = [];
  const hints = packingHints(transcript);
  if (prior && (!spoken.size || (dimensions && canonicalDimensions(dimensions) === canonicalDimensions(sizeMention(draft.size).size || "")))) {
    const previous = prior.hints;
    for (const group of Object.keys(hints)) if (!hints[group].length) hints[group] = previous[group] || [];
  }
  const pool = chosen ? all.filter(candidate => candidate.category.id === chosen) : all;
  // Consider only discriminating details present in this size's configuration.
  const byOption = all.map(candidate => ({ ...candidate, terms: optionHint(candidate) }));
  const criteria = Object.entries(hints).filter(([group, heard]) =>
    heard.some(term => byOption.some(candidate => candidate.terms[group].includes(term))),
  );
  const literal = mentionedTerms(transcript, all.map(candidate => candidate.option));
  const narrowed = byOption.filter(candidate =>
    (!chosen || candidate.category.id === chosen) &&
    criteria.every(([group, heard]) => heard.length === 1 && candidate.terms[group].includes(heard[0])) &&
    literal.every(term => configuredTerms(candidate.option).includes(term)),
  );
  const categoryIds = [...new Set(narrowed.map(candidate => candidate.category.id))];
  if (spoken.multiple) {
    question = "انذكر أكثر من مقاس. اكتب المقاس المطلوب للصنف.";
  } else if (chosen && dimensions && all.length && !pool.length) {
    question = "المقاس غير موجود ضمن مقاسات القسم المحدد. راجع القسم والمقاس.";
  } else if (!chosen && (mentions.length > 1 || categoryIds.length > 1)) {
    question = "المقاس موجود بأكثر من قسم. احكِ القسم أو النوع، مثلاً فاشون، أو اختر القسم.";
  } else if (dimensions && !narrowed.length) {
    question = pool.length
      ? "مواصفات النوع مش واضحة لهذا المقاس. احكِ نوع التعبئة أو اختره."
      : chosen ? "" : "المقاس غير موجود في قوائم الأقسام المتاحة. اختر القسم يدويًا.";
  } else if (dimensions) {
    categoryId ||= categoryIds[0] || null;
    options = narrowed.map(candidate => candidate.option);
    if (narrowed.length === 1) {
      preset = options[0];
      size = preset.desc;
    } else if (narrowed.length > 1) {
      const labels = [...new Set(narrowed.map(variantName))];
      question = labels.length <= 4
        ? `أي نوع؟ ${labels.join("، ")}.`
        : "لهذا المقاس أكثر من نوع تعبئة. احكِ النوع أو اختره من القائمة.";
    }
  } else if (!chosen) {
    categoryId = categories.some(category => category.id === draft.categoryId) ? draft.categoryId : null;
  }
  return { size, categoryId, question, preset, options, hints, explicitCategory: chosen };
}
