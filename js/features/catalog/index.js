import { fetchBooksList } from '../../core/books-repo.js';
import {
    buildReaderUrl
} from '../../core/books-meta.js';
import { createBookListPageController } from './book-list-page-controller.js';
import { onDomReady } from '../../shared/bootstrap.js';
import { normalizeCatalogText } from '../../shared/text-normalization.js';
import { toArabicIndicNumber } from '../../shared/number-format.js';

const EMPTY_MESSAGE = 'لا توجد كتب مطابقة للبحث الحالي.';
const EMPTY_CATALOG_MESSAGE = 'لا توجد كتب متاحة حاليًا.';

onDomReady(initCatalogPage);

async function initCatalogPage() {
    const container = document.getElementById('bookList');
    const searchInput = document.getElementById('catalogSearchInput');
    const summary = document.getElementById('booksSummary');
    if (!container || !searchInput) return;

    let books = [];
    let query = '';
    const listController = createBookListPageController({
        container,
        emptyMessage: EMPTY_MESSAGE,
        createReadHref: (book) => buildReaderUrl(book, 0)
    });

    function applyFilters(source) {
        const normalizedQuery = normalizeCatalogText(query);
        return source.filter((book) => {
            const title = normalizeCatalogText(book.title);
            return !normalizedQuery || title.includes(normalizedQuery);
        });
    }

    function setSummary(text, tone = 'ok') {
        if (!summary) return;
        summary.className = tone === 'error' ? 'status-error' : 'status-ok';
        summary.hidden = false;
        summary.textContent = text;
    }

    function refresh() {
        const visibleBooks = applyFilters(books);
        const renderedCount = listController.render(visibleBooks);

        if (!books.length) {
            setSummary(EMPTY_CATALOG_MESSAGE);
            return;
        }

        if (!renderedCount) {
            setSummary(EMPTY_MESSAGE);
            return;
        }

        setSummary(`عدد الكتب المتاحة: ${toArabicIndicNumber(renderedCount)}`);
    }

    searchInput.addEventListener('input', (event) => {
        query = event.target.value;
        refresh();
    });

    try {
        books = await fetchBooksList();
        refresh();
    } catch (error) {
        listController.renderError(`خطأ في تحميل قائمة الكتب: ${error.message}`);
        setSummary(`خطأ في تحميل قائمة الكتب: ${error.message}`, 'error');
    }
}
