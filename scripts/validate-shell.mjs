import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

async function getHtmlFiles() {
    const entries = await fs.readdir(ROOT, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
        .map((entry) => path.join(ROOT, entry.name))
        .sort((a, b) => a.localeCompare(b));
}

async function validate() {
    const files = await getHtmlFiles();
    const errors = [];

    for (const filePath of files) {
        const relative = path.relative(ROOT, filePath).replace(/\\/g, '/');
        const html = await fs.readFile(filePath, 'utf8');

        if (!html.includes('js/shared/site-shell.js')) {
            errors.push(`${relative}: missing js/shared/site-shell.js script`);
        }

        if (!/<header[^>]*class="[^"]*site-header/.test(html)) {
            errors.push(`${relative}: missing .site-header container`);
        }

        if (/<nav[^>]*class="[^"]*primary-nav/.test(html)) {
            errors.push(`${relative}: contains hardcoded .primary-nav markup`);
        }
    }

    if (errors.length > 0) {
        console.error(`Found ${errors.length} shell error(s):`);
        errors.forEach((error) => console.error(`- ${error}`));
        process.exitCode = 1;
        return;
    }

    console.log(`OK: validated shell structure for ${files.length} HTML pages`);
}

validate().catch((error) => {
    console.error(`Shell validation failed: ${error.message}`);
    process.exitCode = 1;
});
