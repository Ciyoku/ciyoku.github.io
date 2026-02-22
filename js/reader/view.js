import { setCanonicalUrl } from '../shared/seo.js';

const CHOOSE_BOOK_TITLE = 'اختر كتابًا';
const CHOOSE_BOOK_MESSAGE = 'لم يتم اختيار كتاب.';
export const UNKNOWN_BOOK_TITLE = 'كتاب غير معروف';
export const READER_TITLE_SUFFIX = 'القارئ';

export function getBookTitleDisplay() {
    return document.getElementById('bookTitleDisplay');
}

export function getReaderContent() {
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

export function renderReaderLoading(message = 'جاري تحميل الكتاب...') {
    const content = getReaderContent();
    content.replaceChildren();

    const loading = document.createElement('div');
    loading.className = 'loading';

    const spinner = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    spinner.classList.add('loading-spinner');
    spinner.setAttribute('viewBox', '0 0 24 24');
    spinner.setAttribute('aria-hidden', 'true');
    spinner.setAttribute('focusable', 'false');

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '9');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M21 12a9 9 0 0 0-9-9');

    spinner.append(circle, path);

    const text = document.createElement('p');
    text.textContent = message;
    loading.append(spinner, text);
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
