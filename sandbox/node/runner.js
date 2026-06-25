const { spawn } = require('child_process');
const path = require('path');
const { pathToFileURL } = require('url');

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeStderr(text, filename) {
    const escapedFilename = escapeRegExp(filename);
    const escapedSandboxPath = escapeRegExp(`/sandbox/${filename}`);

    return text
        .replace(new RegExp(`file://${escapedSandboxPath}`, 'g'), filename)
        .replace(new RegExp(escapedSandboxPath, 'g'), filename)
        .replace(/file:\/\/\/sandbox\/\[eval\d+\]/g, filename)
        .replace(/\/sandbox\/\[eval\d+\]/g, filename)
        .replace(new RegExp(`\\[eval\\d+\\](?=[:\\s])`, 'g'), filename)
        .replace(new RegExp(`file://[^\\s\\n]*?/${escapedFilename}`, 'g'), filename)
        .replace(new RegExp(`[^\\s'"\\n]*[\\\\/]${escapedFilename}`, 'g'), filename);
}

async function runUserCode() {
    const code = Buffer.from(
        process.env.CODE_B64 || '',
        'base64'
    ).toString('utf8');

    const filename = process.env.FILENAME || 'main.js';
    const sourceUrl = pathToFileURL(path.resolve(__dirname, filename)).href;
    const source = `${code}\n//# sourceURL=${sourceUrl}`;

    const child = spawn(
        'node',
        ['--no-warnings', '--input-type=module', '--eval', source],
        {
            cwd: __dirname, //current working directory
            stdio: ['inherit', 'pipe', 'pipe']
        }
    );

    child.stdout.on('data', chunk => {
        process.stdout.write(chunk);
    });

    child.stderr.on('data', chunk => {
        process.stderr.write(sanitizeStderr(chunk.toString('utf8'), filename));
    });

    child.on('exit', code => {
        process.exit(code);
    });
}

runUserCode().catch(error => {
    console.error(sanitizeStderr(error?.stack || String(error), process.env.FILENAME || 'main.js'));
    process.exit(1);
});
