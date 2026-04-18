import assert from 'node:assert/strict';

import {
    buildReaderUrl,
    buildReaderUrlWithState,
    getBookCategories,
    getBookPartCount,
    parsePartParam
} from '../js/core/books-meta.js';
import { parseBookContentAsync } from '../js/core/reader-parser.js';
import { groupBooksByAuthor, filterBooksByAuthor } from '../js/features/authors/authors-data.js';
import { groupBooksByCategory, filterBooksByCategoryName } from '../js/features/categories/categories-data.js';
import { buildPartNavigationModel } from '../js/features/reader/pagination.js';
import { createSearchEngine, searchInBookIndex } from '../js/features/reader/search.js';
import {
    buildReaderUrlForState,
    parseReaderStateFromSearchParams
} from '../js/features/reader/url-state.js';
import { normalizeArabicForSearch } from '../js/shared/arabic-search.js';

const testCases = [];

function test(name, callback) {
    testCases.push({ name, callback });
}

function buildEntry(line, chapterId = '') {
    return {
        line,
        normalizedLine: normalizeArabicForSearch(line),
        pageIndex: 0,
        chapterTitle: 'الفصل',
        chapterId
    };
}

test('books-meta: part count normalization', () => {
    assert.equal(getBookPartCount({ parts: 4 }), 4);
    assert.equal(getBookPartCount({ parts: '2' }), 2);
    assert.equal(getBookPartCount({ parts: 0 }), 1);
    assert.equal(getBookPartCount({ parts: 'abc' }), 1);
});

test('books-meta: category aggregation and dedupe', () => {
    const categories = getBookCategories({
        categories: ['الحديث', 'الفقه'],
        category: 'الفقه',
        التصنيفات: ['الحديث', 'العقائد'],
        التصنيف: 'العقائد'
    });
    assert.deepEqual(categories, ['الحديث', 'الفقه', 'العقائد']);
});

test('books-meta: part parsing and URL state building', () => {
    assert.equal(parsePartParam('part3'), 2);
    assert.equal(parsePartParam('3'), 2);
    assert.equal(parsePartParam('part0'), null);
    assert.equal(parsePartParam('invalid'), null);

    const url = buildReaderUrlWithState({ id: 'الكافي', parts: 8 }, {
        partIndex: 2,
        pageIndex: 6,
        chapterId: 'chap-9'
    });

    assert.equal(url, 'reader.html?book=%D8%A7%D9%84%D9%83%D8%A7%D9%81%D9%8A&part=part3&page=7&chapter=chap-9');
    assert.equal(buildReaderUrl({ id: 'book-x', parts: 3 }, 0), 'reader.html?book=book-x');
});

test('reader-url-state: parsing explicit and default query state', () => {
    const explicit = parseReaderStateFromSearchParams('book=abc&part=part3&page=5&chapter=chap-2');
    assert.deepEqual(explicit, {
        partIndex: 2,
        pageIndex: 4,
        chapterId: 'chap-2',
        hasExplicitPart: true,
        hasExplicitPage: true,
        hasExplicitChapter: true
    });

    const defaults = parseReaderStateFromSearchParams('book=abc');
    assert.deepEqual(defaults, {
        partIndex: null,
        pageIndex: 0,
        chapterId: '',
        hasExplicitPart: false,
        hasExplicitPage: false,
        hasExplicitChapter: false
    });
});

test('reader-url-state: URL construction for reader state', () => {
    const withPart = buildReaderUrlForState({
        currentBookId: 'book-x',
        currentPageIndex: 6,
        currentPartIndex: 1,
        currentBookPartCount: 4,
        currentChapterId: 'chapter-7'
    }, 'https://ciyoku.github.io/reader.html?book=old');

    assert.equal(
        `${withPart.pathname}?${withPart.searchParams.toString()}`,
        '/reader.html?book=book-x&page=7&part=part2&chapter=chapter-7'
    );

    const singlePart = buildReaderUrlForState({
        currentBookId: 'book-y',
        currentPageIndex: 0,
        currentPartIndex: 0,
        currentBookPartCount: 1,
        currentChapterId: ''
    }, 'https://ciyoku.github.io/reader.html');

    assert.equal(`${singlePart.pathname}?${singlePart.searchParams.toString()}`, '/reader.html?book=book-y&page=1');
});

test('reader-part-navigation: hides control for single-part books', () => {
    const model = buildPartNavigationModel([
        { label: 'Volume 1', status: 'ready' }
    ], 0);

    assert.equal(model.visible, false);
    assert.equal(model.selectedIndex, 0);
    assert.deepEqual(model.options, []);
});

test('reader-part-navigation: maps loading/missing states and selection', () => {
    const model = buildPartNavigationModel([
        { label: 'Volume 1', status: 'ready' },
        { label: 'Volume 2', status: 'loading' },
        { label: 'Volume 3', status: 'missing' }
    ], 8);

    assert.equal(model.visible, true);
    assert.equal(model.selectedIndex, 2);
    assert.equal(model.options.length, 3);

    assert.equal(model.options[0].disabled, false);
    assert.equal(model.options[0].label, 'Volume 1');

    assert.equal(model.options[1].disabled, false);
    assert.equal(model.options[1].label.startsWith('Volume 2'), true);
    assert.notEqual(model.options[1].label, 'Volume 2');

    assert.equal(model.options[2].disabled, true);
    assert.equal(model.options[2].label.startsWith('Volume 3'), true);
    assert.notEqual(model.options[2].label, 'Volume 3');
});

test('reader-search: minimum words and normalized matching', () => {
    const entries = [
        buildEntry('هذا نصٌ تجريبيّ للبحث داخل الكتاب'),
        buildEntry('سطر آخر بلا تطابق')
    ];

    assert.deepEqual(searchInBookIndex(entries, 'نص'), {
        normalizedQuery: '',
        matches: []
    });

    const result = searchInBookIndex(entries, 'نص تجريبي');
    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0].line, 'هذا نصٌ تجريبيّ للبحث داخل الكتاب');
});

test('reader-search: token indexing narrows candidates', () => {
    const engine = createSearchEngine([
        buildEntry('الكافي حديث التوحيد'),
        buildEntry('الفقه العملي'),
        buildEntry('الحديث والتفسير')
    ]);
    const result = searchInBookIndex(engine, 'حديث التوحيد');
    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0].line, 'الكافي حديث التوحيد');
});

test('authors-data: groups and filters books by normalized author name', () => {
    const books = [
        { id: 'a', title: 'Book A', author: 'Author One' },
        { id: 'b', title: 'Book B', author: 'Author Two' },
        { id: 'c', title: 'Book C', author: ['Author One', 'Author Three'] }
    ];

    const grouped = groupBooksByAuthor(books);
    const authorOne = grouped.find((row) => row.name === 'Author One');
    const authorTwo = grouped.find((row) => row.name === 'Author Two');

    assert.ok(authorOne);
    assert.ok(authorTwo);
    assert.equal(authorOne.count, 2);
    assert.equal(authorTwo.count, 1);

    const filtered = filterBooksByAuthor(books, 'author one');
    assert.equal(filtered.length, 2);
    assert.deepEqual(filtered.map((book) => book.id).sort(), ['a', 'c']);
});

test('categories-data: groups and filters books by normalized category name', () => {
    const books = [
        { id: 'a', title: 'Book A', categories: ['Hadith', 'Fiqh'] },
        { id: 'b', title: 'Book B', category: 'Fiqh' },
        { id: 'c', title: 'Book C', التصنيف: 'Aqidah' }
    ];

    const grouped = groupBooksByCategory(books);
    const fiqh = grouped.find((row) => row.name === 'Fiqh');
    const hadith = grouped.find((row) => row.name === 'Hadith');

    assert.ok(fiqh);
    assert.ok(hadith);
    assert.equal(fiqh.count, 2);
    assert.equal(hadith.count, 1);

    const filtered = filterBooksByCategoryName(books, 'fiqh');
    assert.equal(filtered.length, 2);
    assert.deepEqual(filtered.map((book) => book.id).sort(), ['a', 'b']);
});

test('reader-parser: extracts chapters, pages, and search index', async () => {
    const text = [
        '# الكتاب الأول',
        'سطر تمهيدي',
        '## الفصل الأول',
        'سطر داخل الفصل الأول',
        'PAGE_SEPARATOR',
        '## الفصل الثاني',
        'سطر داخل الفصل الثاني'
    ].join('\n');

    const parsed = await parseBookContentAsync(text, { chunkSize: 2 });
    assert.equal(parsed.pages.length, 2);
    assert.equal(parsed.chapters.length, 3);
    assert.equal(parsed.searchIndex.length, 3);
    assert.equal(parsed.chapters[0].kind, 'book');
    assert.equal(parsed.chapters[1].kind, 'section');
    assert.equal(parsed.chapters[2].pageIndex, 1);
});

let passed = 0;
let failed = 0;

for (const { name, callback } of testCases) {
    try {
        await callback();
        passed += 1;
        console.log(`PASS ${name}`);
    } catch (error) {
        failed += 1;
        console.error(`FAIL ${name}`);
        console.error(error.stack || error.message);
    }
}

console.log(`\nTest summary: ${passed} passed, ${failed} failed, ${testCases.length} total.`);
if (failed > 0) {
    process.exitCode = 1;
}
