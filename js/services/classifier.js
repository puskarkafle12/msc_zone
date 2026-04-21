import { TAG_KEYWORDS } from "../config.js";

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

function itemText(item) {
  return [item.formalName, item.name, item.title, item.description, item.ingredients]
    .filter((part) => typeof part === "string")
    .join(" ")
    .toLowerCase();
}

export function classifyItem(item) {
  const text = itemText(item);
  const vegetarianFlag = Boolean(item.isVegetarian || item.isVegan || item.isPlantBased);

  return {
    beef: includesAny(text, TAG_KEYWORDS.beef),
    chicken: includesAny(text, TAG_KEYWORDS.chicken),
    turkey: includesAny(text, TAG_KEYWORDS.turkey),
    pork: includesAny(text, TAG_KEYWORDS.pork),
    vegetarian: vegetarianFlag || includesAny(text, TAG_KEYWORDS.vegetarian),
  };
}

export function displayCalories(item) {
  const calories = item.calories ?? item.calorie ?? item.kcal;
  if (calories === null || calories === undefined || calories === "") return "";
  return `${String(calories).trim()} kcal`;
}

export function displayProtein(item) {
  const protein = item.protein;
  if (protein === null || protein === undefined || protein === "") return "";
  return `${String(protein).trim()} protein`;
}
