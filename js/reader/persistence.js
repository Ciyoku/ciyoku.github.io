const STORAGE_KEY = 'shiaLibReaderState';

function normalizeBookId(bookId) {
    return String(bookId ?? '').trim();
}

function normalizeInteger(value, fallback = 0, min = 0) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < min) return fallback;
    return parsed;
}

function readStore() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { fontSize: null, books: {} };
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { fontSize: null, books: {} };
        const books = parsed.books && typeof parsed.books === 'object' ? parsed.books : {};
        const fontSize = Number.isFinite(parsed.fontSize) ? parsed.fontSize : null;
        return { fontSize, books };
    } catch (_) {
        return { fontSize: null, books: {} };
    }
}

function writeStore(store) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        return true;
    } catch (_) {
        return false;
    }
}

export function loadReaderPreferences() {
    const store = readStore();
    return {
        fontSize: Number.isFinite(store.fontSize) ? store.fontSize : null
    };
}

export function saveReaderPreferences({ fontSize }) {
    const store = readStore();
    store.fontSize = Number.isFinite(fontSize) ? fontSize : null;
    return writeStore(store);
}

export function loadBookProgress(bookId) {
    const id = normalizeBookId(bookId);
    if (!id) return null;

    const store = readStore();
    const progress = store.books[id];
    if (!progress || typeof progress !== 'object') return null;

    return {
        partIndex: normalizeInteger(progress.partIndex, 0, 0),
        pageIndex: normalizeInteger(progress.pageIndex, 0, 0),
        chapterId: String(progress.chapterId ?? ''),
        updatedAt: Number.isFinite(progress.updatedAt) ? progress.updatedAt : null
    };
}

export function saveBookProgress(bookId, progress) {
    const id = normalizeBookId(bookId);
    if (!id || !progress || typeof progress !== 'object') return false;

    const store = readStore();
    store.books[id] = {
        partIndex: normalizeInteger(progress.partIndex, 0, 0),
        pageIndex: normalizeInteger(progress.pageIndex, 0, 0),
        chapterId: String(progress.chapterId ?? ''),
        updatedAt: Date.now()
    };
    return writeStore(store);
}

export function resolveRequestedState(requestedState, storedState) {
    const explicitPart = requestedState?.hasExplicitPart === true;
    const explicitPage = requestedState?.hasExplicitPage === true;
    const explicitChapter = requestedState?.hasExplicitChapter === true;

    if (explicitPart || explicitPage || explicitChapter || !storedState) {
        return {
            partIndex: explicitPart && Number.isInteger(requestedState?.partIndex) ? requestedState.partIndex : 0,
            pageIndex: explicitPage && Number.isInteger(requestedState?.pageIndex) ? requestedState.pageIndex : 0,
            chapterId: explicitChapter ? String(requestedState?.chapterId ?? '') : ''
        };
    }

    return {
        partIndex: Number.isInteger(storedState.partIndex) ? storedState.partIndex : 0,
        pageIndex: Number.isInteger(storedState.pageIndex) ? storedState.pageIndex : 0,
        chapterId: String(storedState.chapterId ?? '')
    };
}
