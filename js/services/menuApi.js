import { BASE_URL, LOCATIONS, REQUEST_HEADERS } from "../config.js";

const CACHE_KEY = "pvamu_menu_cache_v1";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const memoryCache = new Map();
const pendingRequests = new Map();

function cacheId(locationKey, isoDate) {
  const location = LOCATIONS[locationKey];
  return `${locationKey}::${location.siteId}::${location.menuId}::${isoDate}`;
}

function loadPersistedCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function savePersistedCache(store) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage limits/errors and continue with memory cache.
  }
}

function readCache(locationKey, isoDate) {
  const key = cacheId(locationKey, isoDate);
  const fromMemory = memoryCache.get(key);
  if (fromMemory && Date.now() - fromMemory.savedAt <= CACHE_TTL_MS) {
    return fromMemory.data;
  }

  const persisted = loadPersistedCache();
  const row = persisted[key];
  if (!row || typeof row !== "object") return null;
  if (Date.now() - row.savedAt > CACHE_TTL_MS) return null;

  memoryCache.set(key, row);
  return row.data;
}

function writeCache(locationKey, isoDate, data) {
  const key = cacheId(locationKey, isoDate);
  const row = { savedAt: Date.now(), data };
  memoryCache.set(key, row);
  const persisted = loadPersistedCache();
  persisted[key] = row;
  savePersistedCache(persisted);
}

export async function fetchMenu(locationKey, isoDate) {
  const cached = readCache(locationKey, isoDate);
  if (cached) return cached;

  const requestKey = cacheId(locationKey, isoDate);
  const existingPending = pendingRequests.get(requestKey);
  if (existingPending) return existingPending;

  const location = LOCATIONS[locationKey];
  const url = `${BASE_URL}/${location.siteId}/${location.menuId}?date=${encodeURIComponent(isoDate)}`;
  const pending = fetch(url, { headers: REQUEST_HEADERS, mode: "cors", signal: AbortSignal.timeout(20000) })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed ${location.name} (${isoDate}) with HTTP ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (!Array.isArray(data) && !(data && typeof data === "object" &&
        [data.meals, data.MealPeriods, data.menu].some(Array.isArray))) {
        throw new Error(`Unexpected menu response from ${location.name}`);
      }
      writeCache(locationKey, isoDate, data);
      return data;
    })
    .catch((error) => {
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        throw new Error(`${location.name} took too long to respond. Please try again`);
      }
      throw error;
    })
    .finally(() => {
      pendingRequests.delete(requestKey);
    });

  pendingRequests.set(requestKey, pending);
  return pending;
}

export function normalizeMeals(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const meals = payload.meals ?? payload.MealPeriods ?? payload.menu;
    if (Array.isArray(meals)) return meals;
  }
  return [];
}
