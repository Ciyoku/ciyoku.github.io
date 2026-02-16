export function createPaginationController({
    state,
    toArabicIndicNumber,
    parsePageNumberInput,
    syncReaderStateToUrl
}) {
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
        document.querySelectorAll('.chapter-item').forEach((item) => {
            item.classList.toggle('active', item.dataset.chapterId === activeChapterId);
        });
    }

    function wirePageNav() {
        const totalPages = state.pageHtml.length || 1;
        const prevButtons = document.querySelectorAll('.prev-page-btn');
        const nextButtons = document.querySelectorAll('.next-page-btn');
        const pageNumberDisplays = document.querySelectorAll('.page-number-display');
        const pageJumpInputs = document.querySelectorAll('.page-jump-input');

        pageNumberDisplays.forEach((element) => {
            element.textContent = `صفحة ${toArabicIndicNumber(state.currentPageIndex + 1)} / ${toArabicIndicNumber(totalPages)}`;
        });

        prevButtons.forEach((button) => {
            button.disabled = state.currentPageIndex <= 0;
            button.onclick = () => renderPage(state.currentPageIndex - 1, { chapterId: '' });
        });

        nextButtons.forEach((button) => {
            button.disabled = state.currentPageIndex >= totalPages - 1;
            button.onclick = () => renderPage(state.currentPageIndex + 1, { chapterId: '' });
        });

        pageJumpInputs.forEach((input) => {
            let jumpTimer = null;

            const tryJump = () => {
                const enteredPage = parsePageNumberInput(input.value);
                input.classList.remove('is-valid', 'is-invalid');

                if (enteredPage === null) return;

                if (enteredPage < 1 || enteredPage > totalPages) {
                    input.classList.add('is-invalid');
                    return;
                }

                input.classList.add('is-valid');
                const targetPageIndex = enteredPage - 1;
                if (targetPageIndex !== state.currentPageIndex) {
                    renderPage(targetPageIndex, { chapterId: '' });
                }
            };

            input.value = toArabicIndicNumber(state.currentPageIndex + 1);
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
                input.value = toArabicIndicNumber(state.currentPageIndex + 1);
            };
        });
    }

    function renderPage(pageIndex, options = {}) {
        const readerContent = document.getElementById('readerContent');
        const totalPages = state.pageHtml.length || 1;
        const safeIndex = Math.min(Math.max(pageIndex, 0), totalPages - 1);
        const chapterId = typeof options.chapterId === 'string' ? options.chapterId : '';
        const updateUrl = options.updateUrl !== false;

        state.currentPageIndex = safeIndex;
        state.currentChapterId = chapterId;

        const navHtml = `
            <div class="page-nav">
                <button type="button" class="page-btn prev-page-btn">السابق</button>
                <div class="page-nav-center">
                    <div class="page-number-display">صفحة ${toArabicIndicNumber(safeIndex + 1)} / ${toArabicIndicNumber(totalPages)}</div>
                    <input class="page-jump-input" aria-label="انتقال إلى رقم الصفحة" inputmode="numeric" autocomplete="off" spellcheck="false" value="${toArabicIndicNumber(safeIndex + 1)}" />
                </div>
                <button type="button" class="page-btn next-page-btn">التالي</button>
            </div>
        `;

        const pageContent = state.pageHtml[safeIndex] || '';
        readerContent.innerHTML = navHtml + pageContent + navHtml;
        readerContent.style.fontSize = `${state.fontSize}px`;

        wirePageNav();
        updateActiveChapterHighlight();

        if (chapterId) {
            setTimeout(() => {
                const element = document.getElementById(chapterId);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }, 0);
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        if (updateUrl) {
            syncReaderStateToUrl(state);
        }
    }

    function goToPage(pageIndex, targetId) {
        renderPage(pageIndex, { chapterId: targetId || '' });
    }

    function renderSidebar(chapters, onChapterNavigate) {
        const list = document.getElementById('chapterList');
        list.innerHTML = '';

        if (chapters.length === 0) {
            list.innerHTML = '<li class="chapter-empty">ستتم إضافة الفصول لاحقًا.</li>';
            return;
        }

        chapters.forEach((chapter) => {
            const li = document.createElement('li');
            li.className = 'chapter-item';
            li.dataset.chapterId = chapter.id;
            li.dataset.pageIndex = String(chapter.pageIndex);
            li.textContent = chapter.title;
            li.addEventListener('click', () => {
                goToPage(chapter.pageIndex, chapter.id);
                if (typeof onChapterNavigate === 'function') {
                    onChapterNavigate();
                }
            });
            list.appendChild(li);
        });
    }

    return {
        renderSidebar,
        renderPage,
        goToPage
    };
}
