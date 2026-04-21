# MSC + The Zone Menu (Static App)

This project is a pure static website (`index.html`, `styles.css`, `app.js`) and can be deployed directly on Render.

## Deploy on Render

1. Push this folder to a GitHub repo.
2. In Render, create a new **Blueprint** service (or Static Site from repo).
3. Render will detect `render.yaml` and configure deployment automatically.
4. Deploy.

## Notes

- No backend is required.
- Menu data is fetched in the browser from Sodexo's API.
- If you deploy as Static Site manually instead of Blueprint:
  - Build Command: leave empty
  - Publish Directory: `.`
