import { getBookId, getBookPartCount, getBookTitle } from './books-meta.js';

const BOOKS_LIST_PATH = 'books/list.json';
let booksCache = null;

function normalizeBook(book, index = 0) {
    const id = getBookId(book);
    const title = getBookTitle(book, index);
    const parts = getBookPartCount(book);
    return Object.freeze({
        ...book,
        id,
        title,
        parts
    });
}

function validateBooksArray(books) {
    if (!Array.isArray(books)) {
        throw new Error('صيغة قائمة الكتب غير صحيحة');
    }
}

function assertSafeBooksContentType(response) {
    const contentType = String(response.headers.get('content-type') ?? '').toLowerCase();
    // Reject obvious HTML payloads while allowing tolerant static-server content types.
    if (contentType.includes('text/html')) {
        throw new Error('نوع ملف قائمة الكتب غير متوقع');
    }
}

export async function fetchBooksList(options = {}) {
    const force = options.force === true;
    if (!force && Array.isArray(booksCache)) {
        return booksCache;
    }

    const response = await fetch(BOOKS_LIST_PATH, {
        headers: {
            Accept: 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error('تعذر تحميل قائمة الكتب');
    }

    assertSafeBooksContentType(response);

    const rawBooks = await response.json();
    validateBooksArray(rawBooks);

    const normalizedBooks = rawBooks
        .map((book, index) => normalizeBook(book, index))
        .filter((book) => Boolean(book.id));

    booksCache = Object.freeze(normalizedBooks);
    return booksCache;
}