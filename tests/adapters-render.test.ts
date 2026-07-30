// Standalone regression coverage for two Adapters.ts/KamiAdapter.ts rendering
// bugs found during a broader doc/code audit (unrelated to @color): @img's
// alt-text extraction silently dropping nested formatting nodes' text, and
// KamiAdapter.ts's @link not applying the same URI scheme inference
// Adapters.ts does, so the same AST produced different (and for bare
// domains, broken) hrefs depending on which Renderer branch ran it.

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

/** Parses `@p[...]` and returns its single child node (asserts it isn't a plain string). */
function parseSoleChild(pContent: string): DocASTNode {
  const ast = new DocParser(tokenize(`@p[${pContent}]`)).parse();
  const child = ast[0].content[0];
  if (typeof child === 'string') throw new Error(`expected a node, got string: ${child}`);
  return child;
}

// --- @img alt text: nested formatting nodes must contribute their text, not nothing ---
{
  const node = parseSoleChild('@img(logo.png)[Company @bold[Logo]]');
  const html = DocTranspiler.toInlineStyleHTML(node);
  check('Adapters @img alt: nested @bold contributes its text', html.includes('alt="Company Logo"'), html);
}
{
  // Raw-family children (e.g. @kbd) have no `content` — their text lives in `.raw`.
  const node = parseSoleChild('@img(logo.png)[Press @kbd[Ctrl] to continue]');
  const html = DocTranspiler.toInlineStyleHTML(node);
  check('Adapters @img alt: raw-family child (@kbd) contributes its raw text', html.includes('alt="Press Ctrl to continue"'), html);
}
{
  const node = parseSoleChild('@img(logo.png)[Plain text only]');
  const html = DocTranspiler.toInlineStyleHTML(node);
  check('Adapters @img alt: plain text (no nested nodes) still works', html.includes('alt="Plain text only"'), html);
}

// --- @link URI scheme inference: Adapters.ts and KamiAdapter.ts must agree ---
const URI_CASES = [
  { label: 'bare domain', src: 'example.com', expect: 'https://example.com' },
  { label: 'email', src: 'test@example.com', expect: 'mailto:test@example.com' },
  { label: 'phone number', src: '+886912345678', expect: 'tel:+886912345678' },
  { label: 'explicit scheme', src: 'https://example.com', expect: 'https://example.com' },
];

for (const c of URI_CASES) {
  const node = parseSoleChild(`@link(${c.src})[text]`);
  const inlineHtml = DocTranspiler.toInlineStyleHTML(node);
  const kamiHtml = renderKamiNode(node);
  check(`Adapters @link ${c.label}: resolves to ${c.expect}`, inlineHtml.includes(`href="${c.expect}"`), inlineHtml);
  check(`Kami @link ${c.label}: resolves to ${c.expect} (matches Adapters, not the literal input)`, kamiHtml.includes(`href="${c.expect}"`), kamiHtml);
}

console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} total.`);
process.exitCode = fail > 0 ? 1 : 0;
