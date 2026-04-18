import { createIosLoader } from '../../shared/loading-indicator.js';

function renderLoadingSummary(summaryElement) {
    summaryElement.hidden = false;
    summaryElement.className = 'status-ok status-loading';
    summaryElement.replaceChildren(createIosLoader({ size: 'sm' }));
}

function renderSummary(summaryElement, text, tone = 'ok') {
    summaryElement.hidden = false;
    summaryElement.className = tone === 'error' ? 'status-error' : 'status-ok';
    summaryElement.textContent = text;
}

function toSafeMessage(value, fallback) {
    const message = String(value ?? '').trim();
    return message || fallback;
}

function toEntityArray(value) {
    return Array.isArray(value) ? value : [];
}

/**
 * @param {Object} options
 * @param {HTMLElement} options.rootElement
 * @param {HTMLElement} options.summaryElement
 * @param {() => Promise<any[]>} options.loadEntities
 * @param {(entity: any, index: number) => Node|null} options.createEntityNode
 * @param {(count: number) => string} options.formatCountSummary
 * @param {string} options.emptySummaryMessage
 * @param {string} options.loadErrorPrefix
 * @returns {Promise<void>}
 */
export async function renderEntityListPage(options) {
    const rootElement = options?.rootElement;
    const summaryElement = options?.summaryElement;
    if (!rootElement || !summaryElement) return;

    const emptySummaryMessage = toSafeMessage(
        options?.emptySummaryMessage,
        'No items are available right now.'
    );
    const loadErrorPrefix = toSafeMessage(
        options?.loadErrorPrefix,
        'Failed to load data'
    );
    const createEntityNode = typeof options?.createEntityNode === 'function'
        ? options.createEntityNode
        : () => null;
    const formatCountSummary = typeof options?.formatCountSummary === 'function'
        ? options.formatCountSummary
        : (count) => `Count: ${count}`;
    const loadEntities = typeof options?.loadEntities === 'function'
        ? options.loadEntities
        : async () => [];

    try {
        renderLoadingSummary(summaryElement);

        const entities = toEntityArray(await loadEntities());
        if (!entities.length) {
            rootElement.replaceChildren();
            renderSummary(summaryElement, emptySummaryMessage, 'ok');
            return;
        }

        const fragment = document.createDocumentFragment();
        entities.forEach((entity, index) => {
            const node = createEntityNode(entity, index + 1);
            if (node instanceof Node) {
                fragment.appendChild(node);
            }
        });

        rootElement.replaceChildren(fragment);
        renderSummary(summaryElement, formatCountSummary(entities.length), 'ok');
    } catch (error) {
        rootElement.replaceChildren();
        const message = error && typeof error.message === 'string'
            ? error.message
            : String(error);
        renderSummary(summaryElement, `${loadErrorPrefix}: ${message}`, 'error');
    }
}
