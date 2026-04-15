import { getBookId, getBookPartCount, getBookTitle } from '../../core/books-meta.js';

const BOOK_PART_CACHE_NAME = 'library-book-parts-v1';
const OFFLINE_BOOK_META_STORAGE_KEY = 'library.offline.books.v1';
const MAX_DOWNLOADED_BOOKS = 36;
const STORAGE_HIGH_WATERMARK = 0.88;
const STORAGE_TARGET_WATERMARK = 0.74;
const BACKGROUND_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
const TEXT_ACCEPT_HEADER = 'text/plain, text/*;q=0.9, */*;q=0.1';

let metadataSnapshot = null;

/**
 * @typedef {Object} ActiveDownload
 * @property {Promise<any>} promise
 * @property {Set<Function>} listeners
 */

/** @type {Map<string, ActiveDownload>} */
const activeDownloads = new Map();
/** @type {Set<string>} */
const activeBackgroundUpdates = new Set();

function createEmptyMetadataSnapshot() {
    return {
        version: 1,
        books: {}
    };
}

/**
 * @param {string|number} bookId
 * @returns {string}
 */
function normalizeBookId(bookId) {
    return String(bookId ?? '').trim();
}

/**
 * @param {number|string} partCount
 * @returns {number}
 */
function normalizePartCount(partCount) {
    const parsed = Number.parseInt(String(partCount ?? ''), 10);
    if (Number.isInteger(parsed) && parsed > 1) return parsed;
    return 1;
}

/**
 * @param {number} partIndex
 * @returns {number}
 */
function normalizePartIndex(partIndex) {
    return Number.isInteger(partIndex) && partIndex >= 0 ? partIndex : 0;
}

/**
 * @param {string} bookId
 * @param {Object} [source={}]
 * @returns {Object}
 */
function normalizeBookMetadata(bookId, source = {}) {
    const partCount = normalizePartCount(source.partCount);
    const cachedParts = Number.isInteger(source.cachedParts) && source.cachedParts >= 0
        ? Math.min(source.cachedParts, partCount)
        : 0;
    const updatedAt = Number(source.updatedAt) || 0;
    const lastOpenedAt = Number(source.lastOpenedAt) || updatedAt;
    const lastBackgroundSyncAt = Number(source.lastBackgroundSyncAt) || 0;

    return {
        id: bookId,
        title: String(source.title ?? '').trim(),
        partCount,
        cachedParts,
        downloaded: Boolean(source.downloaded) && cachedParts >= partCount,
        bytes: Math.max(0, Number(source.bytes) || 0),
        updatedAt,
        lastOpenedAt,
        lastBackgroundSyncAt
    };
}

function cloneMetadataSnapshot(snapshot) {
    return {
        version: 1,
        books: { ...(snapshot?.books || {}) }
    };
}

function readMetadataSnapshot() {
    if (metadataSnapshot) {
        return metadataSnapshot;
    }

    let snapshot = createEmptyMetadataSnapshot();
    try {
        const raw = localStorage.getItem(OFFLINE_BOOK_META_STORAGE_KEY);
        if (!raw) {
            metadataSnapshot = snapshot;
            return metadataSnapshot;
        }

        const parsed = JSON.parse(raw);
        const parsedBooks = parsed && typeof parsed === 'object' && parsed.books && typeof parsed.books === 'object'
            ? parsed.books
            : {};

        const normalizedBooks = {};
        Object.entries(parsedBooks).forEach(([bookId, metadata]) => {
            const safeBookId = normalizeBookId(bookId);
            if (!safeBookId || !metadata || typeof metadata !== 'object') return;
            normalizedBooks[safeBookId] = normalizeBookMetadata(safeBookId, metadata);
        });

        snapshot = {
            version: 1,
            books: normalizedBooks
        };
    } catch (_) {
        snapshot = createEmptyMetadataSnapshot();
    }

    metadataSnapshot = snapshot;
    return metadataSnapshot;
}

/**
 * @param {Object} snapshot
 */
function saveMetadataSnapshot(snapshot) {
    metadataSnapshot = cloneMetadataSnapshot(snapshot);
    try {
        localStorage.setItem(OFFLINE_BOOK_META_STORAGE_KEY, JSON.stringify(metadataSnapshot));
    } catch (_) {
        // Ignore localStorage write failures and keep the in-memory metadata.
    }
}

/**
 * @param {string} bookId
 * @returns {Object|null}
 */
function getBookMetadata(bookId) {
    const snapshot = readMetadataSnapshot();
    const metadata = snapshot.books[bookId];
    return metadata && typeof metadata === 'object'
        ? normalizeBookMetadata(bookId, metadata)
        : null;
}

/**
 * @param {string} bookId
 * @param {(metadata: Object|null) => Object|null} updater
 * @returns {Object|null}
 */
function updateBookMetadata(bookId, updater) {
    const safeBookId = normalizeBookId(bookId);
    if (!safeBookId || typeof updater !== 'function') return null;

    const current = readMetadataSnapshot();
    const next = cloneMetadataSnapshot(current);
    const previousValue = next.books[safeBookId]
        ? normalizeBookMetadata(safeBookId, next.books[safeBookId])
        : null;
    const updatedValue = updater(previousValue);

    if (!updatedValue || typeof updatedValue !== 'object') {
        delete next.books[safeBookId];
    } else {
        next.books[safeBookId] = normalizeBookMetadata(safeBookId, updatedValue);
    }

    saveMetadataSnapshot(next);
    return next.books[safeBookId] || null;
}

function isOfflineContextSupported() {
    return typeof window !== 'undefined'
        && window.isSecureContext
        && typeof caches !== 'undefined'
        && typeof caches.open === 'function';
}

export function isOfflineBookStorageSupported() {
    return isOfflineContextSupported();
}

/**
 * @param {number} partIndex
 * @returns {string}
 */
function getBookPartFileName(partIndex) {
    return partIndex === 0 ? 'book.txt' : `book${partIndex + 1}.txt`;
}

/**
 * @param {string} bookId
 * @param {number} partIndex
 * @returns {string}
 */
function buildBookPartPath(bookId, partIndex) {
    const safeBookId = encodeURIComponent(normalizeBookId(bookId));
    const safePartIndex = normalizePartIndex(partIndex);
    return `/books/${safeBookId}/${getBookPartFileName(safePartIndex)}`;
}

/**
 * @param {string} path
 * @returns {string}
 */
function toAbsoluteUrl(path) {
    if (typeof window === 'undefined' || !window.location?.origin) {
        return path;
    }

    return new URL(path, window.location.origin).toString();
}

/**
 * @param {string} bookId
 * @param {number} partIndex
 * @returns {Request}
 */
function buildBookPartRequest(bookId, partIndex) {
    const path = buildBookPartPath(bookId, partIndex);
    return new Request(toAbsoluteUrl(path), {
        headers: {
            Accept: TEXT_ACCEPT_HEADER
        }
    });
}

async function openBookPartCache() {
    if (!isOfflineContextSupported()) {
        return null;
    }

    try {
        return await caches.open(BOOK_PART_CACHE_NAME);
    } catch (_) {
        return null;
    }
}

/**
 * @param {Response} response
 */
function assertSafeBookResponse(response) {
    const contentType = String(response.headers.get('content-type') ?? '').toLowerCase();
    if (contentType.includes('text/html')) {
        throw new Error('Unexpected book response type.');
    }
}

/**
 * @param {Response} response
 * @returns {number}
 */
function getResponseByteLength(response) {
    const fromHeader = Number.parseInt(String(response.headers.get('content-length') ?? ''), 10);
    if (Number.isInteger(fromHeader) && fromHeader > 0) {
        return fromHeader;
    }

    return 0;
}

/**
 * @param {string} bookId
 */
function markBookAsOpened(bookId) {
    updateBookMetadata(bookId, (metadata) => {
        if (!metadata) return metadata;
        return {
            ...metadata,
            lastOpenedAt: Date.now()
        };
    });
}

/**
 * @param {string} bookId
 * @param {number} partIndex
 * @returns {Promise<Response|null>}
 */
async function getCachedBookPartResponse(bookId, partIndex) {
    const cache = await openBookPartCache();
    if (!cache) return null;

    const request = buildBookPartRequest(bookId, partIndex);
    const match = await cache.match(request, { ignoreSearch: true });
    if (!match || !match.ok) return null;
    return match;
}

/**
 * @param {string} bookId
 * @param {number} partIndex
 * @returns {Promise<string|null>}
 */
async function getCachedBookPartText(bookId, partIndex) {
    const cached = await getCachedBookPartResponse(bookId, partIndex);
    if (!cached) return null;

    assertSafeBookResponse(cached);
    return cached.text();
}

/**
 * @param {string} bookId
 * @param {number} partIndex
 * @returns {Promise<Response>}
 */
async function fetchBookPartResponse(bookId, partIndex) {
    const request = buildBookPartRequest(bookId, partIndex);
    return fetch(request, {
        cache: 'no-store',
        headers: {
            Accept: TEXT_ACCEPT_HEADER
        }
    });
}

/**
 * @param {string} bookId
 * @param {number} partIndex
 * @returns {Promise<Response|null>}
 */
async function fetchBookPartResponseIfOk(bookId, partIndex) {
    const response = await fetchBookPartResponse(bookId, partIndex);
    if (!response.ok) return null;
    assertSafeBookResponse(response);
    return response;
}

/**
 * @param {string} bookId
 * @param {Object} payload
 */
function notifyDownloadProgress(bookId, payload) {
    const entry = activeDownloads.get(bookId);
    if (!entry) return;

    entry.listeners.forEach((listener) => {
        try {
            listener(payload);
        } catch (_) {
            // Ignore callback errors to keep the download flow stable.
        }
    });
}

/**
 * @param {string} bookId
 * @param {number} partCount
 */
async function removeBookEntries(bookId, partCount) {
    const safeBookId = normalizeBookId(bookId);
    if (!safeBookId) return;

    const cache = await openBookPartCache();
    if (!cache) {
        updateBookMetadata(safeBookId, () => null);
        return;
    }

    const safePartCount = normalizePartCount(partCount);
    for (let partIndex = 0; partIndex < safePartCount; partIndex += 1) {
        await cache.delete(buildBookPartRequest(safeBookId, partIndex), { ignoreSearch: true });
    }

    updateBookMetadata(safeBookId, () => null);
}

/**
 * @param {string} bookId
 * @returns {number}
 */
function getBookRecency(bookId) {
    const metadata = getBookMetadata(bookId);
    if (!metadata) return 0;

    const lastOpenedAt = Number(metadata.lastOpenedAt) || 0;
    const updatedAt = Number(metadata.updatedAt) || 0;
    return Math.max(lastOpenedAt, updatedAt);
}

async function getStorageUsageRatio() {
    if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.estimate !== 'function') {
        return 0;
    }

    try {
        const estimate = await navigator.storage.estimate();
        const quota = Number(estimate.quota) || 0;
        const usage = Number(estimate.usage) || 0;
        if (quota <= 0 || usage <= 0) return 0;
        return usage / quota;
    } catch (_) {
        return 0;
    }
}

/**
 * @param {Object} [options={}]
 * @param {string} [options.protectedBookId='']
 */
async function evictLeastRecentlyUsedBooks(options = {}) {
    const protectedBookId = normalizeBookId(options.protectedBookId);
    const snapshot = readMetadataSnapshot();
    const downloadedIds = Object.entries(snapshot.books)
        .filter(([, metadata]) => Boolean(metadata?.downloaded))
        .map(([bookId]) => bookId)
        .sort((a, b) => getBookRecency(a) - getBookRecency(b));

    if (!downloadedIds.length) return;

    let ratio = await getStorageUsageRatio();
    let downloadedCount = downloadedIds.length;
    const shouldEvict = () => downloadedCount > MAX_DOWNLOADED_BOOKS || ratio > STORAGE_HIGH_WATERMARK;

    if (!shouldEvict()) return;

    for (const candidateBookId of downloadedIds) {
        if (!shouldEvict()) break;
        if (candidateBookId === protectedBookId) continue;
        if (activeDownloads.has(candidateBookId)) continue;

        const metadata = getBookMetadata(candidateBookId);
        const partCount = normalizePartCount(metadata?.partCount ?? 1);
        await removeBookEntries(candidateBookId, partCount);
        downloadedCount -= 1;
        ratio = await getStorageUsageRatio();

        const ratioSafeEnough = ratio <= STORAGE_TARGET_WATERMARK;
        const countSafeEnough = downloadedCount <= MAX_DOWNLOADED_BOOKS;
        if (ratioSafeEnough && countSafeEnough) {
            break;
        }
    }
}

/**
 * @param {Object} book
 * @param {Object} [options={}]
 * @param {(progress: {completedParts: number, totalParts: number}) => void} [options.onProgress]
 * @returns {Promise<Object>}
 */
export async function downloadBookForOffline(book, options = {}) {
    if (!isOfflineBookStorageSupported()) {
        throw new Error('Offline storage is not available in this browser.');
    }

    const normalizedBookId = normalizeBookId(getBookId(book) || book?.id);
    if (!normalizedBookId) {
        throw new Error('Missing book id.');
    }

    const partCount = normalizePartCount(getBookPartCount(book) || book?.parts);
    const title = getBookTitle(book);
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

    const activeEntry = activeDownloads.get(normalizedBookId);
    if (activeEntry) {
        if (onProgress) {
            activeEntry.listeners.add(onProgress);
        }
        return activeEntry.promise;
    }

    const listeners = new Set();
    if (onProgress) {
        listeners.add(onProgress);
    }

    const previousMetadata = getBookMetadata(normalizedBookId);
    const downloadPromise = (async () => {
        const cache = await openBookPartCache();
        if (!cache) {
            throw new Error('Offline cache is unavailable.');
        }

        const startedAt = Date.now();
        let totalBytes = 0;

        updateBookMetadata(normalizedBookId, (metadata) => ({
            ...metadata,
            id: normalizedBookId,
            title: title || metadata?.title || '',
            partCount,
            cachedParts: 0,
            downloaded: false,
            bytes: Number(metadata?.bytes) || 0,
            updatedAt: startedAt,
            lastOpenedAt: startedAt,
            lastBackgroundSyncAt: Number(metadata?.lastBackgroundSyncAt) || 0
        }));

        for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
            const response = await fetchBookPartResponseIfOk(normalizedBookId, partIndex);
            if (!response) {
                throw new Error(`Book part ${partIndex + 1} could not be downloaded.`);
            }

            await cache.put(buildBookPartRequest(normalizedBookId, partIndex), response.clone());
            totalBytes += getResponseByteLength(response);

            const completedParts = partIndex + 1;
            updateBookMetadata(normalizedBookId, (metadata) => ({
                ...metadata,
                id: normalizedBookId,
                title: title || metadata?.title || '',
                partCount,
                cachedParts: completedParts,
                downloaded: completedParts >= partCount,
                bytes: Math.max(Number(metadata?.bytes) || 0, totalBytes),
                updatedAt: Date.now(),
                lastOpenedAt: Date.now(),
                lastBackgroundSyncAt: Number(metadata?.lastBackgroundSyncAt) || 0
            }));

            notifyDownloadProgress(normalizedBookId, { completedParts, totalParts: partCount });
        }

        updateBookMetadata(normalizedBookId, (metadata) => ({
            ...metadata,
            id: normalizedBookId,
            title: title || metadata?.title || '',
            partCount,
            cachedParts: partCount,
            downloaded: true,
            bytes: Math.max(Number(metadata?.bytes) || 0, totalBytes),
            updatedAt: Date.now(),
            lastOpenedAt: Date.now(),
            lastBackgroundSyncAt: Number(metadata?.lastBackgroundSyncAt) || 0
        }));

        await evictLeastRecentlyUsedBooks({ protectedBookId: normalizedBookId });
        return getBookDownloadStatus(normalizedBookId, partCount);
    })().catch(async (error) => {
        if (previousMetadata?.downloaded) {
            updateBookMetadata(normalizedBookId, () => previousMetadata);
        } else {
            await removeBookEntries(normalizedBookId, partCount);
        }
        throw error;
    }).finally(() => {
        activeDownloads.delete(normalizedBookId);
    });

    activeDownloads.set(normalizedBookId, {
        promise: downloadPromise,
        listeners
    });

    return downloadPromise;
}

/**
 * @param {string|number} bookId
 * @param {number} [partCount=1]
 * @returns {Promise<{
 *   bookId: string,
 *   partCount: number,
 *   cachedParts: number,
 *   downloaded: boolean,
 *   downloading: boolean,
 *   bytes: number,
 *   updatedAt: number
 * }>}
 */
export async function getBookDownloadStatus(bookId, partCount = 1) {
    const normalizedBookId = normalizeBookId(bookId);
    const safePartCount = normalizePartCount(partCount);

    if (!normalizedBookId) {
        return {
            bookId: '',
            partCount: safePartCount,
            cachedParts: 0,
            downloaded: false,
            downloading: false,
            bytes: 0,
            updatedAt: 0
        };
    }

    const metadata = getBookMetadata(normalizedBookId);
    const downloading = activeDownloads.has(normalizedBookId);
    const cachedParts = Math.min(Number(metadata?.cachedParts) || 0, safePartCount);
    const downloaded = Boolean(metadata?.downloaded) && cachedParts >= safePartCount;

    return {
        bookId: normalizedBookId,
        partCount: safePartCount,
        cachedParts,
        downloaded,
        downloading,
        bytes: Math.max(0, Number(metadata?.bytes) || 0),
        updatedAt: Number(metadata?.updatedAt) || 0
    };
}

/**
 * @param {string} bookId
 */
async function maybeRefreshDownloadedBookInBackground(bookId) {
    const normalizedBookId = normalizeBookId(bookId);
    if (!normalizedBookId) return;
    if (activeBackgroundUpdates.has(normalizedBookId)) return;
    if (activeDownloads.has(normalizedBookId)) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    const metadata = getBookMetadata(normalizedBookId);
    if (!metadata || !metadata.downloaded) return;

    const elapsedSinceLastSync = Date.now() - (Number(metadata.lastBackgroundSyncAt) || 0);
    if (elapsedSinceLastSync < BACKGROUND_REFRESH_INTERVAL_MS) return;

    activeBackgroundUpdates.add(normalizedBookId);
    updateBookMetadata(normalizedBookId, (current) => {
        if (!current) return current;
        return {
            ...current,
            lastBackgroundSyncAt: Date.now()
        };
    });

    try {
        const cache = await openBookPartCache();
        if (!cache) return;

        const totalParts = normalizePartCount(metadata.partCount);
        let refreshedParts = 0;

        for (let partIndex = 0; partIndex < totalParts; partIndex += 1) {
            try {
                const response = await fetchBookPartResponseIfOk(normalizedBookId, partIndex);
                if (!response) continue;
                await cache.put(buildBookPartRequest(normalizedBookId, partIndex), response.clone());
                refreshedParts += 1;
            } catch (_) {
                // Keep the existing cached content and continue.
            }
        }

        if (refreshedParts > 0) {
            updateBookMetadata(normalizedBookId, (current) => {
                if (!current) return current;
                return {
                    ...current,
                    cachedParts: Math.max(current.cachedParts, refreshedParts),
                    updatedAt: Date.now()
                };
            });
        }
    } finally {
        activeBackgroundUpdates.delete(normalizedBookId);
    }
}

/**
 * @param {string|number} bookId
 * @param {number} [partIndex=0]
 * @param {Object} [options={}]
 * @param {boolean} [options.force=false]
 * @returns {Promise<string|null>}
 */
export async function fetchBookPartWithOfflinePriority(bookId, partIndex = 0, options = {}) {
    const normalizedBookId = normalizeBookId(bookId);
    if (!normalizedBookId) return null;

    const safePartIndex = normalizePartIndex(partIndex);
    const force = options.force === true;

    if (!force) {
        const cachedText = await getCachedBookPartText(normalizedBookId, safePartIndex);
        if (cachedText !== null) {
            markBookAsOpened(normalizedBookId);
            void maybeRefreshDownloadedBookInBackground(normalizedBookId);
            return cachedText;
        }
    }

    const networkResponse = await fetchBookPartResponseIfOk(normalizedBookId, safePartIndex);
    if (!networkResponse) return null;

    const responseForCache = networkResponse.clone();
    const networkText = await networkResponse.text();

    if (getBookMetadata(normalizedBookId)?.downloaded) {
        const cache = await openBookPartCache();
        if (cache) {
            await cache.put(buildBookPartRequest(normalizedBookId, safePartIndex), responseForCache);
            updateBookMetadata(normalizedBookId, (metadata) => {
                if (!metadata) return metadata;
                return {
                    ...metadata,
                    cachedParts: Math.max(Number(metadata.cachedParts) || 0, safePartIndex + 1),
                    updatedAt: Date.now(),
                    lastOpenedAt: Date.now()
                };
            });
        }
    }

    return networkText;
}
