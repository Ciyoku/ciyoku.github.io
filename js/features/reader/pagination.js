function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

const PART_NAV_LABEL = 'الأجزاء';
const PART_LOADING_SUFFIX = ' (جارٍ التحميل...)';
const PART_MISSING_SUFFIX = ' (غير متوفر)';

function getPartBaseLabel(part, index) {
    const label = typeof part?.label === 'string' ? part.label.trim() : '';
    if (label) return label;
    return `الجزء ${index + 1}`;
}

export function buildPartNavigationModel(bookParts, currentPartIndex) {
    const parts = Array.isArray(bookParts) ? bookParts : [];
    if (parts.length <= 1) {
        return {
            visible: false,
            selectedIndex: 0,
            options: []
        };
    }

    const selectedIndex = clamp(
        Number.isInteger(currentPartIndex) ? currentPartIndex : 0,
        0,
        Math.max(parts.length - 1, 0)
    );

    const options = parts.map((part, index) => {
        const status = typeof part?.status === 'string' ? part.status : 'idle';
        const baseLabel = getPartBaseLabel(part, index);

        if (status === 'missing') {
            return {
                index,
                label: `${baseLabel}${PART_MISSING_SUFFIX}`,
                disabled: true,
                status
            };
        }

        if (status === 'loading') {
            return {
                index,
                label: `${baseLabel}${PART_LOADING_SUFFIX}`,
                disabled: false,
                status
            };
        }

        return {
            index,
            label: baseLabel,
            disabled: false,
            status
        };
    });

    return {
        visible: true,
        selectedIndex,
        options
    };
}

function createNavIconButton({ className, iconName, label }) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `page-btn ${className}`;
    button.setAttribute('aria-label', label);
    button.title = label;

    const iconHost = document.createElement('span');
    iconHost.setAttribute('data-lucide', iconName);
    iconHost.setAttribute('aria-hidden', 'true');
    button.appendChild(iconHost);

    return button;
}

function createPartNavigationControl({ onSelectPart }) {
    const container = document.createElement('div');
    container.className = 'page-nav-part-control';
    container.hidden = true;

    const field = document.createElement('label');
    field.className = 'page-nav-part-field';

    const label = document.createElement('span');
    label.className = 'page-nav-part-label';
    label.textContent = PART_NAV_LABEL;

    const select = document.createElement('select');
    select.className = 'page-nav-part-select';
    select.setAttribute('aria-label', 'اختيار الجزء');

    field.appendChild(label);
    field.appendChild(select);
    container.appendChild(field);

    select.addEventListener('change', () => {
        const nextPartIndex = Number.parseInt(select.value, 10);
        if (!Number.isInteger(nextPartIndex)) return;
        if (typeof onSelectPart === 'function') {
            onSelectPart(nextPartIndex);
        }
    });

    return {
        container,
        select
    };
}

function buildPageNav({ onNavigate, renderLucideIcons, partNavigation = null }) {
    const root = document.createElement('div');
    root.className = 'page-nav';

    const firstButton = createNavIconButton({
        className: 'first-page-btn',
        iconName: 'chevrons-right',
        label: 'الانتقال إلى بداية الكتاب'
    });

    const prevButton = createNavIconButton({
        className: 'prev-page-btn',
        iconName: 'chevron-right',
        label: 'الصفحة السابقة'
    });

    const center = document.createElement('div');
    center.className = 'page-nav-center';

    const pageNumberDisplay = document.createElement('div');
    pageNumberDisplay.className = 'page-number-display';
    pageNumberDisplay.setAttribute('aria-live', 'polite');

    const nextButton = createNavIconButton({
        className: 'next-page-btn',
        iconName: 'chevron-left',
        label: 'الصفحة التالية'
    });

    const lastButton = createNavIconButton({
        className: 'last-page-btn',
        iconName: 'chevrons-left',
        label: 'الانتقال إلى نهاية الكتاب'
    });

    center.appendChild(pageNumberDisplay);
    root.appendChild(firstButton);
    root.appendChild(prevButton);
    root.appendChild(center);
    root.appendChild(nextButton);
    root.appendChild(lastButton);

    if (partNavigation?.container) {
        root.appendChild(partNavigation.container);
    }

    renderLucideIcons(root);
    firstButton.addEventListener('click', () => onNavigate('first'));
    prevButton.addEventListener('click', () => onNavigate('prev'));
    nextButton.addEventListener('click', () => onNavigate('next'));
    lastButton.addEventListener('click', () => onNavigate('last'));

    return {
        root,
        firstButton,
        prevButton,
        nextButton,
        pageNumberDisplay,
        lastButton,
        partNavigation
    };
}

function createBlockNode(block) {
    if (block.type === 'heading') {
        const isBook = block.level === 'book';
        const heading = document.createElement(isBook ? 'h2' : 'h3');
        heading.id = block.id;
        heading.className = isBook ? 'book-heading' : 'chapter-heading';
        heading.textContent = block.text;
        return heading;
    }

    if (block.type === 'anchor') {
        const anchor = document.createElement('span');
        anchor.id = block.id;
        anchor.className = 'chapter-anchor';
        anchor.setAttribute('aria-hidden', 'true');
        return anchor;
    }

    const paragraph = document.createElement('p');
    paragraph.textContent = block.text;
    return paragraph;
}

export function createPaginationController({
    state,
    toArabicIndicNumber,
    updateReaderStateInUrl,
    onPageRender,
    renderLucideIcons,
    onSelectPart
}) {
    const chapterList = document.getElementById('chapterList');
    const readerContent = document.getElementById('readerContent');
    const navs = [];
    let pageContainer = null;
    let layoutReady = false;
    let topPartNavigation = null;
    const collapsedBooks = new Set();
    let lastBookId = '';

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
        topPartNavigation = null;
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
        let activeButton = null;
        chapterList.querySelectorAll('[data-chapter-id]').forEach((button) => {
            const isActive = button.dataset.chapterId === activeChapterId;
            button.classList.toggle('is-active', isActive);
            if (isActive) {
                button.setAttribute('aria-current', 'location');
                activeButton = button;
            } else {
                button.removeAttribute('aria-current');
            }
        });

        if (!activeButton) return;
        const sublist = activeButton.closest('.chapter-sublist');
        if (!sublist || !sublist.hidden) return;
        const bookItem = sublist.closest('.chapter-book');
        const bookToggle = bookItem ? bookItem.querySelector('.chapter-book-toggle') : null;
        if (!bookToggle) return;
        bookToggle.setAttribute('aria-expanded', 'true');
        sublist.hidden = false;
        if (bookToggle.dataset.bookKey) {
            collapsedBooks.delete(bookToggle.dataset.bookKey);
        }
    }

    function updateNavState() {
        const totalPages = state.pageBlocks.length || 1;
        const isAtFirstPage = state.currentPageIndex <= 0;
        const isAtLastPage = state.currentPageIndex >= totalPages - 1;
        navs.forEach((nav) => {
            nav.firstButton.disabled = isAtFirstPage;
            nav.prevButton.disabled = isAtFirstPage;
            nav.nextButton.disabled = isAtLastPage;
            nav.lastButton.disabled = isAtLastPage;
            nav.pageNumberDisplay.textContent = `${toArabicIndicNumber(state.currentPageIndex + 1)} / ${toArabicIndicNumber(totalPages)}`;
        });
    }

    function syncPartNavigation() {
        if (!topPartNavigation) return;

        const model = buildPartNavigationModel(state.bookParts, state.currentPartIndex);
        const navRoot = topPartNavigation.container.closest('.page-nav');
        if (navRoot) {
            navRoot.classList.toggle('has-part-control', model.visible);
        }
        topPartNavigation.container.hidden = !model.visible;
        topPartNavigation.select.replaceChildren();

        if (!model.visible) {
            topPartNavigation.select.disabled = true;
            return;
        }

        const fragment = document.createDocumentFragment();
        model.options.forEach((entry) => {
            const option = document.createElement('option');
            option.value = String(entry.index);
            option.textContent = entry.label;
            option.disabled = entry.disabled;
            option.selected = entry.index === model.selectedIndex;
            fragment.appendChild(option);
        });

        topPartNavigation.select.appendChild(fragment);
        topPartNavigation.select.value = String(model.selectedIndex);
        topPartNavigation.select.disabled = model.options.every((entry) => entry.disabled);
    }

    function ensureLayout() {
        if (isLayoutMounted()) return;
        if (layoutReady) {
            resetLayoutState();
        }

        const handleNavAction = (action) => {
            if (action === 'first') {
                renderPage(0, { chapterId: '', historyMode: 'push' });
                return;
            }

            if (action === 'prev') {
                renderPage(state.currentPageIndex - 1, { chapterId: '', historyMode: 'push' });
                return;
            }

            if (action === 'next') {
                renderPage(state.currentPageIndex + 1, { chapterId: '', historyMode: 'push' });
                return;
            }

            if (action === 'last') {
                const totalPages = state.pageBlocks.length || 1;
                renderPage(totalPages - 1, { chapterId: '', historyMode: 'push' });
            }
        };

        topPartNavigation = createPartNavigationControl({
            onSelectPart: (partIndex) => {
                const safePartIndex = clamp(
                    partIndex,
                    0,
                    Math.max(state.bookParts.length - 1, 0)
                );
                if (!Number.isInteger(safePartIndex)) return;

                state.currentPartIndex = safePartIndex;
                syncPartNavigation();

                if (typeof onSelectPart === 'function') {
                    const request = onSelectPart(safePartIndex);
                    if (request && typeof request.catch === 'function') {
                        request.catch(() => {});
                    }
                }
            }
        });

        const topNav = buildPageNav({
            onNavigate: handleNavAction,
            renderLucideIcons,
            partNavigation: topPartNavigation
        });

        const bottomNav = buildPageNav({
            onNavigate: handleNavAction,
            renderLucideIcons
        });

        const contentBody = document.createElement('article');
        contentBody.className = 'reader-page';

        navs.push(topNav, bottomNav);
        pageContainer = contentBody;
        readerContent.replaceChildren(topNav.root, contentBody, bottomNav.root);
        layoutReady = true;
        syncPartNavigation();
    }

    function renderPageBlocks(blocks) {
        const fragment = document.createDocumentFragment();
        blocks.forEach((block) => {
            fragment.appendChild(createBlockNode(block));
        });
        pageContainer.replaceChildren(fragment);
    }

    function scrollAfterRender(chapterId, scrollMode) {
        if (scrollMode === 'none') return;
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
        const scrollMode = options.scrollMode === 'none' ? 'none' : 'auto';

        state.currentPageIndex = safeIndex;
        state.currentChapterId = chapterId;

        const blocks = state.pageBlocks[safeIndex] || [];
        renderPageBlocks(blocks);
        updateNavState();
        updateActiveChapterHighlight();
        scrollAfterRender(chapterId, scrollMode);

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

    function buildChapterGroups(chapters) {
        const groups = [];
        let activeGroup = null;

        chapters.forEach((chapter) => {
            const kind = chapter?.kind === 'book' ? 'book' : 'section';
            if (kind === 'book') {
                activeGroup = { book: chapter, sections: [] };
                groups.push(activeGroup);
                return;
            }

            if (!activeGroup) {
                activeGroup = {
                    book: {
                        title: '',
                        id: '',
                        pageIndex: Number.isFinite(chapter?.pageIndex) ? chapter.pageIndex : 0,
                        kind: 'book',
                        implicit: true
                    },
                    sections: []
                };
                groups.push(activeGroup);
            }

            activeGroup.sections.push(chapter);
        });

        return groups;
    }

    function renderSidebar(chapters, onChapterNavigate) {
        chapterList.replaceChildren();
        if (state.currentBookId !== lastBookId) {
            collapsedBooks.clear();
            lastBookId = state.currentBookId;
        }

        if (!chapters.length) {
            const empty = document.createElement('li');
            empty.className = 'chapter-empty';
            empty.textContent = 'ستتم إضافة الفصول لاحقًا.';
            chapterList.appendChild(empty);
            return;
        }

        const hasBookHeadings = chapters.some((chapter) => chapter?.kind === 'book');
        if (!hasBookHeadings) {
            chapters.forEach((chapter) => {
                const item = document.createElement('li');
                item.className = 'chapter-item';

                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'chapter-link chapter-section-link';
                button.dataset.chapterId = chapter.id;
                button.dataset.pageIndex = String(chapter.pageIndex);
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
            return;
        }

        const groups = buildChapterGroups(chapters);
        const activeChapterId = state.currentChapterId || getNearestChapterIdForPage(state.currentPageIndex);

        groups.forEach((group, groupIndex) => {
            const book = group.book;
            const isImplicitUntitled = !book.title && !book.id;
            if (isImplicitUntitled) {
                group.sections.forEach((section) => {
                    const sectionItem = document.createElement('li');
                    sectionItem.className = 'chapter-item';

                    const sectionButton = document.createElement('button');
                    sectionButton.type = 'button';
                    sectionButton.className = 'chapter-link chapter-section-link';
                    sectionButton.dataset.chapterId = section.id;
                    sectionButton.dataset.pageIndex = String(section.pageIndex);
                    sectionButton.textContent = section.title;

                    sectionButton.addEventListener('click', () => {
                        goToPage(section.pageIndex, section.id, { historyMode: 'push' });
                        if (typeof onChapterNavigate === 'function') {
                            onChapterNavigate();
                        }
                    });

                    sectionItem.appendChild(sectionButton);
                    chapterList.appendChild(sectionItem);
                });
                return;
            }

            const bookKey = book.id || `implicit-book-${groupIndex}`;
            const containsActive = Boolean(
                activeChapterId &&
                    (book.id === activeChapterId ||
                        group.sections.some((section) => section.id === activeChapterId))
            );
            const isCollapsed = containsActive ? false : collapsedBooks.has(bookKey);

            const item = document.createElement('li');
            item.className = 'chapter-book';

            const bookButton = document.createElement('button');
            bookButton.type = 'button';
            bookButton.className = 'chapter-book-toggle';
            bookButton.setAttribute('aria-expanded', String(!isCollapsed));
            bookButton.dataset.bookKey = bookKey;
            if (book.id) {
                bookButton.dataset.chapterId = book.id;
            }

            const expandedIcon = document.createElement('span');
            expandedIcon.className = 'toc-icon is-expanded';
            expandedIcon.setAttribute('data-lucide', 'list-chevrons-up-down');
            expandedIcon.setAttribute('aria-hidden', 'true');

            const collapsedIcon = document.createElement('span');
            collapsedIcon.className = 'toc-icon is-collapsed';
            collapsedIcon.setAttribute('data-lucide', 'list-chevrons-down-up');
            collapsedIcon.setAttribute('aria-hidden', 'true');

            const bookLabel = document.createElement('span');
            bookLabel.className = 'toc-text';
            bookLabel.textContent = book.title;

            bookButton.appendChild(expandedIcon);
            bookButton.appendChild(collapsedIcon);
            bookButton.appendChild(bookLabel);

            let sectionList = null;
            if (group.sections.length) {
                sectionList = document.createElement('ul');
                sectionList.className = 'chapter-sublist';
                sectionList.hidden = isCollapsed;
                sectionList.id = `chapter-sublist-${bookKey}`;
                bookButton.setAttribute('aria-controls', sectionList.id);

                group.sections.forEach((section) => {
                    const sectionItem = document.createElement('li');
                    sectionItem.className = 'chapter-item';

                    const sectionButton = document.createElement('button');
                    sectionButton.type = 'button';
                    sectionButton.className = 'chapter-link chapter-section-link';
                    sectionButton.dataset.chapterId = section.id;
                    sectionButton.dataset.pageIndex = String(section.pageIndex);
                    sectionButton.textContent = section.title;

                    sectionButton.addEventListener('click', () => {
                        goToPage(section.pageIndex, section.id, { historyMode: 'push' });
                        if (typeof onChapterNavigate === 'function') {
                            onChapterNavigate();
                        }
                    });

                    sectionItem.appendChild(sectionButton);
                    sectionList.appendChild(sectionItem);
                });
            }

            bookButton.addEventListener('click', () => {
                const expanded = bookButton.getAttribute('aria-expanded') === 'true';
                const nextExpanded = !expanded;
                bookButton.setAttribute('aria-expanded', String(nextExpanded));
                if (sectionList) {
                    sectionList.hidden = !nextExpanded;
                }
                if (nextExpanded) {
                    collapsedBooks.delete(bookKey);
                } else {
                    collapsedBooks.add(bookKey);
                }
            });

            item.appendChild(bookButton);
            if (sectionList) {
                item.appendChild(sectionList);
            }
            chapterList.appendChild(item);
        });

        renderLucideIcons(chapterList);
    }

    return {
        renderSidebar,
        renderPage,
        goToPage,
        syncPartNavigation
    };
}

