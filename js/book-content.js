function getBookPartFileName(partIndex) {
    return partIndex === 0 ? 'book.txt' : `book${partIndex + 1}.txt`;
}

const BOOK_LOAD_ERROR_MESSAGE = 'تعذر تحميل نص الكتاب';

function normalizeBookPathId(bookId) {
    return encodeURIComponent(String(bookId ?? '').trim());
}

async function fetchTextIfOk(url) {
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.text();
}

export async function fetchBookParts(bookId, expectedPartCount = 1) {
    const normalizedBookId = normalizeBookPathId(bookId);
    if (!normalizedBookId) {
        throw new Error(BOOK_LOAD_ERROR_MESSAGE);
    }

    const totalParts = Number.isInteger(expectedPartCount) && expectedPartCount > 1
        ? expectedPartCount
        : 1;

    const parts = await Promise.all(
        Array.from({ length: totalParts }, (_, index) => (
            fetchTextIfOk(`books/${normalizedBookId}/${getBookPartFileName(index)}`)
        ))
    );

    const firstMissingPart = parts.findIndex((part) => part === null);
    if (firstMissingPart === 0) {
        throw new Error(BOOK_LOAD_ERROR_MESSAGE);
    }

    if (firstMissingPart > 0) {
        return parts.slice(0, firstMissingPart);
    }

    return parts;
}
