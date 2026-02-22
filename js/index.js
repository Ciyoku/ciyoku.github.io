import { fetchBooksList } from './books-repo.js';
import {
    buildReaderUrl,
    getBookId,
    getBookTitle
} from './books-meta.js';
import { onDomReady } from './shared/bootstrap.js';
import {
    createBookListItem,
    renderListMessage
} from './book-list-ui.js';
import {
    createFavoriteToggleControl,
    normalizeCatalogText
} from './catalog-page-core.js';

const EMPTY_MESSAGE = 'لا توجد كتب مطابقة للبحث الحالي.';
const FAVORITE_BUTTON_LABEL = 'إضافة أو إزالة من المفضلة';

onDomReady(initCatalogPage);

async function initCatalogPage() {
    const container = document.getElementById('bookList');
    const searchInput = document.getElementById('catalogSearchInput');

    let books = [];
    let query = '';

    function createFavoriteButton(bookId) {
        return createFavoriteToggleControl(bookId, {
            title: FAVORITE_BUTTON_LABEL,
            ariaLabel: FAVORITE_BUTTON_LABEL
        });
    }

    function applyFilters(source) {
        const normalizedQuery = normalizeCatalogText(query);
        return source.filter((book) => {
            const title = normalizeCatalogText(getBookTitle(book));
            return !normalizedQuery || title.includes(normalizedQuery);
        });
    }

    function render(filteredBooks) {
        container.replaceChildren();

        if (!filteredBooks.length) {
            renderListMessage(container, EMPTY_MESSAGE, 'empty');
            return;
        }

        filteredBooks.forEach((book, index) => {
            const id = getBookId(book);
            if (!id) return;

            const item = createBookListItem({
                bookId: id,
                title: getBookTitle(book, index),
                readHref: buildReaderUrl(book, 0),
                favoriteButton: createFavoriteButton(id)
            });

            container.appendChild(item);
        });

        if (!container.children.length) {
            renderListMessage(container, EMPTY_MESSAGE, 'empty');
        }

    }

    function refresh() {
        render(applyFilters(books));
    }

    searchInput.addEventListener('input', (event) => {
        query = event.target.value;
        refresh();
    });

    try {
        books = await fetchBooksList();
        refresh();
    } catch (error) {
        renderListMessage(container, `خطأ في تحميل قائمة الكتب: ${error.message}`);
    }
}
