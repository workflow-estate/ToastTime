import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'build/icon-source.jpg');
const out = path.join(root, 'build/icon.png');
execFileSync('sips', ['-s', 'format', 'png', src, '--out', out], { stdio: 'inherit' });
console.log(out);
