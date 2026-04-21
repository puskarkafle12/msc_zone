export function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number.parseFloat(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(num) ? num : null;
}

export function buildNutrition(item) {
  return {
    calories: toNumber(item.calories ?? item.calorie ?? item.kcal),
    protein: toNumber(item.protein),
    sugar: toNumber(item.sugar),
    fat: toNumber(item.fat),
    sodium: toNumber(item.sodium),
  };
}

export function isHighProtein(nutrition) {
  return nutrition.protein !== null && nutrition.protein >= 15;
}

export function isHealthy(tags, nutrition) {
  const hasProtein = nutrition.protein !== null && nutrition.protein >= 10;
  const calsOk = nutrition.calories === null || nutrition.calories <= 650;
  const sodiumOk = nutrition.sodium === null || nutrition.sodium <= 900;
  return (tags.vegetarian || hasProtein) && calsOk && sodiumOk;
}

export function itemMatchesFilters(tags, nutrition, activeFilters) {
  if (!activeFilters.length) return true;
  return activeFilters.every((filter) => {
    if (filter === "highProtein") return isHighProtein(nutrition);
    if (filter === "healthy") return isHealthy(tags, nutrition);
    if (filter === "vegetarian") return tags.vegetarian;
    if (filter === "nonVeg") return tags.beef || tags.chicken || tags.turkey || tags.pork;
    if (filter === "chicken") return tags.chicken;
    if (filter === "pork") return tags.pork;
    if (filter === "turkey") return tags.turkey;
    return true;
  });
}

export function recommendationScore(tags, nutrition, activeFilters) {
  let score = 0;
  if (isHealthy(tags, nutrition)) score += 3;
  if (isHighProtein(nutrition)) score += 3;
  if (tags.vegetarian) score += 1;
  if (!activeFilters.length) return score;
  if (itemMatchesFilters(tags, nutrition, activeFilters)) score += 4;
  return score;
}
