import { fetchBooksList } from '../books-repo.js';
import { getBookPartCount } from '../books-meta.js';
import { isFavorite, toggleFavorite } from '../favorites-store.js';
import { fetchBookParts } from '../book-content.js';
import { highlightTextIgnoringDiacritics, parseBookContent } from '../reader-parser.js';
import { toArabicIndicNumber, parsePageNumberInput } from './number-format.js';
import { getRequestedReaderState, syncReaderStateToUrl } from './url-state.js';
import { searchInBookIndex } from './search.js';
import {
    BOOKMARK_ICON_FILLED,
    BOOKMARK_ICON_OUTLINE,
    MAX_FONT_SIZE,
    MIN_FONT_SIZE,
    createReaderState
} from './constants.js';
import { getPartLabel, renderPartSelector, updatePartSelector } from './part-selector.js';
import { createPaginationController } from './pagination.js';
import { renderSearchResults } from './search-results.js';
import { closeSidebarOnCompactView, setupReaderUi } from './ui-shell.js';

const CHOOSE_BOOK_TITLE = 'اختر كتابًا';
const CHOOSE_BOOK_MESSAGE = 'لم يتم اختيار كتاب. عد إلى <a href="index.html">المكتبة</a> واختر عنوانًا.';
const UNKNOWN_BOOK_TITLE = 'كتاب غير معروف';
const READER_TITLE_SUFFIX = 'القارئ';
const BOOK_TEXT_LOAD_ERROR = 'تعذر تحميل نص الكتاب';
const BOOK_LOAD_ERROR_PREFIX = 'تعذر تحميل الكتاب';

const state = createReaderState();

const pagination = createPaginationController({
    state,
    toArabicIndicNumber,
    parsePageNumberInput,
    syncReaderStateToUrl
});

export async function initReaderPage() {
    setupUI();
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('book');
    if (!bookId) {
        renderMissingBookMessage();
        return;
    }

    await loadBook(bookId);
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
                searchIndex: state.searchIndex,
                searchInBookIndex,
                highlightTextIgnoringDiacritics,
                onOpenPage: (pageIndex) => pagination.renderPage(pageIndex, { chapterId: '' }),
                onOpenChapter: (pageIndex, chapterId) => pagination.goToPage(pageIndex, chapterId)
            });
        },
        isFavoriteBook: (bookId) => isFavorite(bookId),
        onToggleFavorite: (bookId) => toggleFavorite(bookId),
        bookmarkIcons: {
            active: BOOKMARK_ICON_FILLED,
            inactive: BOOKMARK_ICON_OUTLINE
        }
    });
}

function renderMissingBookMessage() {
    const readerContent = document.getElementById('readerContent');
    const bookTitleDisplay = document.getElementById('bookTitleDisplay');
    bookTitleDisplay.textContent = CHOOSE_BOOK_TITLE;
    readerContent.innerHTML = `<div class="reader-error">${CHOOSE_BOOK_MESSAGE}</div>`;
}

async function loadBook(id) {
    const readerContent = document.getElementById('readerContent');
    const bookTitleDisplay = document.getElementById('bookTitleDisplay');
    const requestedState = getRequestedReaderState();
    state.currentBookId = String(id);

    try {
        const books = await fetchBooksList();
        const info = books.find((book) => String(book.id) === String(id));
        state.currentBookPartCount = getBookPartCount(info || {});

        bookTitleDisplay.textContent = info?.title || UNKNOWN_BOOK_TITLE;
        document.title = info?.title ? `${info.title} | ${READER_TITLE_SUFFIX}` : READER_TITLE_SUFFIX;

        const parts = await fetchBookParts(id, state.currentBookPartCount);
        if (!parts || parts.length === 0) {
            throw new Error(BOOK_TEXT_LOAD_ERROR);
        }

        state.bookParts = parts.map((text, index) => ({
            text,
            label: getPartLabel(index, toArabicIndicNumber)
        }));
        renderBookPartSelector();

        const requestedPartIndex = Number.isInteger(requestedState.partIndex) ? requestedState.partIndex : 0;
        const maxPartIndex = Math.max(state.bookParts.length - 1, 0);
        const safePartIndex = Math.min(Math.max(requestedPartIndex, 0), maxPartIndex);

        loadBookPart(safePartIndex, {
            pageIndex: requestedState.pageIndex,
            chapterId: requestedState.chapterId
        });
    } catch (error) {
        readerContent.innerHTML = `<div class="reader-error">${BOOK_LOAD_ERROR_PREFIX}: ${error.message}</div>`;
    }
}

function renderBookPartSelector() {
    renderPartSelector({
        state,
        onSelectPart: (partIndex) => {
            loadBookPart(partIndex);
        },
        onAfterSelectPart: closeSidebarOnCompactView
    });
}

function loadBookPart(partIndex, options = {}) {
    if (state.bookParts.length === 0) return;

    const safeIndex = Math.min(Math.max(partIndex, 0), state.bookParts.length - 1);
    const safePageIndex = Number.isInteger(options.pageIndex) ? options.pageIndex : 0;
    const chapterId = typeof options.chapterId === 'string' ? options.chapterId : '';

    state.currentPartIndex = safeIndex;
    parseBook(state.bookParts[safeIndex].text, safePageIndex, chapterId);
    updatePartSelector(state);
}

function parseBook(text, initialPageIndex = 0, initialChapterId = '') {
    const parsed = parseBookContent(text);
    state.pageHtml = parsed.pageHtml;
    state.chapters = parsed.chapters;
    state.searchIndex = parsed.searchIndex;
    state.currentPageIndex = 0;

    pagination.renderSidebar(parsed.chapters, closeSidebarOnCompactView);
    pagination.renderPage(initialPageIndex, { chapterId: initialChapterId });
}

function changeFontSize(delta) {
    state.fontSize = Math.min(Math.max(state.fontSize + delta, MIN_FONT_SIZE), MAX_FONT_SIZE);
    const readerContent = document.getElementById('readerContent');
    readerContent.style.fontSize = `${state.fontSize}px`;
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
