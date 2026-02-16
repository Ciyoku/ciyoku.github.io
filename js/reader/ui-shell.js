function getReaderShellElements() {
    return {
        toggle: document.getElementById('sidebarToggle'),
        sidebar: document.getElementById('sidebar'),
        content: document.getElementById('readerContent'),
        searchOverlay: document.getElementById('searchOverlay'),
        searchBtn: document.getElementById('searchBtn'),
        closeSearch: document.getElementById('closeSearch'),
        searchInput: document.getElementById('searchInput'),
        controls: document.querySelector('.reader-controls')
    };
}

export function isCompactViewport() {
    return window.matchMedia('(max-width: 900px)').matches;
}

export function closeSidebarOnCompactView() {
    if (!isCompactViewport()) return;
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('readerContent').classList.add('full-width');
}

export function setupReaderUi({
    onControlAction,
    onSearchQuery,
    isFavoriteBook,
    onToggleFavorite,
    bookmarkIcons
}) {
    const {
        toggle,
        sidebar,
        content,
        searchOverlay,
        searchBtn,
        closeSearch,
        searchInput,
        controls
    } = getReaderShellElements();

    let compactMode = isCompactViewport();
    let resizeTimer = null;
    let sidebarHiddenBeforeSearch = false;

    const applyViewportLayout = (force = false) => {
        const nextCompactMode = isCompactViewport();
        if (!force && nextCompactMode === compactMode) return;
        compactMode = nextCompactMode;

        if (compactMode) {
            sidebar.classList.add('hidden');
            content.classList.add('full-width');
        }
    };

    const closeSearchOverlay = () => {
        searchOverlay.classList.remove('active');
        if (!isCompactViewport() && !sidebarHiddenBeforeSearch) {
            sidebar.classList.remove('hidden');
            content.classList.remove('full-width');
        }
    };

    applyViewportLayout(true);
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => applyViewportLayout(), 120);
    });

    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('hidden');
        content.classList.toggle('full-width');
        searchOverlay.classList.remove('active');
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
        searchOverlay.classList.add('active');
        sidebar.classList.add('hidden');
        content.classList.add('full-width');
        if (searchOverlay.classList.contains('active')) {
            searchInput.focus();
        }
    });

    closeSearch.addEventListener('click', closeSearchOverlay);

    searchInput.addEventListener('input', (event) => {
        const query = event.target.value.trim();
        const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = '';
        onSearchQuery(query, resultsContainer, closeSearchOverlay);
    });

    const favBtn = document.getElementById('favBtn');
    const bookId = new URLSearchParams(window.location.search).get('book');

    if (bookId) {
        const updateFavoriteIcon = () => {
            if (isFavoriteBook(bookId)) {
                favBtn.innerHTML = bookmarkIcons.active;
                favBtn.classList.add('is-active');
            } else {
                favBtn.innerHTML = bookmarkIcons.inactive;
                favBtn.classList.remove('is-active');
            }
        };

        updateFavoriteIcon();
        favBtn.addEventListener('click', () => {
            onToggleFavorite(bookId);
            updateFavoriteIcon();
        });
    }
}
