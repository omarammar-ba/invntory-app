// Normalize only recognizable stock expressions. Free-form names/brands remain verbatim.
export const inventoryTranscriptionHint =
  "وصف مخزون باللهجة الأردنية مع أسماء وأكواد إنجليزية. سيراميك، بورسلان، كود الصنف، المقاس، الشيد، النخب، السطح. Keep English names, product codes and digits as spoken.";

const groups = [
  [0, "صفر zero oh"], [1, "واحد one"], [2, "اثنين اتنين تنين two"],
  [3, "ثلاث ثلاثة تلات three"], [4, "أربع اربعة أربعة four"],
  [5, "خمس خمسة five"], [6, "ست ستة six"], [7, "سبع سبعة seven"],
  [8, "ثمان ثمانية eight"], [9, "تسع تسعة nine"], [10, "عشر عشرة ten"],
  [11, "حدعش حداش احدعش eleven"], [12, "اثنعش اتناش تناش twelve"],
  [13, "thirteen"], [14, "fourteen"], [15, "fifteen"], [16, "sixteen"],
  [17, "seventeen"], [18, "eighteen"], [19, "nineteen"],
  [20, "عشرين عشرون twenty"], [30, "ثلاثين تلاتين thirty"], [40, "أربعين اربعين forty"],
  [50, "خمسين fifty"], [60, "ستين sixty"], [70, "سبعين seventy"],
  [80, "ثمانين تمانين eighty"], [90, "تسعين ninety"],
  [100, "مية ميه ميةً مائة مئة hundred"], [200, "ميتين مئتين twohundred"],
];
const small = Object.fromEntries(groups.flatMap(([number, names]) =>
  names.split(" ").map(name => [name, number])));
const words = Object.keys(small).sort((a, b) => b.length - a.length).join("|");
const teens = String.raw`(?:أحد|احد|إحدى|احدى|اثنا|اثني|ثلاثة|أربعة|اربعة|خمسة|ستة|سبعة|ثمانية|تسعة)\s+عشر`;
const word = `(?:${words})(?![\\p{L}\\p{N}])`;
const number = `(?:[0-9]+(?:[.,٫][0-9]+)?|${teens}|${word}(?:(?:\\s+and\\s+|\\s+و\\s*|\\s+|-)${word}){0,4})`;
const digits = (text) => text.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 15));
const collapseSpace = (text) => text.trim().replace(/\s+/g, " ");
const codeLabel = "(?:الكود|كود|رمز(?:\\s+الصنف)?|رقم\\s+(?:الصنف|البلاطة|البلاطه)|code|sku)";
const groupedCode = "[0-9]{1,3}(?:[,،٬][0-9]{3})+";

export function normalizeStockCode(value) {
  const clean = collapseSpace(digits(String(value ?? "")));
  return new RegExp(`^${groupedCode}$`).test(clean) ? clean.replace(/[,،٬]/g, "") : clean;
}

function spokenNumber(input, code = false) {
  const value = collapseSpace(digits(input)).toLowerCase();
  if (/^\d+(?:[.,٫]\d+)?$/.test(value)) return value.replace(/[٫,]/, ".");
  const teen = value.match(new RegExp(`^(${teens})$`, "u"));
  if (teen) {
    const head = teen[1].split(" ")[0];
    return String(10 + (/^(?:[أاإ]حد|[إا]حدى)$/.test(head) ? 1 : /^(?:اثنا|اثني)$/.test(head) ? 2 : small[head]));
  }
  const raw = value.split(/[\s-]+/).filter(part => part !== "and" && part !== "و")
    .map(part => !(part in small) && part.startsWith("و") ? part.slice(1) : part);
  const values = raw.map(part => /^\d+$/.test(part) ? Number(part) : small[part]);
  if (!values.length || values.some(n => n === undefined)) return null;
  if (code && values.every(n => n < 10)) return raw.map((part, i) => /^\d+$/.test(part) ? part : values[i]).join("");
  if (values.length === 1) return String(values[0]);
  let base = 0;
  if (raw[1] === "hundred" && values[0] >= 1 && values[0] <= 9) base = values.splice(0, 2)[0] * 100;
  else if (values[0] >= 100) base = values.shift();
  if (!values.length) return String(base);
  if (values.length === 1 && base && values[0] < 100) return String(base + values[0]);
  if (values.length === 2 && values.some(n => n >= 20 && n < 100 && n % 10 === 0) && values.some(n => n >= 1 && n <= 9)) {
    return String(base + values[0] + values[1]);
  }
  return null;
}

function identifier(input) {
  const value = normalizeStockCode(input);
  if (/^[a-z][a-z0-9_-]*\s+\d+[a-z0-9_-]*$/i.test(value)) return value.replace(/\s/g, "");
  if (/^(?=[a-z0-9_-]*\d)[a-z0-9][a-z0-9_-]*$/i.test(value)) return value;
  return spokenNumber(value, true);
}

export function prepareInventoryTranscript(input) {
  let text = collapseSpace(digits(input));
  const dimension = new RegExp(`(?<![\\p{L}\\p{N}])(?<![0-9][.,٫])(${number})\\s*(?:في|ضرب|[×x*]|by|times)\\s*(${number})(?![\\p{L}\\p{N}]|[.,٫][0-9])`, "giu");
  text = text.replace(dimension, (match, a, b) => {
    const left = spokenNumber(a), right = spokenNumber(b);
    return left && right && Number(left) > 0 && Number(right) > 0 ? `${left}*${right}` : match;
  });
  const tagged = new RegExp(`(?<![\\p{L}\\p{N}])([وف]?${codeLabel})(?:[\\s:#-]+|(?=[0-9]))(${groupedCode}|(?:[a-z][a-z0-9_-]*\\s+)?[a-z0-9_-]*[0-9][a-z0-9_-]*|${number})(?![\\p{L}\\p{N}*]|[,،٬.][0-9])`, "giu");
  text = text.replace(tagged, (match, label, value) => {
    const code = identifier(value);
    return code ? `${label} ${code}` : match;
  });
  const repeatedCode = new RegExp(`(?<![\\p{L}\\p{N}])(${codeLabel})\\s+([a-z0-9_-]+)(?:[\\s،,؛.]+(?:${codeLabel})\\s+\\2(?![a-z0-9_-]))+`, "giu");
  text = text.replace(repeatedCode, "$1 $2");
  const repeatedDetail = /(?<![\p{L}\p{N}])(نخب [أا]ول|نخب ثاني|مطفي|لامع|سيمي مط|first grade|matte)(?:[\s،,؛.]+\1(?![\p{L}\p{N}]))+/giu;
  return text.replace(repeatedDetail, "$1");
}

export function explicitStockCodes(transcript) {
  return [...transcript.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])[وف]?${codeLabel}\\s+([a-z0-9_-]+)(?![a-z0-9_*-]|[,،٬.][0-9])`, "giu"))]
    .map(match => match[1]).filter(code => /\d/.test(code));
}

// Used only to keep an explicit code's spelling, not to choose a different item.
export function preserveExplicitStockCode(result, transcript) {
  const codes = explicitStockCodes(transcript);
  const unique = [...new Map(codes.map(code => [code.toLowerCase(), code])).values()];
  if (unique.length !== 1 || !result || typeof result !== "object") return result;
  const key = result.action === "add" ? "name" : ["search", "edit", "delete", "quantity"].includes(result.action) ? "target" : null;
  if (!key) return result;
  const explicit = unique[0];
  const proposed = typeof result[key] === "string" ? identifier(result[key]) : null;
  const equivalent = (code) => code.toLowerCase().replace(/(?<!\d)0+(?=\d)/g, "");
  if (proposed && equivalent(proposed) === equivalent(explicit)) return { ...result, [key]: explicit };
  if (proposed && key === "target") return {
    ...result, action: "clarify", target: null,
    question: `سمعت الكود ${explicit}، لكن نتيجة التحليل مختلفة. أكد الكود في الطلب.`,
  };
  return result;
}
