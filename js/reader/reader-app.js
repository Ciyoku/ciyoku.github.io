import { fetchBooksList } from '../books-repo.js';
import { getBookPartCount, toPartParam } from '../books-meta.js';
import { isFavorite, toggleFavorite } from '../favorites-store.js';
import { clearBookPartCache, fetchBookPart } from '../book-content.js';
import { createHighlightedTextFragment, parseBookContentAsync } from '../reader-parser.js';
import { toArabicIndicNumber, parsePageNumberInput } from './number-format.js';
import { getRequestedReaderState, updateReaderStateInUrl } from './url-state.js';
import { createSearchEngine, searchInBookIndex } from './search.js';
import {
    MAX_FONT_SIZE,
    MIN_FONT_SIZE,
    applyBookmarkIcon,
    createReaderState
} from './constants.js';
import { renderPartSelector, updatePartSelector } from './part-selector.js';
import { createPaginationController } from './pagination.js';
import { renderSearchResults } from './search-results.js';
import { closeSidebarOnCompactView, setupReaderUi } from './ui-shell.js';
import {
    loadBookProgress,
    loadReaderPreferences,
    resolveRequestedState,
    saveBookProgress,
    saveReaderPreferences
} from './persistence.js';
import { clearParsedBookCache, getParsedPartCache, setParsedPartCache } from './parsed-content-cache.js';
import { setCanonicalUrl, setSocialMetadata } from '../shared/seo.js';
import { SITE_NAME } from '../site-config.js';
import { buildBookPartState, canPreloadNextPart } from './part-state.js';
import { createReaderPartLoader } from './part-loader.js';
import {
    UNKNOWN_BOOK_TITLE,
    READER_TITLE_SUFFIX,
    getBookTitleDisplay,
    getReaderContent,
    renderReaderError,
    renderReaderLoading,
    renderMissingBookMessage,
    setDocumentTitle
} from './view.js';

const BOOK_TEXT_LOAD_ERROR = 'تعذر تحميل نص الكتاب';
const BOOK_LOAD_ERROR_PREFIX = 'تعذر تحميل الكتاب';
const PART_LOAD_ERROR_PREFIX = 'تعذر تحميل هذا الجزء';

const state = createReaderState();
let popstateBound = false;
let activeBookInfo = null;
let loadBookPart = async () => {};

const pagination = createPaginationController({
    state,
    toArabicIndicNumber,
    parsePageNumberInput,
    updateReaderStateInUrl,
    onPageRender: () => {
        persistReadingProgress();
    }
});

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getReaderCanonicalPath() {
    if (!state.currentBookId) return 'reader.html';

    const params = new URLSearchParams();
    params.set('book', String(state.currentBookId));

    if (state.currentBookPartCount > 1 && state.currentPartIndex > 0) {
        params.set('part', toPartParam(state.currentPartIndex));
    }

    return `reader.html?${params.toString()}`;
}

function updateReaderSeo() {
    const title = activeBookInfo?.title || UNKNOWN_BOOK_TITLE;
    const fullTitle = `${title} | ${READER_TITLE_SUFFIX} | ${SITE_NAME}`;
    const description = `قراءة كتاب ${title} داخل ${SITE_NAME} مع فهرس فصول وبحث داخل النص.`;

    setSocialMetadata({
        title: fullTitle,
        description,
        url: getReaderCanonicalPath()
    });
}

function applyStoredPreferences() {
    const stored = loadReaderPreferences();
    if (!Number.isFinite(stored.fontSize)) return;
    state.fontSize = clamp(Math.round(stored.fontSize), MIN_FONT_SIZE, MAX_FONT_SIZE);
    getReaderContent().style.fontSize = `${state.fontSize}px`;
}

function persistReadingProgress() {
    if (!state.currentBookId) return;
    saveBookProgress(state.currentBookId, {
        partIndex: state.currentPartIndex,
        pageIndex: state.currentPageIndex,
        chapterId: state.currentChapterId
    });
}

function renderBookPartSelector() {
    renderPartSelector({
        state,
        onSelectPart: async (partIndex) => {
            await loadBookPart(partIndex, { historyMode: 'push' });
        },
        onAfterSelectPart: closeSidebarOnCompactView
    });
}

const partLoader = createReaderPartLoader({
    state,
    clamp,
    createSearchEngine,
    fetchBookPart,
    parseBookContentAsync,
    getParsedPartCache,
    setParsedPartCache,
    updatePartSelector,
    pagination,
    updateReaderSeo,
    renderReaderLoading,
    renderReaderError,
    onPartStatusChange: () => {
        renderBookPartSelector();
    },
    canPreloadNextPart,
    partLoadErrorPrefix: PART_LOAD_ERROR_PREFIX
});

loadBookPart = async (partIndex, options = {}) => {
    await partLoader.loadBookPart(partIndex, {
        ...options,
        onAfterChapterNavigate: closeSidebarOnCompactView
    });
};

function resetBookCachesForSwitch(normalizedId) {
    if (!state.currentBookId || state.currentBookId === normalizedId) return;

    partLoader.cancelPendingPartLoads();
    clearBookPartCache(state.currentBookId);
    clearParsedBookCache(state.currentBookId);
}

async function loadBook(bookId) {
    const normalizedId = String(bookId ?? '').trim();
    if (!normalizedId) {
        renderMissingBookMessage();
        return;
    }

    resetBookCachesForSwitch(normalizedId);

    state.currentBookId = normalizedId;
    renderReaderLoading();

    try {
        const books = await fetchBooksList();
        const info = books.find((book) => String(book.id) === normalizedId);

        if (!info) {
            activeBookInfo = null;
            getBookTitleDisplay().textContent = UNKNOWN_BOOK_TITLE;
            renderReaderError('الكتاب المطلوب غير موجود في الفهرس.');
            setCanonicalUrl('reader.html');
            return;
        }

        activeBookInfo = info;
        state.currentBookPartCount = getBookPartCount(info);
        state.bookParts = buildBookPartState(state.currentBookPartCount, toArabicIndicNumber);

        const titleDisplay = getBookTitleDisplay();
        titleDisplay.textContent = info.title || UNKNOWN_BOOK_TITLE;
        setDocumentTitle(info);

        const requestedState = getRequestedReaderState();
        const persistedState = loadBookProgress(normalizedId);
        const initialState = resolveRequestedState(requestedState, persistedState);
        const safePartIndex = clamp(initialState.partIndex, 0, Math.max(state.bookParts.length - 1, 0));

        state.currentPartIndex = safePartIndex;
        updateReaderSeo();

        renderBookPartSelector();
        await loadBookPart(safePartIndex, {
            pageIndex: initialState.pageIndex,
            chapterId: initialState.chapterId,
            historyMode: 'replace'
        });
    } catch (error) {
        renderReaderError(`${BOOK_LOAD_ERROR_PREFIX}: ${error.message || BOOK_TEXT_LOAD_ERROR}`);
    }
}

function bindPopstateNavigation() {
    if (popstateBound) return;
    popstateBound = true;

    window.addEventListener('popstate', async () => {
        const bookIdFromUrl = new URLSearchParams(window.location.search).get('book');
        if (!bookIdFromUrl) {
            renderMissingBookMessage();
            return;
        }

        if (String(bookIdFromUrl) !== state.currentBookId) {
            await loadBook(bookIdFromUrl);
            return;
        }

        const requested = getRequestedReaderState();
        const partIndex = Number.isInteger(requested.partIndex) ? requested.partIndex : state.currentPartIndex;
        await loadBookPart(partIndex, {
            pageIndex: requested.pageIndex,
            chapterId: requested.chapterId,
            historyMode: 'none'
        });
    });
}

function changeFontSize(delta) {
    state.fontSize = clamp(state.fontSize + delta, MIN_FONT_SIZE, MAX_FONT_SIZE);
    getReaderContent().style.fontSize = `${state.fontSize}px`;
    saveReaderPreferences({ fontSize: state.fontSize });
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        return;
    }

    if (document.exitFullscreen) {
        document.exitFullscreen();
    }
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupUI() {
    setupReaderUi({
        onControlAction: (action) => {
            switch (action) {
                case 'font-up':
                    changeFontSize(1);
                    break;
                case 'font-down':
                    changeFontSize(-1);
                    break;
                case 'fullscreen':
                    toggleFullscreen();
                    break;
                case 'top':
                    scrollToTop();
                    break;
                default:
                    break;
            }
        },
        onSearchQuery: (query, resultsContainer, closeSearchOverlay) => {
            renderSearchResults({
                query,
                resultsContainer,
                closeSearchOverlay,
                searchEngine: state.searchEngine,
                searchInBookIndex,
                createHighlightedTextFragment,
                onOpenPage: (pageIndex) => pagination.renderPage(pageIndex, { chapterId: '', historyMode: 'push' }),
                onOpenChapter: (pageIndex, chapterId) => pagination.goToPage(pageIndex, chapterId, { historyMode: 'push' })
            });
        },
        isFavoriteBook: (bookId) => isFavorite(bookId),
        onToggleFavorite: (bookId) => toggleFavorite(bookId),
        applyFavoriteIcon: (button, isActive) => applyBookmarkIcon(button, isActive)
    });
}

export async function initReaderPage() {
    applyStoredPreferences();
    setupUI();
    bindPopstateNavigation();

    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('book');
    if (!bookId) {
        renderMissingBookMessage();
        return;
    }

    await loadBook(bookId);
}
