const ARABIC_INDIC_DIGITS = ['\u0660', '\u0661', '\u0662', '\u0663', '\u0664', '\u0665', '\u0666', '\u0667', '\u0668', '\u0669'];

export function toArabicIndicNumber(value) {
    return String(value).replace(/\d/g, (digit) => ARABIC_INDIC_DIGITS[digit]);
}

export function parsePageNumberInput(value) {
    const normalized = String(value)
        .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
        .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06F0))
        .replace(/[^\d]/g, '');

    if (!normalized) return null;

    const pageNumber = Number.parseInt(normalized, 10);
    if (!Number.isFinite(pageNumber)) return null;
    return pageNumber;
}
