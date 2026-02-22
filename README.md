# المكتبة الأخبارية

Static Islamic Shia digital library with:
- catalog browsing
- category and author navigation
- full-text search (runtime scanning, no prebuilt index)
- in-browser reader with chapters, parts, and page navigation

## Run locally
Use any static server (do not open with `file://`).

Examples:
- VS Code Live Server
- `python -m http.server 8080`

Then open:
- `http://localhost:8080/index.html`

## Checks before deploy
```bash
npm run check
```

Individual commands:
- `npm run check:js`
- `npm run check:books`
- `npm run check:shell`
- `npm test`
