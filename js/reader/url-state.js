import { parsePartParam, toPartParam } from '../books-meta.js';

function getFallbackHref() {
    if (typeof window !== 'undefined' && window.location?.href) {
        return window.location.href;
    }

    return 'https://example.invalid/reader.html';
}

function parsePageIndex(pageValue) {
    const requestedPage = Number.parseInt(String(pageValue ?? ''), 10);
    if (!Number.isInteger(requestedPage) || requestedPage < 1) {
        return 0;
    }

    return requestedPage - 1;
}

export function parseReaderStateFromSearchParams(searchParams) {
    const params = searchParams instanceof URLSearchParams
        ? searchParams
        : new URLSearchParams(searchParams ?? '');

    return {
        partIndex: parsePartParam(params.get('part')),
        pageIndex: parsePageIndex(params.get('page')),
        chapterId: params.get('chapter') || ''
    };
}

export function buildReaderUrlForState(state, currentHref = getFallbackHref()) {
    if (!state.currentBookId) return null;

    const url = new URL(currentHref);
    url.searchParams.set('book', String(state.currentBookId));
    url.searchParams.set('page', String(state.currentPageIndex + 1));

    if (state.currentBookPartCount > 1 && state.currentPartIndex > 0) {
        url.searchParams.set('part', toPartParam(state.currentPartIndex));
    } else {
        url.searchParams.delete('part');
    }

    if (state.currentChapterId) {
        url.searchParams.set('chapter', state.currentChapterId);
    } else {
        url.searchParams.delete('chapter');
    }

    return url;
}

export function getRequestedReaderState() {
    return parseReaderStateFromSearchParams(new URLSearchParams(window.location.search));
}

export function syncReaderStateToUrl(state) {
    const url = buildReaderUrlForState(state, window.location.href);
    if (!url) return;

    history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}`);
}
