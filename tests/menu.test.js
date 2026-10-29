import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMealsWithOptions, renderCombinedComparison } from '../js/components/menuRenderer.js';
import { fetchMenu } from '../js/services/menuApi.js';

const payload = [{name: 'Lunch', groups: [{name: 'Grill', items: [
  {name: 'Chicken & Rice', calories: 450}, {name: 'Carrots', calories: 40},
]}]}];
const options = {favorites: new Set(['chicken & rice']), favoritesOnly: true, mealFilters: ['lunch']};

test('favourites filter preserves saved dish and escapes its name', () => {
  const {html, visibleItems} = renderMealsWithOptions(payload, options);
  assert.deepEqual(visibleItems.map(item => item.name), ['Chicken & Rice']);
  assert.match(html, /is-favorite/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /Chicken &amp; Rice/);
  assert.doesNotMatch(html, /Carrots/);
});

test('combined view keeps unmatched stations under their correct venue', () => {
  const zone = [{name: 'Lunch', groups: [{name: 'Bakery', items: [{name: 'Zone bread'}]}]}];
  const html = renderCombinedComparison(payload, zone, {});
  const panels = html.split('<article class="venue-panel">').slice(1);
  assert.equal(panels.length, 2);
  assert.match(panels[0], /MSC Dining Facility/);
  assert.doesNotMatch(panels[0], /Zone bread/);
  assert.match(panels[1], /The Zone/);
  assert.match(panels[1], /Zone bread/);
});

test('API empty menus, malformed responses, HTTP errors, retry and caching', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.localStorage = {getItem: () => null, setItem: () => {}};
  let calls = 0;
  let data = payload;
  let status = 200;
  globalThis.fetch = async () => {
    calls++;
    return {ok: status === 200, status, json: async () => data};
  };
  try {
    const [first, second] = await Promise.all([
      fetchMenu('msc', '2026-04-22'), fetchMenu('msc', '2026-04-22'),
    ]);
    assert.deepEqual(first, second);
    assert.equal(calls, 1, 'concurrent requests are deduplicated');
    await fetchMenu('msc', '2026-04-22');
    assert.equal(calls, 1, 'loaded menu is cached');
    data = [];
    assert.deepEqual(await fetchMenu('msc', '2026-10-29'), []);
    data = {message: 'upstream error'};
    await assert.rejects(fetchMenu('zone', '2026-10-29'), /Unexpected menu response/);
    data = payload;
    status = 503;
    await assert.rejects(fetchMenu('zone', '2026-10-29'), /HTTP 503/);
    status = 200;
    assert.deepEqual(await fetchMenu('zone', '2026-10-29'), payload, 'failed requests can be retried');
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.localStorage;
  }
});

test('empty publication and request failures have distinct messages', () => {
  assert.match(renderMealsWithOptions([], {}).html, /No menu published/);
  assert.match(renderMealsWithOptions({error: 'HTTP 503'}, {}).html, /HTTP 503/);
});

test('high-protein comparison includes lunch and dinner for both venues without Add actions', () => {
  const meals = ['Breakfast', 'Lunch', 'Dinner'].map(name => ({name, groups: [{name: 'Grill', items: [
    {name: `${name} chicken`, protein: 25}, {name: `${name} rice`, protein: 4},
  ]}]}));
  const html = renderCombinedComparison(meals, meals, {
    activeFilters: ['highProtein'], mealFilters: ['lunch', 'dinner'],
  });
  assert.equal((html.match(/<h5 class="item-name">Lunch chicken<\/h5>/g) ?? []).length, 2);
  assert.match(html, /Dinner chicken/);
  assert.doesNotMatch(html, /Breakfast chicken|Lunch rice|Dinner rice|data-add-item|calorie tracker/);
  assert.equal((html.match(/class="venue-panel"/g) ?? []).length, 4);
  assert.equal((html.match(/comparison-meal-heading/g) ?? []).length, 2);
});
