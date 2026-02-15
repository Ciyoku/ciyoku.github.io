// App Logic

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('book');

    if (bookId) {
        loadBook(bookId);
    }

    setupUI();
});

// State
let currentBookContent = '';
let currentChapters = [];
let fontSize = 22; // px
let bookPages = [];
let pageHtml = [];
let currentPageIndex = 0;
let bookParts = [];
let currentPartIndex = 0;
let currentBookId = '';
let currentChapterId = '';
let currentBookPartCount = 1;
const arabicIndicDigits = ['\u0660', '\u0661', '\u0662', '\u0663', '\u0664', '\u0665', '\u0666', '\u0667', '\u0668', '\u0669'];

function toArabicIndicNumber(value) {
    return String(value).replace(/\d/g, (digit) => arabicIndicDigits[digit]);
}

function parsePageNumberInput(value) {
    const normalized = String(value)
        .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
        .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06F0))
        .replace(/[^\d]/g, '');

    if (!normalized) return null;

    const pageNumber = Number.parseInt(normalized, 10);
    if (!Number.isFinite(pageNumber)) return null;
    return pageNumber;
}

function getPartLabel(index) {
    return `\u0627\u0644\u062c\u0632\u0621 ${toArabicIndicNumber(index + 1)}`;
}

function isCompactViewport() {
    return window.matchMedia('(max-width: 900px)').matches;
}

function getRequestedReaderState() {
    const params = new URLSearchParams(window.location.search);
    const requestedPartRaw = params.get('part');
    const parsedPartIndex = window.booksMeta
        ? window.booksMeta.parsePartParam(requestedPartRaw)
        : (requestedPartRaw !== null && requestedPartRaw !== '' && Number.isInteger(Number(requestedPartRaw)))
            ? Number(requestedPartRaw) - 1
            : null;
    const requestedPage = Number(params.get('page'));
    const requestedChapter = params.get('chapter') || '';

    return {
        partIndex: parsedPartIndex,
        pageIndex: Number.isInteger(requestedPage) ? requestedPage - 1 : 0,
        chapterId: requestedChapter
    };
}

function syncReaderStateToUrl() {
    if (!currentBookId) return;

    const url = new URL(window.location.href);
    url.searchParams.set('book', String(currentBookId));
    url.searchParams.set('page', String(currentPageIndex + 1));

    if (currentBookPartCount > 1 && currentPartIndex > 0) {
        const partValue = window.booksMeta
            ? window.booksMeta.toPartParam(currentPartIndex)
            : `part${currentPartIndex + 1}`;
        url.searchParams.set('part', partValue);
    } else {
        url.searchParams.delete('part');
    }

    if (currentChapterId) {
        url.searchParams.set('chapter', currentChapterId);
    } else {
        url.searchParams.delete('chapter');
    }

    history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}`);
}

function loadBook(id) {
    const readerContent = document.getElementById('readerContent');
    const bookTitleDisplay = document.getElementById('bookTitleDisplay');
    const requestedState = getRequestedReaderState();
    currentBookId = String(id);

    fetch('books/list.json')
        .then(response => {
            if (!response.ok) throw new Error('Could not load book list');
            return response.json();
        })
        .then(books => {
            const info = books.find(book => String(book.id) === String(id));
            currentBookPartCount = window.booksMeta
                ? window.booksMeta.getBookPartCount(info || {})
                : 1;
            bookTitleDisplay.textContent = info?.title || 'ÙƒØªØ§Ø¨ ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ';
            document.title = info?.title ? `${info.title} | Ø§Ù„Ù‚Ø§Ø±Ø¦` : 'Ø§Ù„Ù‚Ø§Ø±Ø¦';

            return fetchBookParts(id);
        })
        .then(parts => {
            if (!parts || parts.length === 0) {
                throw new Error('Could not load book content');
            }

            bookParts = parts.map((text, index) => ({ text, label: getPartLabel(index) }));
            renderPartSelector();

            const requestedPartIndex = Number.isInteger(requestedState.partIndex) ? requestedState.partIndex : 0;
            const maxPartIndex = Math.max(bookParts.length - 1, 0);
            const safePartIndex = Math.min(Math.max(requestedPartIndex, 0), maxPartIndex);

            loadBookPart(safePartIndex, {
                pageIndex: requestedState.pageIndex,
                chapterId: requestedState.chapterId
            });
        })
        .catch(err => {
            readerContent.innerHTML = `<div class="reader-error">ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„ÙƒØªØ§Ø¨: ${err.message}</div>`;
        });
}

function renderPartChooser() {
    const readerContent = document.getElementById('readerContent');
    const partButtons = bookParts.map((part, index) => (
        `<button type="button" class="part-choice-btn" data-part-choice="${index}">${part.label}</button>`
    )).join('');

    readerContent.innerHTML = `
        <div class="part-chooser">
            <h2 class="chapter-heading part-chooser-title">\u0627\u062e\u062a\u0631 \u0627\u0644\u062c\u0632\u0621</h2>
            <div class="part-choice-grid">${partButtons}</div>
        </div>
    `;
    readerContent.style.fontSize = fontSize + 'px';

    readerContent.querySelectorAll('[data-part-choice]').forEach((button) => {
        button.onclick = () => {
            loadBookPart(Number(button.dataset.partChoice));
        };
    });
}

function renderPartSelector() {
    const chapterList = document.getElementById('chapterList');
    let container = document.getElementById('partSelector');
    if (!container) {
        container = document.createElement('div');
        container.id = 'partSelector';
        container.className = 'part-selector';
        chapterList.parentNode.insertBefore(container, chapterList);
    }

    if (bookParts.length <= 1) {
        container.hidden = true;
        return;
    }

    container.hidden = false;
    const buttonsHtml = bookParts.map((part, index) => (
        `<button type="button" class="part-selector-btn" data-part-index="${index}">${part.label}</button>`
    )).join('');

    container.innerHTML = `
        <div class="part-selector-title">\u0627\u0644\u0623\u062c\u0632\u0627\u0621</div>
        ${buttonsHtml}
    `;

    container.querySelectorAll('[data-part-index]').forEach((button) => {
        button.onclick = () => {
            loadBookPart(Number(button.dataset.partIndex));
            if (isCompactViewport()) {
                document.getElementById('sidebar').classList.add('hidden');
                document.getElementById('readerContent').classList.add('full-width');
            }
        };
    });

    updatePartSelector();
}

function updatePartSelector() {
    const partButtons = document.querySelectorAll('[data-part-index]');
    partButtons.forEach((button) => {
        const isActive = Number(button.dataset.partIndex) === currentPartIndex;
        button.classList.toggle('is-active', isActive);
    });
}

function loadBookPart(partIndex, options = {}) {
    if (bookParts.length === 0) return;
    const safeIndex = Math.min(Math.max(partIndex, 0), bookParts.length - 1);
    const safePageIndex = Number.isInteger(options.pageIndex) ? options.pageIndex : 0;
    const chapterId = typeof options.chapterId === 'string' ? options.chapterId : '';
    currentPartIndex = safeIndex;
    currentBookContent = bookParts[safeIndex].text;
    parseBook(currentBookContent, safePageIndex, chapterId);
    updatePartSelector();
}

function fetchTextIfOk(url) {
    return fetch(url).then(response => (response.ok ? response.text() : null));
}

function fetchIndexedParts(id) {
    const fetchPart = (index) => fetch(`books/${id}/${index}.txt`);
    return fetchPart(1).then(firstResp => {
        if (!firstResp.ok) return null;
        return firstResp.text().then(firstText => {
            const parts = [firstText];
            const loadNext = (index) => fetchPart(index).then(resp => {
                if (!resp.ok) return parts;
                return resp.text().then(text => {
                    parts.push(text);
                    return loadNext(index + 1);
                });
            });
            return loadNext(2);
        });
    });
}

function fetchNamedParts(id) {
    return fetchTextIfOk(`books/${id}/book.txt`).then(firstText => {
        if (firstText === null) return null;
        const parts = [firstText];
        const loadNext = (index) => fetchTextIfOk(`books/${id}/book${index}.txt`).then(text => {
            if (text === null) return parts;
            parts.push(text);
            return loadNext(index + 1);
        });
        return loadNext(2);
    });
}

function fetchBookParts(id) {
    return fetchIndexedParts(id).then(indexedParts => {
        if (indexedParts && indexedParts.length > 0) {
            return indexedParts;
        }

        return fetchNamedParts(id).then(namedParts => {
            if (namedParts && namedParts.length > 0) {
                return namedParts;
            }

            return fetchTextIfOk(`books/${id}/book${id}.txt`).then(text => {
                if (text !== null) return [text];
                throw new Error("Could not load book content");
            });
        });
    });
}


function splitBookPages(text) {
    if (!text.includes('PAGE_SEPARATOR')) {
        return [text];
    }
    return text.split(/PAGE_SEPARATOR/g);
}

function parsePage(text, chapterIndexStart) {
    const lines = text.split('\n');
    const chapters = [];
    let htmlContent = '';
    let chapterIndex = chapterIndexStart;

    // A simple parser looking for "## " as chapter headers
    lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('##')) {
            const title = trimmed.replace('##', '').trim();
            const id = `chap-${chapterIndex}`;
            chapters.push({ title, id });
            htmlContent += `<h2 id="${id}" class="chapter-heading fade-in">${title}</h2>`;
            chapterIndex++;
        } else if (trimmed.length > 0) {
            htmlContent += `<p class="fade-in">${trimmed}</p>`;
        }
    });

    return { htmlContent, chapters, nextChapterIndex: chapterIndex };
}

function parseBook(text, initialPageIndex = 0, initialChapterId = '') {
    const pages = splitBookPages(text);
    const chapterList = [];
    const pageHtmlList = [];
    let chapterIndex = 0;

    pages.forEach((pageText) => {
        const parsed = parsePage(pageText, chapterIndex);
        pageHtmlList.push(parsed.htmlContent);
        parsed.chapters.forEach((chap) => {
            chapterList.push({ ...chap, pageIndex: pageHtmlList.length - 1 });
        });
        chapterIndex = parsed.nextChapterIndex;
    });

    bookPages = pages;
    pageHtml = pageHtmlList;
    currentPageIndex = 0;

    // Render Sidebar
    renderSidebar(chapterList);

    // Render Content
    renderPage(initialPageIndex, { chapterId: initialChapterId });
}

function renderSidebar(chapters) {
    const list = document.getElementById('chapterList');
    list.innerHTML = '';

    if (chapters.length === 0) {
        list.innerHTML = '<li class="chapter-empty">Ø³ØªØªÙ… Ø¥Ø¶Ø§ÙØ© Ø§Ù„ÙØµÙˆÙ„ Ù„Ø§Ø­Ù‚Ù‹Ø§.</li>';
        currentChapters = [];
        return;
    }

    chapters.forEach(chap => {
        const li = document.createElement('li');
        li.className = 'chapter-item';
        li.textContent = chap.title;
        li.onclick = () => {
            goToPage(chap.pageIndex, chap.id);

            // Close sidebar on mobile
            if (isCompactViewport()) {
                document.getElementById('sidebar').classList.add('hidden');
                document.getElementById('readerContent').classList.add('full-width');
            }
        };
        list.appendChild(li);
    });

    currentChapters = chapters;
}

function renderPage(pageIndex, options = {}) {
    const readerContent = document.getElementById('readerContent');
    const totalPages = pageHtml.length || 1;
    const safeIndex = Math.min(Math.max(pageIndex, 0), totalPages - 1);
    const chapterId = typeof options.chapterId === 'string' ? options.chapterId : '';
    const updateUrl = options.updateUrl !== false;

    currentPageIndex = safeIndex;
    currentChapterId = chapterId;

    const navHtml = `
        <div class="page-nav">
            <button type="button" class="page-btn prev-page-btn">\u0627\u0644\u0633\u0627\u0628\u0642</button>
            <div class="page-nav-center">
                <div class="page-number-display">\u0635\u0641\u062d\u0629 ${toArabicIndicNumber(safeIndex + 1)} / ${toArabicIndicNumber(totalPages)}</div>
                <input class="page-jump-input" aria-label="\u0627\u0646\u062a\u0642\u0627\u0644 \u0625\u0644\u0649 \u0631\u0642\u0645 \u0627\u0644\u0635\u0641\u062d\u0629" inputmode="numeric" autocomplete="off" spellcheck="false" value="${toArabicIndicNumber(safeIndex + 1)}" />
            </div>
            <button type="button" class="page-btn next-page-btn">\u0627\u0644\u062a\u0627\u0644\u064a</button>
        </div>
    `;

    const pageContent = pageHtml[safeIndex] || '';
    readerContent.innerHTML = navHtml + pageContent + navHtml;
    readerContent.style.fontSize = fontSize + 'px';

    wirePageNav();
    if (chapterId) {
        setTimeout(() => {
            const el = document.getElementById(chapterId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, 0);
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (updateUrl) {
        syncReaderStateToUrl();
    }
}

function wirePageNav() {
    const totalPages = pageHtml.length || 1;
    const prevButtons = document.querySelectorAll('.prev-page-btn');
    const nextButtons = document.querySelectorAll('.next-page-btn');
    const pageNumberDisplays = document.querySelectorAll('.page-number-display');
    const pageJumpInputs = document.querySelectorAll('.page-jump-input');

    pageNumberDisplays.forEach((el) => {
        el.textContent = `\u0635\u0641\u062d\u0629 ${toArabicIndicNumber(currentPageIndex + 1)} / ${toArabicIndicNumber(totalPages)}`;
    });

    prevButtons.forEach((btn) => {
        btn.disabled = currentPageIndex <= 0;
        btn.onclick = () => renderPage(currentPageIndex - 1, { chapterId: '' });
    });

    nextButtons.forEach((btn) => {
        btn.disabled = currentPageIndex >= totalPages - 1;
        btn.onclick = () => renderPage(currentPageIndex + 1, { chapterId: '' });
    });

    pageJumpInputs.forEach((input) => {
        let jumpTimer = null;

        const tryJump = () => {
            const enteredPage = parsePageNumberInput(input.value);
            input.classList.remove('is-valid', 'is-invalid');

            if (enteredPage === null) {
                return;
            }

            if (enteredPage < 1 || enteredPage > totalPages) {
                input.classList.add('is-invalid');
                return;
            }

            input.classList.add('is-valid');
            const targetPageIndex = enteredPage - 1;
            if (targetPageIndex !== currentPageIndex) {
                renderPage(targetPageIndex, { chapterId: '' });
            }
        };

        input.value = toArabicIndicNumber(currentPageIndex + 1);
        input.onfocus = () => input.select();
        input.oninput = () => {
            clearTimeout(jumpTimer);
            jumpTimer = setTimeout(tryJump, 250);
        };
        input.onkeydown = (event) => {
            if (event.key === 'Enter') {
                clearTimeout(jumpTimer);
                tryJump();
            }
        };
        input.onblur = () => {
            clearTimeout(jumpTimer);
            input.classList.remove('is-valid', 'is-invalid');
            input.value = toArabicIndicNumber(currentPageIndex + 1);
        };
    });
}
function goToPage(pageIndex, targetId) {
    renderPage(pageIndex, { chapterId: targetId || '' });
}

function setupUI() {
    // Sidebar Toggle
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('readerContent');
    const searchOverlay = document.getElementById('searchOverlay');
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
            return;
        }

        if (!searchOverlay.classList.contains('active')) {
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
        // Close search if open
        searchOverlay.classList.remove('active');
    });

    // Font Size
    window.changeFontSize = (delta) => {
        fontSize += delta;
        if (fontSize < 12) fontSize = 12;
        if (fontSize > 48) fontSize = 48;
        content.style.fontSize = fontSize + 'px';
    };

    // Fullscreen
    window.toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    // Scroll Top
    window.scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Search Toggle
    const searchBtn = document.getElementById('searchBtn');
    const closeSearch = document.getElementById('closeSearch');
    const closeSearchOverlay = () => {
        searchOverlay.classList.remove('active');
        if (!isCompactViewport() && !sidebarHiddenBeforeSearch) {
            sidebar.classList.remove('hidden');
            content.classList.remove('full-width');
        }
    };

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
            document.getElementById('searchInput').focus();
        }
    });

    closeSearch.addEventListener('click', closeSearchOverlay);

    // Search Logic
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = '';

        if (!query || query.length < 2) return;

        const regex = new RegExp(query, 'gi');
        let matchCount = 0;

        const lines = currentBookContent.split('\n');
        let currentChapterTitle = "\u0628\u062f\u0627\u064a\u0629 \u0627\u0644\u0643\u062a\u0627\u0628";
        let currentChapterId = "";
        let chapterIndex = -1; // -1 means before first chapter
        let pageIndex = 0;

        lines.forEach((line) => {
            const trimmedLine = line.trim();
            if (trimmedLine.includes('PAGE_SEPARATOR')) {
                pageIndex++;
                return;
            }

            if (trimmedLine.startsWith('##')) {
                currentChapterTitle = trimmedLine.replace('##', '').trim();
                chapterIndex++;
                currentChapterId = `chap-${chapterIndex}`;
            }

            if (matchCount > 50) return;

            if (line.match(regex) && !trimmedLine.startsWith('##')) {
                const resultItem = document.createElement('div');
                resultItem.className = 'search-result-item';

                const highlighted = line.replace(regex, match => `<span class="highlight">${match}</span>`);

                resultItem.innerHTML = `
                    <div class="search-result-chapter">${currentChapterTitle}</div>
                    <div class="search-result-line">${highlighted}</div>
                `;

                // Use closure to capture the ID at this moment
                const targetId = currentChapterId;
                const targetPageIndex = pageIndex;
                resultItem.onclick = () => {
                    if (!targetId) {
                        renderPage(targetPageIndex);
                        closeSearchOverlay();
                        return;
                    }
                    goToPage(targetPageIndex, targetId);
                    closeSearchOverlay();
                };
                resultsContainer.appendChild(resultItem);
                matchCount++;
            }
        });

        if (matchCount === 0) {
            resultsContainer.innerHTML = '<div class="search-result-empty">\u0644\u0627 \u062a\u0648\u062c\u062f \u0646\u062a\u0627\u0626\u062c</div>';
        }
    });

    // Favorites Logic
    const favBtn = document.getElementById('favBtn');
    const bookId = new URLSearchParams(window.location.search).get('book');

    if (bookId) {
        const fallbackGetFavorites = () => JSON.parse(localStorage.getItem('shiaLibFavs') || '[]');
        const fallbackSetFavorites = (values) => localStorage.setItem('shiaLibFavs', JSON.stringify(values));
        const isFavorite = () => window.favoritesStore
            ? window.favoritesStore.isFavorite(bookId)
            : fallbackGetFavorites().includes(bookId);

        const updateFavIcon = () => {
            if (isFavorite()) {
                favBtn.innerHTML = '<i class="fas fa-bookmark"></i>';
                favBtn.classList.add('is-active');
            } else {
                favBtn.innerHTML = '<i class="far fa-bookmark"></i>';
                favBtn.classList.remove('is-active');
            }
        };
        updateFavIcon();

        favBtn.addEventListener('click', () => {
            if (window.favoritesStore) {
                window.favoritesStore.toggleFavorite(bookId);
            } else {
                const current = fallbackGetFavorites();
                if (current.includes(bookId)) {
                    fallbackSetFavorites(current.filter((id) => id !== bookId));
                } else {
                    current.push(bookId);
                    fallbackSetFavorites(current);
                }
            }
            updateFavIcon();
        });
    }
}


