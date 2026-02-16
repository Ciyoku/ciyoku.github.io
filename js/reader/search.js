import { normalizeArabicForSearch } from '../reader-parser.js';

export function searchInBookIndex(searchIndex, query, maxResults = 50) {
    const normalizedQuery = normalizeArabicForSearch(query);
    if (!normalizedQuery || normalizedQuery.length < 2) {
        return { normalizedQuery: '', matches: [] };
    }

    const matches = [];
    for (const entry of searchIndex) {
        if (!entry.normalizedLine.includes(normalizedQuery)) continue;
        matches.push(entry);
        if (matches.length >= maxResults) break;
    }

    return { normalizedQuery, matches };
}
