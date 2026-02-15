(function () {
    function normalizeId(id) {
        return String(id ?? '').trim();
    }

    function getBookId(book) {
        return normalizeId(book?.id);
    }

    function getBookTitle(book, fallbackIndex = 0) {
        const title = String(book?.title ?? '').trim();
        if (title) return title;
        return `كتاب ${fallbackIndex + 1}`;
    }

    function getBookPartCount(book) {
        const value = Number.parseInt(book?.parts, 10);
        if (Number.isInteger(value) && value > 1) return value;
        return 1;
    }

    function hasMultipleParts(book) {
        return getBookPartCount(book) > 1;
    }

    function toPartParam(partIndex) {
        const safeIndex = Number.isInteger(partIndex) && partIndex >= 0 ? partIndex : 0;
        return `part${safeIndex + 1}`;
    }

    function normalizePartIndex(partIndex) {
        return Number.isInteger(partIndex) && partIndex >= 0 ? partIndex : 0;
    }

    function shouldIncludePartInUrl(book, partIndex = 0) {
        return hasMultipleParts(book) && normalizePartIndex(partIndex) > 0;
    }

    function parsePartParam(partValue) {
        if (partValue === null || partValue === undefined || partValue === '') {
            return null;
        }

        const value = String(partValue).trim();
        const partMatch = /^part(\d+)$/i.exec(value);
        if (partMatch) {
            const parsed = Number.parseInt(partMatch[1], 10);
            if (Number.isInteger(parsed) && parsed > 0) return parsed - 1;
            return null;
        }

        const asNumber = Number(value);
        if (Number.isInteger(asNumber) && asNumber > 0) {
            return asNumber - 1;
        }

        return null;
    }

    function buildReaderUrl(book, partIndex = 0) {
        const id = getBookId(book);
        if (!id) return 'reader.html';

        const params = new URLSearchParams();
        params.set('book', id);

        const safePartIndex = normalizePartIndex(partIndex);
        if (shouldIncludePartInUrl(book, safePartIndex)) {
            params.set('part', toPartParam(safePartIndex));
        }

        return `reader.html?${params.toString()}`;
    }

    window.booksMeta = {
        getBookId,
        getBookTitle,
        getBookPartCount,
        hasMultipleParts,
        shouldIncludePartInUrl,
        toPartParam,
        parsePartParam,
        buildReaderUrl
    };
})();
