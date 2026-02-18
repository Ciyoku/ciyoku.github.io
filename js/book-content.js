function getBookPartFileName(partIndex) {
    return partIndex === 0 ? 'book.txt' : `book${partIndex + 1}.txt`;
}

const BOOK_LOAD_ERROR_MESSAGE = 'تعذر تحميل نص الكتاب';
const MAX_PART_CACHE_ENTRIES = 24;
const partFetchCache = new Map();

function normalizeBookPathId(bookId) {
    return encodeURIComponent(String(bookId ?? '').trim());
}

async function fetchTextIfOk(url) {
    const response = await fetch(url, {
        headers: {
            Accept: 'text/plain, text/*;q=0.9, */*;q=0.1'
        }
    });
    if (!response.ok) return null;
    return response.text();
}

function getPartCacheKey(bookId, partIndex) {
    return `${normalizeBookPathId(bookId)}::${partIndex}`;
}

function normalizePartIndex(partIndex) {
    if (!Number.isInteger(partIndex) || partIndex < 0) return 0;
    return partIndex;
}

function setCacheEntry(key, value) {
    partFetchCache.delete(key);
    partFetchCache.set(key, value);

    while (partFetchCache.size > MAX_PART_CACHE_ENTRIES) {
        const oldestKey = partFetchCache.keys().next().value;
        partFetchCache.delete(oldestKey);
    }
}

export async function fetchBookPart(bookId, partIndex = 0, options = {}) {
    const normalizedBookId = normalizeBookPathId(bookId);
    if (!normalizedBookId) {
        throw new Error(BOOK_LOAD_ERROR_MESSAGE);
    }

    const safePartIndex = normalizePartIndex(partIndex);
    const force = options.force === true;
    const cacheKey = getPartCacheKey(bookId, safePartIndex);

    if (!force && partFetchCache.has(cacheKey)) {
        return partFetchCache.get(cacheKey);
    }

    const request = fetchTextIfOk(`books/${normalizedBookId}/${getBookPartFileName(safePartIndex)}`);
    setCacheEntry(cacheKey, request);

    try {
        return await request;
    } catch (error) {
        partFetchCache.delete(cacheKey);
        throw error;
    }
}

export function clearBookPartCache(bookId) {
    const prefix = `${normalizeBookPathId(bookId)}::`;
    [...partFetchCache.keys()].forEach((key) => {
        if (key.startsWith(prefix)) {
            partFetchCache.delete(key);
        }
    });
}

// Backward-compatible helper for callers that still need bulk loading.
export async function fetchBookParts(bookId, expectedPartCount = 1) {
    const normalizedBookId = normalizeBookPathId(bookId);
    if (!normalizedBookId) {
        throw new Error(BOOK_LOAD_ERROR_MESSAGE);
    }

    const totalParts = Number.isInteger(expectedPartCount) && expectedPartCount > 1 ? expectedPartCount : 1;
    const parts = [];

    for (let index = 0; index < totalParts; index++) {
        const partText = await fetchBookPart(bookId, index);
        if (partText === null) {
            if (index === 0) {
                throw new Error(BOOK_LOAD_ERROR_MESSAGE);
            }
            break;
        }
        parts.push(partText);
    }

    return parts;
}