import { getBookId, getBookPartCount, getBookTitle } from '../../core/books-meta.js';
import { createBookListItem, renderListMessage } from '../../shared/book-list-ui.js';

export function createBookListPageController({
    container,
    emptyMessage = 'لا توجد كتب متاحة حاليًا.',
    createReadHref,
    showDownloadButton = true
}) {
    if (!container || typeof container.replaceChildren !== 'function') {
        throw new Error('A valid list container is required');
    }

    function render(books = []) {
        const sourceBooks = Array.isArray(books) ? books : [];
        container.replaceChildren();

        if (!sourceBooks.length) {
            renderListMessage(container, emptyMessage, 'empty');
            return 0;
        }

        const fragment = document.createDocumentFragment();

        sourceBooks.forEach((book, index) => {
            const id = getBookId(book);
            if (!id) return;

            const item = createBookListItem({
                bookId: id,
                title: getBookTitle(book, index),
                readHref: typeof createReadHref === 'function' ? createReadHref(book) : 'reader.html',
                partCount: getBookPartCount(book),
                showDownloadButton
            });

            fragment.appendChild(item);
        });

        container.appendChild(fragment);

        if (!container.children.length) {
            renderListMessage(container, emptyMessage, 'empty');
            return 0;
        }

        return container.children.length;
    }

    function renderError(message) {
        renderListMessage(container, message, 'error');
    }

    function renderLoading(message) {
        renderListMessage(container, message, 'loading');
    }

    return {
        render,
        renderError,
        renderLoading
    };
}
