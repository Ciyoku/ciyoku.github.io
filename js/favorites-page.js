import { fetchBooksList } from './books-repo.js';
import { buildReaderUrl, getBookId, getBookTitle } from './books-meta.js';
import { getFavorites, setFavorite } from './favorites-store.js';
import { onDomReady } from './shared/bootstrap.js';
import {
    createBookListItem,
    createFavoriteToggleButton,
    renderListMessage
} from './book-list-ui.js';

const EMPTY_FAVORITES_MESSAGE = 'لا توجد كتب مفضلة حتى الآن.';

onDomReady(loadFavorites);

async function loadFavorites() {
    const container = document.getElementById('favoritesList');
    const favoriteIds = new Set(getFavorites());

    if (!favoriteIds.size) {
        renderListMessage(container, EMPTY_FAVORITES_MESSAGE);
        return;
    }

    try {
        const books = await fetchBooksList();
        const favoriteBooks = books.filter((book) => favoriteIds.has(getBookId(book)));
        container.innerHTML = '';

        favoriteBooks.forEach((book, index) => {
            const id = getBookId(book);
            const title = getBookTitle(book, index);
            if (!id) return;

            const item = createBookListItem({
                bookId: id,
                title,
                href: buildReaderUrl(book, 0),
                favoriteButton: createRemoveButton(id, container)
            });

            container.appendChild(item);
        });

        if (!container.children.length) {
            renderListMessage(container, EMPTY_FAVORITES_MESSAGE);
        }
    } catch (error) {
        renderListMessage(container, `خطأ في تحميل المفضلة: ${error.message}`);
    }
}

function createRemoveButton(bookId, container) {
    const button = createFavoriteToggleButton({
        active: true,
        title: 'إزالة من المفضلة',
        ariaLabel: 'إزالة من المفضلة'
    });

    button.addEventListener('click', (event) => {
        event.preventDefault();
        setFavorite(bookId, false);
        const row = button.closest('.book-list-item');
        if (row) row.remove();

        if (!container.children.length) {
            renderListMessage(container, EMPTY_FAVORITES_MESSAGE);
        }
    });

    return button;
}
