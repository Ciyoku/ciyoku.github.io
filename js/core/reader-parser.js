import {
    buildNormalizedIndexMap,
    isArabicDiacritic,
    normalizeArabicForSearch
} from '../shared/arabic-search.js';
import { splitBookPages } from '../shared/book-pages.js';

const DEFAULT_PARSE_CHUNK_SIZE = 700;

export { normalizeArabicForSearch, splitBookPages };

/**
 * @typedef {Object} PageBlock
 * @property {'heading'|'paragraph'|'anchor'} type
 * @property {string} text
 * @property {string} [id]
 * @property {'book'|'section'} [level]
 */

/**
 * @typedef {Object} Chapter
 * @property {string} title
 * @property {string} id
 * @property {number} pageIndex
 * @property {'book'|'section'} [kind]
 * @property {string} [bookId]
 */

/**
 * @typedef {Object} SearchIndexEntry
 * @property {string} line
 * @property {string} normalizedLine
 * @property {number} pageIndex
 * @property {string} chapterTitle
 * @property {string} chapterId
 */

/**
 * @typedef {Object} ParserContext
 * @property {string[]} pages
 * @property {PageBlock[][]} pageBlocks
 * @property {Chapter[]} chapters
 * @property {SearchIndexEntry[]} searchIndex
 * @property {number} chapterIndex
 * @property {number} bookIndex
 * @property {number} processedLines
 */

/**
 * @param {string} text
 * @param {string} normalizedQuery
 * @returns {{source: string, ranges: [number, number][]}}
 */
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

/**
 * @param {string} line
 * @param {string} normalizedQuery
 * @returns {DocumentFragment}
 */
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

/**
 * @param {any} value
 * @returns {number}
 */
function normalizeChunkSize(value) {
    if (Number.isInteger(value) && value > 0) return value;
    return DEFAULT_PARSE_CHUNK_SIZE;
}

/**
 * @param {string} text
 * @returns {ParserContext}
 */
function createParserContext(text) {
    return {
        pages: splitBookPages(text),
        pageBlocks: [],
        chapters: [],
        searchIndex: [],
        chapterIndex: 0,
        bookIndex: 0,
        processedLines: 0
    };
}

/**
 * @param {ParserContext} context
 * @param {string} line
 * @param {number} pageIndex
 * @param {{book: {title: string, id: string}, section: {title: string, id: string} | null}} currentState
 * @returns {{book: {title: string, id: string}, section: {title: string, id: string} | null}}
 */
/**
 * @param {string} trimmedLine
 * @returns {{title: string, kind: 'book'|'section'}|null}
 */
function getHeadingInfo(trimmedLine) {
    if (!trimmedLine.startsWith('#')) return null;

    let hashEnd = 0;
    while (trimmedLine[hashEnd] === '#') {
        hashEnd += 1;
    }

    const hashCount = hashEnd;
    const title = trimmedLine.slice(hashEnd).trim();

    if (!title) return null;

    return {
        title,
        kind: hashCount >= 2 ? 'section' : 'book'
    };
}

function parseLine(context, line, pageIndex, currentState) {
    const trimmed = line.trim();
    if (!trimmed) return currentState;

    const headingInfo = getHeadingInfo(trimmed);
    if (headingInfo) {
        const { title, kind } = headingInfo;
        if (kind === 'section') {
            const id = `chap-${context.chapterIndex}`;
            context.pageBlocks[pageIndex].push({
                type: 'anchor',
                id,
                text: ''
            });
            context.chapters.push({
                title,
                id,
                pageIndex,
                kind: 'section',
                bookId: currentState.book?.id || ''
            });
            context.chapterIndex += 1;
            return {
                book: currentState.book,
                section: {
                    title,
                    id
                }
            };
        }

        const id = `book-${context.bookIndex}`;
        context.pageBlocks[pageIndex].push({
            type: 'anchor',
            id,
            text: ''
        });
        context.chapters.push({
            title,
            id,
            pageIndex,
            kind: 'book'
        });
        context.bookIndex += 1;
        return {
            book: {
                title,
                id
            },
            section: null
        };
    }

    context.pageBlocks[pageIndex].push({
        type: 'paragraph',
        text: trimmed
    });

    const activeHeading = currentState.section || currentState.book || { title: '', id: '' };
    context.searchIndex.push({
        line: trimmed,
        normalizedLine: normalizeArabicForSearch(trimmed),
        pageIndex,
        chapterTitle: activeHeading.title,
        chapterId: activeHeading.id
    });

    return currentState;
}

/**
 * @returns {Promise<void>}
 */
async function yieldToBrowser() {
    await new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

/**
 * @param {string} text
 * @param {Object} [options={}]
 * @param {number} [options.chunkSize]
 * @returns {Promise<{pages: string[], pageBlocks: PageBlock[][], chapters: Chapter[], searchIndex: SearchIndexEntry[]}>}
 */
export async function parseBookContentAsync(text, options = {}) {
    const chunkSize = normalizeChunkSize(options.chunkSize);
    const context = createParserContext(text);
    let currentState = {
        book: {
            title: '',
            id: ''
        },
        section: null
    };

    for (let pageIndex = 0; pageIndex < context.pages.length; pageIndex++) {
        const pageText = context.pages[pageIndex];
        const lines = String(pageText).split('\n');
        context.pageBlocks.push([]);

        for (const line of lines) {
            currentState = parseLine(context, line, pageIndex, currentState);
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
