const DISMISS_STORAGE_KEY = 'library.pwa.install.dismiss_until.v1';
const INSTALLED_STORAGE_KEY = 'library.pwa.install.installed.v1';
const DISMISS_DURATION_MS = 14 * 24 * 60 * 60 * 1000;
const WIDGET_ID = 'pwaInstallWidget';

/** @type {BeforeInstallPromptEvent | null} */
let deferredInstallPrompt = null;
let initialized = false;
let widgetRoot = null;
let widgetTitle = null;
let widgetDescription = null;
let installButton = null;
let closeButton = null;

/**
 * @typedef {Event & {
 *   prompt: () => Promise<void>,
 *   userChoice: Promise<{ outcome?: string, platform?: string }>
 * }} BeforeInstallPromptEvent
 */

function readStorageValue(key) {
    try {
        return window.localStorage.getItem(key);
    } catch (_) {
        return null;
    }
}

function writeStorageValue(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch (_) {
        // Ignore storage failures (private mode / disabled storage).
    }
}

function removeStorageValue(key) {
    try {
        window.localStorage.removeItem(key);
    } catch (_) {
        // Ignore storage failures.
    }
}

function getDismissUntil() {
    const stored = readStorageValue(DISMISS_STORAGE_KEY);
    if (!stored) return 0;
    const value = Number.parseInt(stored, 10);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return value;
}

function isDismissed() {
    return getDismissUntil() > Date.now();
}

function setDismissedFor14Days() {
    const dismissUntil = Date.now() + DISMISS_DURATION_MS;
    writeStorageValue(DISMISS_STORAGE_KEY, String(dismissUntil));
}

function isMarkedInstalled() {
    return readStorageValue(INSTALLED_STORAGE_KEY) === '1';
}

function setMarkedInstalled() {
    writeStorageValue(INSTALLED_STORAGE_KEY, '1');
    removeStorageValue(DISMISS_STORAGE_KEY);
}

function isStandaloneDisplayMode() {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) {
        return true;
    }

    return Boolean(window.navigator.standalone);
}

function isIosDevice() {
    const ua = String(window.navigator.userAgent || '');
    if (/iPad|iPhone|iPod/i.test(ua)) return true;

    // iPadOS can identify as Macintosh with touch points.
    return /Macintosh/i.test(ua) && Number(window.navigator.maxTouchPoints) > 1;
}

function isSafariBrowser() {
    const ua = String(window.navigator.userAgent || '');
    const hasSafari = /Safari/i.test(ua);
    const excluded = /(CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo|SamsungBrowser|UCBrowser)/i.test(ua);
    return hasSafari && !excluded;
}

function shouldShowIosHint() {
    return isIosDevice() && isSafariBrowser() && !isStandaloneDisplayMode();
}

function ensureWidgetElements() {
    if (widgetRoot && widgetRoot.isConnected) return;

    widgetRoot = document.getElementById(WIDGET_ID);
    if (!widgetRoot) {
        widgetRoot = document.createElement('aside');
        widgetRoot.id = WIDGET_ID;
        widgetRoot.className = 'pwa-install-widget';
        widgetRoot.hidden = true;
        widgetRoot.setAttribute('aria-live', 'polite');
        widgetRoot.setAttribute('role', 'region');
        widgetRoot.setAttribute('aria-label', 'تثبيت التطبيق');

        const content = document.createElement('div');
        content.className = 'pwa-install-widget-content';

        const textGroup = document.createElement('div');
        textGroup.className = 'pwa-install-widget-text-group';

        widgetTitle = document.createElement('p');
        widgetTitle.className = 'pwa-install-widget-title';

        widgetDescription = document.createElement('p');
        widgetDescription.className = 'pwa-install-widget-description';

        textGroup.append(widgetTitle, widgetDescription);

        const actions = document.createElement('div');
        actions.className = 'pwa-install-widget-actions';

        installButton = document.createElement('button');
        installButton.type = 'button';
        installButton.className = 'pwa-install-widget-install';
        installButton.textContent = 'تثبيت التطبيق';

        closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'pwa-install-widget-close';
        closeButton.setAttribute('aria-label', 'إغلاق إشعار التثبيت');
        closeButton.textContent = 'إغلاق';

        actions.append(installButton, closeButton);
        content.append(textGroup, actions);
        widgetRoot.appendChild(content);
        document.body.appendChild(widgetRoot);
        return;
    }

    widgetTitle = widgetRoot.querySelector('.pwa-install-widget-title');
    widgetDescription = widgetRoot.querySelector('.pwa-install-widget-description');
    installButton = widgetRoot.querySelector('.pwa-install-widget-install');
    closeButton = widgetRoot.querySelector('.pwa-install-widget-close');
}

function hideWidget() {
    ensureWidgetElements();
    if (!widgetRoot) return;
    widgetRoot.hidden = true;
    widgetRoot.dataset.state = 'hidden';
}

function showPromptWidget() {
    ensureWidgetElements();
    if (!widgetRoot || !widgetTitle || !widgetDescription || !installButton) return;

    widgetRoot.hidden = false;
    widgetRoot.dataset.state = 'prompt';
    widgetTitle.textContent = 'ثبّت المكتبة على جهازك';
    widgetDescription.textContent = 'للوصول السريع والقراءة دون اتصال بالإنترنت.';
    installButton.hidden = false;
    installButton.disabled = false;
}

function showIosHintWidget() {
    ensureWidgetElements();
    if (!widgetRoot || !widgetTitle || !widgetDescription || !installButton) return;

    widgetRoot.hidden = false;
    widgetRoot.dataset.state = 'ios_hint';
    widgetTitle.textContent = 'ثبّت المكتبة على جهازك';
    widgetDescription.textContent = 'في Safari اضغط زر المشاركة ثم اختر "إضافة إلى الشاشة الرئيسية".';
    installButton.hidden = true;
    installButton.disabled = true;
}

function refreshWidgetState() {
    ensureWidgetElements();

    if (!widgetRoot) return;

    if (isMarkedInstalled() || isStandaloneDisplayMode()) {
        setMarkedInstalled();
        hideWidget();
        return;
    }

    if (isDismissed()) {
        hideWidget();
        return;
    }

    if (deferredInstallPrompt) {
        showPromptWidget();
        return;
    }

    if (shouldShowIosHint()) {
        showIosHintWidget();
        return;
    }

    hideWidget();
}

async function handleInstallClick() {
    if (!deferredInstallPrompt || !installButton) return;

    const promptEvent = deferredInstallPrompt;
    installButton.disabled = true;

    try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') {
            setMarkedInstalled();
        } else {
            setDismissedFor14Days();
        }
    } catch (_) {
        setDismissedFor14Days();
    } finally {
        deferredInstallPrompt = null;
        refreshWidgetState();
    }
}

function handleDismissClick() {
    setDismissedFor14Days();
    hideWidget();
}

function bindWidgetInteractions() {
    if (installButton) {
        installButton.addEventListener('click', () => {
            void handleInstallClick();
        });
    }

    if (closeButton) {
        closeButton.addEventListener('click', handleDismissClick);
    }
}

function bindInstallEvents() {
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = /** @type {BeforeInstallPromptEvent} */ (event);
        refreshWidgetState();
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        setMarkedInstalled();
        refreshWidgetState();
    });

    if (typeof window.matchMedia === 'function') {
        const standaloneQuery = window.matchMedia('(display-mode: standalone)');
        const onDisplayModeChange = () => {
            if (isStandaloneDisplayMode()) {
                setMarkedInstalled();
            }
            refreshWidgetState();
        };

        if (typeof standaloneQuery.addEventListener === 'function') {
            standaloneQuery.addEventListener('change', onDisplayModeChange);
        } else if (typeof standaloneQuery.addListener === 'function') {
            standaloneQuery.addListener(onDisplayModeChange);
        }
    }
}

export function initPwaInstallWidget() {
    if (initialized) {
        refreshWidgetState();
        return;
    }

    initialized = true;

    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    ensureWidgetElements();
    bindWidgetInteractions();
    bindInstallEvents();
    refreshWidgetState();
}
