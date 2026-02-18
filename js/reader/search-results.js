export function renderSearchResults({
    query,
    resultsContainer,
    closeSearchOverlay,
    searchEngine,
    searchInBookIndex,
    createHighlightedTextFragment,
    onOpenPage,
    onOpenChapter
}) {
    const { normalizedQuery, matches } = searchInBookIndex(searchEngine, query, 50);
    if (!normalizedQuery) return;

    if (!matches.length) {
        const empty = document.createElement('div');
        empty.className = 'search-result-empty';
        empty.textContent = 'لا توجد نتائج';
        resultsContainer.appendChild(empty);
        return;
    }

    matches.forEach((match) => {
        const resultItem = document.createElement('button');
        resultItem.type = 'button';
        resultItem.className = 'search-result-item';
        resultItem.setAttribute('role', 'option');

        const chapterElement = document.createElement('div');
        chapterElement.className = 'search-result-chapter';
        chapterElement.textContent = match.chapterTitle;

        const lineElement = document.createElement('div');
        lineElement.className = 'search-result-line';
        lineElement.appendChild(createHighlightedTextFragment(match.line, normalizedQuery));

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
