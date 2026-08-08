// Standalone verification for @img's Image Style v1 rendering behavior
// across both Adapters.ts routes — see the "Image Style v1" subsection of
// Block-Syntax-Specification.md §5 for the spec this exercises. Same
// rationale as card-render.test.ts: this covers the real Parser -> Renderer
// path (not hand-built AST fixtures), so a regression in Lexer/Parser's
// {styles} handling for @img would also surface here.

import { tokenize } from '../src/Lexer.ts';
import { DocParser } from '../src/Parser.ts';
import { DocTranspiler } from '../src/Adapters.ts';
import type { DocASTNode } from '../src/types.ts';

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

/** Parses a top-level `@img(...)[...]` source string and returns the @img node. */
function parseImgNode(src: string): DocASTNode {
  const ast = new DocParser(tokenize(src)).parse();
  const node = ast[0];
  if (node.type !== 'img') throw new Error(`expected an @img node, got: ${node.type}`);
  return node;
}

interface ImgCase {
  label: string;
  src: string;
  expectBorderColor?: string;
  expectRadiusPx?: string;
  expectBare?: boolean;
}

const CASES: ImgCase[] = [
  { label: 'hex border only', src: '@img(src=a.png){#3366ff}[alt]', expectBorderColor: '#3366ff' },
  { label: 'radius-N radius only', src: '@img(src=a.png){radius-12}[alt]', expectRadiusPx: '12' },
  { label: 'hex + radius-N combined', src: '@img(src=a.png){#3366ff,radius-12}[alt]', expectBorderColor: '#3366ff', expectRadiusPx: '12' },
  { label: 'reversed order (radius-N + hex)', src: '@img(src=a.png){radius-8,#ff00ff}[alt]', expectBorderColor: '#ff00ff', expectRadiusPx: '8' },
  { label: 'unrecognized token', src: '@img(src=a.png){not-a-token}[alt]', expectBare: true },
  { label: 'omitted braces', src: '@img(src=a.png)[alt]', expectBare: true },
];

for (const c of CASES) {
  const node = parseImgNode(c.src);

  // --- Adapters.ts (inline route)
  const inlineHtml = DocTranspiler.toInlineStyleHTML(node);
  if (c.expectBorderColor) {
    check(`Adapters inline ${c.label}: border set`, inlineHtml.includes(`border:1px solid ${c.expectBorderColor};`), inlineHtml);
  }
  if (c.expectRadiusPx) {
    check(`Adapters inline ${c.label}: border-radius set`, inlineHtml.includes(`border-radius:${c.expectRadiusPx}px;`), inlineHtml);
  }
  if (c.expectBare) {
    check(`Adapters inline ${c.label}: no style attribute`, !inlineHtml.includes('style='), inlineHtml);
  }

  // --- Adapters.ts (tailwind route): @img has no Tailwind-class treatment
  // for its styles (unlike @card's "card-radius-N") — both routes render
  // identical inline-style output, same as the pre-existing radius=/border=
  // image options this layers on top of.
  const tailwindHtml = DocTranspiler.toTailwindHTML(node);
  check(`Adapters tailwind ${c.label}: matches the inline route exactly`, tailwindHtml === inlineHtml, tailwindHtml);
}

// {styles} (Image Style v1) takes priority over the older "(radius=...)"
// image option when both are present.
{
  const node = parseImgNode('@img(src=a.png,radius=4px){radius-20}[alt]');
  const html = DocTranspiler.toInlineStyleHTML(node);
  check('Adapters inline: {radius-N} overrides the legacy (radius=...) option', html.includes('border-radius:20px;') && !html.includes('4px'), html);
}

// The legacy "(radius=...,border=...)" image options still work standalone.
{
  const node = parseImgNode('@img(src=a.png,radius=4px,border=2px dashed red)[alt]');
  const html = DocTranspiler.toInlineStyleHTML(node);
  check('Adapters inline: legacy (radius=...,border=...) options still work standalone', html.includes('border-radius:4px;') && html.includes('border:2px dashed red;'), html);
}

console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} total.`);
process.exitCode = fail > 0 ? 1 : 0;
