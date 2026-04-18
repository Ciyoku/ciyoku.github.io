import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_DIRS = ['js', 'scripts', 'tests'];
const ALLOWED_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);

async function pathExists(targetPath) {
    try {
        await fs.access(targetPath);
        return true;
    } catch (_) {
        return false;
    }
}

async function collectJsFiles(dirPath, output = []) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            await collectJsFiles(fullPath, output);
            continue;
        }

        const extension = path.extname(entry.name).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(extension)) continue;
        output.push(fullPath);
    }

    return output;
}

function checkSyntax(filePath) {
    const result = spawnSync(process.execPath, ['--check', filePath], {
        cwd: ROOT,
        encoding: 'utf8'
    });

    const errorCode = result?.error?.code;
    if (errorCode === 'EPERM') {
        return {
            skipped: true,
            reason: 'child_process spawn is blocked by the current execution environment'
        };
    }

    return {
        skipped: false,
        status: result.status,
        stdout: String(result.stdout || '').trim(),
        stderr: String(result.stderr || '').trim()
    };
}

async function main() {
    const files = [];
    for (const relativeDir of TARGET_DIRS) {
        const targetDir = path.join(ROOT, relativeDir);
        if (!await pathExists(targetDir)) continue;
        await collectJsFiles(targetDir, files);
    }

    files.sort((a, b) => a.localeCompare(b));

    const failures = [];
    let skippedCount = 0;

    for (const filePath of files) {
        const result = checkSyntax(filePath);
        if (result.skipped) {
            skippedCount += 1;
            continue;
        }

        if (result.status === 0) continue;

        failures.push({
            file: path.relative(ROOT, filePath).replace(/\\/g, '/'),
            stderr: result.stderr,
            stdout: result.stdout
        });
    }

    if (skippedCount > 0 && skippedCount === files.length) {
        console.warn(
            `WARN: syntax check skipped for ${files.length} file(s); child process execution is blocked in this environment.`
        );
        return;
    }

    if (!failures.length) {
        const suffix = skippedCount > 0
            ? ` (${skippedCount} skipped due to environment restrictions).`
            : '.';
        console.log(`OK: syntax check passed for ${files.length - skippedCount} file(s)${suffix}`);
        return;
    }

    console.error(`Syntax check failed for ${failures.length} file(s):`);
    failures.forEach((failure) => {
        console.error(`- ${failure.file}`);
        const details = failure.stderr || failure.stdout;
        if (details) {
            console.error(details);
        }
    });

    process.exitCode = 1;
}

main().catch((error) => {
    console.error(`Syntax validation failed: ${error.message}`);
    process.exitCode = 1;
});
