import { getBookId, getBookPartCount, getBookTitle } from '../../core/books-meta.js';
import {
    downloadBookForOffline,
    getBookDownloadStatus,
    isOfflineBookStorageSupported
} from '../offline/book-offline-storage.js';

const DOWNLOAD_BOOK_ARIA_LABEL = 'تنزيل الكتاب للاستخدام دون اتصال';
const DOWNLOADED_BOOK_ARIA_LABEL = 'الكتاب محفوظ للاستخدام دون اتصال';
const DOWNLOADING_BOOK_ARIA_LABEL = 'جارٍ تنزيل الكتاب للاستخدام دون اتصال';

/**
 * @param {HTMLButtonElement} button
 * @param {'book-down'|'book-check'} iconName
 * @param {(root?: ParentNode|Element|Document) => void} renderLucideIcons
 */
function setReaderDownloadButtonIcon(button, iconName, renderLucideIcons) {
    const existingIcon = button.querySelector(`.lucide-${iconName}`);
    if (existingIcon) return;

    const iconHost = document.createElement('span');
    iconHost.className = 'reader-download-icon';
    iconHost.setAttribute('data-lucide', iconName);
    iconHost.setAttribute('aria-hidden', 'true');
    button.replaceChildren(iconHost);
    renderLucideIcons(button);
}

/**
 * @param {Object} options
 * @param {(root?: ParentNode|Element|Document) => void} options.renderLucideIcons
 * @param {(options?: { size?: 'sm'|'md'|'lg', accent?: boolean }) => HTMLElement} options.createIosLoader
 * @returns {{ setBook: (book: any|null) => void }}
 */
export function createReaderDownloadController(options) {
    const renderLucideIcons = typeof options?.renderLucideIcons === 'function'
        ? options.renderLucideIcons
        : () => {};
    const createIosLoader = typeof options?.createIosLoader === 'function'
        ? options.createIosLoader
        : () => document.createElement('span');

    const button = document.getElementById('readerDownloadBtn');
    if (!(button instanceof HTMLButtonElement)) {
        return {
            setBook: () => {}
        };
    }

    if (!isOfflineBookStorageSupported()) {
        button.hidden = true;
        button.setAttribute('aria-hidden', 'true');
        return {
            setBook: () => {}
        };
    }

    let currentBook = null;
    let activeSyncToken = 0;
    let activeLocalDownloadBookId = '';

    /**
     * @param {Object} [options={}]
     * @param {boolean} [options.downloaded=false]
     * @param {boolean} [options.downloading=false]
     * @param {boolean} [options.disabled=false]
     */
    function setButtonVisualState(options = {}) {
        const downloaded = options.downloaded === true;
        const downloading = options.downloading === true;
        const disabled = options.disabled === true;

        if (downloading) {
            button.replaceChildren(createIosLoader({ size: 'sm', accent: true }));
        } else {
            const iconName = downloaded ? 'book-check' : 'book-down';
            setReaderDownloadButtonIcon(button, iconName, renderLucideIcons);
        }

        button.classList.toggle('is-downloaded', downloaded);
        button.classList.toggle('is-downloading', downloading);
        button.disabled = downloading || disabled;

        const label = downloaded
            ? DOWNLOADED_BOOK_ARIA_LABEL
            : downloading
                ? DOWNLOADING_BOOK_ARIA_LABEL
                : DOWNLOAD_BOOK_ARIA_LABEL;

        button.setAttribute('aria-label', label);
        button.title = label;
    }

    async function syncButtonState(book, syncToken) {
        const bookId = getBookId(book);
        if (!bookId) {
            setButtonVisualState({ downloaded: false, downloading: false, disabled: true });
            return;
        }

        const partCount = getBookPartCount(book);
        const status = await getBookDownloadStatus(bookId, partCount);
        if (syncToken !== activeSyncToken) return;

        setButtonVisualState({
            downloaded: status.downloaded === true,
            downloading: status.downloading === true || activeLocalDownloadBookId === bookId
        });
    }

    button.addEventListener('click', async (event) => {
        event.preventDefault();
        if (!currentBook) return;

        const bookId = getBookId(currentBook);
        if (!bookId || activeLocalDownloadBookId === bookId) return;

        const partCount = getBookPartCount(currentBook);
        const status = await getBookDownloadStatus(bookId, partCount);
        if (status.downloaded) {
            await syncButtonState(currentBook, activeSyncToken);
            return;
        }

        activeLocalDownloadBookId = bookId;
        setButtonVisualState({ downloaded: false, downloading: true });

        try {
            await downloadBookForOffline({
                id: bookId,
                title: getBookTitle(currentBook),
                parts: partCount
            }, {
                onProgress: () => {
                    if (!button.isConnected) return;
                    setButtonVisualState({ downloaded: false, downloading: true });
                }
            });
        } catch (error) {
            if (typeof console !== 'undefined' && typeof console.error === 'function') {
                console.error('Offline book download failed:', error);
            }
        } finally {
            if (activeLocalDownloadBookId === bookId) {
                activeLocalDownloadBookId = '';
            }
            await syncButtonState(currentBook, activeSyncToken);
        }
    });

    setButtonVisualState({ downloaded: false, downloading: false, disabled: true });

    return {
        setBook(book) {
            currentBook = book && typeof book === 'object' ? book : null;
            activeSyncToken += 1;
            if (!currentBook) {
                setButtonVisualState({ downloaded: false, downloading: false, disabled: true });
                return;
            }
            void syncButtonState(currentBook, activeSyncToken);
        }
    };
}
