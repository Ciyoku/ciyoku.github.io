const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D4-\u08FF]/;

function isArabicDiacritic(char) {
    return ARABIC_DIACRITICS.test(char);
}

function buildNormalizedIndexMap(text) {
    const source = String(text ?? '').normalize('NFC');
    const normalizedChars = [];
    const indexMap = [];

    for (let index = 0; index < source.length; index++) {
        const char = source[index];
        if (isArabicDiacritic(char)) continue;
        normalizedChars.push(char.toLowerCase());
        indexMap.push(index);
    }

    return {
        source,
        normalized: normalizedChars.join(''),
        indexMap
    };
}

export function splitBookPages(text) {
    if (!String(text).includes('PAGE_SEPARATOR')) {
        return [String(text ?? '')];
    }

    return String(text ?? '').split(/PAGE_SEPARATOR/g);
}

export function createMatchExcerpt(line, normalizedQuery, options = {}) {
    const radius = Number.isInteger(options.radius) && options.radius > 0 ? options.radius : 120;
    const source = String(line ?? '').trim();

    if (!source) return '';
    if (source.length <= radius * 2) return source;

    const mapped = buildNormalizedIndexMap(source);
    const queryIndex = mapped.normalized.indexOf(normalizedQuery);
    if (queryIndex === -1) {
        return `${source.slice(0, radius * 2).trim()}…`;
    }

    const startNormalized = Math.max(0, queryIndex - radius);
    const endNormalized = Math.min(mapped.normalized.length, queryIndex + normalizedQuery.length + radius);

    const startOriginal = mapped.indexMap[startNormalized] ?? 0;
    const endMapIndex = endNormalized > 0 ? mapped.indexMap[endNormalized - 1] : 0;
    const endOriginal = typeof endMapIndex === 'number' ? endMapIndex + 1 : mapped.source.length;

    const prefix = startOriginal > 0 ? '…' : '';
    const suffix = endOriginal < mapped.source.length ? '…' : '';
    return `${prefix}${mapped.source.slice(startOriginal, endOriginal).trim()}${suffix}`;
}
