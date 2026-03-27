import { renderLucideIcons } from './lucide.js';
import { applyDefaultPageSeo } from './page-seo-defaults.js';
import { registerPwaServiceWorker } from './pwa.js';
import { initPwaInstallWidget } from './pwa-install-widget.js';
import { applyStoredTheme, setupThemeToggle } from './theme.js';

const MAIN_SECTIONS = Object.freeze([
    { href: 'index.html', label: 'كتب', icon: 'library-big' },
    { href: 'authors.html', label: 'مؤلفون', icon: 'users' },
    { href: 'categories.html', label: 'أقسام', icon: 'folder-tree' }
]);

const PAGE_TO_SECTION = Object.freeze({
    'index.html': 'index.html',
    'authors.html': 'authors.html',
    'author.html': 'authors.html',
    'categories.html': 'categories.html',
    'category.html': 'categories.html',
    'reader.html': 'index.html'
});

const NAV_EXCLUDED_PAGES = Object.freeze(new Set([
    'reader.html'
]));

const SITE_LOGO_HTML = '<a href="index.html" class="site-logo"><span>المكتبة</span><span>الأخبارية</span></a>';

applyStoredTheme();

function getCurrentPageName() {
    const path = String(window.location.pathname || '');
    const pageName = path.split('/').pop();
    if (!pageName) return 'index.html';
    return pageName.toLowerCase();
}

function getActiveSectionHref() {
    const pageName = getCurrentPageName();
    return PAGE_TO_SECTION[pageName] || 'index.html';
}

function shouldInjectPrimaryNav(pageName) {
    return !NAV_EXCLUDED_PAGES.has(pageName);
}

function buildMainNavHtml(activeHref) {
    return MAIN_SECTIONS.map((section) => {
        const current = section.href === activeHref ? ' aria-current="page"' : '';
        return `<a class="top-nav-link" href="${section.href}"${current}><i data-lucide="${section.icon}" aria-hidden="true"></i><span>${section.label}</span></a>`;
    }).join('');
}

function ensurePrimaryNav(header, activeHref) {
    header.classList.add('site-header-nav');

    let logo = header.querySelector('.logo');
    if (!logo) {
        logo = document.createElement('div');
        logo.className = 'logo';
        header.prepend(logo);
    }

    if (!logo.querySelector('.site-logo')) {
        logo.innerHTML = SITE_LOGO_HTML;
    }

    let nav = header.querySelector('.primary-nav');
    if (!nav) {
        nav = document.createElement('nav');
        nav.className = 'primary-nav';
        nav.setAttribute('aria-label', 'التنقل الرئيسي');

        if (logo.nextSibling) {
            header.insertBefore(nav, logo.nextSibling);
        } else {
            header.appendChild(nav);
        }
    }

    nav.innerHTML = buildMainNavHtml(activeHref);
}

function removeFooters() {
    document.querySelectorAll('.site-footer').forEach((footer) => footer.remove());
}

function syncHeaderHeight() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    const measuredHeight = Math.ceil(header.getBoundingClientRect().height);
    if (measuredHeight > 0) {
        document.documentElement.style.setProperty('--header-height', `${measuredHeight}px`);
    }
}

function initSiteShell() {
    const pageName = getCurrentPageName();
    const activeHref = getActiveSectionHref();
    applyDefaultPageSeo(pageName);
    if (shouldInjectPrimaryNav(pageName)) {
        document.querySelectorAll('.site-header').forEach((header) => {
            ensurePrimaryNav(header, activeHref);
        });
    } else {
        document.querySelectorAll('.site-header .primary-nav').forEach((nav) => nav.remove());
        document.querySelectorAll('.site-header').forEach((header) => {
            header.classList.remove('site-header-nav');
        });
    }

    removeFooters();
    renderLucideIcons(document);
    setupThemeToggle();
    initPwaInstallWidget();
    syncHeaderHeight();
    window.addEventListener('resize', syncHeaderHeight, { passive: true });
    void registerPwaServiceWorker();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSiteShell, { once: true });
} else {
    initSiteShell();
}

