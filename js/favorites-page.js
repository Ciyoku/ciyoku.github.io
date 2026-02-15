document.addEventListener('DOMContentLoaded', () => {
    loadFavorites();
});

async function loadFavorites() {
    const container = document.getElementById('favoritesList');
    const favoriteIds = new Set(window.favoritesStore?.getFavorites() || []);

    if (!favoriteIds.size) {
        container.innerHTML = '<li class="book-list-error">لا توجد كتب مفضلة حتى الآن.</li>';
        return;
    }

    try {
        const response = await fetch('books/list.json');
        if (!response.ok) {
            throw new Error('تعذر تحميل قائمة الكتب');
        }

        const books = await response.json();
        if (!Array.isArray(books)) {
            throw new Error('صيغة قائمة الكتب غير صحيحة');
        }

        const favoriteBooks = books.filter((book) => favoriteIds.has(String(book?.id ?? '')));
        container.innerHTML = '';

        favoriteBooks.forEach((book, index) => {
            const id = window.booksMeta?.getBookId(book) || String(book?.id ?? '').trim();
            const title = window.booksMeta?.getBookTitle(book, index) || `كتاب ${index + 1}`;
            if (!id) return;

            const item = document.createElement('li');
            item.className = 'book-list-item fade-in';
            item.dataset.bookId = id;

            const link = document.createElement('a');
            link.href = window.booksMeta
                ? window.booksMeta.buildReaderUrl(book, 0)
                : `reader.html?book=${encodeURIComponent(id)}`;
            link.className = 'book-link';
            link.textContent = title;

            const button = createRemoveButton(id, item, container);

            item.appendChild(link);
            item.appendChild(button);
            container.appendChild(item);
        });

        if (!container.children.length) {
            container.innerHTML = '<li class="book-list-error">لا توجد كتب مفضلة حتى الآن.</li>';
        }
    } catch (error) {
        container.innerHTML = `<li class="book-list-error">خطأ في تحميل المفضلة: ${error.message}</li>`;
    }
}

function createRemoveButton(bookId, row, container) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'favorite-toggle is-active';
    button.title = 'إزالة من المفضلة';
    button.setAttribute('aria-label', 'إزالة من المفضلة');
    button.setAttribute('aria-pressed', 'true');
    button.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 2.25l2.86 5.79 6.39.93-4.62 4.5 1.09 6.37L12 16.84l-5.72 3 1.09-6.37-4.62-4.5 6.39-.93L12 2.25z"></path>
        </svg>
    `;

    button.addEventListener('click', (event) => {
        event.preventDefault();
        if (!window.favoritesStore) return;
        window.favoritesStore.setFavorite(bookId, false);
        row.remove();
        if (!container.children.length) {
            container.innerHTML = '<li class="book-list-error">لا توجد كتب مفضلة حتى الآن.</li>';
        }
    });

    return button;
}
