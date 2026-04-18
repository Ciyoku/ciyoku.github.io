import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_HTML_FILES = Object.freeze([
    'index.html',
    'reader.html',
    'authors.html',
    'author.html',
    'categories.html',
    'category.html'
]);
const START_MARKER = '<!-- SHARED_HEAD:START -->';
const END_MARKER = '<!-- SHARED_HEAD:END -->';

const SHARED_HEAD_LINES = Object.freeze([
    '<meta name="theme-color" content="#08090b">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/assets/img/favicon/apple-touch-icon.png">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon/favicon-32x32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/assets/img/favicon/favicon-16x16.png">',
    '<link rel="shortcut icon" href="/assets/img/favicon/favicon.ico">',
    '<link rel="manifest" href="/assets/img/favicon/site.webmanifest">',
    '<meta name="referrer" content="strict-origin-when-cross-origin">',
    '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; base-uri \'self\'; object-src \'none\'; frame-ancestors \'none\'; frame-src \'none\'; form-action \'self\'; script-src \'self\'; style-src \'self\'; img-src \'self\' data:; font-src \'self\'; connect-src \'self\'; manifest-src \'self\'; worker-src \'self\'; media-src \'self\'; upgrade-insecure-requests">',
    '<meta http-equiv="X-Content-Type-Options" content="nosniff">',
    '<meta http-equiv="Permissions-Policy" content="geolocation=(), microphone=(), camera=()">'
]);

function detectEol(content) {
    return content.includes('\r\n') ? '\r\n' : '\n';
}

function applySharedHeadBlock(content) {
    const markerPattern = /(^[ \t]*)<!-- SHARED_HEAD:START -->[\s\S]*?^[ \t]*<!-- SHARED_HEAD:END -->/m;
    const match = markerPattern.exec(content);
    if (!match) {
        throw new Error(`Missing ${START_MARKER}/${END_MARKER} marker block`);
    }

    const eol = detectEol(content);
    const indent = match[1] ?? '';
    const blockLines = SHARED_HEAD_LINES.map((line) => `${indent}${line}`).join(eol);
    const replacement = [
        `${indent}${START_MARKER}`,
        blockLines,
        `${indent}${END_MARKER}`
    ].join(eol);

    return `${content.slice(0, match.index)}${replacement}${content.slice(match.index + match[0].length)}`;
}

function isCheckMode() {
    return process.argv.slice(2).includes('--check');
}

async function run() {
    const checkMode = isCheckMode();
    const changedFiles = [];

    for (const relativePath of TARGET_HTML_FILES) {
        const filePath = path.join(ROOT, relativePath);
        const current = await fs.readFile(filePath, 'utf8');
        const updated = applySharedHeadBlock(current);

        if (updated === current) continue;
        changedFiles.push(relativePath);

        if (!checkMode) {
            await fs.writeFile(filePath, updated, 'utf8');
        }
    }

    if (!changedFiles.length) {
        const modeLabel = checkMode ? 'check' : 'sync';
        console.log(`OK: shared head ${modeLabel} passed for ${TARGET_HTML_FILES.length} pages.`);
        return;
    }

    if (checkMode) {
        console.error('Shared head block is out of sync in:');
        changedFiles.forEach((filePath) => console.error(`- ${filePath}`));
        process.exitCode = 1;
        return;
    }

    console.log(`Updated shared head block in ${changedFiles.length} page(s):`);
    changedFiles.forEach((filePath) => console.log(`- ${filePath}`));
}

run().catch((error) => {
    console.error(`Shared head sync failed: ${error.message}`);
    process.exitCode = 1;
});
