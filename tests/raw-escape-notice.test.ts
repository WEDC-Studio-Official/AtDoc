// @raw escape advance-notice diagnostics (Editor Mode, non-blocking).
//
// The trap these guard against: inside @raw's raw-escaped content, "@]" is an
// escape for a literal "]" — it does NOT end the node. An accidental one
// (`@raw[@mark[hello@@]]`, a trailing "@", …) silently swallows everything up
// to the next unpaired "]", sometimes the rest of the document. The Parser
// now points a marker at the escape: 'warning' when the node shows swallow
// symptoms (unclosed, or content crossing a line break), 'info' as a quiet
// heads-up on every other consumed escape. Neither tier blocks parsing — the
// AST comes out exactly as the escape rules dictate either way.
//
// Run: npm test --workspace=packages/atdoc-core

import assert from 'node:assert';
import { tokenize } from '../src/Lexer.ts';
import { DocParser } from '../src/Parser.ts';
import type { DocDiagnostic } from '../src/types.ts';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err instanceof Error ? err.message.split('\n').join('\n        ') : String(err)}`);
  }
}

function diagnosticsOf(source: string): DocDiagnostic[] {
  const parser = new DocParser(tokenize(source));
  parser.parse();
  return parser.diagnostics;
}

function bySeverity(diags: DocDiagnostic[], severity: DocDiagnostic['severity']): DocDiagnostic[] {
  return diags.filter(d => d.severity === severity);
}

// ---------------------------------------------------------------------------
// info tier — the plain heads-up
// ---------------------------------------------------------------------------

test('a well-formed escape gets an info notice, anchored on the escape itself', () => {
  const src = '@raw[unpaired @] bracket]';
  const infos = bySeverity(diagnosticsOf(src), 'info');
  assert.strictEqual(infos.length, 1);
  assert.strictEqual(src.slice(infos[0].start, infos[0].end), '@]');
  assert.match(infos[0].message, /escape for a literal "\]"/);
});

test('each escape kind gets its own notice with the right decoded character', () => {
  const src = '@raw[a@] b@[ c@@] d@@[ e]';
  const infos = bySeverity(diagnosticsOf(src), 'info');
  assert.deepStrictEqual(
    infos.map(d => src.slice(d.start, d.end)),
    ['@]', '@[', '@@]', '@@['],
  );
  assert.match(infos[0].message, /"\]"/);
  assert.match(infos[1].message, /"\["/);
  assert.match(infos[2].message, /"@\]"/);
  assert.match(infos[3].message, /"@\["/);
});

test('an @raw with no escapes stays silent', () => {
  const diags = diagnosticsOf('@raw[@mark[hello]] and @raw[plain]');
  assert.strictEqual(diags.length, 0);
});

test('@code/@mermaid never get escape notices — they have no escape mechanism', () => {
  const diags = diagnosticsOf('@code(ts)[const a = "@]";]\n@mermaid[A --> B]');
  assert.strictEqual(diags.length, 0);
});

// ---------------------------------------------------------------------------
// warning tier — swallow symptoms
// ---------------------------------------------------------------------------

test('escape + never-closing @raw warns on the last escape (the likely eaten closer)', () => {
  // The spec's own anti-example: the author escaped a bracket that was
  // already balanced, so the node's real closer is consumed and the node
  // never terminates.
  const src = '@raw[這裡的 @mark[hello@] 保持原樣@]';
  const diags = diagnosticsOf(src);
  const warnings = bySeverity(diags, 'warning');
  assert.strictEqual(warnings.length, 1);
  assert.strictEqual(src.slice(warnings[0].start, warnings[0].end), '@]');
  assert.strictEqual(warnings[0].start, src.lastIndexOf('@]'));
  assert.match(warnings[0].message, /never finds its closing/);
  // The warning replaces the per-escape info notices — one clear marker, not
  // a pile.
  assert.strictEqual(bySeverity(diags, 'info').length, 0);
});

test('escape + content crossing a line break warns on the escape before the newline', () => {
  const src = '@raw[oops@]\nswallowed line]\nafter';
  const warnings = bySeverity(diagnosticsOf(src), 'warning');
  assert.strictEqual(warnings.length, 1);
  assert.strictEqual(src.slice(warnings[0].start, warnings[0].end), '@]');
  assert.match(warnings[0].message, /runs past the end of this line/);
});

test('a deliberate multi-line @raw without escapes is not flagged', () => {
  const diags = diagnosticsOf('@raw[line one\nline two]');
  assert.strictEqual(diags.length, 0);
});

test('a mid-line escape inside deliberate multi-line content stays at the info tier', () => {
  // Only an escape sitting at the very end of a line is symptomatic — one
  // mid-line (like Markdown import's minimally-escaped preservation of an
  // unbalanced code block) doesn't run the content past where it "should"
  // have ended, so there's no reason to escalate it.
  const src = '@raw[cell = { any-char - "," - "@]" } ;\nrow = "[" , cell , "]" ;]';
  const diags = diagnosticsOf(src);
  assert.strictEqual(bySeverity(diags, 'warning').length, 0);
  assert.strictEqual(bySeverity(diags, 'info').length, 1);
});

// ---------------------------------------------------------------------------
// non-blocking guarantee
// ---------------------------------------------------------------------------

test('notices never change the parse — the AST is identical to a silent run', () => {
  const src = '@raw[unpaired @] bracket]';
  const parser = new DocParser(tokenize(src));
  const ast = parser.parse();
  assert.strictEqual(parser.diagnostics.length, 1); // the info notice
  assert.strictEqual(ast.length, 1);
  const paragraph = ast[0];
  const rawNode = paragraph.content.find(c => typeof c !== 'string');
  assert.ok(rawNode && typeof rawNode !== 'string');
  assert.strictEqual(rawNode.raw, 'unpaired ] bracket');
});

test('pre-existing diagnostics still carry no severity field (error tier)', () => {
  const diags = diagnosticsOf('@fn[abc]'); // non-digit @fn — a long-standing error diagnostic
  assert.ok(diags.length > 0);
  assert.strictEqual(diags[0].severity, undefined);
});

console.log(`${passed} passed, ${failed} failed, ${passed + failed} total.`);
if (failed > 0) process.exit(1);
