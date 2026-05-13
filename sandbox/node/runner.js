const vm=require('vm');
const code=Buffer.from(process.env.CODE_B64, 'base64').toString('utf8');
const filename=process.env.FILENAME || 'main.js';

new vm.Script(code, { filename }).runInThisContext();