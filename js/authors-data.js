import { normalizeCatalogText } from './catalog-page-core.js';

function collectAuthorNames(value, output) {
    if (Array.isArray(value)) {
        value.forEach((item) => collectAuthorNames(item, output));
        return;
    }

    if (value === null || value === undefined) {
        return;
    }

    const normalized = String(value).trim();
    if (!normalized) {
        return;
    }

    output.push(normalized);
}

function getBookAuthors(book) {
    const values = [
        book?.author,
        book?.authors,
        book?.writer,
        book?.writers,
        book?.['المؤلف'],
        book?.['المؤلفون'],
        book?.['الكاتب'],
        book?.['الكتّاب']
    ];

    const rawAuthors = [];
    values.forEach((value) => collectAuthorNames(value, rawAuthors));
    return [...new Set(rawAuthors)];
}

export function groupBooksByAuthor(books) {
    const grouped = new Map();

    books.forEach((book) => {
        const authors = getBookAuthors(book);
        authors.forEach((authorName) => {
            if (!grouped.has(authorName)) {
                grouped.set(authorName, []);
            }
            grouped.get(authorName).push(book);
        });
    });

    return [...grouped.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], 'ar'))
        .map(([name, groupedBooks]) => ({
            name,
            books: groupedBooks,
            count: groupedBooks.length
        }));
}

export function buildAuthorPageUrl(authorName) {
    const name = String(authorName ?? '').trim();
    if (!name) return 'authors.html';

    const params = new URLSearchParams();
    params.set('author', name);
    return `author.html?${params.toString()}`;
}

export function filterBooksByAuthor(books, authorName) {
    const normalizedTarget = normalizeCatalogText(authorName);
    if (!normalizedTarget) return [];

    return books.filter((book) => {
        const authors = getBookAuthors(book);
        return authors.some((author) => normalizeCatalogText(author) === normalizedTarget);
    });
}
