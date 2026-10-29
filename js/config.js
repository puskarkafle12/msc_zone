export const API_KEY = "68717828-b754-420d-9488-4c37cb7d7ef7";
export const BASE_URL = "https://api-prd.sodexomyway.net/v0.2/data/menu";

export const LOCATIONS = {
  msc: { key: "msc", name: "MSC Dining Facility", siteId: "77011001", locationId: "14912" },
  zone: { key: "zone", name: "The Zone", siteId: "77011012", locationId: "15924" },
};

// Browser-safe headers only; the browser supplies Origin and Referer itself.
export const REQUEST_HEADERS = {
  accept: "application/json",
  "api-key": API_KEY,
};

export const TAG_KEYWORDS = {
  beef: ["beef", "steak", "brisket", "burger", "meatball", "meatloaf"],
  chicken: ["chicken", "wing", "drumstick", "nugget", "tender"],
  turkey: ["turkey"],
  pork: ["pork", "bacon", "ham", "sausage", "pepperoni", "prosciutto"],
  vegetarian: ["vegetarian", "veggie", "plant based", "tofu", "lentil", "falafel"],
};
