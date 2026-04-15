import { setCanonicalUrl } from '../../shared/seo.js';
import { createLoadingIndicator } from '../../shared/loading-indicator.js';

const CHOOSE_BOOK_TITLE = 'اختر كتابًا';
const CHOOSE_BOOK_MESSAGE = 'لم يتم اختيار كتاب.';
export const UNKNOWN_BOOK_TITLE = 'كتاب غير معروف';
export const READER_TITLE_SUFFIX = 'القارئ';

export function getBookTitleDisplay() {
    return document.getElementById('bookTitleDisplay');
}

function getReaderContent() {
    return document.getElementById('readerContent');
}

export function renderReaderError(message) {
    const content = getReaderContent();
    content.replaceChildren();

    const error = document.createElement('div');
    error.className = 'reader-error';
    error.textContent = message;
    content.appendChild(error);
}

export function renderReaderLoading() {
    const content = getReaderContent();
    content.replaceChildren();

    const loading = createLoadingIndicator({
        className: 'loading',
        size: 'lg',
        accent: true
    });
    content.appendChild(loading);
}

export function renderMissingBookMessage() {
    const content = getReaderContent();
    const title = getBookTitleDisplay();
    title.textContent = CHOOSE_BOOK_TITLE;
    content.replaceChildren();

    const wrapper = document.createElement('div');
    wrapper.className = 'reader-error';

    const text = document.createTextNode(`${CHOOSE_BOOK_MESSAGE} عد إلى `);
    const link = document.createElement('a');
    link.href = 'index.html';
    link.textContent = 'المكتبة';
    const tail = document.createTextNode(' واختر عنوانًا.');

    wrapper.append(text, link, tail);
    content.appendChild(wrapper);

    document.title = `${CHOOSE_BOOK_TITLE} | ${READER_TITLE_SUFFIX}`;
    setCanonicalUrl('reader.html');
}

export function setDocumentTitle(info) {
    const title = info?.title ? `${info.title} | ${READER_TITLE_SUFFIX}` : READER_TITLE_SUFFIX;
    document.title = title;
}
