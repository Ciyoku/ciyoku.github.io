(function () {
    const STORAGE_KEY = 'shiaLibFavs';

    function normalizeId(id) {
        return String(id ?? '').trim();
    }

    function readFavorites() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) return [];
            const unique = new Set();
            parsed.forEach((value) => {
                const id = normalizeId(value);
                if (id) unique.add(id);
            });
            return [...unique];
        } catch (_) {
            return [];
        }
    }

    function writeFavorites(ids) {
        const clean = [];
        const seen = new Set();
        ids.forEach((value) => {
            const id = normalizeId(value);
            if (!id || seen.has(id)) return;
            seen.add(id);
            clean.push(id);
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
        return clean;
    }

    function getFavorites() {
        return readFavorites();
    }

    function isFavorite(id) {
        const target = normalizeId(id);
        if (!target) return false;
        return readFavorites().includes(target);
    }

    function setFavorite(id, shouldFavorite) {
        const target = normalizeId(id);
        if (!target) return false;

        const current = readFavorites();
        const hasTarget = current.includes(target);

        if (shouldFavorite && !hasTarget) {
            current.push(target);
            writeFavorites(current);
            return true;
        }

        if (!shouldFavorite && hasTarget) {
            writeFavorites(current.filter((value) => value !== target));
            return false;
        }

        return hasTarget;
    }

    function toggleFavorite(id) {
        return setFavorite(id, !isFavorite(id));
    }

    window.favoritesStore = {
        getFavorites,
        isFavorite,
        setFavorite,
        toggleFavorite
    };
})();
