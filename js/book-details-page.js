import { fetchBooksList } from './books-repo.js';
import {
    buildReaderUrl,
    buildReaderUrlWithState,
    getBookCategories,
    getBookId,
    getBookPartCount,
    getBookTitle
} from './books-meta.js';
import { isFavorite, toggleFavorite } from './favorites-store.js';
import { loadBookProgress } from './reader/persistence.js';
import { toArabicIndicNumber } from './reader/number-format.js';
import { onDomReady } from './shared/bootstrap.js';
import { createFavoriteToggleButton, setFavoriteToggleState } from './book-list-ui.js';
import { setCanonicalUrl, setSocialMetadata, setRobots } from './shared/seo.js';
import { SITE_NAME } from './site-config.js';

onDomReady(initBookDetailsPage);

const METADATA_LABELS = Object.freeze({
    id: 'المعرّف',
    title: 'العنوان',
    parts: 'عدد الأجزاء',
    category: 'التصنيف',
    categories: 'التصنيفات'
});

function createPartLink(book, partIndex) {
    const link = document.createElement('a');
    link.className = 'part-link';
    link.href = buildReaderUrlWithState(book, { partIndex });
    link.textContent = `الجزء ${toArabicIndicNumber(partIndex + 1)}`;
    return link;
}

function renderMissingBook() {
    const message = document.getElementById('bookDetailsMessage');
    message.className = 'status-error';
    message.textContent = 'لم يتم العثور على الكتاب المطلوب.';
    setRobots('noindex,follow');
    setCanonicalUrl('book-details.html');
}

function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
}

function hasRenderableValue(value) {
    if (value === null || value === undefined) return false;

    if (typeof value === 'string') {
        return value.trim().length > 0;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value);
    }

    if (Array.isArray(value)) {
        return value.some((item) => hasRenderableValue(item));
    }

    if (isPlainObject(value)) {
        return Object.values(value).some((item) => hasRenderableValue(item));
    }

    return true;
}

function formatMetadataLabel(rawKey) {
    const key = String(rawKey ?? '').trim();
    if (!key) return 'بيان';

    const mapped = METADATA_LABELS[key];
    if (mapped) return mapped;

    return key.replace(/[_-]+/g, ' ');
}

function formatPrimitiveValue(value) {
    if (typeof value === 'number') {
        return toArabicIndicNumber(String(value));
    }

    if (typeof value === 'boolean') {
        return value ? 'نعم' : 'لا';
    }

    return String(value);
}

function createMetadataRows(entries, container) {
    entries.forEach(([key, value]) => {
        const valueNode = createMetadataValueNode(value);
        if (!valueNode) return;

        const row = document.createElement('div');
        row.className = 'book-metadata-row';

        const term = document.createElement('dt');
        term.textContent = formatMetadataLabel(key);

        const detail = document.createElement('dd');
        detail.appendChild(valueNode);

        row.appendChild(term);
        row.appendChild(detail);
        container.appendChild(row);
    });
}

function createMetadataValueNode(value) {
    if (!hasRenderableValue(value)) return null;

    if (Array.isArray(value)) {
        const items = value.filter((item) => hasRenderableValue(item));
        if (!items.length) return null;

        const hasOnlyPrimitiveValues = items.every((item) => !Array.isArray(item) && !isPlainObject(item));
        if (hasOnlyPrimitiveValues) {
            const node = document.createElement('span');
            node.textContent = items.map((item) => formatPrimitiveValue(item)).join('، ');
            return node;
        }

        const list = document.createElement('ul');
        list.className = 'book-metadata-list';

        items.forEach((item) => {
            const itemNode = createMetadataValueNode(item);
            if (!itemNode) return;

            const listItem = document.createElement('li');
            listItem.appendChild(itemNode);
            list.appendChild(listItem);
        });

        return list.childElementCount ? list : null;
    }

    if (isPlainObject(value)) {
        const nestedEntries = Object.entries(value)
            .filter(([, nestedValue]) => hasRenderableValue(nestedValue));

        if (!nestedEntries.length) return null;

        const nestedList = document.createElement('dl');
        nestedList.className = 'book-metadata-nested';
        createMetadataRows(nestedEntries, nestedList);

        return nestedList.childElementCount ? nestedList : null;
    }

    const node = document.createElement('span');
    node.textContent = formatPrimitiveValue(value);
    return node;
}

function renderBookMetadata(book, metadataNode, emptyNode) {
    if (!metadataNode) return;

    metadataNode.replaceChildren();
    const entries = Object.entries(book)
        .filter(([, value]) => hasRenderableValue(value));

    createMetadataRows(entries, metadataNode);

    const hasMetadata = metadataNode.childElementCount > 0;
    metadataNode.hidden = !hasMetadata;

    if (emptyNode) {
        emptyNode.hidden = hasMetadata;
    }
}

async function initBookDetailsPage() {
    const titleNode = document.getElementById('bookDetailsTitle');
    const metaNode = document.getElementById('bookDetailsMeta');
    const metadataNode = document.getElementById('bookDetailsMetadata');
    const metadataEmptyNode = document.getElementById('bookDetailsMetadataEmpty');
    const partsNode = document.getElementById('bookDetailsParts');
    const readLink = document.getElementById('bookDetailsReadLink');
    const continueLink = document.getElementById('bookDetailsContinueLink');
    const messageNode = document.getElementById('bookDetailsMessage');
    const favoriteSlot = document.getElementById('bookDetailsFavoriteSlot');

    const params = new URLSearchParams(window.location.search);
    const requestedId = String(params.get('book') || '').trim();

    if (!requestedId) {
        renderMissingBook();
        return;
    }

    try {
        const books = await fetchBooksList();
        const book = books.find((item) => getBookId(item) === requestedId);

        if (!book) {
            renderMissingBook();
            return;
        }

        const title = getBookTitle(book);
        const partCount = getBookPartCount(book);
        const categories = getBookCategories(book);

        titleNode.textContent = title;

        const categoryMeta = categories.length ? ` • التصنيف: ${categories.join('، ')}` : '';
        metaNode.textContent = `عدد الأجزاء: ${toArabicIndicNumber(partCount)}${categoryMeta}`;

        renderBookMetadata(book, metadataNode, metadataEmptyNode);

        readLink.href = buildReaderUrl(book, 0);
        readLink.textContent = 'ابدأ القراءة';

        partsNode.replaceChildren();
        for (let index = 0; index < partCount; index++) {
            partsNode.appendChild(createPartLink(book, index));
        }

        const progress = loadBookProgress(getBookId(book));
        if (progress) {
            const safePartIndex = Number.isInteger(progress.partIndex) && progress.partIndex >= 0 ? progress.partIndex : 0;
            const safePageIndex = Number.isInteger(progress.pageIndex) && progress.pageIndex >= 0 ? progress.pageIndex : 0;
            continueLink.href = buildReaderUrlWithState(book, {
                partIndex: safePartIndex,
                pageIndex: safePageIndex,
                chapterId: progress.chapterId
            });
            continueLink.textContent = 'متابعة القراءة';
            continueLink.hidden = false;
        } else {
            continueLink.hidden = true;
        }

        const favoriteButton = createFavoriteToggleButton({
            active: isFavorite(requestedId),
            title: 'إضافة أو إزالة من المفضلة',
            ariaLabel: 'إضافة أو إزالة من المفضلة'
        });

        favoriteButton.addEventListener('click', () => {
            const nextState = toggleFavorite(requestedId);
            setFavoriteToggleState(favoriteButton, nextState);
        });

        favoriteSlot.replaceChildren(favoriteButton);

        const canonicalPath = `book-details.html?book=${encodeURIComponent(requestedId)}`;
        setSocialMetadata({
            title: `${title} | تفاصيل الكتاب | ${SITE_NAME}`,
            description: `صفحة تفاصيل كتاب ${title} داخل ${SITE_NAME}.`,
            url: canonicalPath
        });

        messageNode.className = 'status-ok';
        messageNode.textContent = 'تم تحميل تفاصيل الكتاب بنجاح.';
    } catch (error) {
        messageNode.className = 'status-error';
        messageNode.textContent = `تعذر تحميل تفاصيل الكتاب: ${error.message}`;
    }
}
