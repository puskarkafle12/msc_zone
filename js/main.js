import { formatISODate, fromInputDate, dateRangeForType, eachDate } from "./utils/date.js";
import { fetchMenu, normalizeMeals } from "./services/menuApi.js";
import { renderMealsWithOptions, renderVenuePanel, renderDayCard, renderCombinedComparison, escapeHtml } from "./components/menuRenderer.js";

/** @type {'combined' | 'msc' | 'zone'} */
let venueMode = "combined";
let selectedMeal = "lunch";
let favoritesOnly = false;
let menuLoadId = 0;
let lastRenderText = "";
const FAVORITES_KEY = "pvamu_menu_favorites_v1";

const els = {
  tabMenuBtn: document.getElementById("tab-menu-btn"),
  tabShareBtn: document.getElementById("tab-share-btn"),
  tabAboutBtn: document.getElementById("tab-about-btn"),
  menuPage: document.getElementById("menu-page"),
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
  shareLinkInput: document.getElementById("share-link-input"),
  copyShareLinkBtn: document.getElementById("copy-share-link-btn"),
  shareQrImg: document.getElementById("share-qr-img"),
  status: document.getElementById("status"),
  content: document.getElementById("content"),
};

function activeFilters() {
  return [...document.querySelectorAll("[data-filter]:checked")].map((node) => node.value);
}

function filtersIncludeHighProtein() {
  return activeFilters().includes("highProtein");
}

function activeMealFilters() {
  return selectedMeal === "lunchDinner" ? ["lunch", "dinner"] : [selectedMeal];
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

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

function setActiveTab(tab) {
  const menu = tab === "menu";
  const share = tab === "share";
  const about = tab === "about";
  els.menuPage.hidden = !menu;
  els.sharePage.hidden = !share;
  els.aboutPage.hidden = !about;
  els.tabMenuBtn.classList.toggle("active", menu);
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
  els.anchorDateInput.value = todayIso;
  els.customStartInput.value = todayIso;
  els.customEndInput.value = todayIso;
  els.rangeTypeSelect.value = "today";
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

  const all = await Promise.allSettled(tasks);
  const keys = [needMsc ? "msc" : null, needZone ? "zone" : null].filter(Boolean);
  return Object.fromEntries(all.map((result, index) => result.status === "fulfilled"
    ? [result.value.key, result.value.data]
    : [keys[index], { error: result.reason instanceof Error ? result.reason.message : "Menu request failed." }]));
}

function wireFavoriteButtons() {
  const favorites = loadFavorites();
  els.content.querySelectorAll("[data-favorite-name]").forEach((button) => {
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

function renderSavedFavorites() {
  const favorites = loadFavorites();
  document.getElementById("favorites-count").textContent = favorites.size;
  const saved = document.getElementById("saved-favorites");
  saved.replaceChildren();
  for (const name of favorites) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "saved-favorite";
    button.textContent = `★ ${name} ×`;
    button.setAttribute("aria-label", `Remove ${name} from favourites`);
    button.addEventListener("click", () => {
      const current = loadFavorites();
      current.delete(name);
      saveFavorites(current);
      loadMenus();
    });
    saved.append(button);
  }
  document.getElementById("favorite-matches").textContent = favorites.size
    ? "Checking today's favourites…"
    : "Tap ★ on any menu item to keep your favourites here. Saved on this device.";
}

async function renderTodayFavorites(loadId) {
  const favorites = loadFavorites();
  if (!favorites.size) return;
  const today = formatISODate(new Date());
  const results = await Promise.allSettled(["msc", "zone"].map(async (venue) => {
    const payload = await fetchMenu(venue, today);
    const matches = [];
    for (const meal of normalizeMeals(payload)) {
      const mealName = String(meal.name ?? meal.meal ?? meal.mealPeriod ?? meal.title ?? "Meal");
      const groups = meal.groups ?? meal.stations ?? meal.Station ?? meal.categories ?? meal.items ?? [];
      for (const group of Array.isArray(groups) ? groups : []) {
        const items = group.items ?? group.products ?? group.recipes ?? [];
        for (const item of Array.isArray(items) ? items : []) {
          const name = String(item.formalName ?? item.name ?? item.title ?? "Item").trim();
          if (favorites.has(name.toLowerCase())) matches.push({name, mealName, venue});
        }
      }
    }
    return matches;
  }));
  if (loadId !== menuLoadId) return;
  const matches = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
  const unique = [...new Map(matches.map(m => [`${m.name}:${m.venue}:${m.mealName}`, m])).values()];
  const target = document.getElementById("favorite-matches");
  target.innerHTML = unique.map(m => `<article class="favorite-match"><strong>★ ${escapeHtml(m.name)}</strong><span>Today · ${m.venue === "msc" ? "MSC" : "The Zone"} · ${escapeHtml(m.mealName)}</span></article>`).join("");
  const note = document.createElement("p");
  note.className = "favorites-note";
  note.textContent = results.some(r => r.status === "rejected")
    ? "Some menus could not be checked. Your saved favourites are still above."
    : unique.length ? "Today's matches across both venues and all meals. Menu filters apply below."
    : "No saved favourites on today's published menus. Your saved list stays here.";
  target.append(note);
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
  const loadId = ++menuLoadId;
  renderSavedFavorites();
  renderTodayFavorites(loadId).catch(() => {});
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

      const iso = formatISODate(date);
      const byVenue = await fetchByVenue(iso);
      if (loadId !== menuLoadId) return;
      const filters = activeFilters();
      const mealFilters = activeMealFilters();
      const favorites = loadFavorites();
      let panelBody = "";
      if (venueMode === "combined") {
        panelBody = renderCombinedComparison(byVenue.msc, byVenue.zone, {
          activeFilters: filters,
          favoritesOnly,
          favorites,
          mealFilters,
          hideMealTitles: mealFilters.length === 1,
          dayLabel: label,
        });
      } else {
        const single = renderMealsWithOptions(byVenue[venueMode], {
          activeFilters: filters,
          favoritesOnly,
          favorites,
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
      setStatus(range.start.toDateString() === new Date().toDateString()
        ? "Showing today’s menu."
        : `Showing menu for ${range.start.toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"})}.`);
    } else {
      const startLabel = range.start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const endLabel = range.end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      setStatus(`Showing ${range.type} menu from ${startLabel} to ${endLabel}.`);
    }

    wireFavoriteButtons();
    if (filtersIncludeHighProtein()) {
      els.status.textContent += " High protein: 15g+ per item.";
    }
    lastRenderText = createCopyText();

  } catch (error) {
    if (loadId !== menuLoadId) return;
    setStatus(error instanceof Error ? error.message : String(error), true);
    els.content.innerHTML = '<p class="empty-note">Unable to load menu right now. Please try again.</p>';
  }
}

document.getElementById("favorites-only-btn").addEventListener("click", (event) => {
  favoritesOnly = !favoritesOnly;
  event.currentTarget.setAttribute("aria-pressed", String(favoritesOnly));
  event.currentTarget.textContent = favoritesOnly ? "Show all items" : "Favourites only";
  loadMenus();
});

els.rangeTypeSelect.addEventListener("change", setCustomFieldsVisibility);
els.loadRangeBtn.addEventListener("click", loadMenus);
els.toggleControlsBtn.addEventListener("click", () => {
  const willShow = els.rangePanel.hidden;
  els.rangePanel.hidden = !willShow;
  els.toggleControlsBtn.setAttribute("aria-expanded", String(willShow));
  els.toggleControlsBtn.textContent = willShow ? "Hide options" : "Dates & options";
});
els.clearFiltersBtn.addEventListener("click", () => {
  document.querySelectorAll("[data-filter]").forEach((node) => {
    node.checked = false;
  });
  loadMenus();
});
document.querySelectorAll("[data-filter]").forEach((node) => {
  node.addEventListener("change", () => {
    if (node.value === "highProtein" && node.checked) {
      selectedMeal = "lunchDinner";
      venueMode = "combined";
      setMealButtons();
      setVenueButtons();
    }
    loadMenus();
  });
});
document.querySelectorAll("[data-meal-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    const meal = button.dataset.mealTab;
    if (meal !== "breakfast" && meal !== "lunch" && meal !== "dinner" && meal !== "lunchDinner") return;
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
els.tabMenuBtn.addEventListener("click", () => setActiveTab("menu"));
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
loadMenus();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // Fail silently so UI is unaffected if SW registration fails.
    });
  });
}
