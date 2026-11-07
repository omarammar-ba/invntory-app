import test from "node:test";
import assert from "node:assert/strict";
import { parseStockCommand, parseStockEditFollowup, stockShortcut } from "../voice-api/src/stock-command.mjs";
import {
  matchStockItems,
  stockPlan,
  stockFingerprint,
} from "../src/features/voice/stock-command-plan.mjs";

const category = { id: "tiles", defaultUnit: "meters" };
const item = {
  name: "0012044",
  categoryId: "tiles",
  meters: 10,
  boxes: 5,
  pallets: 0.11,
  packing: { mBox: 2.16, bPallet: 44 },
};

test("quantity questions are read-only and formatted codes retain every digit", () => {
  for (const question of ["كم كمية البلاطة 12,500؟", "أعطيني كمية البلاطة ١٢٬٥٠٠", "ابحث عن الصنف رقم ۱۲۵۰۰"])
    assert.deepEqual([stockShortcut(question, [category]).action, stockShortcut(question, [category]).target], ["search", "12500"]);
  assert.equal(stockShortcut("زيد كمية البلاطة 12500", [category]), null);
  assert.equal(stockShortcut("كم كمية البلاطة 12500 وبعدين احذفها", [category]), null);
  const candidate = { ...item, name: "12500" };
  const similar = { ...item, name: "12" };
  const duplicate = { ...candidate, categoryId: "ceramics" };
  assert.deepEqual(matchStockItems([candidate, similar, duplicate], { target: "12,500" }), [candidate, duplicate]);
});

test("an incomplete edit keeps the code, and a followup cannot switch item or action", () => {
  const subject = stockShortcut("تعديل رقم البلاطة 12,500", [category]);
  assert.deepEqual([subject.action, subject.target, subject.question], ["clarify", "12500", "اذكر البيانات التي تريد تعديلها."]);
  const change = parseStockEditFollowup({ action: "edit", color: "أسود" }, "خلي اللون أسود", [category], "tiles", "12500");
  assert.deepEqual([change.action, change.target, change.categoryId, change.color], ["edit", "12500", "tiles", "أسود"]);
  for (const [command, phrase] of [
    [{ action: "edit", target: "999", color: "أسود" }, "خلي اللون أسود"],
    [{ action: "edit", color: "أسود" }, "خلي لون كود 999 أسود"],
    [{ action: "edit", target: "12500", color: "أسود" }, "عدل لون كود 12500 وكود 999 لأسود"],
    [{ action: "delete", target: "12500" }, "احذفها"],
    [{ action: "quantity", mode: "set", amount: 20, unit: "meters" }, "كم كمية البلاطة 12500؟"],
  ]) assert.equal(parseStockEditFollowup(command, phrase, [category], "tiles", "12500").action, "clarify");
});

test("the command interpreter strips IDs, flags and arbitrary fields, and clarifies unsafe inputs", () => {
  const parsed = parseStockCommand(
    {
      action: "delete",
      target: "0012044",
      id: "injected",
      hiddenForStaff: true,
      firestorePath: "/x",
    },
    [category],
  );
  assert.equal(parsed.target, "0012044");
  assert.equal(parsed.action, "delete");
  for (const key of ["id", "hiddenForStaff", "firestorePath"])
    assert.equal(Object.hasOwn(parsed, key), false);
  for (const raw of [
    { action: "delete" },
    { action: "delete", target: "0012044", categoryId: "injected" },
    { action: "edit", target: "0012044" },
    { action: "quantity", target: "0012044", amount: 2, unit: "pieces" },
    {
      action: "quantity",
      target: "0012044",
      amount: -2,
      unit: "pieces",
      mode: "decrease",
    },
    {
      action: "quantity",
      target: "0012044",
      amount: 0,
      unit: "pieces",
      mode: "increase",
    },
  ])
    assert.equal(parseStockCommand(raw, [category]).action, "clarify");
});

test("lookup preserves leading zeros, normalizes Arabic digits, and retains ambiguous matches", () => {
  const duplicate = { ...item, categoryId: "ceramics" };
  const similar = { ...item, name: "12044" };
  assert.deepEqual(
    matchStockItems([item, duplicate, similar], { target: "٠٠١٢٠٤٤" }),
    [item, duplicate],
  );
  assert.deepEqual(
    matchStockItems([item, duplicate], {
      target: "۰۰۱۲۰۴۴",
      categoryId: "tiles",
    }),
    [item],
  );
  assert.deepEqual(
    matchStockItems([item, duplicate, similar], { target: "12044" }),
    [similar],
  );
});

test("quantity set, increase, and decrease use saved packing and keep current reservations safe", () => {
  const increase = stockPlan(
    item,
    { action: "quantity", mode: "increase", amount: 1, unit: "pallets" },
    category,
  );
  assert.deepEqual(increase.patch, {
    meters: 105.04,
    boxes: 49,
    pallets: 1.11,
  });
  assert.equal(
    stockPlan(
      item,
      { action: "quantity", mode: "decrease", amount: 2, unit: "boxes" },
      category,
    ).patch.meters,
    5.68,
  );
  assert.equal(
    stockPlan(
      item,
      { action: "quantity", mode: "set", amount: 0, unit: "meters" },
      category,
    ).patch.meters,
    0,
  );
  assert.throws(
    () =>
      stockPlan(
        { ...item, reservations: [{ meters: 9 }] },
        { action: "quantity", mode: "decrease", amount: 2, unit: "meters" },
        category,
      ),
    /المحجوزة/,
  );
  assert.throws(
    () =>
      stockPlan(
        { ...item, packing: undefined },
        { action: "quantity", mode: "increase", amount: 1, unit: "pallets" },
        category,
      ),
    /تعبئة/,
  );
  assert.throws(
    () =>
      stockPlan(
        item,
        { action: "quantity", mode: "increase", amount: 1.5, unit: "boxes" },
        category,
      ),
    /صحيحاً/,
  );
  assert.throws(
    () =>
      stockPlan(
        item,
        { action: "quantity", mode: "decrease", amount: 11, unit: "meters" },
        category,
      ),
    /غير صالحة/,
  );
});

test("only explicit descriptive fields change; edits cannot silently change packing or visibility", () => {
  assert.deepEqual(
    stockPlan(
      item,
      { action: "edit", color: "أسود", hiddenForStaff: true, meters: 0 },
      category,
    ).patch,
    { color: "أسود" },
  );
  assert.throws(
    () => stockPlan(item, { action: "edit", size: "60*60" }, category),
    /التعبئة/,
  );
  assert.throws(
    () =>
      stockPlan({ ...item, isReserved: true }, { action: "delete" }, category),
    /حجوزات/,
  );
  assert.equal(
    stockPlan(item, { action: "delete" }, category).action,
    "delete",
  );
});

test("snapshot comparisons ignore key order and detect changes to quantities, image, and reservations", () => {
  assert.equal(
    stockFingerprint(item),
    stockFingerprint(Object.fromEntries(Object.entries(item).reverse())),
  );
  for (const update of [
    { meters: 11 },
    { image: "different" },
    { reservations: [{ meters: 1 }] },
  ])
    assert.notEqual(
      stockFingerprint(item),
      stockFingerprint({ ...item, ...update }),
    );
});

test("warehouse packing uses only enabled options and never guesses between grades", async () => {
  const { packingValues, resolvePreset, voicePackingKey } = await import("../src/features/voice/voice-presets.mjs");
  const standard = { desc: "80*80", label: "80×80", quality: "نخب أول", mBox: 2, bPallet: 10 };
  const alternate = { ...standard, quality: "نخب ثاني", mBox: 3 };
  const draft = { size: "٨٠×٨٠", quantityInput: 3, quantityUnit: "pallets" };
  const enabled = [standard, alternate];
  assert.equal(resolvePreset(draft, "tiles", "", enabled), null);
  assert.equal(resolvePreset({ ...draft, quality: standard.quality }, "tiles", "", enabled), standard);
  assert.equal(resolvePreset({ ...draft, quality: standard.quality }, "tiles", "", [alternate]), null);
  assert.equal(packingValues(draft, "tiles", voicePackingKey(standard), [alternate]), null);
  assert.deepEqual(packingValues(draft, "tiles", voicePackingKey(standard), enabled), {
    size: "80*80", boxes: 30, pallets: 3, mBox: 2, bPallet: 10,
  });
});

test("spoken numbers keep identifier zeros and normalize dimensions without combining distinct codes", async () => {
  const { prepareInventoryTranscript, preserveExplicitStockCode } = await import("../voice-api/src/inventory-transcript.mjs");
  assert.equal(prepareInventoryTranscript("الكود ١١ كود 11 ١٢٠ ضرب ۶۰ نخب أول، نخب أول مطفي مطفي"), "الكود 11 120*60 نخب أول مطفي");
  assert.equal(prepareInventoryTranscript("بورسلان مية وعشرين في ستين، كود أحد عشر"), "بورسلان 120*60، كود 11");
  assert.equal(prepareInventoryTranscript("model Alpha, code AB 0011, size one hundred and twenty by sixty, matte"), "model Alpha, code AB0011, size 120*60, matte");
  assert.equal(prepareInventoryTranscript("المقاس 12.5 by 60، الكمية 22.5 متر"), "المقاس 12.5*60، الكمية 22.5 متر");
  assert.equal(prepareInventoryTranscript("الكود 11 كود 12"), "الكود 11 كود 12");
  assert.equal(preserveExplicitStockCode({ action: "search", target: "11" }, "ابحث عن كود 0011.").target, "0011");
  assert.equal(preserveExplicitStockCode({ action: "delete", target: "12" }, "احذف كود 11").action, "clarify");
  assert.equal(preserveExplicitStockCode({ action: "search", target: "AB0011" }, "ابحث code AB0011").target, "AB0011");
});

test("voice addition selects the sole configured department for a spoken size", async () => {
  const { routeVoiceAddition, sizeOnlyRequest, spokenDraftSize } = await import("../src/features/voice/voice-category.mjs");
  const { presetsFor, resolvePreset } = await import("../src/features/voice/voice-presets.mjs");
  const categories = [{ id: "tiles", name: "بورسلان" }, { id: "ceramics", name: "سيراميك" }];
  const draft = { size: null, categoryId: "ceramics" };
  for (const phrase of ["أضف الكود 11، مية وعشرين في ستين.", "120-60"]) {
    const { size, categoryId, question } = routeVoiceAddition(draft, phrase, categories, presetsFor);
    assert.deepEqual({ size, categoryId, question }, { size: "120*60", categoryId: "tiles", question: "" });
  }
  assert.equal(routeVoiceAddition(draft, "60×60", categories, presetsFor).categoryId, null);
  const explicit = routeVoiceAddition(draft, "ضيفه بالسيراميك، 120×60", categories, presetsFor);
  assert.equal(explicit.categoryId, "ceramics");
  assert.ok(explicit.question);
  assert.equal(routeVoiceAddition(draft, "أضف 120×60", categories, presetsFor, "ceramics").categoryId, "ceramics");
  assert.equal(routeVoiceAddition(draft, "120×60", categories.slice(1), presetsFor).categoryId, null);
  const custom = [{ id: "warehouse-special", name: "المقاسات الخاصة" }, ...categories];
  assert.equal(routeVoiceAddition(draft, "90 في 45", custom, id => id === "warehouse-special" ? [{ desc: "45*90 - خاص" }] : []).categoryId, "warehouse-special");
  assert.equal(routeVoiceAddition(draft, "60 في 120", categories, presetsFor).categoryId, "tiles");
  assert.equal(resolvePreset({ size: "60*120" }, "tiles")?.desc, "120*60");
  assert.equal(sizeOnlyRequest("المقاس: 120-60"), true);
  assert.equal(sizeOnlyRequest("ابحث عن كود 120-60"), false);
  assert.equal(spokenDraftSize("كود 120-60", null), null);
  assert.equal(spokenDraftSize("الكمية 120-60", null), null);
  assert.equal(routeVoiceAddition(draft, "مقاس 120 في 60 أو 60 في 60", categories, presetsFor).size, null);
  assert.equal(spokenDraftSize("مقاس ستين في ستين فاشون", "60*60 - فاشون"), "60*60 - فاشون");
});


test("spoken packing details resolve the variant, or ask only for the missing distinction", async () => {
  const { routeVoiceAddition, sizeOnlyRequest } = await import("../src/features/voice/voice-category.mjs");
  const { presetsFor } = await import("../src/features/voice/voice-presets.mjs");
  const categories = [{ id: "tiles", name: "بورسلان" }, { id: "ceramics", name: "سيراميك" }];
  const draft = { size: null, categoryId: null };
  const route = (text, seed = draft, prior = null) => routeVoiceAddition(seed, text, categories, presetsFor, "", prior);
  assert.equal(route("60 في 60 فاشون").preset?.desc, "60*60 - فاشون");
  assert.equal(route("60 في 60 بريما قص ليزر").preset?.desc, "60*60 - بريما - قص ليزر");
  assert.equal(route("60 في 60 سماكة 14 ملم").preset?.desc, "60*60 - 14 ملم");
  assert.equal(route("عادي ضيف 60 في 60 سيراميك").preset, null);
  const ambiguous = route("60 في 60");
  assert.equal(ambiguous.categoryId, null);
  assert.equal(route("فاشون", { ...draft, size: ambiguous.size }, ambiguous).preset?.desc, "60*60 - فاشون");
  const prima = route("60 في 60 بريما");
  assert.equal(prima.categoryId, "ceramics");
  assert.deepEqual(prima.options.map(option => option.desc), ["60*60 - بريما - قص ليزر", "60*60 - بريما - قص عادي"]);
  assert.match(prima.question, /ليزر.*عادي/);
  assert.equal(route("ليزر", { ...draft, size: prima.size }, prima).preset?.desc, "60*60 - بريما - قص ليزر");
  assert.equal(sizeOnlyRequest("60 في 60 فاشون"), true);
  assert.equal(sizeOnlyRequest("60 في 60 بريما قص ليزر"), true);
  assert.equal(sizeOnlyRequest("دور على 60 في 60 بريما"), false);
});
