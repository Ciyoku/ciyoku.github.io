import { buildReaderUrl } from '../../core/books-meta.js';
import { fetchBooksList } from '../../core/books-repo.js';
import { setCanonicalUrl, setRobots } from '../../shared/seo.js';
import { normalizeCatalogText } from '../../shared/text-normalization.js';
import { createBookListPageController } from '../catalog/book-list-page-controller.js';

const INDEXABLE_ROBOTS = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';

function findEntityByName(entities, requestedName) {
    const normalizedRequested = normalizeCatalogText(requestedName);
    if (!normalizedRequested) return null;

    const source = Array.isArray(entities) ? entities : [];
    return source.find((entity) => (
        normalizeCatalogText(entity?.name) === normalizedRequested
    )) || null;
}

function toSafeMessage(value, fallback) {
    const message = String(value ?? '').trim();
    return message || fallback;
}

/**
 * @param {Object} options
 * @param {HTMLElement} options.listElement
 * @param {string} options.requestedName
 * @param {string} options.backPageCanonical
 * @param {string} options.emptyMessage
 * @param {string} options.missingSelectionMessage
 * @param {string} options.unknownEntityMessage
 * @param {string} options.loadErrorPrefix
 * @param {(books: any[]) => any[]} options.groupEntities
 * @param {(books: any[], selectedName: string) => any[]} options.filterBooks
 * @param {(selectedName: string) => void} [options.setEntitySeo]
 * @param {(books: any[], requestedName: string) => any|null} [options.findKnownEntity]
 * @param {(book: any) => string} [options.createReadHref]
 * @returns {Promise<void>}
 */
export async function renderEntityBooksPage(options) {
    const listElement = options?.listElement;
    if (!listElement) return;

    const backPageCanonical = toSafeMessage(options?.backPageCanonical, 'index.html');
    const requestedName = String(options?.requestedName ?? '').trim();
    const emptyMessage = toSafeMessage(options?.emptyMessage, 'No books are available right now.');
    const missingSelectionMessage = toSafeMessage(
        options?.missingSelectionMessage,
        'Please return to the listing page and choose an item.'
    );
    const unknownEntityMessage = toSafeMessage(
        options?.unknownEntityMessage,
        'The requested item is not available in the current books metadata.'
    );
    const loadErrorPrefix = toSafeMessage(options?.loadErrorPrefix, 'Failed to load books');
    const groupEntities = typeof options?.groupEntities === 'function'
        ? options.groupEntities
        : () => [];
    const filterBooks = typeof options?.filterBooks === 'function'
        ? options.filterBooks
        : () => [];
    const findKnownEntity = typeof options?.findKnownEntity === 'function'
        ? options.findKnownEntity
        : (entities, name) => findEntityByName(entities, name);
    const setEntitySeo = typeof options?.setEntitySeo === 'function'
        ? options.setEntitySeo
        : () => {};
    const createReadHref = typeof options?.createReadHref === 'function'
        ? options.createReadHref
        : (book) => buildReaderUrl(book, 0);

    const listController = createBookListPageController({
        container: listElement,
        emptyMessage,
        createReadHref
    });

    if (!requestedName) {
        setRobots('noindex,follow');
        setCanonicalUrl(backPageCanonical);
        listController.renderError(missingSelectionMessage);
        return;
    }

    try {
        const books = await fetchBooksList();
        const entities = groupEntities(books);
        const knownEntity = findKnownEntity(entities, requestedName);

        if (!knownEntity) {
            setRobots('noindex,follow');
            setCanonicalUrl(backPageCanonical);
            listController.renderError(unknownEntityMessage);
            return;
        }

        const selectedName = String(knownEntity.name ?? '').trim();
        const selectedBooks = filterBooks(books, selectedName);
        listController.render(selectedBooks);
        setRobots(INDEXABLE_ROBOTS);
        setEntitySeo(selectedName);
    } catch (error) {
        const message = error && typeof error.message === 'string'
            ? error.message
            : String(error);
        listController.renderError(`${loadErrorPrefix}: ${message}`);
    }
}
