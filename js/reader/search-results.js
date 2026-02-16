export function renderSearchResults({
    query,
    resultsContainer,
    closeSearchOverlay,
    searchIndex,
    searchInBookIndex,
    highlightTextIgnoringDiacritics,
    onOpenPage,
    onOpenChapter
}) {
    const { normalizedQuery, matches } = searchInBookIndex(searchIndex, query, 50);
    if (!normalizedQuery) return;

    if (!matches.length) {
        resultsContainer.innerHTML = '<div class="search-result-empty">لا توجد نتائج</div>';
        return;
    }

    matches.forEach((match) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';

        const chapterElement = document.createElement('div');
        chapterElement.className = 'search-result-chapter';
        chapterElement.textContent = match.chapterTitle;

        const lineElement = document.createElement('div');
        lineElement.className = 'search-result-line';
        lineElement.innerHTML = highlightTextIgnoringDiacritics(match.line, normalizedQuery);

        resultItem.appendChild(chapterElement);
        resultItem.appendChild(lineElement);

        resultItem.addEventListener('click', () => {
            if (!match.chapterId) {
                onOpenPage(match.pageIndex);
                closeSearchOverlay();
                return;
            }

            onOpenChapter(match.pageIndex, match.chapterId);
            closeSearchOverlay();
        });

        resultsContainer.appendChild(resultItem);
    });
}
