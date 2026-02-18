import { normalizeArabicForSearch } from '../reader-parser.js';
import { hasMinimumQueryWords } from '../shared/query-words.js';

function tokenizeNormalizedText(text) {
    return String(text ?? '')
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 1);
}

function intersectSets(baseSet, nextSet) {
    const output = new Set();
    if (!baseSet || !nextSet) return output;

    const [smallest, largest] = baseSet.size <= nextSet.size
        ? [baseSet, nextSet]
        : [nextSet, baseSet];

    smallest.forEach((value) => {
        if (largest.has(value)) {
            output.add(value);
        }
    });

    return output;
}

export function createSearchEngine(searchIndex = []) {
    const entries = Array.isArray(searchIndex) ? searchIndex : [];
    const tokenIndex = new Map();

    entries.forEach((entry, entryIndex) => {
        const tokens = new Set(tokenizeNormalizedText(entry.normalizedLine));
        tokens.forEach((token) => {
            if (!tokenIndex.has(token)) {
                tokenIndex.set(token, new Set());
            }
            tokenIndex.get(token).add(entryIndex);
        });
    });

    return {
        entries,
        tokenIndex
    };
}

function getCandidateEntryIndices(engine, normalizedQuery) {
    const tokens = tokenizeNormalizedText(normalizedQuery);
    if (!tokens.length) return null;

    let candidateSet = null;
    for (const token of tokens) {
        const tokenMatches = engine.tokenIndex.get(token);
        if (!tokenMatches) return new Set();
        candidateSet = candidateSet === null
            ? new Set(tokenMatches)
            : intersectSets(candidateSet, tokenMatches);
        if (!candidateSet.size) return candidateSet;
    }

    return candidateSet;
}

function normalizeSearchSource(source) {
    if (source && Array.isArray(source.entries) && source.tokenIndex instanceof Map) {
        return source;
    }

    return createSearchEngine(Array.isArray(source) ? source : []);
}

export function searchInBookIndex(searchSource, query, maxResults = 50) {
    if (!hasMinimumQueryWords(query, 2)) {
        return { normalizedQuery: '', matches: [] };
    }

    const normalizedQuery = normalizeArabicForSearch(query);
    if (!normalizedQuery) {
        return { normalizedQuery: '', matches: [] };
    }

    const engine = normalizeSearchSource(searchSource);
    const candidateIndices = getCandidateEntryIndices(engine, normalizedQuery);
    const matches = [];

    const scanEntry = (entry) => {
        if (!entry.normalizedLine.includes(normalizedQuery)) return;
        matches.push(entry);
    };

    const scanAllEntries = () => {
        for (const entry of engine.entries) {
            scanEntry(entry);
            if (matches.length >= maxResults) break;
        }
    };

    if (candidateIndices && candidateIndices.size > 0) {
        for (const entryIndex of candidateIndices) {
            const entry = engine.entries[entryIndex];
            if (!entry) continue;
            scanEntry(entry);
            if (matches.length >= maxResults) break;
        }

        if (!matches.length) {
            scanAllEntries();
        }
    } else {
        scanAllEntries();
    }

    return { normalizedQuery, matches };
}
