const STAR_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 2.25l2.86 5.79 6.39.93-4.62 4.5 1.09 6.37L12 16.84l-5.72 3 1.09-6.37-4.62-4.5 6.39-.93L12 2.25z"></path>
    </svg>
`;

export function createFavoriteToggleButton({ active = false, title, ariaLabel }) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'favorite-toggle';
    button.title = title;
    button.setAttribute('aria-label', ariaLabel);
    button.innerHTML = STAR_ICON;
    setFavoriteToggleState(button, active);
    return button;
}

export function setFavoriteToggleState(button, isActive) {
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
}

export function createBookListItem({ bookId, title, href, favoriteButton }) {
    const item = document.createElement('li');
    item.className = 'book-list-item fade-in';
    if (bookId) {
        item.dataset.bookId = String(bookId);
    }

    const link = document.createElement('a');
    link.href = href;
    link.className = 'book-link';
    link.textContent = title;

    item.appendChild(link);
    item.appendChild(favoriteButton);
    return item;
}

export function renderListMessage(container, message, tone = 'error') {
    const cssClass = tone === 'loading' ? 'book-list-loading' : 'book-list-error';
    container.innerHTML = `<li class="${cssClass}">${message}</li>`;
}
