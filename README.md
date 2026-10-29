# MSC + The Zone Menu

Dining comparison app for PVAMU with:
- side-by-side MSC vs Zone comparison
- meal switcher (breakfast / lunch / dinner)
- prominent saved favourites list, today’s matches by venue and meal, and a favourites-only filter
- calorie tracker with graph

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

Run regression checks with `npm test`.

Use Node.js 22.12+ (or 20.19+) for Vite 8.

## Menu availability

Menus load directly from the Sodexo API. A successful empty response means no menu is published for that date; choose another date under **Show controls**. Failed requests show a separate error, and each venue loads independently. Weekend dates are checked rather than assumed closed.

Favourites and calorie history stay in this browser on this device. Saved favourites appear at the top even when they are absent from today’s menu. The menu below still follows the selected meal, date, venue, and dietary filters.

On phones, venue panels stack vertically, filters scroll horizontally, and actions have larger touch targets.

Build output is generated in `dist/`.

## Deploy on Render

This repo includes `render.yaml` for automatic deployment:
- Build Command: `npm run build`
- Publish Directory: `dist`

Steps:
1. Push this project to GitHub.
2. In Render, create a new **Blueprint** service and select the repo.
3. Deploy.

## Install on mobile (PWA)

This app is configured as an installable Progressive Web App.

- **Android (Chrome):**
  - Open deployed URL
  - Tap browser menu -> **Install app** / **Add to Home screen**
- **iPhone (Safari):**
  - Open deployed URL
  - Tap **Share** -> **Add to Home Screen**
