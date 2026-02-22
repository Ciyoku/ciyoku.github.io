const DEFAULT_MIN_QUERY_WORDS = 2;

function countQueryWords(value) {
    return String(value ?? '')
        .trim()
        .split(/\s+/u)
        .filter((word) => word.length > 0)
        .length;
}

export function hasMinimumQueryWords(value, minimum = DEFAULT_MIN_QUERY_WORDS) {
    const safeMinimum = Number.isInteger(minimum) && minimum > 0
        ? minimum
        : DEFAULT_MIN_QUERY_WORDS;

    return countQueryWords(value) >= safeMinimum;
}
