import { fetchBooksList } from '../../core/books-repo.js';
import { onDomReady } from '../../shared/bootstrap.js';
import { toArabicIndicNumber } from '../../shared/number-format.js';
import { renderEntityListPage } from '../entities/entity-list-page.js';
import { buildAuthorPageUrl, groupBooksByAuthor } from './authors-data.js';

const EMPTY_AUTHORS_MESSAGE = 'لا توجد أسماء مؤلفين متاحة في books/list.json.';
const LOAD_AUTHORS_ERROR_PREFIX = 'تعذر تحميل المؤلفين';

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

async function loadAuthors() {
    const books = await fetchBooksList();
    return groupBooksByAuthor(books);
}

function formatAuthorsSummary(count) {
    const authorCountLabel = toArabicIndicNumber(count);
    return `عدد المؤلفين: ${authorCountLabel}`;
}

async function initAuthorsPage() {
    const summary = document.getElementById('authorsSummary');
    const list = document.getElementById('authorsList');
    if (!summary || !list) return;

    await renderEntityListPage({
        rootElement: list,
        summaryElement: summary,
        loadEntities: loadAuthors,
        createEntityNode: (authorRow, index) => createAuthorListItem(index, authorRow),
        formatCountSummary: formatAuthorsSummary,
        emptySummaryMessage: EMPTY_AUTHORS_MESSAGE,
        loadErrorPrefix: LOAD_AUTHORS_ERROR_PREFIX
    });
}
