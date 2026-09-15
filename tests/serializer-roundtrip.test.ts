// Serializer round-trip test.
//
// Runs the shared corpus (tests/fixtures/roundtrip-cases.ts, byte-identical
// with the AtDoc repo's copy) against this repo's Editor Mode Parser, then
// adds the cases only this side can express: placement/context checks, and
// sources that rely on recovery rather than throwing.
//
// The invariant: for any source S, parse(serialize(parse(S))) deep-equals
// parse(S). "deep-equal AST", not "identical text" — aliases canonicalize,
// implicit paragraphs may shed their `@p[...]` wrapper, and incidental
// whitespace between structural children is dropped.
//
// This suite only covers the engine itself. apps/atdoc has its own small
// i18n-syntax-roundtrip.test.ts that round-trips each locale's homepage
// syntax sample through this same package — that content lives in the app,
// not here.
//
// Run: npm test --workspace=packages/atdoc-core

import assert from 'node:assert';
import { tokenize } from '../src/Lexer.ts';
import { DocParser } from '../src/Parser.ts';
import {
  serializeDocument, serializeNode, canonicalizeNode, validateSerializableNode, unsupportedContentModes,
} from '../src/Serializer.ts';
import type { NodeSerializationContext } from '../src/Serializer.ts';
import type { DocASTNode } from '../src/types.ts';
import { ROUNDTRIP_CASES, CANONICALIZATION_CASES, DOCUMENT_CASES, REFUSAL_CASES } from './fixtures/roundtrip-cases.ts';

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

function parse(source: string): DocASTNode[] {
  return new DocParser(tokenize(source)).parse();
}

/** Drops `start` so two parses of differently-positioned text can be compared. */
function stripPositions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPositions);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'start') continue;
      out[k] = stripPositions(v);
    }
    return out;
  }
  return value;
}

function roundTrips(source: string): void {
  const original = parse(source);
  const result = serializeDocument(original);
  assert.ok(result.ok, `serialize refused: ${result.ok ? '' : result.reason}`);

  const reparsed = parse(result.text);
  try {
    assert.deepStrictEqual(stripPositions(reparsed), stripPositions(original));
  } catch (err) {
    throw new Error(
      `AST changed across the round trip.\n`
      + `  in:  ${JSON.stringify(source)}\n`
      + `  out: ${JSON.stringify(result.text)}\n`
      + `${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

const AT_ROOT: NodeSerializationContext = { placement: { at: 'root' } };

function inside(parentType: string): NodeSerializationContext {
  return { placement: { at: 'slot', parentType } };
}

function refuses(node: DocASTNode, expectedFragment: string, context: NodeSerializationContext = AT_ROOT): void {
  const result = serializeNode(node, context);
  assert.ok(!result.ok, `expected a refusal, got ${JSON.stringify(result.ok ? result.text : '')}`);
  assert.ok(
    result.reason.includes(expectedFragment),
    `reason ${JSON.stringify(result.reason)} does not mention ${JSON.stringify(expectedFragment)}`,
  );
}

function accepts(node: DocASTNode, expectedText: string, context: NodeSerializationContext = AT_ROOT): void {
  const result = serializeNode(node, context);
  assert.ok(result.ok, `expected success, got refusal: ${result.ok ? '' : result.reason}`);
  assert.strictEqual(result.text, expectedText);
}

/**
 * Parses `text` and digs out the node of type `type`.
 *
 * An inline node written at the document root doesn't stay there — the Parser
 * wraps stray inline content in an implicit paragraph — so `parse(text)[0]`
 * for `@link(...)[x]` is the paragraph, not the link. That wrapping is correct
 * behavior, not a serializer bug, so the comparison steps through it.
 */
function reparseAsNode(text: string, type: string): DocASTNode | undefined {
  const root = parse(text)[0];
  if (root?.type === type) return root;
  return root?.content.find((c): c is DocASTNode => typeof c !== 'string' && c.type === type);
}

// ---------------------------------------------------------------------------
// Shared corpus — identical on both sides of the repo split.
// ---------------------------------------------------------------------------

for (const [name, source] of Object.entries(ROUNDTRIP_CASES)) {
  test(`round-trips: ${name}`, () => roundTrips(source));
}

for (const { name, node, text } of CANONICALIZATION_CASES) {
  test(`canonicalizes: ${name}`, () => {
    accepts(node as DocASTNode, text);
    const canonical = canonicalizeNode(node as DocASTNode);
    assert.ok(canonical.ok, `canonicalize refused: ${canonical.ok ? '' : canonical.reason}`);
    assert.deepStrictEqual(stripPositions(reparseAsNode(text, canonical.node.type)), stripPositions(canonical.node));
  });
}

for (const { name, ast, text } of DOCUMENT_CASES) {
  test(`document: ${name}`, () => {
    const result = serializeDocument(ast as DocASTNode[]);
    assert.ok(result.ok, `serialize refused: ${result.ok ? '' : result.reason}`);
    assert.strictEqual(result.text, text);
    // And the text has to mean what it looks like.
    assert.deepStrictEqual(
      stripPositions(parse(result.text)),
      stripPositions(parse(text)),
    );
  });
}

for (const { name, node, reason } of REFUSAL_CASES) {
  test(`refuses: ${name}`, () => refuses(node as DocASTNode, reason));
}

// ---------------------------------------------------------------------------
// Web-only: sources that lean on Editor Mode recovery, which Strict Mode
// throws on — so they can't live in the shared corpus.
// ---------------------------------------------------------------------------

const EDITOR_MODE_CASES: Record<string, string> = {
  // A "(...)" on a node whose registry entry has no `parenRole`: the Parser
  // records it (and diagnoses it) without deriving anything, so there's no
  // convenience field for canonicalization to compare against.
  'paren on a node that takes none': '@hr(oops)',
  'retired @color paren form': '@p[@color(red){blue}[x]]',
};

for (const [name, source] of Object.entries(EDITOR_MODE_CASES)) {
  test(`round-trips (editor mode): ${name}`, () => roundTrips(source));
}

// ---------------------------------------------------------------------------
// Web-only: placement. Serializing a node is not a property of the node alone,
// and the context that makes it safe is an editor-side concern.
// ---------------------------------------------------------------------------

test('refuses: @tab outside @tabs', () => {
  refuses({ type: 'tab', title: 'One', content: ['x'] }, 'only appear directly inside `@tabs`');
});

test('accepts: @tab inside @tabs', () => {
  accepts({ type: 'tab', title: 'One', content: ['x'] }, '@tab(One)[x]', inside('tabs'));
});

test('refuses: a node inside an opaque slot', () => {
  refuses({ type: 'bold', content: ['x'] }, 'scanned opaquely', inside('code'));
});

test('refuses: a node inside a void node', () => {
  refuses({ type: 'bold', content: ['x'] }, 'takes no content slot', inside('hr'));
});

test('refuses: @tabs holding something other than @tab', () => {
  refuses({ type: 'card', content: ['x'] }, 'only `@tab` children', inside('tabs'));
});

test('refuses: a block node inside a table cell', () => {
  refuses({ type: 'card', content: ['x'] }, "isn't allowed inside", inside('cols'));
});

test('accepts: an allowed inline node inside a table cell', () => {
  accepts({ type: 'bold', content: ['x'] }, '@bold[x]', inside('cols'));
});

test('refuses: "," inside a table cell', () => {
  refuses({ type: 'cols', content: [], columns: [['a,b']] }, 'cell separator', inside('table'));
});

test('refuses: insertion after an unpaired "@" in the source', () => {
  refuses({ type: 'bold', content: ['x'] }, 'unpaired "@"', {
    placement: { at: 'root' },
    precedingSource: 'contact me at @',
  });
});

test('accepts: insertion after a paired "@@" in the source', () => {
  accepts({ type: 'bold', content: ['x'] }, '@bold[x]', {
    placement: { at: 'root' },
    precedingSource: 'a literal @@',
  });
});

test('@raw content ending in "@" falls back to the strong quote', () => {
  // scanDepthRaw matches "@]" (and "@@]") before the bare "]" closer, so a
  // trailing "@" in the escaped form would swallow the closing bracket and the
  // node would never terminate — there is no escaped encoding for it. The
  // strong quote ends at "]}" and has no escapes for the "@" to fuse with, so
  // it holds what the escaped form can't. This used to be a flat refusal.
  accepts({ type: 'raw', content: [], raw: '@' }, '@raw{[@]}');
  accepts({ type: 'raw', content: [], raw: 'a@' }, '@raw{[a@]}');
  // Only content that also contains "]}" defeats both forms.
  refuses({ type: 'raw', content: [], raw: 'a]} b@' }, 'neither form can hold it');
  // "@" anywhere else keeps the escaped form, which reads better for the
  // inline code this node usually carries.
  accepts({ type: 'raw', content: [], raw: 'a@b' }, '@raw[a@b]');
});

test('refuses: text that would be read as a void node\'s slot', () => {
  refuses({ type: 'paragraph', content: [{ type: 'n', content: [] }, '(not a paren)'] }, 'void child');
});

test('validateSerializableNode mirrors serializeNode without emitting', () => {
  assert.deepStrictEqual(
    validateSerializableNode({ type: 'heading', level: 2, content: ['x'] }, AT_ROOT),
    { ok: true },
  );
  const bad = validateSerializableNode({ type: 'tab', title: 'x', content: [] }, AT_ROOT);
  assert.ok(!bad.ok);
  assert.match(bad.reason, /only appear directly inside `@tabs`/);
});

// ---------------------------------------------------------------------------
// Guard: a new ContentMode in registry.ts must not silently serialize to "".
// ---------------------------------------------------------------------------

test('every registry ContentMode has an emitter', () => {
  assert.deepStrictEqual(unsupportedContentModes(), []);
});

console.log(`${passed} passed, ${failed} failed, ${passed + failed} total.`);
if (failed > 0) process.exit(1);
