const STORAGE_KEY = 'ciyoku-reader-position-v1';
let cachedPositions = null;

function clampValue(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function normalizeBookId(bookId) {
    return String(bookId ?? '').trim();
}

function normalizeIndex(value, fallback = 0) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isInteger(parsed) || parsed < 0) {
        return fallback;
    }
    return parsed;
}

function normalizeTimestamp(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return 0;
    }
    return parsed;
}

function loadStoredPositions() {
    if (cachedPositions) return cachedPositions;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            cachedPositions = {};
            return cachedPositions;
        }
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            cachedPositions = parsed;
            return cachedPositions;
        }
    } catch (_) {
        cachedPositions = {};
        return cachedPositions;
    }
    cachedPositions = {};
    return cachedPositions;
}

function persistStoredPositions(positions) {
    cachedPositions = positions;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
    } catch (_) {
        // Ignore storage write errors (private mode, blocked storage, etc.).
    }
}

function getScrollRoot() {
    if (typeof document === 'undefined') return null;
    return document.scrollingElement || document.documentElement;
}

export function getStoredReadingPosition(bookId) {
    const key = normalizeBookId(bookId);
    if (!key) return null;

    const positions = loadStoredPositions();
    const entry = positions[key];
    if (!entry || typeof entry !== 'object') return null;

    const partIndex = normalizeIndex(entry.partIndex, 0);
    const pageIndex = normalizeIndex(entry.pageIndex, 0);
    const chapterId = typeof entry.chapterId === 'string' ? entry.chapterId : '';
    const scrollRatio = Number.isFinite(entry.scrollRatio)
        ? clampValue(entry.scrollRatio, 0, 1)
        : 0;

    return {
        bookId: key,
        partIndex,
        pageIndex,
        chapterId,
        scrollRatio
    };
}

export function getMostRecentStoredReadingPosition() {
    const positions = loadStoredPositions();
    const entries = Object.entries(positions);
    if (!entries.length) return null;

    let latest = null;

    entries.forEach(([bookId, rawEntry]) => {
        if (!rawEntry || typeof rawEntry !== 'object') return;

        const key = normalizeBookId(bookId);
        if (!key) return;

        const updatedAt = normalizeTimestamp(rawEntry.updatedAt);
        if (latest && updatedAt < latest.updatedAt) return;

        const partIndex = normalizeIndex(rawEntry.partIndex, 0);
        const pageIndex = normalizeIndex(rawEntry.pageIndex, 0);
        const chapterId = typeof rawEntry.chapterId === 'string' ? rawEntry.chapterId : '';
        const scrollRatio = Number.isFinite(rawEntry.scrollRatio)
            ? clampValue(rawEntry.scrollRatio, 0, 1)
            : 0;

        latest = {
            bookId: key,
            partIndex,
            pageIndex,
            chapterId,
            scrollRatio,
            updatedAt
        };
    });

    if (!latest) return null;

    return {
        bookId: latest.bookId,
        partIndex: latest.partIndex,
        pageIndex: latest.pageIndex,
        chapterId: latest.chapterId,
        scrollRatio: latest.scrollRatio
    };
}

export function updateStoredReadingPosition(bookId, position = {}) {
    const key = normalizeBookId(bookId);
    if (!key) return;

    const positions = loadStoredPositions();
    const previous = positions[key] && typeof positions[key] === 'object' ? positions[key] : {};
    const previousPart = normalizeIndex(previous.partIndex, -1);
    const previousPage = normalizeIndex(previous.pageIndex, -1);

    const partIndex = normalizeIndex(position.partIndex, previousPart >= 0 ? previousPart : 0);
    const pageIndex = normalizeIndex(position.pageIndex, previousPage >= 0 ? previousPage : 0);
    const chapterId = typeof position.chapterId === 'string'
        ? position.chapterId
        : typeof previous.chapterId === 'string'
            ? previous.chapterId
            : '';

    let scrollRatio = null;
    if (Number.isFinite(position.scrollRatio)) {
        scrollRatio = clampValue(position.scrollRatio, 0, 1);
    } else if (partIndex === previousPart && pageIndex === previousPage && Number.isFinite(previous.scrollRatio)) {
        scrollRatio = clampValue(previous.scrollRatio, 0, 1);
    } else {
        scrollRatio = 0;
    }

    positions[key] = {
        partIndex,
        pageIndex,
        chapterId,
        scrollRatio,
        updatedAt: Date.now()
    };

    persistStoredPositions(positions);
}

export function getScrollRatio() {
    if (typeof window === 'undefined') return 0;
    const root = getScrollRoot();
    if (!root) return 0;
    const maxScrollTop = Math.max(0, root.scrollHeight - window.innerHeight);
    if (maxScrollTop <= 0) return 0;
    return clampValue(root.scrollTop / maxScrollTop, 0, 1);
}

export function restoreScrollRatio(scrollRatio) {
    if (typeof window === 'undefined') return;
    const root = getScrollRoot();
    if (!root) return;
    const ratio = Number.isFinite(scrollRatio) ? clampValue(scrollRatio, 0, 1) : 0;

    const applyScroll = () => {
        const maxScrollTop = Math.max(0, root.scrollHeight - window.innerHeight);
        if (maxScrollTop <= 0) return;
        const target = Math.round(maxScrollTop * ratio);
        window.scrollTo({ top: target, behavior: 'auto' });
    };

    requestAnimationFrame(() => {
        applyScroll();
        requestAnimationFrame(applyScroll);
    });
}
