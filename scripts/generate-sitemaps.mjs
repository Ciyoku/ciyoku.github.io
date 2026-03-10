import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const SITE_URL = 'https://ciyoku.github.io';
const BOOKS_LIST_PATH = path.join(repoRoot, 'books', 'list.json');
const SITEMAP_INDEX_PATH = path.join(repoRoot, 'sitemap.xml');
const SITEMAP_PAGES_PATH = path.join(repoRoot, 'sitemap-pages.xml');
const SITEMAP_READER_PATH = path.join(repoRoot, 'sitemap-reader.xml');

const STATIC_PAGES = Object.freeze([
    '/',
    '/categories.html',
    '/authors.html',
    '/reader.html'
]);

function xmlEscape(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

function readBooksList() {
    const raw = fs.readFileSync(BOOKS_LIST_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
        throw new Error('books/list.json must contain a JSON array.');
    }
    return parsed;
}

function normalizeBookId(book) {
    return String(book?.id ?? '').trim();
}

function normalizePartCount(book) {
    const value = Number.parseInt(book?.parts, 10);
    if (Number.isInteger(value) && value > 1) return value;
    return 1;
}

function buildReaderUrls(books) {
    const urls = [];
    for (const book of books) {
        const id = normalizeBookId(book);
        if (!id) continue;

        const parts = normalizePartCount(book);
        const encodedId = encodeURIComponent(id);
        urls.push(`${SITE_URL}/reader.html?book=${encodedId}`);

        for (let part = 2; part <= parts; part += 1) {
            urls.push(`${SITE_URL}/reader.html?book=${encodedId}&part=part${part}`);
        }
    }
    return urls;
}

function buildUrlSetXml(urls, lastmod) {
    const rows = urls
        .map((url) => `  <url>\n    <loc>${xmlEscape(url)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}

function writeFile(filePath, content) {
    fs.writeFileSync(filePath, content, 'utf8');
}

function main() {
    const today = new Date().toISOString().slice(0, 10);
    const books = readBooksList();

    const staticUrls = STATIC_PAGES.map((pathname) => `${SITE_URL}${pathname}`);
    const readerUrls = buildReaderUrls(books);
    const allUrls = [...new Set([...staticUrls, ...readerUrls])];

    // Primary sitemap is a direct URL set to avoid dependency on sitemap index traversal.
    writeFile(SITEMAP_INDEX_PATH, buildUrlSetXml(allUrls, today));
    writeFile(SITEMAP_PAGES_PATH, buildUrlSetXml(staticUrls, today));
    writeFile(SITEMAP_READER_PATH, buildUrlSetXml(readerUrls, today));

    process.stdout.write(
        `Generated sitemaps:\n- sitemap.xml (${allUrls.length} URLs)\n- sitemap-pages.xml (${staticUrls.length} URLs)\n- sitemap-reader.xml (${readerUrls.length} URLs)\n`
    );
}

main();
