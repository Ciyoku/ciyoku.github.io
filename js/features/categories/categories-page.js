import { fetchBooksList } from '../../core/books-repo.js';
import { onDomReady } from '../../shared/bootstrap.js';
import { toArabicIndicNumber } from '../../shared/number-format.js';
import { renderEntityListPage } from '../entities/entity-list-page.js';
import { buildCategoryPageUrl, groupBooksByCategory } from './categories-data.js';

const EMPTY_CATEGORIES_MESSAGE = 'لا توجد تصنيفات متاحة حاليًا.';
const LOAD_CATEGORIES_ERROR_PREFIX = 'تعذر تحميل التصنيفات';

onDomReady(initCategoriesPage);

function createCategorySection(index, category) {
    const section = document.createElement('section');
    section.className = 'category-section';

    const link = document.createElement('a');
    link.className = 'category-row category-row-link';
    link.href = buildCategoryPageUrl(category.name);

    const label = document.createElement('span');
    label.className = 'category-label';
    label.textContent = `${toArabicIndicNumber(index)}- ${category.name}`;

    const count = document.createElement('span');
    count.className = 'category-side-count';
    count.textContent = toArabicIndicNumber(category.count);

    link.append(label, count);
    section.appendChild(link);
    return section;
}

async function loadCategories() {
    const books = await fetchBooksList();
    return groupBooksByCategory(books);
}

function formatCategoriesSummary(count) {
    const countLabel = toArabicIndicNumber(count);
    return `عدد التصنيفات المتاحة: ${countLabel}`;
}

async function initCategoriesPage() {
    const root = document.getElementById('categoriesRoot');
    const summary = document.getElementById('categoriesSummary');
    if (!root || !summary) return;

    await renderEntityListPage({
        rootElement: root,
        summaryElement: summary,
        loadEntities: loadCategories,
        createEntityNode: (category, index) => createCategorySection(index, category),
        formatCountSummary: formatCategoriesSummary,
        emptySummaryMessage: EMPTY_CATEGORIES_MESSAGE,
        loadErrorPrefix: LOAD_CATEGORIES_ERROR_PREFIX
    });
}
