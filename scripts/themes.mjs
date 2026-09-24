// Theme discovery — the single place that knows what a "theme" is.
//
// A theme is any folder directly under src/ (other than `editor`) that holds
// at least one *.css or *Adapter.ts file. Drop in src/cat/ or src/leaf/ and
// every build script picks it up with no edit anywhere else.
//
// Which themes are published is the one thing that must be declared, and it is
// deliberately opt-in: only the names in package.json's "atdoc.publicThemes"
// ship. Every other theme — including a brand-new one nobody has decided about
// yet — is internal by default.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const srcDir = join(root, 'src');

const NOT_THEMES = new Set(['editor']);

export function readAtdocConfig() {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const cfg = pkg.atdoc ?? {};
  return {
    pkg,
    publicThemes: cfg.publicThemes ?? [],
    internalFiles: cfg.internalFiles ?? [],
  };
}

export function discoverThemes() {
  const { publicThemes } = readAtdocConfig();
  const all = readdirSync(srcDir)
    .filter((name) => !NOT_THEMES.has(name) && statSync(join(srcDir, name)).isDirectory())
    .filter((name) => readdirSync(join(srcDir, name)).some((f) => f.endsWith('.css') || f.endsWith('Adapter.ts')))
    .sort();
  const unknownPublic = publicThemes.filter((t) => !all.includes(t));
  if (unknownPublic.length > 0) {
    throw new Error(`package.json atdoc.publicThemes lists themes with no src/<name>/ folder: ${unknownPublic.join(', ')}`);
  }
  return {
    all,
    publicThemes: all.filter((t) => publicThemes.includes(t)),
    internalThemes: all.filter((t) => !publicThemes.includes(t)),
    adapterFiles(theme) {
      return readdirSync(join(srcDir, theme)).filter((f) => f.endsWith('Adapter.ts')).sort();
    },
    hasCss(theme) {
      return existsSync(join(srcDir, theme)) && readdirSync(join(srcDir, theme)).some((f) => f.endsWith('.css'));
    },
  };
}
