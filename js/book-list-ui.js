import { renderLucideIcons } from './shared/lucide.js';

export function createFavoriteToggleButton({ active = false, title, ariaLabel }) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'favorite-toggle';
    button.title = title;
    button.setAttribute('aria-label', ariaLabel);
    setFavoriteToggleState(button, active);
    return button;
}

export function setFavoriteToggleState(button, isActive) {
    button.replaceChildren();
    const iconPlaceholder = document.createElement('i');
    iconPlaceholder.setAttribute('data-lucide', isActive ? 'heart-minus' : 'heart-plus');
    iconPlaceholder.setAttribute('aria-hidden', 'true');
    button.appendChild(iconPlaceholder);
    renderLucideIcons(button);
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
}

export function createBookListItem({
    bookId,
    title,
    readHref,
    favoriteButton
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
    if (favoriteButton instanceof Element) {
        item.appendChild(favoriteButton);
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
    item.textContent = message;
    container.appendChild(item);
}
