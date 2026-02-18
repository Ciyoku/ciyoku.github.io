import {
    buildReaderUrlWithState,
    getBookCategories,
    getBookId
} from './books-meta.js';
import { createFavoriteToggleButton, setFavoriteToggleState } from './book-list-ui.js';
import { isFavorite, setFavorite, toggleFavorite } from './favorites-store.js';
import { loadBookProgress } from './reader/persistence.js';

export const UNCATEGORIZED_FILTER = '__uncategorized';

export function normalizeCatalogText(value) {
    return String(value ?? '').normalize('NFC').toLowerCase().trim();
}

export function getBookProgressMeta(book) {
    const progress = loadBookProgress(getBookId(book));
    if (!progress) return null;

    const safePartIndex = Number.isInteger(progress.partIndex) && progress.partIndex >= 0
        ? progress.partIndex
        : 0;
    const safePageIndex = Number.isInteger(progress.pageIndex) && progress.pageIndex >= 0
        ? progress.pageIndex
        : 0;

    return {
        progressHref: buildReaderUrlWithState(book, {
            partIndex: safePartIndex,
            pageIndex: safePageIndex,
            chapterId: progress.chapterId
        }),
        progressLabel: 'متابعة القراءة'
    };
}

export function filterBooksByCategory(sourceBooks, categoryMode = 'all') {
    return sourceBooks.filter((book) => {
        const categories = getBookCategories(book);
        if (categoryMode === UNCATEGORIZED_FILTER) {
            return categories.length === 0;
        }

        if (categoryMode !== 'all') {
            return categories.includes(categoryMode);
        }

        return true;
    });
}

export function populateCategoryFilter(selectElement, sourceBooks, options = {}) {
    const {
        currentValue = 'all',
        allLabel = 'كل التصنيفات',
        uncategorizedLabel = 'بدون تصنيف',
        uncategorizedValue = UNCATEGORIZED_FILTER,
        locale = 'ar'
    } = options;

    if (!selectElement || typeof selectElement.replaceChildren !== 'function') {
        return currentValue;
    }

    const categoriesSet = new Set();
    let hasUncategorizedBooks = false;

    sourceBooks.forEach((book) => {
        const categories = getBookCategories(book);
        if (!categories.length) {
            hasUncategorizedBooks = true;
            return;
        }

        categories.forEach((category) => categoriesSet.add(category));
    });

    const sortedCategories = [...categoriesSet].sort((a, b) => a.localeCompare(b, locale));
    const fragment = document.createDocumentFragment();

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = allLabel;
    fragment.appendChild(allOption);

    sortedCategories.forEach((category) => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        fragment.appendChild(option);
    });

    if (hasUncategorizedBooks) {
        const uncategorizedOption = document.createElement('option');
        uncategorizedOption.value = uncategorizedValue;
        uncategorizedOption.textContent = uncategorizedLabel;
        fragment.appendChild(uncategorizedOption);
    }

    selectElement.replaceChildren(fragment);

    const allowedValues = new Set([
        'all',
        ...sortedCategories,
        ...(hasUncategorizedBooks ? [uncategorizedValue] : [])
    ]);

    const nextValue = allowedValues.has(currentValue) ? currentValue : 'all';
    selectElement.value = nextValue;
    return nextValue;
}

export function createFavoriteToggleControl(bookId, options = {}) {
    const {
        title = '',
        ariaLabel = '',
        onToggle = null
    } = options;

    const button = createFavoriteToggleButton({
        active: isFavorite(bookId),
        title,
        ariaLabel
    });

    button.addEventListener('click', (event) => {
        event.preventDefault();
        const nextState = toggleFavorite(bookId);
        setFavoriteToggleState(button, nextState);
        if (typeof onToggle === 'function') {
            onToggle(nextState, button);
        }
    });

    return button;
}

export function createFavoriteRemoveControl(bookId, options = {}) {
    const {
        title = '',
        ariaLabel = '',
        onRemove = null
    } = options;

    const button = createFavoriteToggleButton({
        active: true,
        title,
        ariaLabel
    });

    button.addEventListener('click', (event) => {
        event.preventDefault();
        setFavorite(bookId, false);
        setFavoriteToggleState(button, false);
        if (typeof onRemove === 'function') {
            onRemove(button);
        }
    });

    return button;
}
