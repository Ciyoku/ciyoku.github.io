import { fetchBooksList } from './books-repo.js';
import {
    buildBookDetailsUrl,
    buildReaderUrl,
    getBookId,
    getBookPartCount,
    getBookTitle
} from './books-meta.js';
import { buildAuthorPageUrl, filterBooksByAuthor, groupBooksByAuthor } from './authors-data.js';
import { createBookListItem, renderListMessage } from './book-list-ui.js';
import {
    createFavoriteToggleControl,
    getBookProgressMeta,
    normalizeCatalogText
} from './catalog-page-core.js';
import { onDomReady } from './shared/bootstrap.js';
import { setSocialMetadata } from './shared/seo.js';

const FAVORITE_BUTTON_LABEL = 'إضافة أو إزالة من المفضلة';
const EMPTY_AUTHOR_MESSAGE = 'لا توجد كتب لهذا المؤلف حاليًا.';

onDomReady(initAuthorPage);

function getRequestedAuthorName() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get('author') ?? '').trim();
}

function findKnownAuthor(authors, requestedAuthor) {
    const normalizedRequested = normalizeCatalogText(requestedAuthor);
    if (!normalizedRequested) return null;

    return authors.find((author) => (
        normalizeCatalogText(author.name) === normalizedRequested
    )) || null;
}

function createFavoriteButton(bookId) {
    return createFavoriteToggleControl(bookId, {
        title: FAVORITE_BUTTON_LABEL,
        ariaLabel: FAVORITE_BUTTON_LABEL
    });
}

function renderAuthorBooks(container, books) {
    container.replaceChildren();

    if (!books.length) {
        renderListMessage(container, EMPTY_AUTHOR_MESSAGE, 'empty');
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
        renderListMessage(container, EMPTY_AUTHOR_MESSAGE, 'empty');
    }
}

function setAuthorSeo(authorName) {
    const safeName = String(authorName).trim();
    if (!safeName) return;

    setSocialMetadata({
        title: `${safeName} | المؤلفون | المكتبة الأخبارية`,
        description: `تصفح الكتب التابعة للمؤلف "${safeName}" في المكتبة الأخبارية.`,
        url: buildAuthorPageUrl(safeName)
    });
}

async function initAuthorPage() {
    const listElement = document.getElementById('authorBookList');
    if (!listElement) return;

    const requestedAuthor = getRequestedAuthorName();
    if (!requestedAuthor) {
        renderListMessage(listElement, 'يرجى العودة إلى صفحة المؤلفين ثم اختيار مؤلف.', 'empty');
        return;
    }

    try {
        const books = await fetchBooksList();
        const authors = groupBooksByAuthor(books);
        const knownAuthor = findKnownAuthor(authors, requestedAuthor);

        if (!knownAuthor) {
            renderListMessage(listElement, 'المؤلف المطلوب غير متاح في بيانات الكتب الحالية.', 'empty');
            return;
        }

        const selectedAuthor = knownAuthor.name;
        const authorBooks = filterBooksByAuthor(books, selectedAuthor);
        renderAuthorBooks(listElement, authorBooks);
        setAuthorSeo(selectedAuthor);
    } catch (error) {
        renderListMessage(listElement, `تعذر تحميل كتب المؤلف: ${error.message}`);
    }
}
