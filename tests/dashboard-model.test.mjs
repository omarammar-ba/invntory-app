import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/features/dashboard/dashboardModel.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { EMPTY_HOME_FILTERS: empty, matchesHomeSearch, activeFilterCount, getQuantityChange, getLogDate, getLogTone, orderHomeCategories, createHomeSearchIndex, searchHomeIndex } =
  await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const item = Object.freeze({
  id: 'a', categoryId: 'tiles', name: '12064', shade: 'A14', size: '60*60', quality: 'نخب أول',
  surface: 'مطفي', color: 'رمادي', brand: 'إيطالي', meters: 45.36,
  customValues: Object.freeze({ origin: 'الأردن' }),
  customFieldSnapshot: Object.freeze([{ fieldId: 'f', label: 'السماكة', value: 8, suffix: 'ملم' }]),
});

test('search matches Arabic digits, diacritics and combined item specifications', () => {
  assert.equal(matchesHomeSearch(item, '١٢٠٦٤', empty), true);
  assert.equal(matchesHomeSearch(item, 'رَمادي ايطالي', empty), true);
  assert.equal(matchesHomeSearch(item, '60×60 مطفي', empty), true);
  assert.equal(matchesHomeSearch(item, 'رمادي لامع', empty), false);
});
test('custom fields remain searchable', () => {
  assert.equal(matchesHomeSearch(item, 'السماكة 8', empty), true);
  assert.equal(matchesHomeSearch(item, 'الاردن', empty), true);
});
test('all selected filters apply together and dimensions normalize', () => {
  const filters = { categoryId: 'tiles', size: '60 × 60', quality: 'نخب اول', surface: 'مطفي' };
  assert.equal(matchesHomeSearch(item, '12064', filters), true);
  assert.equal(activeFilterCount(filters), 4);
  for (const [key, value] of [['categoryId', 'ceramics'], ['size', '30*60'], ['quality', 'نخب ثاني'], ['surface', 'لامع']]) {
    assert.equal(matchesHomeSearch(item, '', { ...filters, [key]: value }), false);
  }
  assert.equal(item.meters, 45.36);
});
test('legacy items without optional metadata do not crash search', () => {
  assert.equal(matchesHomeSearch({ id: 'old', categoryId: 'tiles', name: 'قديم' }, 'قديم', empty), true);
  assert.equal(matchesHomeSearch({ id: 'old', categoryId: 'tiles' }, '12064', empty), false);
});
test('before/after quantities retain the stored direction and precision', () => {
  assert.deepEqual(getQuantityChange('الكمية: 21 -> 45.36، تعديل الملاحظات'), { before: '21', after: '45.36' });
  assert.deepEqual(getQuantityChange('الكمية: ١٥.١٢ -> ٩.٣٥'), { before: '15.12', after: '9.35' });
  assert.equal(getQuantityChange('حجز 10 أمتار في 2026/10/21'), null);
  assert.equal(getQuantityChange('حذف الصنف نهائياً'), null);
});
test('cached and live Firestore dates sort correctly; malformed dates remain safe', () => {
  const date = new Date('2026-10-21T10:00:00Z');
  assert.equal(getLogDate({ seconds: date.getTime() / 1000 }).getTime(), date.getTime());
  assert.equal(getLogDate({ toDate: () => date }).getTime(), date.getTime());
  assert.equal(getLogDate(date.toISOString()).getTime(), date.getTime());
  assert.equal(getLogDate('bad'), null);
  assert.equal(getLogDate({ toDate: () => { throw Error('invalid'); } }), null);
});
test('reservation deletion differs visually from permanent item deletion', () => {
  assert.equal(getLogTone('حذف حجز'), 'amber');
  assert.equal(getLogTone('حذف'), 'rose');
  assert.equal(getLogTone('إضافة'), 'teal');
  assert.equal(getLogTone('تعديل'), 'blue');
});

test('main tile departments come first without mutating configured order or other departments', () => {
  const departments = Object.freeze([
    { id: 'basins', name: 'مجالي' }, { id: 'ceramics', name: 'سيراميك' },
    { id: 'toilets', name: 'مقاعد' }, { id: 'tiles', name: 'بورسلان' },
    { id: 'showers', name: 'دش' },
  ].map(Object.freeze));
  assert.deepEqual(orderHomeCategories(departments).map(c => c.id), ['tiles', 'ceramics', 'basins', 'toilets', 'showers']);
  assert.deepEqual(departments.map(c => c.id), ['basins', 'ceramics', 'toilets', 'tiles', 'showers']);
  assert.deepEqual(orderHomeCategories([{ id: 'custom', name: 'أخرى', template: 'ceramic' }, { id: 'p', name: 'بورسلان' }]).map(c => c.id), ['p', 'custom']);
  assert.deepEqual(orderHomeCategories([]), []);
});

test('indexed search keeps the same Arabic, filter and custom-field results in source order', () => {
  const items = [item, { ...item, id: 'second', categoryId: 'ceramics', name: '12048', surface: 'لامع' },
    { id: 'old', categoryId: 'tiles', name: 'قديم' }];
  const index = createHomeSearchIndex(items);
  for (const query of ['', '١٢٠٦٤', '60×60 مطفي', 'رَمادي ايطالي', 'السماكة 8', 'الاردن', 'غير موجود']) {
    for (const filters of [empty, { ...empty, categoryId: 'tiles' },
      { categoryId: 'tiles', size: '60 × 60', quality: 'نخب اول', surface: 'مطفي' }]) {
      assert.deepEqual(searchHomeIndex(index, query, filters), items.filter(tile => matchesHomeSearch(tile, query, filters)));
    }
  }
  assert.equal(searchHomeIndex(index, '12064', empty)[0], item);
  const updated = { ...item, name: 'جديد' };
  assert.deepEqual(searchHomeIndex(createHomeSearchIndex([updated]), 'جديد', empty), [updated]);
});
