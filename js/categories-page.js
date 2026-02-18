import { fetchBooksList } from './books-repo.js';
import { buildCategoryPageUrl, groupBooksByCategory } from './categories-data.js';
import { toArabicIndicNumber } from './reader/number-format.js';
import { onDomReady } from './shared/bootstrap.js';

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

async function initCategoriesPage() {
    const root = document.getElementById('categoriesRoot');
    const summary = document.getElementById('categoriesSummary');
    if (!root || !summary) return;

    try {
        summary.hidden = false;
        summary.className = 'status-ok';
        summary.textContent = 'جاري تحميل التصنيفات...';

        const books = await fetchBooksList();
        const categories = groupBooksByCategory(books);

        if (!categories.length) {
            root.replaceChildren();
            summary.textContent = 'لا توجد تصنيفات متاحة حاليًا.';
            return;
        }

        const fragment = document.createDocumentFragment();
        categories.forEach((category, index) => {
            fragment.appendChild(createCategorySection(index + 1, category));
        });
        root.replaceChildren(fragment);

        const countLabel = toArabicIndicNumber(categories.length);
        summary.textContent = `عدد التصنيفات المتاحة: ${countLabel}`;
    } catch (error) {
        root.replaceChildren();
        summary.hidden = false;
        summary.className = 'status-error';
        summary.textContent = `تعذر تحميل التصنيفات: ${error.message}`;
    }
}
