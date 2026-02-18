const MAX_PARSED_CACHE_ENTRIES = 10;
const parsedPartCache = new Map();

function normalizeBookId(bookId) {
    return String(bookId ?? '').trim();
}

function normalizePartIndex(partIndex) {
    return Number.isInteger(partIndex) && partIndex >= 0 ? partIndex : 0;
}

function buildCacheKey(bookId, partIndex) {
    return `${normalizeBookId(bookId)}::${normalizePartIndex(partIndex)}`;
}

function enforceCacheLimit() {
    while (parsedPartCache.size > MAX_PARSED_CACHE_ENTRIES) {
        const oldestKey = parsedPartCache.keys().next().value;
        parsedPartCache.delete(oldestKey);
    }
}

export function getParsedPartCache(bookId, partIndex) {
    const key = buildCacheKey(bookId, partIndex);
    if (!parsedPartCache.has(key)) return null;

    const cached = parsedPartCache.get(key);
    parsedPartCache.delete(key);
    parsedPartCache.set(key, cached);
    return cached;
}

export function setParsedPartCache(bookId, partIndex, parsedContent) {
    const key = buildCacheKey(bookId, partIndex);
    parsedPartCache.delete(key);
    parsedPartCache.set(key, parsedContent);
    enforceCacheLimit();
}

export function clearParsedBookCache(bookId) {
    const prefix = `${normalizeBookId(bookId)}::`;
    [...parsedPartCache.keys()].forEach((key) => {
        if (key.startsWith(prefix)) {
            parsedPartCache.delete(key);
        }
    });
}