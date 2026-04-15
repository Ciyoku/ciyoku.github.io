import { getBookCategories } from '../../core/books-meta.js';
import { normalizeCatalogText } from '../../shared/text-normalization.js';

function collectBookCategories(book) {
    return [...new Set(getBookCategories(book).map((value) => String(value).trim()).filter(Boolean))];
}

export function filterBooksByCategoryName(books, categoryName) {
    const normalizedTarget = normalizeCatalogText(categoryName);
    if (!normalizedTarget) return [];

    const sourceBooks = Array.isArray(books) ? books : [];
    return sourceBooks.filter((book) => {
        const categories = collectBookCategories(book);
        return categories.some((category) => normalizeCatalogText(category) === normalizedTarget);
    });
}
