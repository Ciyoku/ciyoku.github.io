import { fetchBooksList } from './books-repo.js';
import { buildAuthorPageUrl, groupBooksByAuthor } from './authors-data.js';
import { toArabicIndicNumber } from './reader/number-format.js';
import { onDomReady } from './shared/bootstrap.js';

onDomReady(initAuthorsPage);

function createAuthorListItem(index, authorRow) {
    const item = document.createElement('li');
    item.className = 'authors-list-item';

    const link = document.createElement('a');
    link.className = 'authors-list-link';
    link.href = buildAuthorPageUrl(authorRow.name);

    const name = document.createElement('span');
    name.className = 'authors-list-name';
    name.textContent = `${toArabicIndicNumber(index)}- ${authorRow.name}`;

    const count = document.createElement('span');
    count.className = 'authors-list-count';
    count.textContent = `${toArabicIndicNumber(authorRow.count)} كتاب`;

    link.append(name, count);
    item.appendChild(link);
    return item;
}

async function initAuthorsPage() {
    const summary = document.getElementById('authorsSummary');
    const list = document.getElementById('authorsList');
    if (!summary || !list) return;

    try {
        summary.className = 'status-ok';
        summary.textContent = 'جاري تحميل المؤلفين...';

        const books = await fetchBooksList();
        const authors = groupBooksByAuthor(books);

        if (!authors.length) {
            list.replaceChildren();
            summary.className = 'status-error';
            summary.textContent = 'لا توجد أسماء مؤلفين متاحة في books/list.json.';
            return;
        }

        const fragment = document.createDocumentFragment();
        authors.forEach((authorRow, index) => {
            fragment.appendChild(createAuthorListItem(index + 1, authorRow));
        });
        list.replaceChildren(fragment);

        const authorCountLabel = toArabicIndicNumber(authors.length);
        summary.className = 'status-ok';
        summary.textContent = `عدد المؤلفين: ${authorCountLabel}`;
    } catch (error) {
        list.replaceChildren();
        summary.className = 'status-error';
        summary.textContent = `تعذر تحميل المؤلفين: ${error.message}`;
    }
}
