// Builds one flat <theme>.css per theme folder at the package root — fully
// independent bundles, never loaded together (each duplicates what it needs;
// plugins are complete, not layered). Themes are auto-discovered from src/
// (see scripts/themes.mjs): add src/<name>/*.css and it is built on the next
// run, no edit here. Edit the sources, never the generated *.css.
//
//   node scripts/build-css.mjs            every theme (internal use)
//   node scripts/build-css.mjs --public   only the publishable themes
//
// `tokens.css` sorts first within a folder if present; everything else sorts
// alphabetically so the build is deterministic without a manifest.
//
// Why a generated flat file instead of shipping split files with @import:
// consumers may read the CSS as a raw string and inline it (e.g. into a
// sandboxed iframe's <style>), where a relative @import would not resolve.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { discoverThemes, root, srcDir } from './themes.mjs';

const t = discoverThemes();
const targets = process.argv.includes('--public') ? t.publicThemes : t.all.filter((n) => t.hasCss(n));

function cssFilesIn(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.css'))
    .sort((a, b) => (a === 'tokens.css' ? -1 : b === 'tokens.css' ? 1 : a.localeCompare(b)));
}

function banner(label) {
  return `/* ============================================================================
 * GENERATED FILE — do not edit directly.
 * Source: src/${label}/*.css
 * Rebuild: npm run build:css
 * ========================================================================== */

`;
}

for (const label of targets) {
  const dir = join(srcDir, label);
  const files = cssFilesIn(dir);
  if (files.length === 0) {
    throw new Error(`No *.css files found in ${dir} — nothing to build for "${label}".`);
  }
  const body = files.map((name) => `/* ---- src/${label}/${name} ---- */\n${readFileSync(join(dir, name), 'utf8').trimEnd()}\n`).join('\n');
  writeFileSync(join(root, `${label}.css`), banner(label) + body);
  console.log(`Built ${label}.css from ${files.length} files in src/${label}/: ${files.join(', ')}`);
}
