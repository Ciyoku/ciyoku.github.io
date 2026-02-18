import { SITE_URL } from '../site-config.js';

function toAbsoluteUrl(pathOrUrl = '/') {
    const raw = String(pathOrUrl || '/').trim();
    if (!raw) return SITE_URL;

    try {
        return new URL(raw, SITE_URL).toString();
    } catch (_) {
        return SITE_URL;
    }
}

function upsertMeta(attributeName, attributeValue, content) {
    if (!attributeValue) return;

    const selector = `meta[${attributeName}="${attributeValue}"]`;
    let node = document.head.querySelector(selector);
    if (!node) {
        node = document.createElement('meta');
        node.setAttribute(attributeName, attributeValue);
        document.head.appendChild(node);
    }

    node.setAttribute('content', String(content ?? ''));
}

export function setCanonicalUrl(pathOrUrl) {
    const canonicalHref = toAbsoluteUrl(pathOrUrl);
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalHref);
    upsertMeta('property', 'og:url', canonicalHref);
}

export function setSocialMetadata({ title, description, url }) {
    if (title) {
        const safeTitle = String(title);
        document.title = safeTitle;
        upsertMeta('property', 'og:title', safeTitle);
        upsertMeta('name', 'twitter:title', safeTitle);
    }

    if (description) {
        const safeDescription = String(description);
        upsertMeta('name', 'description', safeDescription);
        upsertMeta('property', 'og:description', safeDescription);
        upsertMeta('name', 'twitter:description', safeDescription);
    }

    if (url) {
        setCanonicalUrl(url);
    }
}

export function setRobots(content) {
    upsertMeta('name', 'robots', String(content || 'index,follow'));
}