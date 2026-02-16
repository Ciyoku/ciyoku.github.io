import { getBookId, getBookPartCount, getBookTitle } from './books-meta.js';

const BOOKS_LIST_PATH = 'books/list.json';
let booksCache = null;

function normalizeBook(book, index = 0) {
    const id = getBookId(book);
    const title = getBookTitle(book, index);
    const parts = getBookPartCount(book);
    return {
        ...book,
        id,
        title,
        parts
    };
}

function validateBooksArray(books) {
    if (!Array.isArray(books)) {
        throw new Error('صيغة قائمة الكتب غير صحيحة');
    }
}

export async function fetchBooksList(options = {}) {
    const force = options.force === true;
    if (!force && Array.isArray(booksCache)) {
        return booksCache;
    }

    const response = await fetch(BOOKS_LIST_PATH);
    if (!response.ok) {
        throw new Error('تعذر تحميل قائمة الكتب');
    }

    const rawBooks = await response.json();
    validateBooksArray(rawBooks);

    const normalizedBooks = rawBooks
        .map((book, index) => normalizeBook(book, index))
        .filter((book) => Boolean(book.id));

    booksCache = normalizedBooks;
    return normalizedBooks;
}
