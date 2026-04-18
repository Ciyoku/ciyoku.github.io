import { onDomReady } from '../../shared/bootstrap.js';
import { setSocialMetadata } from '../../shared/seo.js';
import { renderEntityBooksPage } from '../entities/entity-books-page.js';
import { buildAuthorPageUrl, filterBooksByAuthor, groupBooksByAuthor } from './authors-data.js';

const EMPTY_AUTHOR_MESSAGE = 'لا توجد كتب لهذا المؤلف حاليًا.';
const MISSING_AUTHOR_SELECTION_MESSAGE = 'يرجى العودة إلى صفحة المؤلفين ثم اختيار مؤلف.';
const UNKNOWN_AUTHOR_MESSAGE = 'المؤلف المطلوب غير متاح في بيانات الكتب الحالية.';
const LOAD_AUTHOR_BOOKS_ERROR_PREFIX = 'تعذر تحميل كتب المؤلف';

onDomReady(initAuthorPage);

function getRequestedAuthorName() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get('author') ?? '').trim();
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

    await renderEntityBooksPage({
        listElement,
        requestedName: getRequestedAuthorName(),
        backPageCanonical: 'authors.html',
        emptyMessage: EMPTY_AUTHOR_MESSAGE,
        missingSelectionMessage: MISSING_AUTHOR_SELECTION_MESSAGE,
        unknownEntityMessage: UNKNOWN_AUTHOR_MESSAGE,
        loadErrorPrefix: LOAD_AUTHOR_BOOKS_ERROR_PREFIX,
        groupEntities: groupBooksByAuthor,
        filterBooks: filterBooksByAuthor,
        setEntitySeo: setAuthorSeo
    });
}
