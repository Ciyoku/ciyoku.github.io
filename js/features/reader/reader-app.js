import { fetchBooksList } from '../../core/books-repo.js';
import { getBookId, getBookPartCount, getBookTitle } from '../../core/books-meta.js';
import { clearBookPartCache, fetchBookPart } from '../../core/book-content.js';
import { createHighlightedTextFragment, parseBookContentAsync } from '../../core/reader-parser.js';
import { toArabicIndicNumber } from '../../shared/number-format.js';
import { renderLucideIcons } from '../../shared/lucide.js';
import { createIosLoader } from '../../shared/loading-indicator.js';
import { getRequestedReaderState, updateReaderStateInUrl } from './url-state.js';
import { createSearchEngine, searchInBookIndex } from './search.js';
import { createReaderState } from './constants.js';
import { renderPartSelector, updatePartSelector } from './part-selector.js';
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
import {
    getScrollRatio,
    getStoredReadingPosition,
    restoreScrollRatio,
    updateStoredReadingPosition
} from './reading-position.js';
import {
    downloadBookForOffline,
    getBookDownloadStatus,
    isOfflineBookStorageSupported
} from '../offline/book-offline-storage.js';
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
const DOWNLOAD_BOOK_ARIA_LABEL = 'تنزيل الكتاب للاستخدام دون اتصال';
const DOWNLOADED_BOOK_ARIA_LABEL = 'الكتاب محفوظ للاستخدام دون اتصال';
const DOWNLOADING_BOOK_ARIA_LABEL = 'جارٍ تنزيل الكتاب للاستخدام دون اتصال';

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

/**
 * @param {HTMLButtonElement} button
 * @param {'book-down'|'book-check'} iconName
 */
function setReaderDownloadButtonIcon(button, iconName) {
    const existingIcon = button.querySelector(`.lucide-${iconName}`);
    if (existingIcon) return;

    const iconHost = document.createElement('span');
    iconHost.className = 'reader-download-icon';
    iconHost.setAttribute('data-lucide', iconName);
    iconHost.setAttribute('aria-hidden', 'true');
    button.replaceChildren(iconHost);
    renderLucideIcons(button);
}

function createReaderDownloadController() {
    const button = document.getElementById('readerDownloadBtn');
    if (!(button instanceof HTMLButtonElement)) {
        return {
            setBook: () => {}
        };
    }

    if (!isOfflineBookStorageSupported()) {
        button.hidden = true;
        button.setAttribute('aria-hidden', 'true');
        return {
            setBook: () => {}
        };
    }

    let currentBook = null;
    let activeSyncToken = 0;
    let activeLocalDownloadBookId = '';

    /**
     * @param {Object} [options={}]
     * @param {boolean} [options.downloaded=false]
     * @param {boolean} [options.downloading=false]
     * @param {boolean} [options.disabled=false]
     */
    function setButtonVisualState(options = {}) {
        const downloaded = options.downloaded === true;
        const downloading = options.downloading === true;
        const disabled = options.disabled === true;

        if (downloading) {
            button.replaceChildren(createIosLoader({ size: 'sm', accent: true }));
        } else {
            const iconName = downloaded ? 'book-check' : 'book-down';
            setReaderDownloadButtonIcon(button, iconName);
        }

        button.classList.toggle('is-downloaded', downloaded);
        button.classList.toggle('is-downloading', downloading);
        button.disabled = downloading || disabled;

        const label = downloaded
            ? DOWNLOADED_BOOK_ARIA_LABEL
            : downloading
                ? DOWNLOADING_BOOK_ARIA_LABEL
                : DOWNLOAD_BOOK_ARIA_LABEL;

        button.setAttribute('aria-label', label);
        button.title = label;
    }

    async function syncButtonState(book, syncToken) {
        const bookId = getBookId(book);
        if (!bookId) {
            setButtonVisualState({ downloaded: false, downloading: false, disabled: true });
            return;
        }

        const partCount = getBookPartCount(book);
        const status = await getBookDownloadStatus(bookId, partCount);
        if (syncToken !== activeSyncToken) return;

        setButtonVisualState({
            downloaded: status.downloaded === true,
            downloading: status.downloading === true || activeLocalDownloadBookId === bookId
        });
    }

    button.addEventListener('click', async (event) => {
        event.preventDefault();
        if (!currentBook) return;

        const bookId = getBookId(currentBook);
        if (!bookId || activeLocalDownloadBookId === bookId) return;

        const partCount = getBookPartCount(currentBook);
        const status = await getBookDownloadStatus(bookId, partCount);
        if (status.downloaded) {
            await syncButtonState(currentBook, activeSyncToken);
            return;
        }

        activeLocalDownloadBookId = bookId;
        setButtonVisualState({ downloaded: false, downloading: true });

        try {
            await downloadBookForOffline({
                id: bookId,
                title: getBookTitle(currentBook),
                parts: partCount
            }, {
                onProgress: () => {
                    // Keep the loader visible during active download.
                    if (!button.isConnected) return;
                    setButtonVisualState({ downloaded: false, downloading: true });
                }
            });
        } catch (error) {
            if (typeof console !== 'undefined' && typeof console.error === 'function') {
                console.error('Offline book download failed:', error);
            }
        } finally {
            if (activeLocalDownloadBookId === bookId) {
                activeLocalDownloadBookId = '';
            }
            await syncButtonState(currentBook, activeSyncToken);
        }
    });

    setButtonVisualState({ downloaded: false, downloading: false, disabled: true });

    return {
        setBook(book) {
            currentBook = book && typeof book === 'object' ? book : null;
            activeSyncToken += 1;
            if (!currentBook) {
                setButtonVisualState({ downloaded: false, downloading: false, disabled: true });
                return;
            }
            void syncButtonState(currentBook, activeSyncToken);
        }
    };
}

const pagination = createPaginationController({
    state,
    toArabicIndicNumber,
    updateReaderStateInUrl,
    onPageRender: handlePageRender,
    renderLucideIcons
});

function updateReaderSeo() {
    applyReaderSeoMetadata(state, activeBookInfo, {
        siteName: SITE_NAME,
        unknownBookTitle: UNKNOWN_BOOK_TITLE,
        readerTitleSuffix: READER_TITLE_SUFFIX
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
    clamp: clampValue,
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

        renderBookPartSelector();
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

export async function initReaderPage() {
    readerDownloadController = createReaderDownloadController();
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
    const bookId = urlParams.get('book');
    if (!bookId) {
        state.currentBookId = '';
        readerDownloadController?.setBook(null);
        renderMissingBookMessage();
        return;
    }

    await loadBook(bookId);
}
