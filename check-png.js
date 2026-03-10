import fs from 'fs';
const buf = fs.readFileSync('public/icon.png');
console.log(buf.slice(0, 8).toString('hex'));
