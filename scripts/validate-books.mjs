import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BOOKS_DIR = path.join(ROOT, 'books');
const LIST_PATH = path.join(BOOKS_DIR, 'list.json');

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeId(value) {
    return String(value ?? '').trim();
}

function normalizeParts(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
        return 1;
    }
    return parsed;
}

function partFileName(partNumber) {
    return partNumber === 1 ? 'book.txt' : `book${partNumber}.txt`;
}

async function pathExists(targetPath) {
    try {
        await fs.access(targetPath);
        return true;
    } catch (_) {
        return false;
    }
}

async function loadBooksList() {
    const raw = await fs.readFile(LIST_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
        throw new Error('books/list.json must be a JSON array');
    }
    return parsed;
}

async function validate() {
    const errors = [];
    const warnings = [];

    const books = await loadBooksList();
    const ids = new Set();

    books.forEach((book, index) => {
        const itemLabel = `books/list.json item #${index + 1}`;
        if (!isObject(book)) {
            errors.push(`${itemLabel} must be an object`);
            return;
        }

        const id = normalizeId(book.id);
        if (!id) {
            errors.push(`${itemLabel} is missing a non-empty "id"`);
            return;
        }

        if (ids.has(id)) {
            errors.push(`duplicate book id "${id}"`);
            return;
        }

        ids.add(id);

        const title = String(book.title ?? '').trim();
        if (!title) {
            warnings.push(`book "${id}" has an empty title`);
        }
    });

    for (const book of books) {
        const id = normalizeId(book.id);
        if (!id) continue;

        const bookDir = path.join(BOOKS_DIR, id);
        if (!await pathExists(bookDir)) {
            errors.push(`missing directory: books/${id}`);
            continue;
        }

        const parts = normalizeParts(book.parts);
        for (let part = 1; part <= parts; part++) {
            const fileName = partFileName(part);
            const partPath = path.join(bookDir, fileName);
            if (!await pathExists(partPath)) {
                errors.push(`missing file: books/${id}/${fileName}`);
            }
        }
    }

    const dirEntries = await fs.readdir(BOOKS_DIR, { withFileTypes: true });
    const extraDirectories = dirEntries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => !ids.has(name))
        .sort((a, b) => a.localeCompare(b, 'ar'));

    if (extraDirectories.length > 0) {
        warnings.push(
            `directories not referenced by books/list.json: ${extraDirectories.join(', ')}`
        );
    }

    if (errors.length === 0) {
        console.log(`OK: validated ${books.length} books from books/list.json`);
    } else {
        console.error(`Found ${errors.length} error(s):`);
        errors.forEach((error) => console.error(`- ${error}`));
    }

    if (warnings.length > 0) {
        console.warn(`Warnings (${warnings.length}):`);
        warnings.forEach((warning) => console.warn(`- ${warning}`));
    }

    process.exitCode = errors.length > 0 ? 1 : 0;
}

validate().catch((error) => {
    console.error(`Validation failed: ${error.message}`);
    process.exitCode = 1;
});
