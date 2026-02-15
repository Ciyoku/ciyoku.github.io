document.addEventListener('DOMContentLoaded', () => {
    loadBooks();
});

async function loadBooks() {
    const container = document.getElementById('bookList');

    try {
        const response = await fetch('books/list.json');
        if (!response.ok) {
            throw new Error('تعذر تحميل قائمة الكتب');
        }

        const books = await response.json();
        if (!Array.isArray(books)) {
            throw new Error('صيغة قائمة الكتب غير صحيحة');
        }

        container.innerHTML = '';

        books.forEach((book, index) => {
            const id = window.booksMeta?.getBookId(book) || String(book?.id ?? '').trim();
            const title = window.booksMeta?.getBookTitle(book, index) || `كتاب ${index + 1}`;
            if (!id) {
                return;
            }

            const item = document.createElement('li');
            item.className = 'book-list-item fade-in';

            const link = document.createElement('a');
            link.href = window.booksMeta
                ? window.booksMeta.buildReaderUrl(book, 0)
                : `reader.html?book=${encodeURIComponent(id)}`;
            link.className = 'book-link';
            link.textContent = title;

            const favoriteButton = createFavoriteButton(id);

            item.appendChild(link);
            item.appendChild(favoriteButton);
            container.appendChild(item);
        });

        if (!container.children.length) {
            container.innerHTML = '<li class="book-list-error">لا توجد كتب متاحة.</li>';
        }
    } catch (error) {
        container.innerHTML = `<li class="book-list-error">خطأ في تحميل قائمة الكتب: ${error.message}</li>`;
    }
}

function createFavoriteButton(bookId) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'favorite-toggle';
    button.title = 'إضافة أو إزالة من المفضلة';
    button.setAttribute('aria-label', 'إضافة أو إزالة من المفضلة');
    button.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 2.25l2.86 5.79 6.39.93-4.62 4.5 1.09 6.37L12 16.84l-5.72 3 1.09-6.37-4.62-4.5 6.39-.93L12 2.25z"></path>
        </svg>
    `;

    syncFavoriteButton(button, bookId);
    button.addEventListener('click', (event) => {
        event.preventDefault();
        if (!window.favoritesStore) return;
        const isFavorite = window.favoritesStore.toggleFavorite(bookId);
        syncFavoriteButton(button, bookId, isFavorite);
    });

    return button;
}

function syncFavoriteButton(button, bookId, forcedValue) {
    const isFavorite = typeof forcedValue === 'boolean'
        ? forcedValue
        : Boolean(window.favoritesStore?.isFavorite(bookId));

    button.classList.toggle('is-active', isFavorite);
    button.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
}
