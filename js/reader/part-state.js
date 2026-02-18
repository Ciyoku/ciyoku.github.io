import { getPartLabel } from './part-selector.js';

export function buildBookPartState(partCount, toArabicIndicNumber) {
    const total = Number.isInteger(partCount) && partCount > 1 ? partCount : 1;
    return Array.from({ length: total }, (_, index) => ({
        label: getPartLabel(index, toArabicIndicNumber),
        text: '',
        status: 'idle',
        request: null
    }));
}

export function canPreloadNextPart() {
    if (typeof navigator === 'undefined') return true;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) return true;
    if (connection.saveData) return false;

    const effectiveType = String(connection.effectiveType || '').toLowerCase();
    if (effectiveType.includes('2g')) return false;

    return true;
}
