import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SERVICE_WORKER_PATH = path.join(ROOT, 'sw.js');
const START_MARKER = '// SW_ASSETS_START';
const END_MARKER = '// SW_ASSETS_END';

const VERIFICATION_HTML_PATTERNS = Object.freeze([
    /^google[a-z0-9]+\.html$/i,
    /^yandex_[a-z0-9]+\.html$/i
]);

function isCheckMode() {
    return process.argv.slice(2).includes('--check');
}

function detectEol(content) {
    return content.includes('\r\n') ? '\r\n' : '\n';
}

function toWebPath(relativePath) {
    return `/${relativePath.replace(/\\/g, '/')}`;
}

function isVerificationHtml(fileName) {
    return VERIFICATION_HTML_PATTERNS.some((pattern) => pattern.test(fileName));
}

async function collectFiles(relativeDir, allowedExtensions = null, output = []) {
    const directory = path.join(ROOT, relativeDir);
    let entries = [];
    try {
        entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (_) {
        return output;
    }

    for (const entry of entries) {
        const nextRelative = path.posix.join(relativeDir.replace(/\\/g, '/'), entry.name);
        if (entry.isDirectory()) {
            await collectFiles(nextRelative, allowedExtensions, output);
            continue;
        }

        if (!entry.isFile()) continue;
        if (allowedExtensions) {
            const extension = path.extname(entry.name).toLowerCase();
            if (!allowedExtensions.has(extension)) continue;
        }

        output.push(toWebPath(nextRelative));
    }

    return output;
}

async function collectRootHtmlPages() {
    const entries = await fs.readdir(ROOT, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
        .map((entry) => entry.name)
        .filter((fileName) => !isVerificationHtml(fileName))
        .sort((a, b) => a.localeCompare(b))
        .map((fileName) => `/${fileName}`);
}

async function buildAppShellAssets() {
    const htmlPages = await collectRootHtmlPages();
    const cssFiles = await collectFiles('css', new Set(['.css']));
    const jsFiles = await collectFiles('js', new Set(['.js']));
    const fontFiles = await collectFiles('assets/fonts', new Set(['.woff2', '.woff', '.ttf', '.otf']));
    const faviconFiles = await collectFiles('assets/img/favicon');

    return [
        '/',
        ...htmlPages,
        ...cssFiles,
        ...jsFiles,
        '/books/list.json',
        ...fontFiles,
        ...faviconFiles
    ].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function applyAssetBlock(content, assets) {
    const markerPattern = /(^[ \t]*)\/\/ SW_ASSETS_START[\s\S]*?^[ \t]*\/\/ SW_ASSETS_END/m;
    const match = markerPattern.exec(content);
    if (!match) {
        throw new Error(`Missing ${START_MARKER}/${END_MARKER} marker block`);
    }

    const eol = detectEol(content);
    const indent = match[1] ?? '';
    const assetLines = assets.map((assetPath) => `${indent}'${assetPath}',`).join(eol);
    const replacement = [
        `${indent}${START_MARKER}`,
        assetLines,
        `${indent}${END_MARKER}`
    ].join(eol);

    return `${content.slice(0, match.index)}${replacement}${content.slice(match.index + match[0].length)}`;
}

async function run() {
    const checkMode = isCheckMode();
    const assets = await buildAppShellAssets();
    const current = await fs.readFile(SERVICE_WORKER_PATH, 'utf8');
    const updated = applyAssetBlock(current, assets);

    if (updated === current) {
        const modeLabel = checkMode ? 'check' : 'sync';
        console.log(`OK: service worker asset ${modeLabel} passed (${assets.length} assets).`);
        return;
    }

    if (checkMode) {
        console.error('Service worker asset list is out of sync. Run: npm run sw:assets:sync');
        process.exitCode = 1;
        return;
    }

    await fs.writeFile(SERVICE_WORKER_PATH, updated, 'utf8');
    console.log(`Updated service worker asset list with ${assets.length} assets.`);
}

run().catch((error) => {
    console.error(`Service worker asset sync failed: ${error.message}`);
    process.exitCode = 1;
});
