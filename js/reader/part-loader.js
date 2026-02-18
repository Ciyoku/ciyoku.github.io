function clampPartIndex(partIndex, partCount, clamp) {
    return clamp(partIndex, 0, Math.max(partCount - 1, 0));
}

export function createReaderPartLoader({
    state,
    clamp,
    createSearchEngine,
    fetchBookPart,
    parseBookContentAsync,
    getParsedPartCache,
    setParsedPartCache,
    updatePartSelector,
    pagination,
    updateReaderSeo,
    renderReaderLoading,
    renderReaderError,
    onPartStatusChange,
    canPreloadNextPart,
    partLoadErrorPrefix
}) {
    let activePartLoadToken = 0;

    async function ensurePartLoaded(partIndex) {
        const part = state.bookParts[partIndex];
        if (!part) return null;

        if (part.status === 'ready') return part.text;
        if (part.status === 'missing') return null;
        if (part.status === 'loading' && part.request) return part.request;

        part.status = 'loading';
        onPartStatusChange();

        part.request = fetchBookPart(state.currentBookId, partIndex)
            .then((text) => {
                if (text === null) {
                    part.status = 'missing';
                    part.text = '';
                    return null;
                }

                part.status = 'ready';
                part.text = text;
                return text;
            })
            .catch((error) => {
                part.status = 'error';
                throw error;
            })
            .finally(() => {
                part.request = null;
                onPartStatusChange();
            });

        return part.request;
    }

    async function preloadNextPart(partIndex) {
        if (!canPreloadNextPart()) return;

        const nextIndex = partIndex + 1;
        if (nextIndex >= state.bookParts.length) return;
        const nextPart = state.bookParts[nextIndex];
        if (!nextPart || nextPart.status !== 'idle') return;

        try {
            await ensurePartLoaded(nextIndex);
        } catch (_) {
            // Silent by design: preloading should not interrupt reading.
        }
    }

    function applyParsedPart(parsed, initialPageIndex = 0, initialChapterId = '', options = {}) {
        state.pageBlocks = parsed.pageBlocks;
        state.chapters = parsed.chapters;
        state.searchIndex = parsed.searchIndex;
        state.searchEngine = createSearchEngine(parsed.searchIndex);
        state.currentPageIndex = 0;

        pagination.renderSidebar(parsed.chapters, options.onAfterChapterNavigate);
        pagination.renderPage(initialPageIndex, {
            chapterId: initialChapterId,
            historyMode: options.historyMode || 'replace'
        });
    }

    async function getParsedPartContent(partText, partIndex, loadToken) {
        const cachedParsed = getParsedPartCache(state.currentBookId, partIndex);
        if (cachedParsed) {
            return cachedParsed;
        }

        const parsed = await parseBookContentAsync(partText);
        if (loadToken !== activePartLoadToken) return null;

        setParsedPartCache(state.currentBookId, partIndex, parsed);
        return parsed;
    }

    async function loadBookPart(partIndex, options = {}) {
        if (!state.bookParts.length) return;

        const loadToken = ++activePartLoadToken;
        const safePartIndex = clampPartIndex(partIndex, state.bookParts.length, clamp);
        const safePageIndex = Number.isInteger(options.pageIndex) ? options.pageIndex : 0;
        const chapterId = typeof options.chapterId === 'string' ? options.chapterId : '';
        const historyMode = options.historyMode || 'replace';

        state.currentPartIndex = safePartIndex;
        updatePartSelector(state);
        updateReaderSeo();

        const selectedPart = state.bookParts[safePartIndex];
        if (selectedPart?.status !== 'ready') {
            renderReaderLoading('جاري تحميل الجزء...');
        }

        let partText = null;
        try {
            partText = await ensurePartLoaded(safePartIndex);
        } catch (error) {
            if (loadToken !== activePartLoadToken) return;
            renderReaderError(`${partLoadErrorPrefix}: ${error.message}`);
            return;
        }

        if (loadToken !== activePartLoadToken) return;

        if (!partText) {
            renderReaderError(partLoadErrorPrefix);
            return;
        }

        const cachedParsed = getParsedPartCache(state.currentBookId, safePartIndex);
        if (!cachedParsed) {
            renderReaderLoading('جاري تجهيز النص...');
        }

        const parsed = cachedParsed || await getParsedPartContent(partText, safePartIndex, loadToken);
        if (!parsed || loadToken !== activePartLoadToken) return;

        applyParsedPart(parsed, safePageIndex, chapterId, {
            historyMode,
            onAfterChapterNavigate: options.onAfterChapterNavigate
        });

        preloadNextPart(safePartIndex);
    }

    function cancelPendingPartLoads() {
        activePartLoadToken += 1;
    }

    return {
        loadBookPart,
        cancelPendingPartLoads
    };
}
