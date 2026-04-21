import { formatISODate, fromInputDate, dateRangeForType, eachDate } from "./utils/date.js";
import { fetchMenu, normalizeMeals } from "./services/menuApi.js";
import { renderMealsWithOptions, renderVenuePanel, renderHolidayCard, renderDayCard, renderCombinedComparison } from "./components/menuRenderer.js";

/** @type {'combined' | 'msc' | 'zone'} */
let venueMode = "combined";
let selectedMeal = "lunch";
let lastRenderText = "";
const FAVORITES_KEY = "pvamu_menu_favorites_v1";
const CALORIE_LOG_KEY = "pvamu_calorie_log_v1";

const els = {
  tabMenuBtn: document.getElementById("tab-menu-btn"),
  tabTrackerBtn: document.getElementById("tab-tracker-btn"),
  tabShareBtn: document.getElementById("tab-share-btn"),
  tabAboutBtn: document.getElementById("tab-about-btn"),
  menuPage: document.getElementById("menu-page"),
  trackerPage: document.getElementById("tracker-page"),
  sharePage: document.getElementById("share-page"),
  aboutPage: document.getElementById("about-page"),
  toggleControlsBtn: document.getElementById("toggle-controls-btn"),
  rangePanel: document.getElementById("range-panel"),
  anchorDateInput: document.getElementById("anchor-date-input"),
  rangeTypeSelect: document.getElementById("range-type-select"),
  customStartField: document.getElementById("custom-start-field"),
  customEndField: document.getElementById("custom-end-field"),
  customStartInput: document.getElementById("custom-start-input"),
  customEndInput: document.getElementById("custom-end-input"),
  loadRangeBtn: document.getElementById("load-range-btn"),
  copyMenuBtn: document.getElementById("copy-menu-btn"),
  clearFiltersBtn: document.getElementById("clear-filters-btn"),
  trackerDateInput: document.getElementById("tracker-date-input"),
  graphStartInput: document.getElementById("graph-start-input"),
  graphEndInput: document.getElementById("graph-end-input"),
  graphGroupSelect: document.getElementById("graph-group-select"),
  trackerGraph: document.getElementById("tracker-graph"),
  trackerTotal: document.getElementById("tracker-total"),
  trackerList: document.getElementById("tracker-list"),
  shareLinkInput: document.getElementById("share-link-input"),
  copyShareLinkBtn: document.getElementById("copy-share-link-btn"),
  shareQrImg: document.getElementById("share-qr-img"),
  status: document.getElementById("status"),
  todayFavStatus: document.getElementById("today-fav-status"),
  upcomingStatus: document.getElementById("upcoming-status"),
  content: document.getElementById("content"),
};

function activeFilters() {
  return [...document.querySelectorAll("[data-filter]:checked")].map((node) => node.value);
}

function activeMealFilters() {
  return selectedMeal ? [selectedMeal] : [];
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const values = JSON.parse(raw);
    if (!Array.isArray(values)) return new Set();
    return new Set(values.map((x) => String(x).toLowerCase()));
  } catch {
    return new Set();
  }
}

function saveFavorites(set) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set.values()]));
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

function setUpcomingStatus(message) {
  if (!message) {
    els.upcomingStatus.hidden = true;
    els.upcomingStatus.textContent = "";
    return;
  }
  els.upcomingStatus.hidden = false;
  els.upcomingStatus.textContent = message;
}

function setTodayFavoriteStatus(message) {
  if (!message) {
    els.todayFavStatus.hidden = true;
    els.todayFavStatus.textContent = "";
    return;
  }
  els.todayFavStatus.hidden = false;
  els.todayFavStatus.textContent = message;
}

function setActiveTab(tab) {
  const menu = tab === "menu";
  const tracker = tab === "tracker";
  const share = tab === "share";
  const about = tab === "about";
  els.menuPage.hidden = !menu;
  els.trackerPage.hidden = !tracker;
  els.sharePage.hidden = !share;
  els.aboutPage.hidden = !about;
  els.tabMenuBtn.classList.toggle("active", menu);
  els.tabTrackerBtn.classList.toggle("active", tracker);
  els.tabShareBtn.classList.toggle("active", share);
  els.tabAboutBtn.classList.toggle("active", about);
}

function setCustomFieldsVisibility() {
  const isCustom = els.rangeTypeSelect.value === "custom";
  els.customStartField.hidden = !isCustom;
  els.customEndField.hidden = !isCustom;
}

function setVenueButtons() {
  document.querySelectorAll("[data-venue]").forEach((button) => {
    const active = button.dataset.venue === venueMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function setMealButtons() {
  document.querySelectorAll("[data-meal-tab]").forEach((button) => {
    const active = button.dataset.mealTab === selectedMeal;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function initDates() {
  const today = new Date();
  const todayIso = formatISODate(today);
  const rangeStart = new Date(today);
  rangeStart.setDate(today.getDate() - 6);
  els.anchorDateInput.value = todayIso;
  els.customStartInput.value = todayIso;
  els.customEndInput.value = todayIso;
  els.rangeTypeSelect.value = "today";
  els.trackerDateInput.value = todayIso;
  els.graphStartInput.value = formatISODate(rangeStart);
  els.graphEndInput.value = todayIso;
  els.graphGroupSelect.value = "daily";
  const shareUrl = window.location.href;
  els.shareLinkInput.value = shareUrl;
  els.shareQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareUrl)}`;
}

async function fetchByVenue(isoDate) {
  const needMsc = venueMode === "combined" || venueMode === "msc";
  const needZone = venueMode === "combined" || venueMode === "zone";
  const tasks = [];

  if (needMsc) tasks.push(fetchMenu("msc", isoDate).then((data) => ({ key: "msc", data })));
  if (needZone) tasks.push(fetchMenu("zone", isoDate).then((data) => ({ key: "zone", data })));

  const all = await Promise.all(tasks);
  return Object.fromEntries(all.map((item) => [item.key, item.data]));
}

function loadCalorieLogStore() {
  try {
    const raw = localStorage.getItem(CALORIE_LOG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function todayTrackerCountsMap() {
  const day = formatISODate(new Date());
  const store = loadCalorieLogStore();
  const list = Array.isArray(store[day]) ? store[day] : [];
  const counts = new Map();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const name = String(item.name ?? "").trim();
    if (!name) continue;
    const qty = Number(item.quantity) || 0;
    if (qty > 0) counts.set(name.toLowerCase(), qty);
  }
  return counts;
}

function saveCalorieLogStore(store) {
  localStorage.setItem(CALORIE_LOG_KEY, JSON.stringify(store));
}

function addCalorieEntry({ name, quantity, caloriesPerUnit }) {
  const day = formatISODate(new Date());
  const store = loadCalorieLogStore();
  const list = Array.isArray(store[day]) ? store[day] : [];
  const key = String(name).toLowerCase();
  const existing = list.find((item) => String(item.name).toLowerCase() === key);
  if (existing) {
    existing.quantity = (Number(existing.quantity) || 0) + quantity;
    existing.caloriesPerUnit = Number.isFinite(caloriesPerUnit) && caloriesPerUnit > 0
      ? caloriesPerUnit
      : (Number(existing.caloriesPerUnit) || 0);
    existing.totalCalories = (Number(existing.quantity) || 0) * (Number(existing.caloriesPerUnit) || 0);
    existing.addedAt = new Date().toISOString();
  } else {
    list.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name,
      quantity,
      caloriesPerUnit,
      totalCalories: caloriesPerUnit * quantity,
      addedAt: new Date().toISOString(),
    });
  }
  store[day] = list;
  saveCalorieLogStore(store);
}

function removeCalorieEntry(day, entryId) {
  const store = loadCalorieLogStore();
  const list = Array.isArray(store[day]) ? store[day] : [];
  store[day] = list.filter((item) => item.id !== entryId);
  saveCalorieLogStore(store);
}

function renderTracker() {
  const day = els.trackerDateInput.value || formatISODate(new Date());
  const store = loadCalorieLogStore();
  const list = Array.isArray(store[day]) ? store[day] : [];
  const total = list.reduce((sum, item) => sum + (Number(item.totalCalories) || 0), 0);
  els.trackerTotal.textContent = `Total: ${Math.round(total)} kcal`;

  if (!list.length) {
    els.trackerList.innerHTML = '<p class="empty-note">No entries yet for this day.</p>';
    return;
  }

  els.trackerList.innerHTML = list
    .map(
      (item) => `
      <div class="tracker-item">
        <div>
          <p class="tracker-item-name">${item.name}</p>
          <p class="tracker-item-meta">${item.quantity} x ${Math.round(item.caloriesPerUnit)} kcal = <strong>${Math.round(item.totalCalories)} kcal</strong></p>
        </div>
        <button type="button" class="btn tiny" data-delete-entry="${item.id}" data-delete-day="${day}">Delete</button>
      </div>`
    )
    .join("");

  els.trackerList.querySelectorAll("[data-delete-entry]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-delete-entry");
      const d = button.getAttribute("data-delete-day");
      removeCalorieEntry(d, id);
      renderTracker();
      renderCalorieGraph();
    });
  });
}

function graphRangeDates() {
  const start = fromInputDate(els.graphStartInput.value);
  const end = fromInputDate(els.graphEndInput.value);
  return start <= end ? { start, end } : { start: end, end: start };
}

function weekKey(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return formatISODate(d);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function aggregateCaloriesForGraph() {
  const store = loadCalorieLogStore();
  const { start, end } = graphRangeDates();
  const groupBy = els.graphGroupSelect.value;
  const days = eachDate(start, end);
  const map = new Map();

  for (const day of days) {
    const iso = formatISODate(day);
    const list = Array.isArray(store[iso]) ? store[iso] : [];
    const total = list.reduce((sum, item) => sum + (Number(item.totalCalories) || 0), 0);
    let key = iso;
    if (groupBy === "weekly") key = weekKey(day);
    if (groupBy === "monthly") key = monthKey(day);
    map.set(key, (map.get(key) || 0) + total);
  }

  const rows = [...map.entries()].map(([key, total]) => ({ key, total }));
  rows.sort((a, b) => a.key.localeCompare(b.key));
  return rows;
}

function prettyGraphLabel(key, groupBy) {
  if (groupBy === "daily") {
    const d = fromInputDate(key);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (groupBy === "weekly") {
    const d = fromInputDate(key);
    return `Wk ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  const [year, month] = key.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function renderCalorieGraph() {
  const rows = aggregateCaloriesForGraph();
  if (!rows.length || rows.every((r) => r.total === 0)) {
    els.trackerGraph.innerHTML = '<p class="graph-empty">No calories in this range yet.</p>';
    return;
  }

  const max = Math.max(...rows.map((r) => r.total), 1);
  const groupBy = els.graphGroupSelect.value;
  const bars = rows
    .map((row) => {
      const heightPct = Math.max(4, (row.total / max) * 100);
      return `
        <div class="bar-wrap">
          <div class="bar-value">${Math.round(row.total)}</div>
          <div class="bar" style="height:${heightPct}%"></div>
          <div class="bar-label">${prettyGraphLabel(row.key, groupBy)}</div>
        </div>`;
    })
    .join("");

  els.trackerGraph.innerHTML = `<div class="graph-bars">${bars}</div>`;
}

function wireFavoriteButtons() {
  const favorites = loadFavorites();
  document.querySelectorAll("[data-favorite-name]").forEach((button) => {
    button.addEventListener("click", () => {
      const rawName = button.getAttribute("data-favorite-name") || "";
      const key = rawName.toLowerCase();
      if (favorites.has(key)) favorites.delete(key);
      else favorites.add(key);
      saveFavorites(favorites);
      loadMenus();
    });
  });
}

function wireAddButtons() {
  document.querySelectorAll("[data-add-item]").forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.getAttribute("data-add-item") || "Item";
      const rawCalories = Number.parseFloat(button.getAttribute("data-add-calories") || "");
      const caloriesPerUnit = Number.isFinite(rawCalories) && rawCalories > 0 ? rawCalories : 0;
      const quantity = 1;

      addCalorieEntry({ name, quantity, caloriesPerUnit });
      renderTracker();
      renderCalorieGraph();
      const card = button.closest(".menu-item");
      const badge = card ? card.querySelector("[data-add-count-for]") : null;
      if (badge instanceof HTMLElement) {
        const counts = todayTrackerCountsMap();
        const qty = counts.get(name.toLowerCase()) || 0;
        if (qty > 0) {
          badge.textContent = String(qty);
          badge.hidden = false;
        } else {
          badge.hidden = true;
          badge.textContent = "";
        }
      }
    });
  });
}

async function getUpcomingWeekFavoritesText() {
  const favorites = loadFavorites();
  if (!favorites.size) return "";

  const today = new Date();
  const future = new Date(today);
  future.setDate(today.getDate() + 6);
  const days = eachDate(today, future);
  const matches = [];

  for (const day of days) {
    if (isWeekend(day)) continue;
    const iso = formatISODate(day);
    const byVenue = await fetchByVenue(iso);
    const label = day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const mealFilters = activeMealFilters();

    /** @param {unknown} payload @param {"MSC"|"ZONE"} venueLabel */
    const collectMatches = (payload, venueLabel) => {
      const meals = normalizeMeals(payload);
      for (const meal of meals) {
        if (!meal || typeof meal !== "object") continue;
        const mealName = String(meal.name ?? meal.meal ?? meal.mealPeriod ?? meal.title ?? "Meal");
        const mealText = mealName.toLowerCase();
        if (mealFilters.length && !mealFilters.some((k) => mealText.includes(k))) continue;
        const groups = meal.groups ?? meal.stations ?? meal.Station ?? meal.categories ?? meal.items ?? [];
        if (!Array.isArray(groups)) continue;
        for (const group of groups) {
          if (!group || typeof group !== "object") continue;
          const items = group.items ?? group.products ?? group.recipes ?? [];
          if (!Array.isArray(items)) continue;
          for (const item of items) {
            if (!item || typeof item !== "object") continue;
            const name = String(item.formalName ?? item.name ?? item.title ?? "Item").trim();
            if (!favorites.has(name.toLowerCase())) continue;
            matches.push(`${name} (${label}, ${venueLabel}, ${mealName})`);
          }
        }
      }
    };

    if (venueMode === "combined" || venueMode === "msc") {
      collectMatches(byVenue.msc, "MSC");
    }
    if (venueMode === "combined" || venueMode === "zone") {
      collectMatches(byVenue.zone, "ZONE");
    }
  }

  const unique = [...new Set(matches)].slice(0, 10);
  if (!unique.length) return "Upcoming week favorites found: none";
  return `Upcoming week favorites found: ${unique.join(", ")}`;
}

async function getTodayFavoritesText() {
  const favorites = loadFavorites();
  if (!favorites.size) return "";
  const today = new Date();
  if (isWeekend(today)) return "Today's favorite items: none (holiday/weekend)";
  const iso = formatISODate(today);
  const byVenue = await fetchByVenue(iso);
  const found = [];

  const collect = (payload, venueLabel) => {
    const meals = normalizeMeals(payload);
    for (const meal of meals) {
      if (!meal || typeof meal !== "object") continue;
      const mealName = String(meal.name ?? meal.meal ?? meal.mealPeriod ?? meal.title ?? "Meal");
      const groups = meal.groups ?? meal.stations ?? meal.Station ?? meal.categories ?? meal.items ?? [];
      if (!Array.isArray(groups)) continue;
      for (const group of groups) {
        if (!group || typeof group !== "object") continue;
        const items = group.items ?? group.products ?? group.recipes ?? [];
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          if (!item || typeof item !== "object") continue;
          const name = String(item.formalName ?? item.name ?? item.title ?? "Item").trim();
          if (!favorites.has(name.toLowerCase())) continue;
          found.push(`${name} (${venueLabel}, ${mealName})`);
        }
      }
    }
  };

  if (venueMode === "combined" || venueMode === "msc") collect(byVenue.msc, "MSC");
  if (venueMode === "combined" || venueMode === "zone") collect(byVenue.zone, "ZONE");
  const unique = [...new Set(found)].slice(0, 10);
  if (!unique.length) return "Today's favorite items: none";
  return `Today's favorite items: ${unique.join(", ")}`;
}

function createCopyText() {
  const pageText = els.content.innerText.replace(/\n{3,}/g, "\n\n").trim();
  return `PVAMU Menu Export\n\n${els.status.textContent}\n\n${pageText}`;
}

async function buildFullCopyText() {
  const anchor = fromInputDate(els.anchorDateInput.value);
  const customStart = fromInputDate(els.customStartInput.value);
  const customEnd = fromInputDate(els.customEndInput.value);
  const range = dateRangeForType(els.rangeTypeSelect.value, anchor, customStart, customEnd);
  const days = eachDate(range.start, range.end);
  const filters = activeFilters();
  const favorites = loadFavorites();
  let out = [`PVAMU Menu Export`, `Range: ${range.type}`, ``];

  for (const date of days) {
    if (isWeekend(date)) continue;
    const iso = formatISODate(date);
    const dayLabel = date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const byVenue = await fetchByVenue(iso);

    const renderPlain = (html) =>
      html
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    out.push(`## ${dayLabel}`);
    if (venueMode === "combined" || venueMode === "msc") {
      const m = renderMealsWithOptions(byVenue.msc, {
        activeFilters: filters,
        favorites,
        mealFilters: [],
        hideMealTitles: false,
      });
      out.push(`MSC: ${renderPlain(m.html)}`);
    }
    if (venueMode === "combined" || venueMode === "zone") {
      const z = renderMealsWithOptions(byVenue.zone, {
        activeFilters: filters,
        favorites,
        mealFilters: [],
        hideMealTitles: false,
      });
      out.push(`ZONE: ${renderPlain(z.html)}`);
    }
    out.push("");
  }

  return out.join("\n").trim();
}

async function loadMenus() {
  const anchor = fromInputDate(els.anchorDateInput.value);
  const customStart = fromInputDate(els.customStartInput.value);
  const customEnd = fromInputDate(els.customEndInput.value);
  const range = dateRangeForType(els.rangeTypeSelect.value, anchor, customStart, customEnd);
  const days = eachDate(range.start, range.end);

  if (days.length > 370) {
    setStatus("Please keep custom range to 370 days or less.", true);
    return;
  }

  setStatus(`Loading ${range.type} menu...`);
  setTodayFavoriteStatus("");
  setUpcomingStatus("");
  const trackerCounts = todayTrackerCountsMap();
  els.content.innerHTML = "";
  let html = '<section class="menu-stack">';
  try {
    for (const date of days) {
      const label = date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      if (isWeekend(date)) {
        html += renderHolidayCard(label);
        continue;
      }

      const iso = formatISODate(date);
      const byVenue = await fetchByVenue(iso);
      const filters = activeFilters();
      const mealFilters = activeMealFilters();
      const favorites = loadFavorites();
      let panelBody = "";
      if (venueMode === "combined") {
        panelBody = renderCombinedComparison(byVenue.msc, byVenue.zone, {
          activeFilters: filters,
          favorites,
          trackerCounts,
          mealFilters,
          hideMealTitles: mealFilters.length === 1,
          dayLabel: label,
        });
      } else {
        const single = renderMealsWithOptions(byVenue[venueMode], {
          activeFilters: filters,
          favorites,
          trackerCounts,
          mealFilters,
          hideMealTitles: mealFilters.length === 1,
          dayLabel: label,
        });
        panelBody = `<div class="single-grid">${renderVenuePanel(venueMode, single.html)}</div>`;
      }
      html += renderDayCard(label, panelBody);
    }

    html += "</section>";
    els.content.innerHTML = html;

    if (range.type === "today") {
      setStatus("Showing today's menu.");
    } else {
      const startLabel = range.start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const endLabel = range.end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      setStatus(`Showing ${range.type} menu from ${startLabel} to ${endLabel}.`);
    }

    wireFavoriteButtons();
    wireAddButtons();
    lastRenderText = createCopyText();
    const todayFavText = await getTodayFavoritesText();
    setTodayFavoriteStatus(todayFavText);
    setUpcomingStatus("");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
    setTodayFavoriteStatus("");
    setUpcomingStatus("");
    els.content.innerHTML = '<p class="empty-note">Unable to load menu right now. Please try again.</p>';
  }
}

els.rangeTypeSelect.addEventListener("change", setCustomFieldsVisibility);
els.loadRangeBtn.addEventListener("click", loadMenus);
els.toggleControlsBtn.addEventListener("click", () => {
  const willShow = els.rangePanel.hidden;
  els.rangePanel.hidden = !willShow;
  els.toggleControlsBtn.textContent = willShow ? "Hide controls" : "Show controls";
});
els.clearFiltersBtn.addEventListener("click", () => {
  document.querySelectorAll("[data-filter]").forEach((node) => {
    node.checked = false;
  });
  loadMenus();
});
document.querySelectorAll("[data-filter]").forEach((node) => {
  node.addEventListener("change", () => loadMenus());
});
document.querySelectorAll("[data-meal-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    const meal = button.dataset.mealTab;
    if (meal !== "breakfast" && meal !== "lunch" && meal !== "dinner") return;
    selectedMeal = meal;
    setMealButtons();
    loadMenus();
  });
});
els.copyMenuBtn.addEventListener("click", async () => {
  try {
    const fullText = await buildFullCopyText();
    await navigator.clipboard.writeText(fullText || lastRenderText || createCopyText());
    setStatus("Menu copied. You can paste it into ChatGPT.");
  } catch {
    setStatus("Clipboard copy failed. Please copy manually.", true);
  }
});
els.trackerDateInput.addEventListener("change", renderTracker);
els.graphStartInput.addEventListener("change", renderCalorieGraph);
els.graphEndInput.addEventListener("change", renderCalorieGraph);
els.graphGroupSelect.addEventListener("change", renderCalorieGraph);
els.tabMenuBtn.addEventListener("click", () => setActiveTab("menu"));
els.tabTrackerBtn.addEventListener("click", () => {
  setActiveTab("tracker");
  renderTracker();
  renderCalorieGraph();
});
els.tabShareBtn.addEventListener("click", () => setActiveTab("share"));
els.tabAboutBtn.addEventListener("click", () => setActiveTab("about"));
els.copyShareLinkBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(els.shareLinkInput.value);
    setStatus("Share link copied.");
  } catch {
    setStatus("Unable to copy share link.", true);
  }
});

document.querySelectorAll("[data-venue]").forEach((button) => {
  button.addEventListener("click", () => {
    const selected = button.dataset.venue;
    if (selected !== "combined" && selected !== "msc" && selected !== "zone") return;
    venueMode = selected;
    setVenueButtons();
    loadMenus();
  });
});

initDates();
setVenueButtons();
setMealButtons();
setCustomFieldsVisibility();
setActiveTab("menu");
renderTracker();
renderCalorieGraph();
loadMenus();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // Fail silently so UI is unaffected if SW registration fails.
    });
  });
}
