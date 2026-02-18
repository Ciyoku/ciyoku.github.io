import { fetchBooksList } from './books-repo.js';
import {
    buildBookDetailsUrl,
    buildReaderUrl,
    getBookId,
    getBookPartCount,
    getBookTitle
} from './books-meta.js';
import { getFavorites } from './favorites-store.js';
import { onDomReady } from './shared/bootstrap.js';
import { hasMinimumQueryWords } from './shared/query-words.js';
import {
    createBookListItem,
    renderListMessage
} from './book-list-ui.js';
import {
    createFavoriteRemoveControl,
    getBookProgressMeta,
    normalizeCatalogText
} from './catalog-page-core.js';

const EMPTY_FAVORITES_MESSAGE = 'لا توجد كتب مفضلة حتى الآن.';
const REMOVE_FAVORITE_LABEL = 'إزالة من المفضلة';
const MIN_SEARCH_WORDS = 2;
const MIN_SEARCH_WORDS_MESSAGE = 'اكتب كلمتين أو أكثر لبدء البحث.';

onDomReady(initFavoritesPage);

async function initFavoritesPage() {
    const container = document.getElementById('favoritesList');
    const searchInput = document.getElementById('favoritesSearchInput');

    let books = [];
    let favoriteIds = new Set(getFavorites());
    let query = '';

    function createRemoveButton(bookId) {
        return createFavoriteRemoveControl(bookId, {
            title: REMOVE_FAVORITE_LABEL,
            ariaLabel: REMOVE_FAVORITE_LABEL,
            onRemove: () => {
                favoriteIds.delete(bookId);
                render();
            }
        });
    }

    function getVisibleFavorites(normalizedQuery) {
        return books.filter((book) => {
            const id = getBookId(book);
            if (!favoriteIds.has(id)) return false;

            if (!normalizedQuery) return true;
            return normalizeCatalogText(getBookTitle(book)).includes(normalizedQuery);
        });
    }

    function render() {
        const normalizedQuery = normalizeCatalogText(query);
        const belowMinWordCount = normalizedQuery && !hasMinimumQueryWords(query, MIN_SEARCH_WORDS);
        const visibleBooks = belowMinWordCount ? [] : getVisibleFavorites(normalizedQuery);
        container.replaceChildren();

        if (!visibleBooks.length) {
            if (belowMinWordCount) {
                renderListMessage(container, MIN_SEARCH_WORDS_MESSAGE, 'empty');
                return;
            }

            renderListMessage(container, EMPTY_FAVORITES_MESSAGE, 'empty');
            return;
        }

        visibleBooks.forEach((book, index) => {
            const id = getBookId(book);
            if (!id) return;

            const progressMeta = getBookProgressMeta(book);
            const item = createBookListItem({
                bookId: id,
                title: getBookTitle(book, index),
                readHref: buildReaderUrl(book, 0),
                detailsHref: buildBookDetailsUrl(book),
                favoriteButton: createRemoveButton(id),
                parts: getBookPartCount(book),
                progressHref: progressMeta?.progressHref || '',
                progressLabel: progressMeta?.progressLabel || ''
            });

            container.appendChild(item);
        });

        if (!container.children.length) {
            renderListMessage(container, EMPTY_FAVORITES_MESSAGE, 'empty');
        }
    }

    searchInput.addEventListener('input', (event) => {
        query = event.target.value;
        render();
    });

    if (!favoriteIds.size) {
        renderListMessage(container, EMPTY_FAVORITES_MESSAGE, 'empty');
        return;
    }

    try {
        books = await fetchBooksList();
        render();
    } catch (error) {
        renderListMessage(container, `خطأ في تحميل المفضلة: ${error.message}`);
    }
}
