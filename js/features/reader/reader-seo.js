import { toPartParam } from '../../core/books-meta.js';
import { setSocialMetadata } from '../../shared/seo.js';

function getReaderCanonicalPath(state) {
    if (!state.currentBookId) return 'reader.html';

    const params = new URLSearchParams();
    params.set('book', String(state.currentBookId));

    if (state.currentBookPartCount > 1 && state.currentPartIndex > 0) {
        params.set('part', toPartParam(state.currentPartIndex));
    }

    return `reader.html?${params.toString()}`;
}

export function updateReaderSeo(state, activeBookInfo, options = {}) {
    const {
        siteName = '',
        unknownBookTitle = 'كتاب غير معروف',
        readerTitleSuffix = 'القارئ'
    } = options;

    const title = activeBookInfo?.title || unknownBookTitle;
    const fullTitle = `${title} | ${readerTitleSuffix} | ${siteName}`;
    const description = `قراءة كتاب ${title} داخل ${siteName} مع فهرس فصول وبحث داخل النص.`;

    setSocialMetadata({
        title: fullTitle,
        description,
        url: getReaderCanonicalPath(state)
    });
}
