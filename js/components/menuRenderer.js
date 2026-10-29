import { LOCATIONS } from "../config.js";
import { normalizeMeals } from "../services/menuApi.js";
import { classifyItem, displayCalories, displayProtein } from "../services/classifier.js";
import { buildNutrition, itemMatchesFilters, isHealthy, isHighProtein, recommendationScore } from "../services/filtering.js";

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function itemName(item) {
  return String(item.formalName ?? item.name ?? item.title ?? "Item").trim();
}

function canonicalMealKey(name) {
  const t = String(name || "").toLowerCase();
  if (t.includes("lunch")) return "lunch";
  if (t.includes("dinner")) return "dinner";
  if (t.includes("breakfast")) return "breakfast";
  return "other";
}

function sortMealsForDisplay(meals, mealFilters) {
  const ordered = [...meals];
  const fallbackOrder = ["lunch", "dinner", "other", "breakfast"];
  const preferredOrder = mealFilters.length
    ? [...mealFilters.filter((k) => k !== "breakfast"), "other", ...(mealFilters.includes("breakfast") ? ["breakfast"] : [])]
    : fallbackOrder;
  ordered.sort((a, b) => {
    const aKey = canonicalMealKey(a?.name ?? a?.meal ?? a?.mealPeriod ?? a?.title ?? "");
    const bKey = canonicalMealKey(b?.name ?? b?.meal ?? b?.mealPeriod ?? b?.title ?? "");
    const ai = preferredOrder.indexOf(aKey);
    const bi = preferredOrder.indexOf(bKey);
    const av = ai === -1 ? 999 : ai;
    const bv = bi === -1 ? 999 : bi;
    return av - bv;
  });
  return ordered;
}

function itemTags(tags) {
  const rows = [];
  if (tags.beef) rows.push('<span class="tag tag-beef">Beef</span>');
  if (tags.chicken) rows.push('<span class="tag tag-chicken">Chicken</span>');
  if (tags.turkey) rows.push('<span class="tag tag-turkey">Turkey</span>');
  if (tags.pork) rows.push('<span class="tag tag-pork">Pork</span>');
  if (tags.vegetarian) rows.push('<span class="tag tag-vegetarian">Vegetarian</span>');
  return rows.join("");
}

function nutritionLine(item) {
  const calories = displayCalories(item);
  const protein = displayProtein(item);
  return { calories, protein };
}

function renderItemCard(name, item, tags, favorites, highProtein, healthy) {
  const tagsMarkup = [];
  if (tags.vegetarian) tagsMarkup.push('<span class="meta-chip meta-vegetarian">Vegetarian</span>');
  if (healthy) tagsMarkup.push('<span class="meta-chip meta-healthy">Healthy pick</span>');
  if (tags.beef) tagsMarkup.push('<span class="meta-chip meta-beef">Beef</span>');
  if (tags.chicken) tagsMarkup.push('<span class="meta-chip meta-chicken">Chicken</span>');
  if (tags.turkey) tagsMarkup.push('<span class="meta-chip meta-turkey">Turkey</span>');
  if (tags.pork) tagsMarkup.push('<span class="meta-chip meta-pork">Pork</span>');
  if (highProtein) tagsMarkup.push('<span class="meta-chip meta-protein">High protein</span>');
  const nutrition = nutritionLine(item);
  if (nutrition.calories) tagsMarkup.push(`<span class="meta-chip meta-cal">${escapeHtml(nutrition.calories)}</span>`);
  if (nutrition.protein) tagsMarkup.push(`<span class="meta-chip meta-protein">${escapeHtml(nutrition.protein)}</span>`);
  const favActive = favorites.has(name.toLowerCase());
  const favClass = favActive ? "fav-btn active" : "fav-btn";
  return `
    <article class="menu-item${favActive ? " is-favorite" : ""}">
      <div class="item-main">
        <div class="item-top">
          <h5 class="item-name">${escapeHtml(name)}</h5>
          <div class="item-actions">
            <button type="button" class="${favClass}" data-favorite-name="${escapeHtml(name)}" aria-label="${favActive ? "Remove" : "Save"} ${escapeHtml(name)} ${favActive ? "from" : "to"} favourites" aria-pressed="${favActive}">★</button>
          </div>
        </div>
        ${tagsMarkup.length ? `<div class="meta-line">${tagsMarkup.join('<span class="meta-sep">,</span>')}</div>` : ""}
      </div>
    </article>`;
}

function stationSortValue(name) {
  const t = String(name || "").toLowerCase();
  if (t.includes("chef") && t.includes("table")) return 0;
  return 1;
}

function stationClassName(name) {
  const t = String(name || "").toLowerCase();
  if (
    (t.includes("chef") && t.includes("table")) ||
    t.includes("entree - meal") ||
    t.includes("stock & sauce") ||
    t.includes("wstock & sauce") ||
    t.includes("pasta station") ||
    t.includes("dessert")
  ) {
    return "station-chef";
  }
  if (
    t.includes("entree") ||
    t.includes("miscellaneous") ||
    t.includes("condiment") ||
    t.includes("garnish")
  ) {
    return "station-chef";
  }
  if (
    t.includes("pizza") ||
    t.includes("salad") ||
    t.includes("salad dressing")
  ) {
    return "station-bakery";
  }
  if (
    t.includes("action") ||
    t.includes("starch") ||
    t.includes("sandwich - hot") ||
    t.includes("sandwich") ||
    t.includes("deli")
  ) {
    return "station-grill";
  }
  if (t.includes("bakery")) return "station-bakery";
  if (t.includes("grill")) return "station-grill";
  return "station-default";
}

function stationHeaderForItem(item, fallbackName) {
  const course = String(item?.course ?? "").trim();
  if (course) return course;
  const station = String(item?.station ?? "").trim();
  if (station) return station;
  return String(fallbackName ?? "Station");
}

function sortStationsForDisplay(stations) {
  const ordered = [...stations];
  ordered.sort((a, b) => {
    const sa = stationSortValue(a?.name ?? "");
    const sb = stationSortValue(b?.name ?? "");
    if (sa !== sb) return sa - sb;
    return String(a?.name ?? "").localeCompare(String(b?.name ?? ""));
  });
  return ordered;
}

export function renderMeals(payload) {
  return renderMealsWithOptions(payload, { activeFilters: [], favorites: new Set(), dayLabel: "" }).html;
}

export function renderMealsWithOptions(payload, options) {
  if (payload?.error) return {
    html: `<p class="empty-note error">${escapeHtml(payload.error)}. Open Dates & options and select Load range to retry.</p>`,
    visibleItems: [], recommended: [], allNames: [],
  };
  const meals = normalizeMeals(payload);
  if (!meals.length) {
    return {
      html: '<p class="empty-note">No menu published for this date. Try another date in Dates & options.</p>',
      visibleItems: [],
      recommended: [],
      allNames: [],
    };
  }

  const activeFilters = options.activeFilters ?? [];
  const favorites = options.favorites ?? new Set();
  const mealFilters = options.mealFilters ?? [];
  const hideMealTitles = Boolean(options.hideMealTitles);
  const highProteinMode = activeFilters.includes("highProtein");

  let mealHtml = "";
  const visibleItems = [];
  const allNames = [];
  const sortedMeals = sortMealsForDisplay(meals, mealFilters);
  for (const meal of sortedMeals) {
    if (!meal || typeof meal !== "object") continue;
    const mealName = meal.name ?? meal.meal ?? meal.mealPeriod ?? meal.title ?? "Meal";
    const mealText = String(mealName).toLowerCase();
    if (mealFilters.length) {
      const includeMeal = mealFilters.some((key) => mealText.includes(key));
      if (!includeMeal) continue;
    }
    const groups = meal.groups ?? meal.stations ?? meal.Station ?? meal.categories ?? meal.items ?? [];
    if (!Array.isArray(groups) || !groups.length) continue;
    const sortedGroups = sortStationsForDisplay(groups);

    let groupHtml = "";
    const mealItems = [];
    for (const group of sortedGroups) {
      if (!group || typeof group !== "object") continue;
      const groupName = group.name ?? group.station ?? group.category ?? "Station";
      const items = group.items ?? group.products ?? group.recipes ?? [];
      if (!Array.isArray(items) || !items.length) continue;

      const renderedByHeader = new Map();
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const tags = classifyItem(item);
        const nutrition = buildNutrition(item);
        if (!itemMatchesFilters(tags, nutrition, activeFilters)) continue;
        const healthy = isHealthy(tags, nutrition);
        const highProtein = isHighProtein(nutrition);
        const score = recommendationScore(tags, nutrition, activeFilters);
        const name = itemName(item);
        if (options.favoritesOnly && !favorites.has(name.toLowerCase())) continue;
        allNames.push(name);
        visibleItems.push({
          name,
          score,
          dayLabel: options.dayLabel ?? "",
          tags,
          healthy,
          highProtein,
          favorite: favorites.has(name.toLowerCase()),
        });
        const headerName = stationHeaderForItem(item, groupName);
        if (!renderedByHeader.has(headerName)) renderedByHeader.set(headerName, []);
        renderedByHeader.get(headerName).push({
          html: renderItemCard(name, item, tags, favorites, highProtein, healthy),
          protein: nutrition.protein ?? -1,
          name,
        });
      }
      const sections = [...renderedByHeader.entries()].sort((a, b) => {
        const sa = stationSortValue(a[0]);
        const sb = stationSortValue(b[0]);
        if (sa !== sb) return sa - sb;
        return a[0].localeCompare(b[0]);
      });
      for (const [headerName, renderedItems] of sections) {
        if (highProteinMode) {
          renderedItems.sort((a, b) => {
            if (b.protein !== a.protein) return b.protein - a.protein;
            return a.name.localeCompare(b.name);
          });
          mealItems.push(...renderedItems);
        } else {
          const itemHtml = renderedItems.map((x) => x.html).join("");
          if (!itemHtml) continue;
          groupHtml += `
            <section class="station-block">
              <h4 class="station-name ${stationClassName(headerName)}">${escapeHtml(headerName)}</h4>
              <div class="station-items">${itemHtml}</div>
            </section>`;
        }
      }
    }

    if (highProteinMode) {
      mealItems.sort((a, b) => {
        if (b.protein !== a.protein) return b.protein - a.protein;
        return a.name.localeCompare(b.name);
      });
      const topHtml = mealItems.map((x) => x.html).join("");
      if (topHtml) {
        groupHtml += `
          <section class="station-block">
            <h4 class="station-name">Top High Protein</h4>
            <div class="station-items">${topHtml}</div>
          </section>`;
      }
    }

    if (!groupHtml) continue;
    mealHtml += `
      <section class="meal-block">
        ${hideMealTitles ? "" : `<h3 class="meal-title">${escapeHtml(mealName)}</h3>`}
        ${groupHtml}
      </section>`;
  }

  if (!mealHtml) {
    return {
      html: '<p class="empty-note">No items match current filters.</p>',
      visibleItems: [],
      recommended: [],
      allNames,
    };
  }

  const recommended = [...visibleItems]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return { html: mealHtml, visibleItems, recommended, allNames };
}

export function renderCombinedComparison(mscPayload, zonePayload, options) {
  const mealFilters = options.mealFilters ?? [];
  if (mealFilters.length > 1) {
    return mealFilters.map(meal => `<section class="meal-comparison">
      <h2 class="comparison-meal-heading">${escapeHtml(meal[0].toUpperCase() + meal.slice(1))}</h2>
      ${renderCombinedComparison(mscPayload, zonePayload, {...options, mealFilters: [meal], hideMealTitles: true})}
    </section>`).join("");
  }
  return `<section class="combined-grid" aria-label="Dining venue comparison">
    ${renderVenuePanel("msc", renderMealsWithOptions(mscPayload, options).html)}
    ${renderVenuePanel("zone", renderMealsWithOptions(zonePayload, options).html)}
  </section>`;
}

export function renderVenuePanel(locationKey, bodyHtml) {
  return `
    <article class="venue-panel">
      <header class="venue-panel-header">
        <h2>${escapeHtml(LOCATIONS[locationKey].name)}</h2>
      </header>
      <div class="venue-panel-body">${bodyHtml}</div>
    </article>`;
}

export function renderHolidayCard(label) {
  return `
    <article class="day-card">
      <header class="day-header">${escapeHtml(label)}</header>
      <div class="day-body">
        <div class="holiday-card">Holiday (Weekend)</div>
      </div>
    </article>`;
}

export function renderDayCard(label, bodyHtml) {
  return `
    <article class="day-card">
      <header class="day-header">${escapeHtml(label)}</header>
      <div class="day-body">${bodyHtml}</div>
    </article>`;
}
