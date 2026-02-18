const STORAGE_KEY = 'shiaLibFavs';
let favoritesCache = null;

function normalizeId(id) {
    return String(id ?? '').trim();
}

function sanitizeFavorites(values) {
    if (!Array.isArray(values)) return [];
    const unique = new Set();
    values.forEach((value) => {
        const id = normalizeId(value);
        if (id) unique.add(id);
    });
    return [...unique];
}

function readFavoritesFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return sanitizeFavorites(parsed);
    } catch (_) {
        return [];
    }
}

function getCachedFavorites() {
    if (!Array.isArray(favoritesCache)) {
        favoritesCache = readFavoritesFromStorage();
    }
    return favoritesCache;
}

function writeFavoritesToStorage(ids) {
    const clean = sanitizeFavorites(ids);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
        favoritesCache = clean;
        return true;
    } catch (_) {
        return false;
    }
}

function getFavorites() {
    return [...getCachedFavorites()];
}

function isFavorite(id) {
    const target = normalizeId(id);
    if (!target) return false;
    return getCachedFavorites().includes(target);
}

function setFavorite(id, shouldFavorite) {
    const target = normalizeId(id);
    if (!target) return false;

    const current = [...getCachedFavorites()];
    const hasTarget = current.includes(target);

    if (shouldFavorite && !hasTarget) {
        const next = [...current, target];
        return writeFavoritesToStorage(next) ? true : hasTarget;
    }

    if (!shouldFavorite && hasTarget) {
        const next = current.filter((value) => value !== target);
        return writeFavoritesToStorage(next) ? false : hasTarget;
    }

    return hasTarget;
}

function toggleFavorite(id) {
    return setFavorite(id, !isFavorite(id));
}

if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
        if (event.key !== STORAGE_KEY) return;
        favoritesCache = readFavoritesFromStorage();
    });
}

export {
    STORAGE_KEY,
    getFavorites,
    isFavorite,
    setFavorite,
    toggleFavorite
};
