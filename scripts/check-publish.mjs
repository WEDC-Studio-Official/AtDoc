// Publish guard: no internal theme may ship. Fails the build (and therefore
// `npm publish`, via prepublishOnly) if any trace of one ended up in what
// would be published — dist/, package.json's "files" / "exports", or a public
// theme whose stylesheet is missing from "files".
//
// The forbidden names are discovered (every theme folder not listed in
// "atdoc.publicThemes"), so a future theme is guarded from the day its folder
// exists.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { discoverThemes, readAtdocConfig, root } from './themes.mjs';

const t = discoverThemes();
const { pkg } = readAtdocConfig();
const names = t.internalThemes;
const problems = [];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alternation = names.map(esc).join('|');
const namePattern = names.length ? new RegExp(alternation, 'i') : null;
const importPattern = names.length
  ? new RegExp(`(?:from|import)\\s*\\(?\\s*['"][^'"]*(?:${alternation})[^'"]*['"]`, 'i')
  : null;

if (namePattern) {
  for (const key of Object.keys(pkg.exports ?? {})) {
    if (namePattern.test(key) || namePattern.test(JSON.stringify(pkg.exports[key]))) problems.push(`package.json exports: ${key}`);
  }
  for (const entry of pkg.files ?? []) {
    if (namePattern.test(entry)) problems.push(`package.json files: ${entry}`);
  }
}
for (const theme of t.publicThemes.filter((n) => t.hasCss(n))) {
  if (!(pkg.files ?? []).includes(`${theme}.css`)) {
    problems.push(`public theme "${theme}" has a stylesheet but package.json "files" lacks ${theme}.css`);
  }
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
for (const f of walk(join(root, 'dist'))) {
  const rel = f.slice(root.length + 1);
  if (namePattern && namePattern.test(rel)) problems.push(`dist file: ${rel}`);
  else if (importPattern && f.endsWith('.js') && importPattern.test(readFileSync(f, 'utf8'))) problems.push(`dist file imports an internal theme: ${rel}`);
}

if (problems.length > 0) {
  console.error(`Refusing to build: internal themes (${names.join(', ')}) must not be published.\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-publish: public themes [${t.publicThemes.join(', ')}] only; internal themes [${names.join(', ')}] kept out.`);
