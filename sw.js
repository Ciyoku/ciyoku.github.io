const SW_VERSION = '2026-03-10-1';
const APP_SHELL_CACHE = `app-shell-${SW_VERSION}`;
const RUNTIME_CACHE = `runtime-${SW_VERSION}`;
const BOOK_PART_CACHE = 'library-book-parts-v1';
const OFFLINE_FALLBACK_URL = '/index.html';

const APP_SHELL_ASSETS = [
    '/',
    '/index.html',
    '/authors.html',
    '/categories.html',
    '/author.html',
    '/category.html',
    '/reader.html',
    '/css/base.css',
    '/css/catalog.css',
    '/css/info-pages.css',
    '/css/reader.css',
    '/js/app.js',
    '/js/core/book-content.js',
    '/js/core/books-meta.js',
    '/js/core/books-repo.js',
    '/js/core/reader-parser.js',
    '/js/core/site-config.js',
    '/js/features/authors/author-page.js',
    '/js/features/authors/authors-data.js',
    '/js/features/authors/authors-page.js',
    '/js/features/catalog/book-list-page-controller.js',
    '/js/features/catalog/books-filtering.js',
    '/js/features/catalog/index.js',
    '/js/features/categories/categories-data.js',
    '/js/features/categories/categories-page.js',
    '/js/features/categories/category-page.js',
    '/js/features/offline/book-download-button.js',
    '/js/features/offline/book-offline-storage.js',
    '/js/features/reader/constants.js',
    '/js/features/reader/pagination.js',
    '/js/features/reader/parsed-content-cache.js',
    '/js/features/reader/part-loader.js',
    '/js/features/reader/part-selector.js',
    '/js/features/reader/part-state.js',
    '/js/features/reader/popstate-navigation.js',
    '/js/features/reader/reader-app.js',
    '/js/features/reader/reader-seo.js',
    '/js/features/reader/search-results.js',
    '/js/features/reader/search.js',
    '/js/features/reader/ui-shell.js',
    '/js/features/reader/url-state.js',
    '/js/features/reader/view.js',
    '/js/shared/arabic-search.js',
    '/js/shared/book-list-ui.js',
    '/js/shared/book-pages.js',
    '/js/shared/bootstrap.js',
    '/js/shared/loading-indicator.js',
    '/js/shared/lucide.js',
    '/js/shared/number-format.js',
    '/js/shared/page-seo-defaults.js',
    '/js/shared/pwa.js',
    '/js/shared/query-words.js',
    '/js/shared/seo.js',
    '/js/shared/site-shell.js',
    '/js/shared/text-normalization.js',
    '/books/list.json',
    '/assets/fonts/kitab-base.woff2',
    '/assets/fonts/kitab-base-bold.woff2',
    '/assets/fonts/kitab-phrases.woff2',
    '/assets/img/favicon/apple-touch-icon.png',
    '/assets/img/favicon/favicon-32x32.png',
    '/assets/img/favicon/favicon-16x16.png',
    '/assets/img/favicon/android-chrome-192x192.png',
    '/assets/img/favicon/android-chrome-512x512.png',
    '/assets/img/favicon/site.webmanifest'
];

function isCacheableResponse(response) {
    return Boolean(response)
        && response.ok
        && (response.type === 'basic' || response.type === 'default');
}

function isBookResponse(response) {
    if (!isCacheableResponse(response)) return false;
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    return !contentType.includes('text/html');
}

function isBookPartRequest(url) {
    return /^\/books\/[^/]+\/book(?:\d+)?\.txt$/i.test(url.pathname);
}

function isStaticAssetRequest(request, url) {
    if (request.destination === 'style' || request.destination === 'script' || request.destination === 'font' || request.destination === 'image') {
        return true;
    }

    if (url.pathname === '/books/list.json') return true;
    return /\.(?:css|js|mjs|json|png|jpg|jpeg|svg|webp|avif|woff2?|ico)$/i.test(url.pathname);
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(APP_SHELL_CACHE);
        await cache.addAll(APP_SHELL_ASSETS);
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys.map((key) => {
                if (key === APP_SHELL_CACHE || key === RUNTIME_CACHE || key === BOOK_PART_CACHE) {
                    return Promise.resolve();
                }
                if (key.startsWith('app-shell-') || key.startsWith('runtime-')) {
                    return caches.delete(key);
                }
                return Promise.resolve();
            })
        );

        await self.clients.claim();
    })());
});

self.addEventListener('message', (event) => {
    if (event?.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleNavigationRequest(request) {
    const requestUrl = new URL(request.url);
    const pathRequest = new Request(requestUrl.pathname, {
        method: 'GET'
    });

    try {
        const networkResponse = await fetch(request);
        if (isCacheableResponse(networkResponse)) {
            const runtimeCache = await caches.open(RUNTIME_CACHE);
            await runtimeCache.put(request, networkResponse.clone());
            await runtimeCache.put(pathRequest, networkResponse.clone());
        }
        return networkResponse;
    } catch (_) {
        const runtimeCache = await caches.open(RUNTIME_CACHE);
        const cachedPage = await runtimeCache.match(request)
            || await runtimeCache.match(pathRequest)
            || await runtimeCache.match(request, { ignoreSearch: true });
        if (cachedPage) return cachedPage;

        const shellCache = await caches.open(APP_SHELL_CACHE);
        const shellMatch = await shellCache.match(pathRequest);
        if (shellMatch) return shellMatch;

        const fallback = await shellCache.match(OFFLINE_FALLBACK_URL);
        if (fallback) return fallback;

        return new Response('Offline', {
            status: 503,
            statusText: 'Offline'
        });
    }
}

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleStaticAssetRequest(request, event) {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);

    const networkRequest = fetch(request)
        .then(async (response) => {
            if (isCacheableResponse(response)) {
                await cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => null);

    if (cached) {
        if (event) {
            event.waitUntil(networkRequest.then(() => {}));
        }
        return cached;
    }

    const networkResponse = await networkRequest;
    if (networkResponse) {
        return networkResponse;
    }

    return new Response('Offline', {
        status: 503,
        statusText: 'Offline'
    });
}

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleBookPartRequest(request) {
    const cache = await caches.open(BOOK_PART_CACHE);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        if (isBookResponse(response)) {
            await cache.put(request, response.clone());
        }
        return response;
    } catch (_) {
        return new Response('Offline', {
            status: 503,
            statusText: 'Offline'
        });
    }
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (isBookPartRequest(url)) {
        event.respondWith(handleBookPartRequest(request));
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(handleNavigationRequest(request));
        return;
    }

    if (isStaticAssetRequest(request, url)) {
        event.respondWith(handleStaticAssetRequest(request, event));
    }
});
