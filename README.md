# المكتبة الأخبارية

Static Islamic Shia digital library with:
- catalog browsing
- category and author navigation
- in-browser reader with chapters, parts, and page navigation
- offline-friendly PWA behavior

## Run locally

Use any static server (do not open with `file://`).

Examples:
- VS Code Live Server
- `python -m http.server 8080`

Then open:
- `http://localhost:8080/index.html`

## Architecture

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for module boundaries, runtime flow, and maintainability conventions.

## Checks before deploy

```bash
npm run check
npm test
```

Useful maintenance commands:
- `npm run head:sync` to sync shared `<head>` security/favicon block across pages
- `npm run sw:assets:sync` to regenerate the service worker app shell asset list

Individual checks:
- `npm run check:js`
- `npm run check:imports`
- `npm run check:books`
- `npm run check:shell`
- `npm run check:head`
- `npm run check:swassets`
- `npm run check:policy`
