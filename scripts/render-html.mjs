// Exports a .atd document as one self-contained HTML file (CSS inlined).
//
// Usage: npm run render -- <doc.atd> [--theme index] [--out out.html] [--dark] [--title Title] [--lang zh-Hant] [--no-mermaid]
// Without --out, writes <doc>.html next to the input.
//
// The theme's CSS is assembled straight from src/<theme>/*.css (same order as
// scripts/build-css.mjs), so build:css doesn't have to run first. Themes that
// aren't part of the public entry are picked up through src/internal.ts when
// that file exists.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const srcDir = join(import.meta.dirname, '..', 'src');
const entry = existsSync(join(srcDir, 'internal.ts')) ? 'internal.ts' : 'index.ts';
const { renderStandaloneHtml, hasTheme } = await import(pathToFileURL(join(srcDir, entry)).href);

const args = process.argv.slice(2);
const flag = (name) => {
    const i = args.indexOf(name);
    if (i < 0) return undefined;
    const value = args[i + 1];
    args.splice(i, 2);
    return value;
};
const has = (name) => {
    const i = args.indexOf(name);
    if (i < 0) return false;
    args.splice(i, 1);
    return true;
};

const theme = flag('--theme') ?? 'index';
const out = flag('--out');
const title = flag('--title');
const lang = flag('--lang');
const dark = has('--dark');
const noMermaid = has('--no-mermaid');
const input = args[0];

const usage = 'Usage: npm run render -- <doc.atd> [--theme index] [--out out.html] [--dark] [--title Title] [--lang zh-Hant] [--no-mermaid]';
if (!input || !existsSync(input)) {
    console.error(usage);
    process.exit(1);
}

if (!hasTheme(theme)) {
    console.error(`Theme "${theme}" is not registered by src/${entry}.`);
    process.exit(1);
}

const themeDir = join(srcDir, theme);
const cssFiles = existsSync(themeDir) ? readdirSync(themeDir).filter((f) => f.endsWith('.css')) : [];
if (cssFiles.length === 0) {
    console.error(`No CSS found for theme "${theme}" (src/${theme}/*.css).`);
    process.exit(1);
}
const css = cssFiles
    .sort((a, b) => (a === 'tokens.css' ? -1 : b === 'tokens.css' ? 1 : a.localeCompare(b)))
    .map((f) => readFileSync(join(themeDir, f), 'utf8').trimEnd())
    .join('\n\n');

const result = renderStandaloneHtml(readFileSync(input, 'utf8'), {
    theme,
    css,
    title,
    lang,
    scheme: dark ? 'dark' : 'light',
    mermaidUrl: noMermaid ? null : undefined,
});

for (const d of result.diagnostics) {
    console.warn(`${d.severity ?? 'error'}: ${d.message}`);
}
if (result.html === null) {
    console.error(`Render failed: ${result.error}`);
    process.exit(1);
}

const target = out ?? resolve(input).replace(/\.atd$/i, '') + '.html';
writeFileSync(target, result.html, 'utf8');
console.log(`Wrote ${target} (theme: ${theme}${dark ? ', dark' : ''})`);
