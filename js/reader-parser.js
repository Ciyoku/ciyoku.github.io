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
const DEFAULT_PARSE_CHUNK_SIZE = 700;

function splitBookPages(text) {
    if (!String(text).includes('PAGE_SEPARATOR')) {
        return [String(text ?? '')];
    }
    return String(text ?? '').split(/PAGE_SEPARATOR/g);
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

export function createHighlightedTextFragment(line, normalizedQuery) {
    const { source, ranges } = findDiacriticsInsensitiveRanges(line, normalizedQuery);
    const fragment = document.createDocumentFragment();

    if (!ranges.length) {
        fragment.appendChild(document.createTextNode(source));
        return fragment;
    }

    let cursor = 0;
    ranges.forEach(([start, end]) => {
        if (start < cursor) return;

        const before = source.slice(cursor, start);
        if (before) {
            fragment.appendChild(document.createTextNode(before));
        }

        const highlighted = document.createElement('span');
        highlighted.className = 'highlight';
        highlighted.textContent = source.slice(start, end);
        fragment.appendChild(highlighted);
        cursor = end;
    });

    const remaining = source.slice(cursor);
    if (remaining) {
        fragment.appendChild(document.createTextNode(remaining));
    }

    return fragment;
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

function normalizeChunkSize(value) {
    if (Number.isInteger(value) && value > 0) return value;
    return DEFAULT_PARSE_CHUNK_SIZE;
}

function createParserContext(text) {
    return {
        pages: splitBookPages(text),
        pageBlocks: [],
        chapters: [],
        searchIndex: [],
        chapterIndex: 0,
        processedLines: 0
    };
}

function parseLine(context, line, pageIndex, currentChapter) {
    const trimmed = line.trim();
    if (!trimmed) return currentChapter;

    if (trimmed.startsWith('##')) {
        const title = trimmed.replace('##', '').trim();
        const id = `chap-${context.chapterIndex}`;
        context.pageBlocks[pageIndex].push({
            type: 'heading',
            id,
            text: title
        });
        context.chapters.push({ title, id, pageIndex });
        context.chapterIndex += 1;
        return {
            title: title || currentChapter.title,
            id
        };
    }

    context.pageBlocks[pageIndex].push({
        type: 'paragraph',
        text: trimmed
    });

    context.searchIndex.push({
        line: trimmed,
        normalizedLine: normalizeArabicForSearch(trimmed),
        pageIndex,
        chapterTitle: currentChapter.title,
        chapterId: currentChapter.id
    });

    return currentChapter;
}

async function yieldToBrowser() {
    await new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

export function parseBookContent(text) {
    const context = createParserContext(text);
    let currentChapter = {
        title: 'بداية الكتاب',
        id: ''
    };

    context.pages.forEach((pageText, pageIndex) => {
        context.pageBlocks.push([]);
        const lines = String(pageText).split('\n');

        lines.forEach((line) => {
            currentChapter = parseLine(context, line, pageIndex, currentChapter);
        });
    });

    return {
        pages: context.pages,
        pageBlocks: context.pageBlocks,
        chapters: context.chapters,
        searchIndex: context.searchIndex
    };
}

export async function parseBookContentAsync(text, options = {}) {
    const chunkSize = normalizeChunkSize(options.chunkSize);
    const context = createParserContext(text);
    let currentChapter = {
        title: 'بداية الكتاب',
        id: ''
    };

    for (let pageIndex = 0; pageIndex < context.pages.length; pageIndex++) {
        const pageText = context.pages[pageIndex];
        const lines = String(pageText).split('\n');
        context.pageBlocks.push([]);

        for (const line of lines) {
            currentChapter = parseLine(context, line, pageIndex, currentChapter);
            context.processedLines += 1;

            if (context.processedLines % chunkSize === 0) {
                await yieldToBrowser();
            }
        }
    }

    return {
        pages: context.pages,
        pageBlocks: context.pageBlocks,
        chapters: context.chapters,
        searchIndex: context.searchIndex
    };
}
