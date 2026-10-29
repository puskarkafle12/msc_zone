import requests
from datetime import date

API_KEY = "68717828-b754-420d-9488-4c37cb7d7ef7"

BASE_URL = "https://api-prd.sodexomyway.net/v0.2/data/menu"

# PVAMU campus/account IDs
LOCATIONS = {
    "msc": {
        "name": "MSC Dining Facility",
        "site_id": "77011001",
        "menu_id": "1410735",
    },
    "zone": {
        "name": "The Zone",
        "site_id": "77011012",
        "menu_id": "1410982",
    },
}

HEADERS = {
    "accept": "*/*",
    "accept-language": "en-US,en;q=0.9",
    "api-key": API_KEY,
    "authorization": "Bearer",
    "content-type": "application/json",
    "origin": "https://pvamu.sodexomyway.com",
    "referer": "https://pvamu.sodexomyway.com/",
    "user-agent": "Mozilla/5.0",
}


def get_menu(location_key, menu_date):
    location = LOCATIONS[location_key]

    url = f"{BASE_URL}/{location['site_id']}/{location['menu_id']}"

    params = {
        "date": menu_date
    }

    response = requests.get(url, params=params, headers=HEADERS, timeout=20)
    response.raise_for_status()

    return response.json()


def print_menu(data, location_name):
    print("\n" + "=" * 60)
    print(location_name)
    print("=" * 60)

    # API returns a list of meal periods with `groups` (Sodexo web menu JSON).
    if isinstance(data, list):
        meals = data
    elif isinstance(data, dict):
        meals = data.get("meals") or data.get("MealPeriods") or data.get("menu") or []
    else:
        print(data)
        return

    if not meals:
        print("No meal data.")
        return

    for meal in meals:
        meal_name = (
            meal.get("name")
            or meal.get("meal")
            or meal.get("mealPeriod")
            or meal.get("title")
            or "Meal"
        )

        print(f"\n{str(meal_name).upper()}")

        stations = (
            meal.get("groups")
            or meal.get("stations")
            or meal.get("Station")
            or meal.get("categories")
            or meal.get("items")
            or []
        )

        for station in stations:
            if isinstance(station, dict):
                station_name = (
                    station.get("name")
                    or station.get("station")
                    or station.get("category")
                    or "Station"
                )
                print(f"\n  {station_name}")

                items = station.get("items") or station.get("products") or station.get("recipes") or []

                for item in items:
                    if isinstance(item, dict):
                        item_name = item.get("formalName") or item.get("name") or item.get("title") or "Item"
                        calories = item.get("calories") or item.get("calorie") or item.get("kcal")

                        if calories:
                            print(f"    - {item_name} — {calories} cal")
                        else:
                            print(f"    - {item_name}")
                    else:
                        print(f"    - {item}")
            else:
                print(f"  - {station}")


def main():
    menu_date = date.today().isoformat()

    for location_key in ["msc", "zone"]:
        location_name = LOCATIONS[location_key]["name"]

        try:
            data = get_menu(location_key, menu_date)
            print_menu(data, location_name)

        except requests.exceptions.RequestException as e:
            print(f"\nError getting {location_name}: {e}")


if __name__ == "__main__":
    main()
