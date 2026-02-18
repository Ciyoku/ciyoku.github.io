import { fetchBookPart } from './book-content.js';
import { fetchBooksList } from './books-repo.js';
import {
    buildBookDetailsUrl,
    buildReaderUrlWithState,
    getBookId,
    getBookPartCount,
    getBookTitle
} from './books-meta.js';
import { toArabicIndicNumber } from './reader/number-format.js';
import { createHighlightedTextFragment, normalizeArabicForSearch } from './reader-parser.js';
import { onDomReady } from './shared/bootstrap.js';
import { hasMinimumQueryWords } from './shared/query-words.js';
import {
    createBookListItem,
    renderListMessage
} from './book-list-ui.js';
import {
    filterBooksByCategory,
    normalizeCatalogText,
    populateCategoryFilter
} from './catalog-page-core.js';
import {
    EMPTY_SEARCH_MESSAGE,
    EXCERPT_RADIUS,
    INITIAL_RESULTS_COUNT,
    INPUT_DEBOUNCE_MS,
    MAX_STORED_MATCHES,
    MIN_QUERY_WORDS,
    PAGE_SCAN_CHUNK_SIZE,
    RESULTS_BATCH_SIZE
} from './search/constants.js';
import { createMatchExcerpt, splitBookPages } from './search/excerpt.js';
import { createSearchSession, fillMatchesUntil } from './search/full-text-session.js';

onDomReady(initSearchPage);

async function yieldToBrowser() {
    await new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

async function initSearchPage() {
    const queryInput = document.getElementById('globalSearchInput');
    const categoryFilter = document.getElementById('searchCategoryFilter');
    const status = document.getElementById('searchStatus');
    const resultsContainer = document.getElementById('searchResults');
    const loadControls = document.getElementById('searchLoadControls');
    const loadMoreButton = document.getElementById('searchLoadMoreButton');
    const loadSentinel = document.getElementById('searchLoadSentinel');

    if (!queryInput || !status || !resultsContainer) return;

    let books = [];
    let query = '';
    let categoryMode = 'all';
    let debounceTimer = null;
    let activeSearchToken = 0;
    let activeSearchSession = null;
    let visibleResultCount = 0;
    let renderedResultCount = 0;
    let loadMoreBusy = false;
    let hasUserScrolled = window.scrollY > 0;

    const urlParams = new URLSearchParams(window.location.search);
    query = urlParams.get('q') || '';
    categoryMode = urlParams.get('category') || 'all';
    queryInput.value = query;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 0) {
            hasUserScrolled = true;
        }
    }, { passive: true });

    const buildSearchMatch = ({ book, partIndex, pageIndex, line, normalizedQuery }) => {
        const parts = getBookPartCount(book);
        return {
            bookId: getBookId(book),
            title: getBookTitle(book),
            parts,
            readHref: buildReaderUrlWithState(book, { partIndex, pageIndex }),
            detailsHref: buildBookDetailsUrl(book),
            locationLabel: buildLocationLabel(parts, partIndex, pageIndex),
            excerpt: createMatchExcerpt(line, normalizedQuery, { radius: EXCERPT_RADIUS })
        };
    };

    const sessionDepsBase = {
        fetchBookPart,
        getBookId,
        getBookPartCount,
        getBookTitle,
        normalizeLine: normalizeArabicForSearch,
        splitPartToPages: splitBookPages,
        maxStoredMatches: MAX_STORED_MATCHES,
        pageScanChunkSize: PAGE_SCAN_CHUNK_SIZE,
        yieldToBrowser,
        buildMatch: buildSearchMatch
    };

    function setStatusMessage(message, tone = 'ok') {
        status.hidden = false;
        status.className = tone === 'error' ? 'status-error' : 'status-ok';
        status.textContent = message;
    }

    function clearStatusMessage() {
        status.hidden = true;
        status.className = 'status-ok';
        status.textContent = '';
    }

    function resetLoadControls() {
        if (!loadControls || !loadMoreButton) return;
        loadControls.hidden = true;
        loadMoreButton.disabled = false;
        loadMoreButton.textContent = 'تحميل المزيد';
    }

    function updateLoadControls() {
        if (!loadControls || !loadMoreButton) return;
        const session = activeSearchSession;
        if (!session) {
            resetLoadControls();
            return;
        }

        const hasBufferedResults = renderedResultCount < session.matches.length;
        const mayFetchMore = !session.completed && renderedResultCount > 0;
        const hasMoreToShow = hasBufferedResults || mayFetchMore;

        loadControls.hidden = !hasMoreToShow;
        if (!hasMoreToShow) {
            loadMoreButton.disabled = false;
            loadMoreButton.textContent = 'تحميل المزيد';
            return;
        }

        const blockingLoad = session.loading && !hasBufferedResults;
        loadMoreButton.disabled = blockingLoad;
        loadMoreButton.textContent = blockingLoad ? 'جاري التحميل...' : 'تحميل المزيد';
    }

    function cancelActiveSearch() {
        activeSearchToken += 1;
        activeSearchSession = null;
        visibleResultCount = 0;
        renderedResultCount = 0;
        loadMoreBusy = false;
        resetLoadControls();
    }

    function updateUrlState() {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (categoryMode !== 'all') params.set('category', categoryMode);

        const next = params.toString() ? `search.html?${params.toString()}` : 'search.html';
        history.replaceState(null, '', next);
    }

    function hydrateCategoryFilter(source) {
        categoryMode = populateCategoryFilter(categoryFilter, source, {
            currentValue: categoryMode,
            allLabel: 'كل التصنيفات',
            uncategorizedLabel: 'بدون تصنيف'
        });
    }

    function renderSearchPrompt() {
        cancelActiveSearch();
        resultsContainer.replaceChildren();
        resultsContainer.hidden = true;
        clearStatusMessage();
    }

    function buildLocationLabel(parts, partIndex, pageIndex) {
        const pageLabel = toArabicIndicNumber(pageIndex + 1);
        if (parts > 1) {
            const partLabel = toArabicIndicNumber(partIndex + 1);
            return `الموضع: الجزء ${partLabel} - الصفحة ${pageLabel}`;
        }

        return `الموضع: الصفحة ${pageLabel}`;
    }

    function createSearchResultItem(match, normalizedQuery) {
        const item = createBookListItem({
            bookId: match.bookId,
            title: match.title,
            readHref: match.readHref,
            detailsHref: '',
            favoriteButton: null,
            parts: match.parts
        });

        const card = item.querySelector('.book-card');
        if (!card) return item;

        const titleLink = card.querySelector('.book-link');
        if (titleLink) {
            titleLink.href = match.readHref;
        }

        card.querySelector('.book-actions')?.remove();
        card.classList.add('search-result-card');
        card.setAttribute('role', 'link');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `فتح النتيجة: ${match.title}`);

        const location = document.createElement('p');
        location.className = 'search-result-location';
        location.textContent = match.locationLabel;

        const snippet = document.createElement('p');
        snippet.className = 'search-result-snippet';
        snippet.appendChild(createHighlightedTextFragment(match.excerpt, normalizedQuery));

        const navigateToMatch = () => {
            window.location.href = match.readHref;
        };

        card.addEventListener('click', (event) => {
            const target = event.target;
            if (target instanceof Element && target.closest('a, button')) {
                return;
            }
            navigateToMatch();
        });

        card.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            navigateToMatch();
        });

        card.append(location, snippet);
        return item;
    }

    function updateSearchStatus(session) {
        if (session.error) {
            setStatusMessage(`تعذر استكمال البحث: ${session.error.message}`, 'error');
            return;
        }

        const foundLabel = toArabicIndicNumber(session.matches.length);

        if (!session.completed) {
            setStatusMessage(`تم العثور على ${foundLabel} نتيجة حتى الآن...`);
            return;
        }

        if (!session.matches.length) {
            setStatusMessage(EMPTY_SEARCH_MESSAGE);
            return;
        }

        if (session.reachedMatchCap) {
            setStatusMessage(`تم عرض أول ${foundLabel} نتيجة حفاظًا على الأداء. ضيّق كلمات البحث لنتائج أدق.`);
            return;
        }

        if (session.partialFailures > 0) {
            const failedLabel = toArabicIndicNumber(session.partialFailures);
            setStatusMessage(`تم العثور على ${foundLabel} نتيجة. تعذر فحص ${failedLabel} جزء.`);
            return;
        }

        setStatusMessage(`تم العثور على ${foundLabel} نتيجة.`);
    }

    function renderVisibleFullTextResults(session) {
        resultsContainer.hidden = false;
        const targetVisibleCount = Math.min(visibleResultCount, session.matches.length, MAX_STORED_MATCHES);

        if (!targetVisibleCount) {
            renderedResultCount = 0;
            if (session.error) {
                renderListMessage(resultsContainer, `تعذر البحث داخل النصوص: ${session.error.message}`);
                return;
            }

            if (!session.completed) {
                renderListMessage(resultsContainer, 'جاري البحث في النصوص...', 'loading');
                return;
            }

            renderListMessage(resultsContainer, EMPTY_SEARCH_MESSAGE, 'empty');
            return;
        }

        if (renderedResultCount === 0) {
            resultsContainer.replaceChildren();
        }

        for (let index = renderedResultCount; index < targetVisibleCount; index++) {
            const match = session.matches[index];
            if (!match) continue;
            resultsContainer.appendChild(createSearchResultItem(match, session.normalizedQuery));
        }

        renderedResultCount = targetVisibleCount;
    }

    async function ensureVisibleResults(token) {
        const session = activeSearchSession;
        if (!session || token !== activeSearchToken) return;

        visibleResultCount = Math.min(visibleResultCount, MAX_STORED_MATCHES);
        updateLoadControls();

        await fillMatchesUntil(session, visibleResultCount, {
            ...sessionDepsBase,
            isTokenActive: () => token === activeSearchToken
        });

        if (token !== activeSearchToken || session !== activeSearchSession) return;

        renderVisibleFullTextResults(session);
        updateSearchStatus(session);
        updateLoadControls();
    }

    async function startFullTextSearch(sourceBooks, normalizedQuery) {
        const token = ++activeSearchToken;
        activeSearchSession = createSearchSession(sourceBooks, normalizedQuery);
        visibleResultCount = INITIAL_RESULTS_COUNT;
        renderedResultCount = 0;
        loadMoreBusy = false;

        resultsContainer.hidden = false;
        renderListMessage(resultsContainer, 'جاري البحث في نصوص المكتبة...', 'loading');
        clearStatusMessage();
        updateLoadControls();

        await ensureVisibleResults(token);
    }

    async function handleLoadMore({ fromScroll = false } = {}) {
        if (loadMoreBusy) return;
        const session = activeSearchSession;
        if (!session) return;
        if (fromScroll && !hasUserScrolled) return;

        const hasBufferedResults = renderedResultCount < session.matches.length;
        const mayFetchMore = !session.completed && renderedResultCount > 0;
        if (!hasBufferedResults && !mayFetchMore) return;

        loadMoreBusy = true;
        visibleResultCount = Math.min(visibleResultCount + RESULTS_BATCH_SIZE, MAX_STORED_MATCHES);

        try {
            await ensureVisibleResults(activeSearchToken);
        } finally {
            loadMoreBusy = false;
        }
    }

    function setupLoadObserver() {
        loadMoreButton?.addEventListener('click', () => {
            void handleLoadMore();
        });

        if (!loadSentinel || !('IntersectionObserver' in window)) return;

        const observer = new IntersectionObserver((entries) => {
            const hasVisibleEntry = entries.some((entry) => entry.isIntersecting);
            if (!hasVisibleEntry || !hasUserScrolled) return;
            void handleLoadMore({ fromScroll: true });
        }, {
            root: null,
            rootMargin: '280px 0px'
        });

        observer.observe(loadSentinel);
    }

    async function refresh() {
        updateUrlState();
        const normalizedQuery = normalizeCatalogText(query);
        const categoryFilteredBooks = filterBooksByCategory(books, categoryMode);

        if (!normalizedQuery) {
            renderSearchPrompt();
            return;
        }

        if (!hasMinimumQueryWords(query, MIN_QUERY_WORDS)) {
            renderSearchPrompt();
            return;
        }

        await startFullTextSearch(categoryFilteredBooks, normalizedQuery);
    }

    queryInput.addEventListener('input', (event) => {
        query = event.target.value.trim();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            void refresh();
        }, INPUT_DEBOUNCE_MS);
    });

    categoryFilter?.addEventListener('change', (event) => {
        categoryMode = event.target.value;
        void refresh();
    });

    setupLoadObserver();

    try {
        books = await fetchBooksList();
        hydrateCategoryFilter(books);
        await refresh();
    } catch (error) {
        cancelActiveSearch();
        resultsContainer.hidden = false;
        renderListMessage(resultsContainer, `تعذر تحميل بيانات البحث: ${error.message}`);
        setStatusMessage(`تعذر تحميل بيانات البحث: ${error.message}`, 'error');
    }
}
