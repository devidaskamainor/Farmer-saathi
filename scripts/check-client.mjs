import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientSrc = path.join(rootDir, 'client', 'src');

function walk(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      files = files.concat(walk(full));
    } else if (full.endsWith('.js') || full.endsWith('.jsx')) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(clientSrc);
console.log(`Checking ${files.length} client files...`);

let brokenImports = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const importMatches = [...content.matchAll(/from\s+['"](\.[^'"]+)['"]/g)];
  for (const [, relPath] of importMatches) {
    const dir = path.dirname(file);
    const resolvedBase = path.resolve(dir, relPath);
    const exists = [
      resolvedBase,
      resolvedBase + '.js',
      resolvedBase + '.jsx',
      resolvedBase + '.json',
      resolvedBase + '.css',
      path.join(resolvedBase, 'index.js'),
      path.join(resolvedBase, 'index.jsx')
    ].some(p => fs.existsSync(p));
    if (!exists) {
      brokenImports.push({ file: path.relative(rootDir, file), relPath });
    }
  }
}

if (brokenImports.length === 0) {
  console.log('✔ All internal imports in client/src resolve correctly!');
} else {
  console.error('❌ Broken imports found:', brokenImports);
  process.exit(1);
}
