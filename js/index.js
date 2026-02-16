import { fetchBooksList } from './books-repo.js';
import { buildReaderUrl, getBookId, getBookTitle } from './books-meta.js';
import { isFavorite, toggleFavorite } from './favorites-store.js';
import { onDomReady } from './shared/bootstrap.js';
import {
    createBookListItem,
    createFavoriteToggleButton,
    renderListMessage,
    setFavoriteToggleState
} from './book-list-ui.js';

onDomReady(loadBooks);

async function loadBooks() {
    const container = document.getElementById('bookList');

    try {
        const books = await fetchBooksList();
        container.innerHTML = '';

        books.forEach((book, index) => {
            const id = getBookId(book);
            const title = getBookTitle(book, index);
            if (!id) return;

            const favoriteButton = createFavoriteButton(id);
            const item = createBookListItem({
                bookId: id,
                title,
                href: buildReaderUrl(book, 0),
                favoriteButton
            });

            container.appendChild(item);
        });

        if (!container.children.length) {
            renderListMessage(container, 'لا توجد كتب متاحة.');
        }
    } catch (error) {
        renderListMessage(container, `خطأ في تحميل قائمة الكتب: ${error.message}`);
    }
}

function createFavoriteButton(bookId) {
    const button = createFavoriteToggleButton({
        active: isFavorite(bookId),
        title: 'إضافة أو إزالة من المفضلة',
        ariaLabel: 'إضافة أو إزالة من المفضلة'
    });

    button.addEventListener('click', (event) => {
        event.preventDefault();
        const favoriteState = toggleFavorite(bookId);
        setFavoriteToggleState(button, favoriteState);
    });

    return button;
}
