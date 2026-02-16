export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 48;

export const BOOKMARK_ICON_OUTLINE = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"></path>
    </svg>
`;

export const BOOKMARK_ICON_FILLED = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" fill="currentColor" stroke="currentColor"></path>
    </svg>
`;

export function createReaderState() {
    return {
        fontSize: 22,
        pageHtml: [],
        chapters: [],
        searchIndex: [],
        currentPageIndex: 0,
        bookParts: [],
        currentPartIndex: 0,
        currentBookId: '',
        currentChapterId: '',
        currentBookPartCount: 1
    };
}
