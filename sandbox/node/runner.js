const { spawn } = require('child_process');

async function runUserCode() {
    const code = Buffer.from(
        process.env.CODE_B64 || '',
        'base64'
    ).toString('utf8');

    const filename = process.env.FILENAME || 'main.js';
    const source = `${code}\n//# sourceURL=${filename}`;

    const child = spawn(
        'node',
        ['--no-warnings', '--input-type=module', '--eval', source],
        {
            cwd: __dirname, //current working directory
            stdio: 'inherit'
        }
    );

    child.on('exit', code => {
        process.exit(code);
    });
}

runUserCode().catch(console.error);
