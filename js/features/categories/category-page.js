import { onDomReady } from '../../shared/bootstrap.js';
import { setSocialMetadata } from '../../shared/seo.js';
import { renderEntityBooksPage } from '../entities/entity-books-page.js';
import { filterBooksByCategoryName, groupBooksByCategory } from './categories-data.js';

const EMPTY_CATEGORY_MESSAGE = 'لا توجد كتب ضمن هذا التصنيف حاليًا.';
const MISSING_CATEGORY_SELECTION_MESSAGE = 'يرجى العودة إلى صفحة التصنيفات ثم اختيار تصنيف.';
const UNKNOWN_CATEGORY_MESSAGE = 'التصنيف المطلوب غير متاح في بيانات الكتب الحالية.';
const LOAD_CATEGORY_BOOKS_ERROR_PREFIX = 'تعذر تحميل كتب التصنيف';

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

    await renderEntityBooksPage({
        listElement,
        requestedName: getRequestedCategoryName(),
        backPageCanonical: 'categories.html',
        emptyMessage: EMPTY_CATEGORY_MESSAGE,
        missingSelectionMessage: MISSING_CATEGORY_SELECTION_MESSAGE,
        unknownEntityMessage: UNKNOWN_CATEGORY_MESSAGE,
        loadErrorPrefix: LOAD_CATEGORY_BOOKS_ERROR_PREFIX,
        groupEntities: groupBooksByCategory,
        filterBooks: filterBooksByCategoryName,
        setEntitySeo: setCategorySeo
    });
}
