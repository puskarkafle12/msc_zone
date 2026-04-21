import { BASE_URL, LOCATIONS, REQUEST_HEADERS } from "../config.js";

export async function fetchMenu(locationKey, isoDate) {
  const location = LOCATIONS[locationKey];
  const url = `${BASE_URL}/${location.siteId}/${location.locationId}?date=${encodeURIComponent(isoDate)}`;
  const response = await fetch(url, { headers: REQUEST_HEADERS, mode: "cors" });
  if (!response.ok) {
    throw new Error(`Failed ${location.name} (${isoDate}) with HTTP ${response.status}`);
  }
  return response.json();
}

export function normalizeMeals(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const meals = payload.meals ?? payload.MealPeriods ?? payload.menu;
    if (Array.isArray(meals)) return meals;
  }
  return [];
}
