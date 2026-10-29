/**
 * Static range menu viewer for Sodexo API (MSC & The Zone, PVAMU).
 */
const API_KEY = "68717828-b754-420d-9488-4c37cb7d7ef7";
const BASE_URL = "https://api-prd.sodexomyway.net/v0.2/data/menu";

const LOCATIONS = {
  msc: { key: "msc", name: "MSC Dining Facility", siteId: "77011001", menuId: "1410735" },
  zone: { key: "zone", name: "The Zone", siteId: "77011012", menuId: "1410982" },
};

const HEADERS = {
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9",
  "api-key": API_KEY,
  authorization: "Bearer",
  "content-type": "application/json",
  origin: "https://pvamu.sodexomyway.com",
  referer: "https://pvamu.sodexomyway.com/",
  "user-agent": "Mozilla/5.0",
};

/** @type {'combined' | 'msc' | 'zone'} */
let venueMode = "combined";

const els = {
  anchorDateInput: document.getElementById("anchor-date-input"),
  rangeTypeSelect: document.getElementById("range-type-select"),
  customStartField: document.getElementById("custom-start-field"),
  customEndField: document.getElementById("custom-end-field"),
  customStartInput: document.getElementById("custom-start-input"),
  customEndInput: document.getElementById("custom-end-input"),
  loadRangeBtn: document.getElementById("load-range-btn"),
  status: document.getElementById("status"),
  content: document.getElementById("content"),
};

const KEYWORDS = {
  beef: ["beef", "steak", "brisket", "burger", "meatball", "meatloaf"],
  chicken: ["chicken", "wing", "drumstick", "nugget", "tender"],
  turkey: ["turkey"],
  pork: ["pork", "bacon", "ham", "sausage", "pepperoni", "prosciutto"],
  vegetarian: ["vegetarian", "veggie", "plant based", "tofu", "lentil", "falafel"],
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseInputDate(v) {
  return new Date(`${v}T12:00:00`);
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function startOfWeekSunday(d) {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12, 0, 0);
}

function endOfYear(d) {
  return new Date(d.getFullYear(), 11, 31, 12, 0, 0);
}

function eachDate(start, end) {
  const out = [];
  let d = new Date(start);
  while (d <= end) {
    out.push(new Date(d));
    d = addDays(d, 1);
  }
  return out;
}

function rangeFromSelection() {
  const rangeType = els.rangeTypeSelect.value;
  const anchor = parseInputDate(els.anchorDateInput.value);

  if (rangeType === "custom") {
    const customStart = parseInputDate(els.customStartInput.value);
    const customEnd = parseInputDate(els.customEndInput.value);
    return {
      rangeType,
      start: customStart <= customEnd ? customStart : customEnd,
      end: customStart <= customEnd ? customEnd : customStart,
    };
  }

  if (rangeType === "week") {
    const start = startOfWeekSunday(anchor);
    const end = addDays(start, 6);
    return { rangeType, start, end };
  }

  if (rangeType === "month") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12, 0, 0);
    return { rangeType, start, end: endOfMonth(anchor) };
  }

  const start = new Date(anchor.getFullYear(), 0, 1, 12, 0, 0);
  return { rangeType: "year", start, end: endOfYear(anchor) };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeMeals(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const o = raw;
    const meals = o.meals ?? o.MealPeriods ?? o.menu;
    if (Array.isArray(meals)) return meals;
  }
  return [];
}

function stationItems(station) {
  const items = station.items ?? station.products ?? station.recipes ?? [];
  return Array.isArray(items) ? items : [];
}

function mealStations(meal) {
  const groups = meal.groups ?? meal.stations ?? meal.Station ?? meal.categories ?? meal.items ?? [];
  return Array.isArray(groups) ? groups : [];
}

function itemDisplayName(item) {
  return String(item.formalName ?? item.name ?? item.title ?? "Item").trim();
}

function itemText(item) {
  const fields = [item.formalName, item.name, item.title, item.description, item.ingredients];
  return fields.filter((x) => typeof x === "string").join(" ").toLowerCase();
}

function includesAny(text, words) {
  return words.some((w) => text.includes(w));
}

function detectItemTags(item) {
  const text = itemText(item);
  const vegetarianByFlag = Boolean(item.isVegetarian || item.isVegan || item.isPlantBased);
  return {
    beef: includesAny(text, KEYWORDS.beef),
    chicken: includesAny(text, KEYWORDS.chicken),
    turkey: includesAny(text, KEYWORDS.turkey),
    pork: includesAny(text, KEYWORDS.pork),
    vegetarian: vegetarianByFlag || includesAny(text, KEYWORDS.vegetarian),
  };
}

function itemCalories(item) {
  const c = item.calories ?? item.calorie ?? item.kcal;
  if (c === null || c === undefined || c === "") return "";
  return `${String(c).trim()} cal`;
}

function flagTag(label, on, css) {
  return `<span class="flag ${css} ${on ? "on" : ""}">[${on ? "x" : " "}] ${label}</span>`;
}

function renderMealsHtml(payload) {
  const meals = normalizeMeals(payload);
  if (!meals.length) return '<p class="empty-note">No menu data found.</p>';
  let html = "";
  for (const meal of meals) {
    if (!meal || typeof meal !== "object") continue;
    const mealName = String(meal.name ?? meal.meal ?? meal.mealPeriod ?? meal.title ?? "Meal");
    let stationHtml = "";
    for (const station of mealStations(meal)) {
      if (!station || typeof station !== "object") continue;
      const stationName = String(station.name ?? station.station ?? station.category ?? "Station");
      let itemsHtml = "";
      for (const item of stationItems(station)) {
        if (!item || typeof item !== "object") continue;
        const name = itemDisplayName(item);
        const cal = itemCalories(item);
        const tags = detectItemTags(item);
        const rowClasses = ["menu-item"];
        if (tags.beef) rowClasses.push("beef");
        if (tags.chicken) rowClasses.push("chicken");
        if (tags.turkey) rowClasses.push("turkey");
        if (tags.pork) rowClasses.push("pork");
        if (tags.vegetarian) rowClasses.push("vegetarian");

        itemsHtml += `
          <div class="${rowClasses.join(" ")}">
            <div class="item-head">
              <span class="item-name">${escapeHtml(name)}</span>
              ${cal ? `<span class="item-cal">${escapeHtml(cal)}</span>` : ""}
            </div>
            <div class="item-flags">
              ${flagTag("Beef", tags.beef, "flag-beef")}
              ${flagTag("Chicken", tags.chicken, "flag-chicken")}
              ${flagTag("Turkey", tags.turkey, "flag-turkey")}
              ${flagTag("Pork", tags.pork, "flag-pork")}
              ${flagTag("Vegetarian", tags.vegetarian, "flag-vegetarian")}
            </div>
          </div>`;
      }
      if (!itemsHtml) continue;
      stationHtml += `
        <div class="station-block">
          <h4 class="station-name">${escapeHtml(stationName)}</h4>
          ${itemsHtml}
        </div>`;
    }
    if (!stationHtml) continue;
    html += `
      <section class="meal-block">
        <h3 class="meal-title">${escapeHtml(mealName)}</h3>
        ${stationHtml}
      </section>`;
  }
  return html || '<p class="empty-note">No stations/items found.</p>';
}

async function fetchMenu(locationKey, isoDate) {
  const loc = LOCATIONS[locationKey];
  const url = `${BASE_URL}/${loc.siteId}/${loc.menuId}?date=${encodeURIComponent(isoDate)}`;
  const res = await fetch(url, { headers: HEADERS, mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function venuePanel(venue, bodyHtml) {
  return `
    <article class="venue-panel">
      <header class="venue-panel-header"><h2>${escapeHtml(LOCATIONS[venue].name)}</h2></header>
      <div class="venue-panel-body">${bodyHtml}</div>
    </article>`;
}

function renderHolidayCard(dayName) {
  return `
    <div class="week-day-card">
      <div class="week-day-header">${escapeHtml(dayName)}</div>
      <div class="week-day-body">
        <article class="venue-panel">
          <header class="venue-panel-header"><h2>Holiday</h2></header>
          <div class="venue-panel-body"><p class="empty-note">Weekend holiday (no menu shown).</p></div>
        </article>
      </div>
    </div>`;
}

function setVenueButtons() {
  document.querySelectorAll("[data-venue]").forEach((btn) => {
    const b = btn;
    const active = b.dataset.venue === venueMode;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function setCustomDateVisibility() {
  const custom = els.rangeTypeSelect.value === "custom";
  els.customStartField.hidden = !custom;
  els.customEndField.hidden = !custom;
}

async function loadRange() {
  const { rangeType, start, end } = rangeFromSelection();
  const days = eachDate(start, end);
  if (days.length > 370) {
    els.status.classList.add("error");
    els.status.textContent = "Custom range too large. Please keep it 370 days or less.";
    return;
  }

  const wantMsc = venueMode === "combined" || venueMode === "msc";
  const wantZone = venueMode === "combined" || venueMode === "zone";
  els.status.classList.remove("error");
  els.status.textContent = `Loading ${rangeType} menu (${days.length} days)...`;
  els.content.innerHTML = "";

  let html = `<div class="legend-row">
      <span class="legend"><span class="legend-swatch beef"></span> Beef</span>
      <span class="legend"><span class="legend-swatch chicken"></span> Chicken</span>
      <span class="legend"><span class="legend-swatch turkey"></span> Turkey</span>
      <span class="legend"><span class="legend-swatch pork"></span> Pork</span>
      <span class="legend"><span class="legend-swatch vegetarian"></span> Vegetarian</span>
    </div><div class="week-grid">`;

  try {
    for (const dateObj of days) {
      const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
      const weekday = dateObj.getDay();
      if (weekday === 0 || weekday === 6) {
        html += renderHolidayCard(dayName);
        continue;
      }

      const iso = formatISODate(dateObj);
      const tasks = [];
      if (wantMsc) tasks.push(fetchMenu("msc", iso).then((data) => ({ venue: "msc", data })));
      if (wantZone) tasks.push(fetchMenu("zone", iso).then((data) => ({ venue: "zone", data })));
      const results = await Promise.all(tasks);
      const byVenue = Object.fromEntries(results.map((r) => [r.venue, r.data]));

      const dayBody = venueMode === "combined"
        ? `<div class="week-combined-inner">
            ${venuePanel("msc", renderMealsHtml(byVenue.msc))}
            ${venuePanel("zone", renderMealsHtml(byVenue.zone))}
          </div>`
        : `<div class="week-single">${venuePanel(venueMode, renderMealsHtml(byVenue[venueMode]))}</div>`;

      html += `
        <div class="week-day-card">
          <div class="week-day-header">${escapeHtml(dayName)}</div>
          <div class="week-day-body">${dayBody}</div>
        </div>`;
    }

    html += "</div>";
    els.content.innerHTML = html;
    const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    els.status.textContent = `Showing ${rangeType} menu from ${startLabel} to ${endLabel}.`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    els.status.classList.add("error");
    els.status.textContent = `Could not load some menus: ${msg}`;
    els.content.innerHTML = '<p class="empty-note">Try again or choose a smaller date range.</p>';
  }
}

function initDates() {
  const today = new Date();
  const iso = formatISODate(today);
  els.anchorDateInput.value = iso;
  els.customStartInput.value = iso;
  els.customEndInput.value = iso;
}

document.querySelectorAll("[data-venue]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const v = btn.dataset.venue;
    if (v !== "combined" && v !== "msc" && v !== "zone") return;
    venueMode = v;
    setVenueButtons();
  });
});

els.rangeTypeSelect.addEventListener("change", () => setCustomDateVisibility());
els.loadRangeBtn.addEventListener("click", () => loadRange());

initDates();
setVenueButtons();
setCustomDateVisibility();
loadRange();
