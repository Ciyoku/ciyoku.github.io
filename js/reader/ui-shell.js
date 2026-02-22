import { hasMinimumQueryWords } from '../shared/query-words.js';

const MIN_READER_SEARCH_WORDS = 2;
const READER_MIN_SEARCH_WORDS_MESSAGE = 'اكتب كلمتين أو أكثر لبدء البحث.';

function getReaderShellElements() {
    return {
        toggle: document.getElementById('sidebarToggle'),
        sidebar: document.getElementById('sidebar'),
        content: document.getElementById('readerContent'),
        searchOverlay: document.getElementById('searchOverlay'),
        searchBtn: document.getElementById('searchBtn'),
        closeSearch: document.getElementById('closeSearch'),
        searchInput: document.getElementById('searchInput'),
        searchHint: document.getElementById('searchHint'),
        searchResults: document.getElementById('searchResults'),
        controls: document.querySelector('.reader-controls'),
        favBtn: document.getElementById('favBtn')
    };
}

function isCompactViewport() {
    return window.matchMedia('(max-width: 900px)').matches;
}

export function closeSidebarOnCompactView() {
    if (!isCompactViewport()) return;
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('readerContent');
    const toggle = document.getElementById('sidebarToggle');

    sidebar.classList.add('hidden');
    sidebar.setAttribute('aria-hidden', 'true');
    content.classList.add('full-width');
    toggle.setAttribute('aria-expanded', 'false');
}

export function setupReaderUi({
    onControlAction,
    onSearchQuery,
    isFavoriteBook,
    onToggleFavorite,
    applyFavoriteIcon
}) {
    const {
        toggle,
        sidebar,
        content,
        searchOverlay,
        searchBtn,
        closeSearch,
        searchInput,
        searchHint,
        searchResults,
        controls,
        favBtn
    } = getReaderShellElements();

    let compactMode = isCompactViewport();
    let resizeTimer = null;
    let searchDebounceTimer = null;
    let sidebarHiddenBeforeSearch = false;

    const setSidebarVisibility = (hidden) => {
        sidebar.classList.toggle('hidden', hidden);
        sidebar.setAttribute('aria-hidden', hidden ? 'true' : 'false');
        content.classList.toggle('full-width', hidden);
        toggle.setAttribute('aria-expanded', hidden ? 'false' : 'true');
    };

    const setSearchVisibility = (open) => {
        searchOverlay.classList.toggle('active', open);
        searchOverlay.setAttribute('aria-hidden', open ? 'false' : 'true');
        searchBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    const applyViewportLayout = (force = false) => {
        const nextCompactMode = isCompactViewport();
        if (!force && nextCompactMode === compactMode) return;
        compactMode = nextCompactMode;

        if (compactMode) {
            setSidebarVisibility(true);
        }
    };

    const closeSearchOverlay = () => {
        setSearchVisibility(false);
        clearTimeout(searchDebounceTimer);

        if (searchHint) {
            searchHint.textContent = '';
        }

        searchResults.replaceChildren();

        if (!isCompactViewport() && !sidebarHiddenBeforeSearch) {
            setSidebarVisibility(false);
        }

        searchBtn.focus({ preventScroll: true });
    };

    applyViewportLayout(true);
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => applyViewportLayout(), 120);
    });

    toggle.addEventListener('click', () => {
        const hidden = sidebar.classList.contains('hidden');
        setSidebarVisibility(!hidden);
        setSearchVisibility(false);
    });

    controls.addEventListener('click', (event) => {
        const control = event.target.closest('[data-control]');
        if (!control) return;
        onControlAction(control.dataset.control);
    });

    searchBtn.addEventListener('click', () => {
        const willOpen = !searchOverlay.classList.contains('active');

        if (!willOpen) {
            closeSearchOverlay();
            return;
        }

        sidebarHiddenBeforeSearch = !isCompactViewport() && sidebar.classList.contains('hidden');
        setSearchVisibility(true);
        setSidebarVisibility(true);
        searchInput.focus({ preventScroll: true });
    });

    closeSearch.addEventListener('click', closeSearchOverlay);

    searchInput.addEventListener('input', (event) => {
        const query = event.target.value.trim();
        searchResults.replaceChildren();
        clearTimeout(searchDebounceTimer);

        if (!query) {
            if (searchHint) {
                searchHint.textContent = '';
            }
            return;
        }

        if (!hasMinimumQueryWords(query, MIN_READER_SEARCH_WORDS)) {
            if (searchHint) {
                searchHint.textContent = READER_MIN_SEARCH_WORDS_MESSAGE;
            }
            return;
        }

        if (searchHint) {
            searchHint.textContent = '';
        }

        searchDebounceTimer = setTimeout(() => {
            onSearchQuery(query, searchResults, closeSearchOverlay);
        }, 180);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (!searchOverlay.classList.contains('active')) return;
        closeSearchOverlay();
    });

    document.addEventListener('pointerdown', (event) => {
        if (!searchOverlay.classList.contains('active')) return;
        const target = event.target;
        if (searchOverlay.contains(target)) return;
        if (searchBtn.contains(target)) return;
        closeSearchOverlay();
    });

    const bookId = new URLSearchParams(window.location.search).get('book');

    const updateFavoriteIcon = () => {
        if (!bookId) {
            favBtn.disabled = true;
            favBtn.setAttribute('aria-disabled', 'true');
            applyFavoriteIcon(favBtn, false);
            return;
        }

        favBtn.disabled = false;
        favBtn.removeAttribute('aria-disabled');
        applyFavoriteIcon(favBtn, isFavoriteBook(bookId));
    };

    updateFavoriteIcon();

    if (bookId) {
        favBtn.addEventListener('click', () => {
            onToggleFavorite(bookId);
            updateFavoriteIcon();
        });

        window.addEventListener('storage', (event) => {
            if (event.key !== 'shiaLibFavs') return;
            updateFavoriteIcon();
        });
    }
}
