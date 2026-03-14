const THEME_STORAGE_KEY = 'ciyoku-theme';
const VALID_THEMES = new Set(['light', 'dark']);
const DEFAULT_THEME = 'dark';
const THEME_META_COLORS = Object.freeze({
    dark: '#08090b',
    light: '#f6f5f0'
});

function getStoredTheme() {
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (VALID_THEMES.has(stored)) return stored;
    } catch (_) {
        return null;
    }
    return null;
}

function persistTheme(theme) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (_) {
        // Ignore storage failures (privacy mode, blocked storage, etc.).
    }
}

function resolveTheme(theme) {
    if (VALID_THEMES.has(theme)) return theme;
    return DEFAULT_THEME;
}

function applyMetaThemeColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const color = THEME_META_COLORS[theme] || THEME_META_COLORS[DEFAULT_THEME];
    meta.setAttribute('content', color);
}

export function applyTheme(theme, { persist = false } = {}) {
    const resolved = resolveTheme(theme);
    document.documentElement.setAttribute('data-theme', resolved);
    applyMetaThemeColor(resolved);
    if (persist) {
        persistTheme(resolved);
    }
    return resolved;
}

export function applyStoredTheme() {
    const stored = getStoredTheme();
    return applyTheme(stored || DEFAULT_THEME);
}

export function setupThemeToggle(selector = '[data-theme-toggle]') {
    const toggle = document.querySelector(selector);
    if (!toggle) return;

    const updateToggleLabels = (theme) => {
        const isDark = theme === 'dark';
        const label = isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن';
        toggle.setAttribute('aria-label', label);
        toggle.setAttribute('title', label);
        toggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    };

    updateToggleLabels(document.documentElement.getAttribute('data-theme') || DEFAULT_THEME);

    toggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
        const next = current === 'dark' ? 'light' : 'dark';
        const applied = applyTheme(next, { persist: true });
        updateToggleLabels(applied);
    });
}
