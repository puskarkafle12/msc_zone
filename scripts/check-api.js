import { BASE_URL, LOCATIONS, REQUEST_HEADERS } from '../js/config.js';
import { normalizeMeals } from '../js/services/menuApi.js';

const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
}).formatToParts(new Date()).map(p => [p.type, p.value]));
const date = process.argv[2] ?? `${parts.year}-${parts.month}-${parts.day}`;
const slugs = {msc: 'msc-dining-facility', zone: 'the-zone'};
let failed = false;

function menuMetadata(value, siteId) {
  if (!value || typeof value !== 'object') return null;
  if (String(value.locationId) === siteId && value.menuId) return String(value.menuId);
  for (const child of Object.values(value)) {
    const found = menuMetadata(child, siteId);
    if (found) return found;
  }
  return null;
}

for (const [key, location] of Object.entries(LOCATIONS)) {
  try {
    const officialUrl = `https://pvamu.sodexomyway.com/en-us/locations/${slugs[key]}`;
    const official = await fetch(officialUrl, {signal: AbortSignal.timeout(20000)});
    if (!official.ok) throw new Error(`Official page: HTTP ${official.status}`);
    const html = await official.text();
    const match = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{.*?\})\s*;?\s*<\/script>/s);
    if (!match) throw new Error('Could not verify menu configuration on the official page');
    const currentId = menuMetadata(JSON.parse(match[1]), location.siteId);
    if (currentId !== location.menuId) throw new Error(`Menu ID changed: configured ${location.menuId}, official ${currentId}`);
    const response = await fetch(`${BASE_URL}/${location.siteId}/${location.menuId}?date=${date}`, {
      headers: REQUEST_HEADERS, signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Menu API: HTTP ${response.status}`);
    const meals = normalizeMeals(await response.json());
    const count = meals.reduce((total, meal) => total + (meal.groups ?? []).reduce((n, group) => n + (group.items ?? []).length, 0), 0);
    console.log(`${location.name}: official ID verified; ${date}: ${count} items, ${meals.length} meals${count ? '' : ' (empty response)'}`);
  } catch (error) {
    failed = true;
    console.error(`${location.name}: ${error.message}`);
  }
}
if (failed) process.exitCode = 1;
