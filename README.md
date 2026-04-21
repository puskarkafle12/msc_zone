# MSC + The Zone Menu

Dining comparison app for PVAMU with:
- side-by-side MSC vs Zone comparison
- meal switcher (breakfast / lunch / dinner)
- favorites + upcoming favorites insight
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
