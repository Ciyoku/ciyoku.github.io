import { renderLucideIcons } from '../shared/lucide.js';

export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 48;

export function applyBookmarkIcon(button, isActive = false) {
    button.replaceChildren();
    const iconPlaceholder = document.createElement('i');
    iconPlaceholder.setAttribute('data-lucide', isActive ? 'heart-minus' : 'heart-plus');
    iconPlaceholder.setAttribute('aria-hidden', 'true');
    button.appendChild(iconPlaceholder);
    renderLucideIcons(button);
    button.classList.toggle('is-active', Boolean(isActive));
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
}

export function createReaderState() {
    return {
        fontSize: 22,
        pageBlocks: [],
        chapters: [],
        searchIndex: [],
        searchEngine: null,
        currentPageIndex: 0,
        bookParts: [],
        currentPartIndex: 0,
        currentBookId: '',
        currentChapterId: '',
        currentBookPartCount: 1
    };
}
