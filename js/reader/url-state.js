import { parsePartParam, toPartParam } from '../books-meta.js';
import { SITE_URL } from '../site-config.js';

function getFallbackHref() {
    if (typeof window !== 'undefined' && window.location?.href) {
        return window.location.href;
    }

    return `${SITE_URL}/reader.html`;
}

function parsePageIndex(pageValue) {
    const requestedPage = Number.parseInt(String(pageValue ?? ''), 10);
    if (!Number.isInteger(requestedPage) || requestedPage < 1) {
        return 0;
    }

    return requestedPage - 1;
}

function parseReaderStateFromSearchParams(searchParams) {
    const params = searchParams instanceof URLSearchParams
        ? searchParams
        : new URLSearchParams(searchParams ?? '');

    const partRaw = params.get('part');
    const pageRaw = params.get('page');
    const chapterRaw = params.get('chapter');

    return {
        partIndex: parsePartParam(partRaw),
        pageIndex: parsePageIndex(pageRaw),
        chapterId: chapterRaw || '',
        hasExplicitPart: params.has('part'),
        hasExplicitPage: params.has('page'),
        hasExplicitChapter: params.has('chapter')
    };
}

function buildReaderUrlForState(state, currentHref = getFallbackHref()) {
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

export function updateReaderStateInUrl(state, options = {}) {
    const mode = options.mode === 'push' ? 'push' : 'replace';
    const url = buildReaderUrlForState(state, window.location.href);
    if (!url) return;

    const nextUrl = `${url.pathname}?${url.searchParams.toString()}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl === currentUrl) return;

    if (mode === 'push') {
        history.pushState(null, '', nextUrl);
        return;
    }

    history.replaceState(null, '', nextUrl);
}
