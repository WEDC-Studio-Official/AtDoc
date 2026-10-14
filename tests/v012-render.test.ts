// index Adapter render tests for the v0.1.2 syntax additions: @span colspan,
// pipe-delimited tables, @spoiler, @hex, @img float alignment, and
// document-unique @tabs ids.
//
// Run: node --import ./tests/ts-resolve-hook.mjs tests/v012-render.test.ts

import assert from 'node:assert';
import { tokenize } from '../src/Lexer.ts';
import { DocParser } from '../src/Parser.ts';
import { DocTranspiler } from '../src/index/Adapters.ts';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err instanceof Error ? err.message.split('\n').join('\n        ') : String(err)}`);
  }
}

function render(source: string): string {
  return new DocParser(tokenize(source)).parse().map(n => DocTranspiler.toTailwindHTML(n)).join('');
}

test('@span(n) in a table cell renders <td colspan="n">', () => {
  const html = render('@table[@cols[a|b|c]@data[[x|@span(2)[y]]]]');
  assert.ok(html.includes('<td colspan="2">y</td>'), html);
  assert.ok(html.includes('<td>x</td>'), html);
});

test('pipe-delimited table renders the same as the comma form', () => {
  assert.strictEqual(render('@table[@cols[a|b]@data[[1|2]]]'), render('@table[@cols[a,b]@data[[1,2]]]'));
});

// A row whose first cell starts with a node (Markdown inline code imports as
// @raw) used to lose its first "|": the leading-pipe check looked at the first
// depth-0 TEXT token ("|b|c" here), not the row's first token, and stripped
// the real delimiter as if it were `[|a|b]` decoration.
test('pipe row whose first cell starts with a node keeps every cell', () => {
  for (const row of ['[@raw[x]|b|c]', '[@bold[x]|b|c]', '[@raw[x]|b, still b|c]']) {
    const ast = new DocParser(tokenize(`@table[@cols[A|B|C]@data[${row}]]`));
    const table = ast.parse()[0] as { rows?: unknown[][] };
    assert.strictEqual(table.rows?.[0]?.length, 3, `${row} -> ${JSON.stringify(table.rows?.[0])}`);
    assert.strictEqual(ast.diagnostics.length, 0, `${row}: ${ast.diagnostics.map(d => d.message).join('; ')}`);
  }
  // A real leading "|" before a node is still decoration.
  const decorated = new DocParser(tokenize('@table[@cols[A|B|C]@data[[|@raw[x]|b|c|]]]')).parse()[0] as { rows?: unknown[][] };
  assert.strictEqual(decorated.rows?.[0]?.length, 3);
});

test('@spoiler renders a focusable .spoiler span', () => {
  assert.ok(render('@spoiler[secret]').includes('<span class="spoiler" tabindex="0">secret</span>'));
});

test('@hex renders a swatch plus its own code', () => {
  const html = render('@hex[#3366ff]');
  assert.ok(html.includes('class="hex-swatch"'), html);
  assert.ok(html.includes('background-color:#3366ff;'), html);
  assert.ok(html.includes('<code>#3366ff</code>'), html);
});

test('@img float-left uses a class, not inline display/margin', () => {
  const html = render('@img(src=a.png,align=float-left)[alt]');
  assert.ok(html.includes('class="float-left"'), html);
  assert.ok(!html.includes('display:block'), html);
});

test('two @tabs blocks get distinct panel ids', () => {
  const tabs = '@tabs[@tab(A)[x]@tab(B)[y]]';
  const html = render(tabs + '\n\n' + tabs);
  const ids = [...html.matchAll(/role="tabpanel" id="([^"]+)"/g)].map(m => m[1]);
  assert.strictEqual(ids.length, 4, html);
  assert.strictEqual(new Set(ids).size, 4, ids.join(','));
});

console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total.`);
if (failed > 0) process.exit(1);
