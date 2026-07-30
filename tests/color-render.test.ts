// Standalone verification for @color's rendering behavior across both
// Renderer branches (Adapters.ts's two routes, and the experimental
// KamiAdapter.ts). tests/run-tests.ts only exercises Lexer+Parser Strict
// Mode (throw vs. not, per expected.json) — it has no visibility into what
// HTML actually comes out the other end, which is exactly where @color's
// hex/named-token/unrecognized/omitted resolution logic lives. This file
// covers that gap directly against the real Parser output, not hand-built
// AST fixtures, so a regression in Lexer/Parser's {styles} handling would
// also surface here.

import { tokenize } from '../src/Lexer.ts';
import { DocParser } from '../src/Parser.ts';
import { DocTranspiler } from '../src/Adapters.ts';
import { renderKamiNode } from '../src/kami/KamiAdapter.ts';

let pass = 0;
let fail = 0;

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`PASS ${name}`);
  } else {
    fail++;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Parses `@p[@color...[content]]` and returns its single @color child node. */
function parseColorNode(colorSource: string) {
  const src = `@p[${colorSource}]`;
  const ast = new DocParser(tokenize(src)).parse();
  const p = ast[0];
  const node = p.content.find(c => typeof c !== 'string' && c.type === 'color');
  if (!node || typeof node === 'string') throw new Error(`no @color node found in: ${src}`);
  return node;
}

interface ColorCase {
  label: string;
  src: string;
  expectHex?: string;
  expectNamed?: string;
  expectFallback?: boolean;
}

const CASES: ColorCase[] = [
  { label: 'literal hex', src: '@color{#ff0000}[text]', expectHex: '#ff0000' },
  { label: 'named token (blue)', src: '@color{blue}[text]', expectNamed: 'blue' },
  { label: 'unrecognized token', src: '@color{not-a-color}[text]', expectFallback: true },
  { label: 'omitted braces', src: '@color[text]', expectFallback: true },
];

for (const c of CASES) {
  const node = parseColorNode(c.src);

  // --- KamiAdapter: always resolves to *some* color (falls back to its
  // shared default tint, same one @mark uses), never a bare/uncolored span.
  const kamiHtml = renderKamiNode(node);
  check(`Kami ${c.label}: renders a data-kami="color" span`, kamiHtml.includes('data-kami="color"'), kamiHtml);
  if (c.expectHex) {
    check(`Kami ${c.label}: hex passes through unchanged`, kamiHtml.includes(`color:${c.expectHex};`), kamiHtml);
  } else if (c.expectNamed) {
    check(`Kami ${c.label}: named token resolves to its own preset (not literal token text, not @mark's tint)`,
      /color:#[0-9A-Fa-f]{6};/.test(kamiHtml) && !kamiHtml.includes(`color:${c.expectNamed};`), kamiHtml);
  } else if (c.expectFallback) {
    check(`Kami ${c.label}: falls back to a real hex color (default tint), not empty`, /color:#[0-9A-Fa-f]{6};/.test(kamiHtml), kamiHtml);
  }

  // --- Adapters.ts (inline route): unresolved tokens render as a bare,
  // uncolored <span> — this Adapter has no "default color" concept.
  const inlineHtml = DocTranspiler.toInlineStyleHTML(node);
  if (c.expectHex) {
    check(`Adapters inline ${c.label}: hex passes through`, inlineHtml.includes(`color: ${c.expectHex};`), inlineHtml);
  } else if (c.expectNamed) {
    check(`Adapters inline ${c.label}: named token resolves to a real color`, /color: #[0-9A-Fa-f]{6};/.test(inlineHtml), inlineHtml);
  } else if (c.expectFallback) {
    check(`Adapters inline ${c.label}: unresolved token → bare <span>, no color style`, inlineHtml === `<span>text</span>`, inlineHtml);
  }

  // --- Adapters.ts (tailwind route): named tokens get a "color-<token>"
  // class (mirroring @mark's "mark-<token>"); hex still needs inline style
  // (no Tailwind-class equivalent for an arbitrary hex value).
  const tailwindHtml = DocTranspiler.toTailwindHTML(node);
  check(`Adapters tailwind ${c.label}: always carries the base "color" class`, /class="color/.test(tailwindHtml), tailwindHtml);
  if (c.expectHex) {
    check(`Adapters tailwind ${c.label}: hex falls back to inline style, no color-<token> class`, tailwindHtml.includes(`style="color: ${c.expectHex};"`) && !tailwindHtml.includes('color-#'), tailwindHtml);
  } else if (c.expectNamed) {
    check(`Adapters tailwind ${c.label}: named token gets a color-${c.expectNamed} class, no inline style`, tailwindHtml.includes(`color-${c.expectNamed}`) && !tailwindHtml.includes('style='), tailwindHtml);
  } else if (c.expectFallback) {
    check(`Adapters tailwind ${c.label}: unresolved token → just the base class, no modifier, no style`, tailwindHtml === `<span class="color">text</span>`, tailwindHtml);
  }
}

// Sanity check: @mark and @color resolve the *same* named token to
// *different* colors (independent palettes — see Adapters.ts/KamiAdapter.ts
// module comments for why reusing @mark's pale tint as @color's foreground
// text color would be a contrast/readability regression).
{
  const markSrc = '@p[@mark{blue}[text]]';
  const markAst = new DocParser(tokenize(markSrc)).parse();
  const markNode = markAst[0].content.find(c => typeof c !== 'string' && c.type === 'mark');
  if (!markNode || typeof markNode === 'string') throw new Error('no @mark node found');

  const markKami = renderKamiNode(markNode);
  const colorKami = renderKamiNode(parseColorNode('@color{blue}[text]'));
  const markHex = markKami.match(/background-color:(#[0-9A-Fa-f]{6})/)?.[1];
  const colorHex = colorKami.match(/color:(#[0-9A-Fa-f]{6})/)?.[1];
  check('Kami: @mark{blue} and @color{blue} resolve to different hex values (independent palettes)',
    !!markHex && !!colorHex && markHex !== colorHex, `mark=${markHex} color=${colorHex}`);
}

console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} total.`);
process.exitCode = fail > 0 ? 1 : 0;
