import { createIosLoader } from './loading-indicator.js';
import { attachBookDownloadButton } from '../features/offline/book-download-button.js';

export function createBookListItem({
    bookId,
    title,
    readHref,
    partCount = 1,
    showDownloadButton = true
}) {
    const item = document.createElement('li');
    item.className = 'book-list-item fade-in';
    if (bookId) {
        item.dataset.bookId = String(bookId);
    }

    const card = document.createElement('article');
    card.className = 'book-card';

    const link = document.createElement('a');
    link.href = readHref;
    link.className = 'book-link';
    link.textContent = title;

    card.appendChild(link);
    item.appendChild(card);

    if (showDownloadButton) {
        const actions = document.createElement('div');
        actions.className = 'book-item-actions';

        const downloadButton = document.createElement('button');
        downloadButton.className = 'book-download-button';
        downloadButton.textContent = 'Download';
        downloadButton.setAttribute('aria-label', `Download ${title}`);
        actions.appendChild(downloadButton);

        attachBookDownloadButton(downloadButton, {
            bookId,
            title,
            partCount,
            readHref
        });

        item.appendChild(actions);
    }

    return item;
}

export function renderListMessage(container, message, tone = 'error') {
    const cssClass = tone === 'loading'
        ? 'book-list-loading'
        : tone === 'empty'
            ? 'book-list-empty'
            : 'book-list-error';

    container.replaceChildren();
    const item = document.createElement('li');
    item.className = cssClass;

    if (tone === 'loading') {
        item.appendChild(createIosLoader({ size: 'md' }));
    } else {
        item.textContent = message;
    }

    container.appendChild(item);
}
