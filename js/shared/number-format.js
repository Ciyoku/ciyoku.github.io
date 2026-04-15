const ARABIC_INDIC_DIGITS = ['\u0660', '\u0661', '\u0662', '\u0663', '\u0664', '\u0665', '\u0666', '\u0667', '\u0668', '\u0669'];

export function toArabicIndicNumber(value) {
    return String(value).replace(/\d/g, (digit) => ARABIC_INDIC_DIGITS[digit]);
}
