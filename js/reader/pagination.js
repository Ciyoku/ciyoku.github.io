function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function buildPageNav({ parsePageNumberInput, toArabicIndicNumber, onNavigate }) {
    const root = document.createElement('div');
    root.className = 'page-nav';

    const prevButton = document.createElement('button');
    prevButton.type = 'button';
    prevButton.className = 'page-btn prev-page-btn';
    prevButton.textContent = 'السابق';

    const center = document.createElement('div');
    center.className = 'page-nav-center';

    const pageNumberDisplay = document.createElement('div');
    pageNumberDisplay.className = 'page-number-display';

    const pageJumpInput = document.createElement('input');
    pageJumpInput.className = 'page-jump-input';
    pageJumpInput.setAttribute('aria-label', 'انتقال إلى رقم الصفحة');
    pageJumpInput.setAttribute('inputmode', 'numeric');
    pageJumpInput.setAttribute('autocomplete', 'off');
    pageJumpInput.setAttribute('spellcheck', 'false');

    const nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'page-btn next-page-btn';
    nextButton.textContent = 'التالي';

    center.appendChild(pageNumberDisplay);
    center.appendChild(pageJumpInput);
    root.appendChild(prevButton);
    root.appendChild(center);
    root.appendChild(nextButton);

    let jumpTimer = null;
    const tryJump = () => {
        const enteredPage = parsePageNumberInput(pageJumpInput.value);
        pageJumpInput.classList.remove('is-valid', 'is-invalid');
        if (enteredPage === null) return;
        onNavigate('jump', enteredPage - 1, pageJumpInput);
    };

    prevButton.addEventListener('click', () => onNavigate('prev'));
    nextButton.addEventListener('click', () => onNavigate('next'));

    pageJumpInput.addEventListener('focus', () => {
        pageJumpInput.select();
    });

    pageJumpInput.addEventListener('input', () => {
        clearTimeout(jumpTimer);
        jumpTimer = setTimeout(tryJump, 220);
    });

    pageJumpInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        clearTimeout(jumpTimer);
        tryJump();
    });

    pageJumpInput.addEventListener('blur', () => {
        clearTimeout(jumpTimer);
        pageJumpInput.classList.remove('is-valid', 'is-invalid');
    });

    return {
        root,
        prevButton,
        nextButton,
        pageNumberDisplay,
        pageJumpInput,
        setValue(value) {
            const localized = toArabicIndicNumber(value);
            pageJumpInput.value = localized;
        }
    };
}

function createBlockNode(block) {
    if (block.type === 'heading') {
        const heading = document.createElement('h2');
        heading.id = block.id;
        heading.className = 'chapter-heading';
        heading.textContent = block.text;
        return heading;
    }

    const paragraph = document.createElement('p');
    paragraph.textContent = block.text;
    return paragraph;
}

export function createPaginationController({
    state,
    toArabicIndicNumber,
    parsePageNumberInput,
    updateReaderStateInUrl,
    onPageRender
}) {
    const chapterList = document.getElementById('chapterList');
    const readerContent = document.getElementById('readerContent');
    const navs = [];
    let pageContainer = null;
    let layoutReady = false;

    function isLayoutMounted() {
        if (!layoutReady || !pageContainer || !readerContent.contains(pageContainer)) {
            return false;
        }
        if (!navs.length) return false;
        return navs.every((nav) => nav?.root && readerContent.contains(nav.root));
    }

    function resetLayoutState() {
        navs.length = 0;
        pageContainer = null;
        layoutReady = false;
    }

    function getNearestChapterIdForPage(pageIndex) {
        let nearestChapterId = '';
        state.chapters.forEach((chapter) => {
            if (chapter.pageIndex <= pageIndex) {
                nearestChapterId = chapter.id;
            }
        });
        return nearestChapterId;
    }

    function updateActiveChapterHighlight() {
        const activeChapterId = state.currentChapterId || getNearestChapterIdForPage(state.currentPageIndex);
        chapterList.querySelectorAll('.chapter-link').forEach((button) => {
            const isActive = button.dataset.chapterId === activeChapterId;
            button.classList.toggle('is-active', isActive);
            if (isActive) {
                button.setAttribute('aria-current', 'location');
            } else {
                button.removeAttribute('aria-current');
            }
        });
    }

    function updateNavState() {
        const totalPages = state.pageBlocks.length || 1;
        navs.forEach((nav) => {
            nav.prevButton.disabled = state.currentPageIndex <= 0;
            nav.nextButton.disabled = state.currentPageIndex >= totalPages - 1;
            nav.pageNumberDisplay.textContent = `صفحة ${toArabicIndicNumber(state.currentPageIndex + 1)} / ${toArabicIndicNumber(totalPages)}`;
            nav.setValue(state.currentPageIndex + 1);
        });
    }

    function ensureLayout() {
        if (isLayoutMounted()) return;
        if (layoutReady) {
            resetLayoutState();
        }

        const handleNavAction = (action, pageIndex, inputElement) => {
            if (action === 'prev') {
                renderPage(state.currentPageIndex - 1, { chapterId: '', historyMode: 'push' });
                return;
            }

            if (action === 'next') {
                renderPage(state.currentPageIndex + 1, { chapterId: '', historyMode: 'push' });
                return;
            }

            if (action === 'jump') {
                const totalPages = state.pageBlocks.length || 1;
                if (pageIndex < 0 || pageIndex > totalPages - 1) {
                    inputElement.classList.add('is-invalid');
                    return;
                }
                inputElement.classList.add('is-valid');
                if (pageIndex !== state.currentPageIndex) {
                    renderPage(pageIndex, { chapterId: '', historyMode: 'push' });
                }
            }
        };

        const topNav = buildPageNav({
            parsePageNumberInput,
            toArabicIndicNumber,
            onNavigate: handleNavAction
        });

        const bottomNav = buildPageNav({
            parsePageNumberInput,
            toArabicIndicNumber,
            onNavigate: handleNavAction
        });

        const contentBody = document.createElement('article');
        contentBody.className = 'reader-page';

        navs.push(topNav, bottomNav);
        pageContainer = contentBody;
        readerContent.replaceChildren(topNav.root, contentBody, bottomNav.root);
        layoutReady = true;
    }

    function renderPageBlocks(blocks) {
        const fragment = document.createDocumentFragment();
        blocks.forEach((block) => {
            fragment.appendChild(createBlockNode(block));
        });
        pageContainer.replaceChildren(fragment);
    }

    function scrollAfterRender(chapterId) {
        if (chapterId) {
            requestAnimationFrame(() => {
                const element = document.getElementById(chapterId);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                    return;
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            return;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderPage(pageIndex, options = {}) {
        ensureLayout();

        const totalPages = state.pageBlocks.length || 1;
        const safeIndex = clamp(pageIndex, 0, totalPages - 1);
        const chapterId = typeof options.chapterId === 'string' ? options.chapterId : '';
        const historyMode = options.historyMode || 'replace';

        state.currentPageIndex = safeIndex;
        state.currentChapterId = chapterId;

        const blocks = state.pageBlocks[safeIndex] || [];
        renderPageBlocks(blocks);
        readerContent.style.fontSize = `${state.fontSize}px`;
        updateNavState();
        updateActiveChapterHighlight();
        scrollAfterRender(chapterId);

        if (historyMode !== 'none') {
            updateReaderStateInUrl(state, { mode: historyMode });
        }

        if (typeof onPageRender === 'function') {
            onPageRender({
                pageIndex: safeIndex,
                chapterId,
                historyMode
            });
        }
    }

    function goToPage(pageIndex, targetId, options = {}) {
        renderPage(pageIndex, {
            chapterId: targetId || '',
            historyMode: options.historyMode || 'push'
        });
    }

    function renderSidebar(chapters, onChapterNavigate) {
        chapterList.replaceChildren();

        if (!chapters.length) {
            const empty = document.createElement('li');
            empty.className = 'chapter-empty';
            empty.textContent = 'ستتم إضافة الفصول لاحقًا.';
            chapterList.appendChild(empty);
            return;
        }

        chapters.forEach((chapter, chapterIndex) => {
            const item = document.createElement('li');
            item.className = 'chapter-item';

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'chapter-link';
            button.dataset.chapterId = chapter.id;
            button.dataset.pageIndex = String(chapter.pageIndex);
            button.dataset.chapterNumber = String(chapterIndex + 1);
            button.textContent = chapter.title;

            button.addEventListener('click', () => {
                goToPage(chapter.pageIndex, chapter.id, { historyMode: 'push' });
                if (typeof onChapterNavigate === 'function') {
                    onChapterNavigate();
                }
            });

            item.appendChild(button);
            chapterList.appendChild(item);
        });
    }

    return {
        renderSidebar,
        renderPage,
        goToPage
    };
}

