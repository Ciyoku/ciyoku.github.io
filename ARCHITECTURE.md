# Architecture Overview

This repository is a static Arabic digital library delivered as plain HTML/CSS/ES modules and optimized for GitHub Pages.

## High-Level Layout

- `index.html`, `authors.html`, `author.html`, `categories.html`, `category.html`, `reader.html`:
  page shells and entrypoints.
- `js/core/`:
  domain data and parsing primitives.
- `js/features/`:
  page/feature behavior (`catalog`, `authors`, `categories`, `reader`, `offline`).
- `js/shared/`:
  cross-cutting UI/runtime helpers (site shell, SEO, theme, PWA, loading, text normalization).
- `books/`:
  source corpus (`books/list.json` metadata and `books/{id}/book*.txt` content).
- `sw.js`:
  service worker caching and offline routing strategy.
- `scripts/`:
  quality checks and maintenance automation.

## Runtime Composition

### Catalog, Authors, Categories

- `fetchBooksList` (`js/core/books-repo.js`) is the single metadata entrypoint.
- List/detail pages are implemented in feature modules and share:
  - entity list rendering via `js/features/entities/entity-list-page.js`
  - entity detail/book rendering via `js/features/entities/entity-books-page.js`
- Book links are generated via `buildReaderUrl` in `js/core/books-meta.js`.

### Reader

- Bootstrapped from `js/features/reader/reader-app.js`.
- Main concerns:
  - URL state parsing/updating (`url-state.js`)
  - text loading and caching (`core/book-content.js`, offline storage)
  - parsing and search indexing (`core/reader-parser.js`)
  - pagination/sidebar rendering (`pagination.js`)
  - part loading and preloading (`part-loader.js`, `part-state.js`)
  - search execution (`search.js`, `search-results.js`)
  - reading position persistence (`reading-position.js`)
  - reader download UX (`download-controller.js`)

### Shared Shell and SEO

- `js/shared/site-shell.js` injects primary nav, theme/pwa wiring, and default SEO.
- Per-page/feature SEO deltas are applied through `js/shared/seo.js`.

## Offline and PWA

- `sw.js` handles:
  - app shell precache (`APP_SHELL_ASSETS`)
  - runtime caching for navigations/assets
  - book part cache strategy
- `js/features/offline/book-offline-storage.js` handles:
  - offline book download
  - metadata tracking
  - storage-aware eviction and background refresh

## Automation and Checks

- `npm run check` executes:
  - syntax/import validation
  - books corpus integrity checks
  - HTML shell checks
  - shared head sync checks
  - service worker asset sync checks
  - legacy policy checks
- `npm test` runs module-level unit tests from `scripts/run-unit-tests.mjs`.

## Maintainer Notes

- Shared `<head>` security/favicon block is managed by `scripts/sync-shared-head.mjs`.
- Service worker precache list is managed by `scripts/sync-sw-assets.mjs`.
- Keep feature modules focused on one page flow; promote cross-page behavior into `js/features/entities/` or `js/shared/` where possible.
