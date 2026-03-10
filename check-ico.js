import fs from 'fs';
const buf = fs.readFileSync('public/icon.ico');
console.log(buf.slice(0, 4).toString('hex'));
