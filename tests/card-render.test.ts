// Standalone verification for @card's Card Style v1 rendering behavior
// across both Adapters.ts routes and KamiAdapter.ts — see the "Card Style
// v1" subsection of Container-Blocks.md / Block-Syntax-Specification.md §6
// for the spec this exercises. Same rationale as color-render.test.ts: this
// covers the real Parser -> Renderer path (not hand-built AST fixtures), so
// a regression in Lexer/Parser's {styles} handling for @card would also
// surface here.

import { tokenize } from '../src/Lexer.ts';
import { DocParser } from '../src/Parser.ts';
import { DocTranspiler } from '../src/Adapters.ts';
import { renderKamiNode } from '../src/kami/KamiAdapter.ts';
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

/** Parses a top-level `@card{...}[...]` source string and returns the @card node. */
function parseCardNode(src: string): DocASTNode {
  const ast = new DocParser(tokenize(src)).parse();
  const node = ast[0];
  if (node.type !== 'card') throw new Error(`expected a @card node, got: ${node.type}`);
  return node;
}

interface CardCase {
  label: string;
  src: string;
  expectBackground?: string;
  expectRadiusPx?: string;
  expectUnrecognized?: boolean;
}

const CASES: CardCase[] = [
  { label: 'hex background only', src: '@card{#3366ff}[text]', expectBackground: '#3366ff' },
  { label: 'radius-N radius only', src: '@card{radius-12}[text]', expectRadiusPx: '12' },
  { label: 'hex + radius-N combined', src: '@card{#3366ff,radius-12}[text]', expectBackground: '#3366ff', expectRadiusPx: '12' },
  { label: 'reversed order (radius-N + hex)', src: '@card{radius-8,#ff00ff}[text]', expectBackground: '#ff00ff', expectRadiusPx: '8' },
  { label: 'unrecognized token', src: '@card{not-a-token}[text]', expectUnrecognized: true },
  { label: 'omitted braces', src: '@card[text]', expectUnrecognized: true },
];

for (const c of CASES) {
  const node = parseCardNode(c.src);

  // --- KamiAdapter: emits a data-kami="card" <article>; background/radius
  // only appear as inline style overrides when actually resolved — an
  // unrecognized/omitted {styles} falls back to kami.css's static defaults,
  // i.e. no inline style attribute at all.
  const kamiHtml = renderKamiNode(node);
  check(`Kami ${c.label}: renders a data-kami="card" article`, kamiHtml.includes('data-kami="card"'), kamiHtml);
  if (c.expectBackground) {
    check(`Kami ${c.label}: background token applied verbatim`, kamiHtml.includes(`background:${c.expectBackground};`), kamiHtml);
  }
  if (c.expectRadiusPx) {
    check(`Kami ${c.label}: radius-N resolves to border-radius:Npx`, kamiHtml.includes(`border-radius:${c.expectRadiusPx}px;`), kamiHtml);
  }
  if (c.expectUnrecognized) {
    check(`Kami ${c.label}: no inline style attribute (falls back to kami.css defaults)`, !kamiHtml.includes('style='), kamiHtml);
  }

  // --- Adapters.ts (inline route)
  const inlineHtml = DocTranspiler.toInlineStyleHTML(node);
  if (c.expectBackground) {
    check(`Adapters inline ${c.label}: background-color set`, inlineHtml.includes(`background-color: ${c.expectBackground};`), inlineHtml);
  }
  if (c.expectRadiusPx) {
    check(`Adapters inline ${c.label}: border-radius set`, inlineHtml.includes(`border-radius: ${c.expectRadiusPx}px;`), inlineHtml);
  }
  if (c.expectUnrecognized) {
    check(`Adapters inline ${c.label}: bare <article>, no style attribute`, inlineHtml === `<article>text</article>`, inlineHtml);
  }

  // --- Adapters.ts (tailwind route): radius-N gets a "card-radius-N" modifier
  // class (no CSS ambiguity — it's already a valid class-name fragment); a
  // hex background has no class equivalent, so it always falls back to
  // inline style even on this route.
  const tailwindHtml = DocTranspiler.toTailwindHTML(node);
  check(`Adapters tailwind ${c.label}: always carries the base "card" class`, /class="card/.test(tailwindHtml), tailwindHtml);
  if (c.expectBackground) {
    check(`Adapters tailwind ${c.label}: hex background falls back to inline style`, tailwindHtml.includes(`style="background-color: ${c.expectBackground};"`), tailwindHtml);
  }
  if (c.expectRadiusPx) {
    const radiusToken = c.src.match(/radius-\d+/)?.[0];
    check(`Adapters tailwind ${c.label}: radius-N gets a card-${radiusToken} class, no inline style`, tailwindHtml.includes(`card-${radiusToken}`), tailwindHtml);
  }
  if (c.expectUnrecognized) {
    check(`Adapters tailwind ${c.label}: just the base class, no modifier, no style`, tailwindHtml === `<article class="card">text</article>`, tailwindHtml);
  }
}

// Sanity check: a named color token (valid for @mark/@color/@bordered) is
// NOT recognized by @card — Card Style v1 deliberately has no named-token
// palette, only hex + radius-N (see Block-Syntax-Specification.md §6).
{
  const node = parseCardNode('@card{blue}[text]');
  const kamiHtml = renderKamiNode(node);
  check('Kami: named color token "blue" is not recognized by @card (no inline style)', !kamiHtml.includes('style='), kamiHtml);
}

// @card(title){styles}[...] — title and styles slots are independent.
{
  const node = parseCardNode('@card(API Key){#3366ff,radius-12}[text]');
  const kamiHtml = renderKamiNode(node);
  check('Kami: title renders alongside resolved styles', kamiHtml.includes('<header>API Key</header>') && kamiHtml.includes('background:#3366ff;') && kamiHtml.includes('border-radius:12px;'), kamiHtml);
}

console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} total.`);
process.exitCode = fail > 0 ? 1 : 0;
