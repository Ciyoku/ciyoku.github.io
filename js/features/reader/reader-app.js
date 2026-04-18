import { fetchBooksList } from '../../core/books-repo.js';
import { getBookPartCount } from '../../core/books-meta.js';
import { clearBookPartCache, fetchBookPart } from '../../core/book-content.js';
import { createHighlightedTextFragment, parseBookContentAsync } from '../../core/reader-parser.js';
import { toArabicIndicNumber } from '../../shared/number-format.js';
import { renderLucideIcons } from '../../shared/lucide.js';
import { createIosLoader } from '../../shared/loading-indicator.js';
import { getRequestedReaderState, updateReaderStateInUrl } from './url-state.js';
import { createSearchEngine, searchInBookIndex } from './search.js';
import { createReaderState } from './constants.js';
import { createPaginationController } from './pagination.js';
import { renderSearchResults } from './search-results.js';
import { closeSidebarOnCompactView, setupReaderUi } from './ui-shell.js';
import { clearParsedBookCache, getParsedPartCache, setParsedPartCache } from './parsed-content-cache.js';
import { setCanonicalUrl } from '../../shared/seo.js';
import { SITE_NAME } from '../../core/site-config.js';
import { buildBookPartState, canPreloadNextPart } from './part-state.js';
import { createReaderPartLoader } from './part-loader.js';
import { updateReaderSeo as applyReaderSeoMetadata } from './reader-seo.js';
import { bindReaderPopstateNavigation } from './popstate-navigation.js';
import { createReaderDownloadController } from './download-controller.js';
import {
    getScrollRatio,
    getMostRecentStoredReadingPosition,
    getStoredReadingPosition,
    restoreScrollRatio,
    updateStoredReadingPosition
} from './reading-position.js';
import {
    UNKNOWN_BOOK_TITLE,
    READER_TITLE_SUFFIX,
    getBookTitleDisplay,
    renderReaderError,
    renderReaderLoading,
    renderMissingBookMessage,
    setDocumentTitle
} from './view.js';

const BOOK_TEXT_LOAD_ERROR = 'تعذر تحميل نص الكتاب';
const BOOK_LOAD_ERROR_PREFIX = 'تعذر تحميل الكتاب';
const PART_LOAD_ERROR_PREFIX = 'تعذر تحميل هذا الجزء';

function clampValue(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

const state = createReaderState();
let activeBookInfo = null;
let loadBookPart = async () => {};
let readerDownloadController = null;
const READING_POSITION_SAVE_DELAY = 200;
let scrollSaveTimer = null;
let pendingRestorePosition = null;
let readingPositionBound = false;

function shouldRestoreStoredPosition(requestedState) {
    if (!requestedState || typeof requestedState !== 'object') return true;
    return !requestedState.hasExplicitPart
        && !requestedState.hasExplicitPage
        && !requestedState.hasExplicitChapter;
}

function saveReadingPosition({ includeScroll = false } = {}) {
    if (!state.currentBookId || !state.pageBlocks.length) return;
    const position = {
        partIndex: state.currentPartIndex,
        pageIndex: state.currentPageIndex,
        chapterId: state.currentChapterId || ''
    };
    if (includeScroll) {
        position.scrollRatio = getScrollRatio();
    }
    updateStoredReadingPosition(state.currentBookId, position);
}

function scheduleScrollSave() {
    if (scrollSaveTimer) return;
    scrollSaveTimer = window.setTimeout(() => {
        scrollSaveTimer = null;
        saveReadingPosition({ includeScroll: true });
    }, READING_POSITION_SAVE_DELAY);
}

function flushReadingPosition() {
    if (scrollSaveTimer) {
        clearTimeout(scrollSaveTimer);
        scrollSaveTimer = null;
    }
    saveReadingPosition({ includeScroll: true });
}

function handlePageRender() {
    if (pendingRestorePosition) {
        const restore = pendingRestorePosition;
        pendingRestorePosition = null;
        if (state.currentBookId === restore.bookId && state.currentPartIndex === restore.partIndex) {
            restoreScrollRatio(restore.scrollRatio);
            saveReadingPosition({ includeScroll: false });
            return;
        }
    }
    saveReadingPosition({ includeScroll: false });
}

function bindReadingPositionTracking() {
    if (readingPositionBound) return;
    readingPositionBound = true;

    window.addEventListener('scroll', scheduleScrollSave, { passive: true });
    window.addEventListener('pagehide', flushReadingPosition);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flushReadingPosition();
        }
    });
}

const pagination = createPaginationController({
    state,
    toArabicIndicNumber,
    updateReaderStateInUrl,
    onPageRender: handlePageRender,
    renderLucideIcons,
    onSelectPart: (partIndex) => {
        closeSidebarOnCompactView();
        return loadBookPart(partIndex, { historyMode: 'push' });
    }
});

function updateReaderSeo() {
    applyReaderSeoMetadata(state, activeBookInfo, {
        siteName: SITE_NAME,
        unknownBookTitle: UNKNOWN_BOOK_TITLE,
        readerTitleSuffix: READER_TITLE_SUFFIX
    });
}

const partLoader = createReaderPartLoader({
    state,
    clamp: clampValue,
    createSearchEngine,
    fetchBookPart,
    parseBookContentAsync,
    getParsedPartCache,
    setParsedPartCache,
    syncPartNavigation: () => {
        pagination.syncPartNavigation();
    },
    pagination,
    updateReaderSeo,
    renderReaderLoading,
    renderReaderError,
    onPartStatusChange: () => {
        pagination.syncPartNavigation();
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
        state.currentBookId = '';
        pendingRestorePosition = null;
        readerDownloadController?.setBook(null);
        renderMissingBookMessage();
        return;
    }

    resetBookCachesForSwitch(normalizedId);
    pendingRestorePosition = null;

    state.currentBookId = normalizedId;
    renderReaderLoading();

    try {
        const books = await fetchBooksList();
        const info = books.find((book) => String(book.id) === normalizedId);

        if (!info) {
            activeBookInfo = null;
            readerDownloadController?.setBook(null);
            getBookTitleDisplay().textContent = UNKNOWN_BOOK_TITLE;
            renderReaderError('الكتاب المطلوب غير موجود في الفهرس.');
            setCanonicalUrl('reader.html');
            return;
        }

        activeBookInfo = info;
        readerDownloadController?.setBook(info);
        state.currentBookPartCount = getBookPartCount(info);
        state.bookParts = buildBookPartState(state.currentBookPartCount, toArabicIndicNumber);

        const titleDisplay = getBookTitleDisplay();
        titleDisplay.textContent = info.title || UNKNOWN_BOOK_TITLE;
        setDocumentTitle(info);

        const requestedState = getRequestedReaderState();
        const storedPosition = shouldRestoreStoredPosition(requestedState)
            ? getStoredReadingPosition(normalizedId)
            : null;
        pendingRestorePosition = storedPosition;

        const initialState = storedPosition
            ? {
                partIndex: storedPosition.partIndex,
                pageIndex: storedPosition.pageIndex,
                chapterId: storedPosition.chapterId
            }
            : {
                partIndex: Number.isInteger(requestedState.partIndex) ? requestedState.partIndex : 0,
                pageIndex: Number.isInteger(requestedState.pageIndex) ? requestedState.pageIndex : 0,
                chapterId: String(requestedState.chapterId ?? '')
            };
        const safePartIndex = clampValue(initialState.partIndex, 0, Math.max(state.bookParts.length - 1, 0));

        state.currentPartIndex = safePartIndex;
        if (pendingRestorePosition) {
            pendingRestorePosition = {
                ...pendingRestorePosition,
                bookId: normalizedId,
                partIndex: safePartIndex
            };
        }
        updateReaderSeo();
        pagination.syncPartNavigation();
        await loadBookPart(safePartIndex, {
            pageIndex: initialState.pageIndex,
            chapterId: initialState.chapterId,
            historyMode: 'replace',
            scrollMode: pendingRestorePosition ? 'none' : undefined
        });
    } catch (error) {
        renderReaderError(`${BOOK_LOAD_ERROR_PREFIX}: ${error.message || BOOK_TEXT_LOAD_ERROR}`);
    }
}

function setupUI() {
    setupReaderUi({
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
        }
    });
}

function redirectToReaderBook(bookId) {
    const normalizedBookId = String(bookId ?? '').trim();
    if (!normalizedBookId) return false;

    const params = new URLSearchParams();
    params.set('book', normalizedBookId);
    window.location.replace(`reader.html?${params.toString()}`);
    return true;
}

function handleResumeActionIntent() {
    const latestPosition = getMostRecentStoredReadingPosition();
    if (!latestPosition || !latestPosition.bookId) {
        window.location.replace('index.html');
        return true;
    }

    return redirectToReaderBook(latestPosition.bookId);
}

export async function initReaderPage() {
    readerDownloadController = createReaderDownloadController({
        renderLucideIcons,
        createIosLoader
    });
    setupUI();
    bindReadingPositionTracking();
    bindReaderPopstateNavigation({
        state,
        getRequestedReaderState,
        renderMissingBookMessage,
        loadBook: (bookId) => loadBook(bookId),
        loadBookPart: (partIndex, options) => loadBookPart(partIndex, options)
    });

    const urlParams = new URLSearchParams(window.location.search);
    const action = String(urlParams.get('action') ?? '').trim().toLowerCase();
    if (action === 'resume') {
        handleResumeActionIntent();
        return;
    }

    const bookId = urlParams.get('book');
    if (!bookId) {
        state.currentBookId = '';
        readerDownloadController?.setBook(null);
        renderMissingBookMessage();
        return;
    }

    await loadBook(bookId);
}
