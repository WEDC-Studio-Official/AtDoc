// Standalone regression coverage for two Adapters.ts rendering bugs found
// during a broader doc/code audit (unrelated to @color): @img's alt-text
// extraction silently dropping nested formatting nodes' text, and @link not
// applying URI scheme inference, so a bare domain produced a broken href.

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

// --- @link URI scheme inference (Inline Syntax Specification §8) ---
const URI_CASES = [
  { label: 'bare domain', src: 'example.com', expect: 'https://example.com' },
  { label: 'email', src: 'test@example.com', expect: 'mailto:test@example.com' },
  { label: 'phone number', src: '+886912345678', expect: 'tel:+886912345678' },
  { label: 'explicit scheme', src: 'https://example.com', expect: 'https://example.com' },
];

for (const c of URI_CASES) {
  const node = parseSoleChild(`@link(${c.src})[text]`);
  const inlineHtml = DocTranspiler.toInlineStyleHTML(node);
  check(`Adapters @link ${c.label}: resolves to ${c.expect}`, inlineHtml.includes(`href="${c.expect}"`), inlineHtml);
}

// --- @raw renders as inline code (Inline Syntax Specification §9) ---
// The opaque domain's *parsing* rules were always specified; its rendering
// semantics were not, so every renderer emitted bare escaped text — @raw was
// the one inline node with no element around it at all. It is Markdown's
// backtick: content that must not be parsed, shown literally, monospace.
{
  const node = parseSoleChild('@raw[@mark[hello]]');
  for (const [label, html] of [
    ['tailwind', DocTranspiler.toTailwindHTML(node)],
    ['inline', DocTranspiler.toInlineStyleHTML(node)],
  ] as const) {
    check(`Adapters @raw (${label}): wraps content in <code>`, html === '<code>@mark[hello]</code>', html);
  }
}
{
  // The content stays literal — the <code> element must not tempt a renderer
  // into parsing what the opaque domain deliberately kept whole.
  const node = parseSoleChild('@raw[a < b && c > d]');
  const html = DocTranspiler.toTailwindHTML(node);
  check(
    'Adapters @raw: content is HTML-escaped, not interpreted',
    html === '<code>a &lt; b &amp;&amp; c &gt; d</code>',
    html,
  );
}
{
  // @code is the block form and keeps its <pre><code class="language-...">;
  // index.css resets the inline chip styling for `pre code` so they don't
  // stack. Locks the two apart so a future change to one doesn't silently
  // collapse the distinction.
  const ast = new DocParser(tokenize('@code(js)[let x = 1;]')).parse();
  const html = DocTranspiler.toTailwindHTML(ast[0]);
  check(
    'Adapters @code stays a block, distinct from @raw',
    html.startsWith('<pre><code class="language-js">') && html.endsWith('</code></pre>'),
    html,
  );
}

console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} total.`);
process.exitCode = fail > 0 ? 1 : 0;
