function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D4-\u08FF]/g;
const SINGLE_ARABIC_DIACRITIC = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D4-\u08FF]/;

function splitBookPages(text) {
    if (!text.includes('PAGE_SEPARATOR')) {
        return [text];
    }
    return text.split(/PAGE_SEPARATOR/g);
}

function parsePage(text, chapterIndexStart, pageIndex) {
    const lines = text.split('\n');
    const chapters = [];
    const searchEntries = [];
    let htmlContent = '';
    let chapterIndex = chapterIndexStart;
    let currentChapterTitle = 'بداية الكتاب';
    let currentChapterId = '';

    lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('##')) {
            const title = trimmed.replace('##', '').trim();
            const id = `chap-${chapterIndex}`;
            chapters.push({ title, id });
            htmlContent += `<h2 id="${id}" class="chapter-heading fade-in">${escapeHtml(title)}</h2>`;
            currentChapterTitle = title || currentChapterTitle;
            currentChapterId = id;
            chapterIndex++;
        } else if (trimmed.length > 0) {
            htmlContent += `<p class="fade-in">${escapeHtml(trimmed)}</p>`;
            searchEntries.push({
                line: trimmed,
                normalizedLine: normalizeArabicForSearch(trimmed),
                pageIndex,
                chapterTitle: currentChapterTitle,
                chapterId: currentChapterId
            });
        }
    });

    return { htmlContent, chapters, searchEntries, nextChapterIndex: chapterIndex };
}

export function parseBookContent(text) {
    const pages = splitBookPages(text);
    const pageHtml = [];
    const chapters = [];
    const searchIndex = [];
    let chapterIndex = 0;

    pages.forEach((pageText, pageIndex) => {
        const parsed = parsePage(pageText, chapterIndex, pageIndex);
        pageHtml.push(parsed.htmlContent);
        parsed.chapters.forEach((chapter) => {
            chapters.push({
                ...chapter,
                pageIndex: pageHtml.length - 1
            });
        });
        parsed.searchEntries.forEach((entry) => {
            searchIndex.push(entry);
        });
        chapterIndex = parsed.nextChapterIndex;
    });

    return {
        pages,
        pageHtml,
        chapters,
        searchIndex
    };
}

export function normalizeArabicForSearch(text) {
    return String(text ?? '')
        .normalize('NFC')
        .replace(ARABIC_DIACRITICS, '')
        .toLowerCase();
}

function isArabicDiacritic(char) {
    return SINGLE_ARABIC_DIACRITIC.test(char);
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

function findDiacriticsInsensitiveRanges(text, normalizedQuery) {
    const query = normalizeArabicForSearch(normalizedQuery);
    if (!query) return { source: String(text ?? '').normalize('NFC'), ranges: [] };

    const mapped = buildNormalizedIndexMap(text);
    const ranges = [];
    let offset = 0;

    while (offset <= mapped.normalized.length - query.length) {
        const normalizedIndex = mapped.normalized.indexOf(query, offset);
        if (normalizedIndex === -1) break;

        const startOriginalIndex = mapped.indexMap[normalizedIndex];
        let endOriginalIndex = mapped.indexMap[normalizedIndex + query.length - 1] + 1;

        while (endOriginalIndex < mapped.source.length && isArabicDiacritic(mapped.source[endOriginalIndex])) {
            endOriginalIndex++;
        }

        ranges.push([startOriginalIndex, endOriginalIndex]);
        offset = normalizedIndex + 1;
    }

    return { source: mapped.source, ranges };
}

export function highlightTextIgnoringDiacritics(line, normalizedQuery) {
    const { source, ranges } = findDiacriticsInsensitiveRanges(line, normalizedQuery);
    if (!ranges.length) return escapeHtml(source);

    let html = '';
    let cursor = 0;

    ranges.forEach(([start, end]) => {
        if (start < cursor) return;
        html += escapeHtml(source.slice(cursor, start));
        html += `<span class="highlight">${escapeHtml(source.slice(start, end))}</span>`;
        cursor = end;
    });

    html += escapeHtml(source.slice(cursor));
    return html;
}
