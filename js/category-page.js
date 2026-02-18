import { fetchBooksList } from './books-repo.js';
import {
    buildBookDetailsUrl,
    buildReaderUrl,
    getBookId,
    getBookPartCount,
    getBookTitle
} from './books-meta.js';
import { filterBooksByCategory, groupBooksByCategory } from './categories-data.js';
import { createBookListItem, renderListMessage } from './book-list-ui.js';
import {
    createFavoriteToggleControl,
    getBookProgressMeta,
    normalizeCatalogText
} from './catalog-page-core.js';
import { onDomReady } from './shared/bootstrap.js';
import { setSocialMetadata } from './shared/seo.js';

const FAVORITE_BUTTON_LABEL = 'إضافة أو إزالة من المفضلة';
const EMPTY_CATEGORY_MESSAGE = 'لا توجد كتب ضمن هذا التصنيف حاليًا.';

onDomReady(initCategoryPage);

function getRequestedCategoryName() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get('category') ?? '').trim();
}

function buildCategoryUrl(categoryName) {
    const params = new URLSearchParams();
    params.set('category', categoryName);
    return `category.html?${params.toString()}`;
}

function findKnownCategory(categories, requestedCategory) {
    const normalizedRequested = normalizeCatalogText(requestedCategory);
    if (!normalizedRequested) return null;

    return categories.find((category) => (
        normalizeCatalogText(category.name) === normalizedRequested
    )) || null;
}

function createFavoriteButton(bookId) {
    return createFavoriteToggleControl(bookId, {
        title: FAVORITE_BUTTON_LABEL,
        ariaLabel: FAVORITE_BUTTON_LABEL
    });
}

function renderCategoryBooks(container, books) {
    container.replaceChildren();

    if (!books.length) {
        renderListMessage(container, EMPTY_CATEGORY_MESSAGE, 'empty');
        return;
    }

    books.forEach((book, index) => {
        const id = getBookId(book);
        if (!id) return;

        const progressMeta = getBookProgressMeta(book);
        const item = createBookListItem({
            bookId: id,
            title: getBookTitle(book, index),
            readHref: buildReaderUrl(book, 0),
            detailsHref: buildBookDetailsUrl(book),
            favoriteButton: createFavoriteButton(id),
            parts: getBookPartCount(book),
            progressHref: progressMeta?.progressHref || '',
            progressLabel: progressMeta?.progressLabel || ''
        });

        container.appendChild(item);
    });

    if (!container.children.length) {
        renderListMessage(container, EMPTY_CATEGORY_MESSAGE, 'empty');
    }
}

function setCategorySeo(categoryName) {
    const safeName = String(categoryName).trim();
    if (!safeName) return;

    setSocialMetadata({
        title: `${safeName} | التصنيفات | المكتبة الأخبارية`,
        description: `تصفح الكتب المصنفة تحت "${safeName}" في المكتبة الأخبارية.`,
        url: buildCategoryUrl(safeName)
    });
}

async function initCategoryPage() {
    const listElement = document.getElementById('categoryBookList');
    if (!listElement) return;

    const requestedCategory = getRequestedCategoryName();
    if (!requestedCategory) {
        renderListMessage(listElement, 'يرجى العودة إلى صفحة التصنيفات ثم اختيار تصنيف.', 'empty');
        return;
    }

    try {
        const books = await fetchBooksList();
        const categories = groupBooksByCategory(books);
        const knownCategory = findKnownCategory(categories, requestedCategory);

        if (!knownCategory) {
            renderListMessage(listElement, 'التصنيف المطلوب غير متاح في بيانات الكتب الحالية.', 'empty');
            return;
        }

        const selectedCategory = knownCategory.name;
        const categoryBooks = filterBooksByCategory(books, selectedCategory);
        renderCategoryBooks(listElement, categoryBooks);
        setCategorySeo(selectedCategory);
    } catch (error) {
        renderListMessage(listElement, `تعذر تحميل كتب التصنيف: ${error.message}`);
    }
}
