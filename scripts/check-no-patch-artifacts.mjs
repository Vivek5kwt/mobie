import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['.git', 'node_modules', 'android', 'ios', 'build', 'dist']);
const TEXT_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.yml', '.yaml']);
const PATCH_MARKERS = [/^<<<<<<<\s/m, /^=======\s*$/m, /^>>>>>>>\s/m, /^@@\s[-+0-9, ]+@@/m];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) {
        walk(fullPath, files);
      }
      continue;
    }

    if (TEXT_EXTENSIONS.has(extname(entry))) {
      files.push(fullPath);
    }
  }
  return files;
}

const offenders = [];
for (const file of walk(ROOT)) {
  const content = readFileSync(file, 'utf8');
  if (PATCH_MARKERS.some((pattern) => pattern.test(content))) {
    offenders.push(file.replace(`${ROOT}/`, ''));
  }
}

if (offenders.length) {
  console.error('Found patch/merge artifacts in:');
  offenders.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

console.log('No patch/merge artifacts found.');
