// Markdown → @Doc converter test — this feature has no counterpart in the
// public AtDoc spec repo, unlike serializer-roundtrip.test.ts's shared
// corpus.
//
// Strategy per case: convert the markdown, assert success/failure, then for
// successes reparse the emitted @Doc text and assert on the resulting AST —
// the same "trust the real Parser, not string-matching" approach
// serializer-roundtrip.test.ts uses.
//
// Run: npm test --workspace=packages/atdoc-core

import assert from 'node:assert';
import { tokenize } from '../src/Lexer.ts';
import { DocParser } from '../src/Parser.ts';
import { convertMarkdownToAtDoc } from '../src/markdownImport.ts';
import type { DocASTNode } from '../src/types.ts';

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

/** Drops `start` so the reparsed AST can be compared without caring about offsets. */
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

/** Converts, asserts success, and returns the reparsed AST for structural assertions. */
function convertToAst(markdown: string): DocASTNode[] {
  const result = convertMarkdownToAtDoc(markdown);
  assert.ok(result.ok, `expected conversion to succeed, got refusal: ${result.ok ? '' : result.reason}`);
  const text = result.text ?? '';
  // The converter already does this check internally; repeating it here
  // guards against a future change accidentally dropping that safety net.
  return stripPositions(new DocParser(tokenize(text)).parse()) as DocASTNode[];
}

function convertFails(markdown: string, expectedFragment: string): void {
  const result = convertMarkdownToAtDoc(markdown);
  assert.ok(!result.ok, `expected a refusal, got ${JSON.stringify(result.ok ? result.text : '')}`);
  assert.ok(
    (result.reason ?? '').includes(expectedFragment),
    `reason ${JSON.stringify(result.reason)} does not mention ${JSON.stringify(expectedFragment)}`,
  );
}

// ---------------------------------------------------------------------------
// Headings
// ---------------------------------------------------------------------------

test('ATX headings, level 1 has no paren', () => {
  const ast = convertToAst('# Title');
  assert.deepStrictEqual(ast, [{ type: 'heading', level: 1, content: ['Title'] }]);
});

test('ATX headings, level 2-6 carry an explicit paren', () => {
  for (const level of [2, 3, 4, 5, 6]) {
    const ast = convertToAst(`${'#'.repeat(level)} Title`);
    assert.deepStrictEqual(ast, [{ type: 'heading', paren: String(level), level, content: ['Title'] }]);
  }
});

test('ATX heading strips trailing closing hashes', () => {
  const ast = convertToAst('## Title ##');
  assert.deepStrictEqual(ast, [{ type: 'heading', paren: '2', level: 2, content: ['Title'] }]);
});

test('setext headings map to level 1 / 2', () => {
  const ast = convertToAst('Title One\n=========\n\nTitle Two\n---------\n');
  assert.deepStrictEqual(ast, [
    { type: 'heading', level: 1, content: ['Title One'] },
    { type: 'heading', paren: '2', level: 2, content: ['Title Two'] },
  ]);
});

// ---------------------------------------------------------------------------
// Inline formatting
// ---------------------------------------------------------------------------

test('bold / italic / bold-italic / strikethrough / inline code', () => {
  const ast = convertToAst('**b** *i* ***bi*** ~~s~~ `c`');
  assert.deepStrictEqual(ast, [
    {
      type: 'paragraph',
      content: [
        { type: 'bold', content: ['b'] },
        ' ',
        { type: 'italic', content: ['i'] },
        ' ',
        { type: 'bold', content: [{ type: 'italic', content: ['bi'] }] },
        ' ',
        { type: 'del', content: ['s'] },
        ' ',
        { type: 'raw', content: [], raw: 'c' },
      ],
    },
  ]);
});

test('underscore bold/italic delimiters are equivalent to asterisks', () => {
  const ast = convertToAst('__b__ _i_');
  assert.deepStrictEqual(ast, [
    { type: 'paragraph', content: [{ type: 'bold', content: ['b'] }, ' ', { type: 'italic', content: ['i'] }] },
  ]);
});

test('double-backtick code span carries a literal backtick (CommonMark)', () => {
  const ast = convertToAst('a `` `code` `` b');
  assert.deepStrictEqual(ast, [
    { type: 'paragraph', content: ['a ', { type: 'raw', content: [], raw: '`code`' }, ' b'] },
  ]);
});

test('inline code ending in "@" keeps its code styling via the strong quote', () => {
  // `@raw[@]` does NOT mean "raw containing @" — scanDepthRaw matches the "@]"
  // escape before the closer, so the node never terminates and swallows the
  // rest of the document. `@raw[@@]` is just as bad ("@@]" is the escape for a
  // literal "@]"). Converting a doc about @Doc's own syntax (`` `@` `` and
  // `` `@@` `` examples everywhere) used to emit exactly that; it was then
  // degraded to plain text, losing the monospace on every such example. The
  // strong quote ends at "]}" and has no escapes to fuse with, so the code
  // styling survives.
  const one = convertMarkdownToAtDoc('當掃描到 `@` 時');
  assert.ok(one.ok);
  assert.strictEqual(one.text, '@paragraph[當掃描到 @raw{[@]} 時]');
  assert.strictEqual(one.notes.length, 0);

  const two = convertMarkdownToAtDoc('若後續為 `@@`');
  assert.ok(two.ok);
  assert.strictEqual(two.text, '@paragraph[若後續為 @raw{[@@]}]');

  // "@" elsewhere keeps the escaped form, which reads better.
  const mid = convertMarkdownToAtDoc('寫 `a@b` 即可');
  assert.ok(mid.ok);
  assert.strictEqual(mid.text, '@paragraph[寫 @raw[a@b] 即可]');

  // Only "@"-terminated content that also contains "]}" defeats both forms.
  // (Brackets kept balanced here so the plain-text fallback itself stays
  // representable — an unbalanced one would fail for a second, unrelated
  // reason and stop this case from testing what it says.)
  const both = convertMarkdownToAtDoc('寫 `a[b]} c@` 即可');
  assert.ok(both.ok, both.ok ? '' : (both.reason ?? ''));
  assert.ok(both.notes.some((n) => n.includes('plain text')));
});

test('==mark==  maps to @mark', () => {
  const ast = convertToAst('==hl==');
  assert.deepStrictEqual(ast, [{ type: 'paragraph', content: [{ type: 'mark', content: ['hl'] }] }]);
});

test('a literal "@" in text is preserved (Serializer escapes it on the way out)', () => {
  const ast = convertToAst('mail me at a@b.com');
  assert.deepStrictEqual(ast, [{ type: 'paragraph', content: ['mail me at a@b.com'] }]);
});

test('escaped markdown punctuation is treated as literal text', () => {
  const ast = convertToAst('\\*not italic\\*');
  assert.deepStrictEqual(ast, [{ type: 'paragraph', content: ['*not italic*'] }]);
});

// ---------------------------------------------------------------------------
// Links / images
// ---------------------------------------------------------------------------

test('inline link and image', () => {
  const ast = convertToAst('[a](https://a.example) ![alt](https://a.example/x.png)');
  assert.deepStrictEqual(ast, [
    {
      type: 'paragraph',
      content: [
        { type: 'link', paren: 'https://a.example', uri: 'https://a.example', content: ['a'] },
        ' ',
        { type: 'img', paren: 'https://a.example/x.png', imgOptions: { src: 'https://a.example/x.png' }, content: ['alt'] },
      ],
    },
  ]);
});

test('reference-style link resolves against its definition', () => {
  const ast = convertToAst('[text][ref]\n\n[ref]: https://example.com "title"');
  assert.deepStrictEqual(ast, [
    {
      type: 'paragraph',
      content: [{ type: 'link', paren: 'https://example.com', uri: 'https://example.com', content: ['text'] }],
    },
  ]);
});

test('unresolved reference-style link falls back to plain text with a note', () => {
  const result = convertMarkdownToAtDoc('[text][missing]');
  assert.ok(result.ok);
  assert.ok(result.notes.some((n) => n.includes('missing')));
});

test('autolink maps to @link', () => {
  const ast = convertToAst('<https://example.com>');
  assert.deepStrictEqual(ast, [
    {
      type: 'paragraph',
      content: [{ type: 'link', paren: 'https://example.com', uri: 'https://example.com', content: ['https://example.com'] }],
    },
  ]);
});

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

test('unordered list, one item per line', () => {
  const ast = convertToAst('- one\n- two\n');
  assert.deepStrictEqual(ast, [
    {
      type: 'list',
      content: [
        { type: 'list-item', content: ['one'] },
        { type: 'list-item', content: ['two'] },
      ],
    },
  ]);
});

test('ordered list keeps its numbering as `marker`', () => {
  const ast = convertToAst('5. five\n6. six\n');
  assert.deepStrictEqual(ast, [
    {
      type: 'list',
      paren: 'ordered',
      ordered: true,
      content: [
        { type: 'list-item', content: ['five'], marker: 5 },
        { type: 'list-item', content: ['six'], marker: 6 },
      ],
    },
  ]);
});

test('nested list folds into the parent item', () => {
  const ast = convertToAst('- a\n  - a1\n  - a2\n- b\n');
  assert.deepStrictEqual(ast, [
    {
      type: 'list',
      content: [
        {
          type: 'list-item',
          content: [
            'a',
            {
              type: 'list',
              content: [
                { type: 'list-item', content: ['a1'] },
                { type: 'list-item', content: ['a2'] },
              ],
            },
          ],
        },
        { type: 'list-item', content: ['b'] },
      ],
    },
  ]);
});

test('a loose ordered list (blank lines between items, nested bullets) stays one list', () => {
  // Regression: the blank line between items used to terminate the list,
  // splitting "1. / 2. / 3." into three separate @list(ordered) blocks.
  const md = '1. one\n   - sub one\n\n2. two\n   - sub two\n';
  const ast = convertToAst(md);
  assert.deepStrictEqual(ast, [
    {
      type: 'list',
      paren: 'ordered',
      ordered: true,
      content: [
        {
          type: 'list-item',
          marker: 1,
          content: ['one', { type: 'list', content: [{ type: 'list-item', content: ['sub one'] }] }],
        },
        {
          type: 'list-item',
          marker: 2,
          content: ['two', { type: 'list', content: [{ type: 'list-item', content: ['sub two'] }] }],
        },
      ],
    },
  ]);
});

test('a single-line fenced code block inside a list item stays in the item as @code', () => {
  // Regression: the fence lines used to be joined into the item's inline
  // text, where the ``` markers re-paired as bogus inline code spans and
  // scrambled the surrounding text.
  const md = '- **Named**:\n  ```text\n  yellow / red\n  ```\n  trailing note.\n';
  const ast = convertToAst(md);
  assert.deepStrictEqual(ast, [
    {
      type: 'list',
      content: [
        {
          type: 'list-item',
          content: [
            { type: 'bold', content: ['Named'] },
            ': ',
            { type: 'code', paren: 'text', language: 'text', content: [], raw: 'yellow / red' },
            ' trailing note.',
          ],
        },
      ],
    },
  ]);
});

test('a multi-line fenced code block inside a list item is hoisted after the list, with a note', () => {
  // @list items must serialize to a single line (Serializer.ts's
  // emitListItems), and a multi-line @code emission would break that — so it
  // moves out rather than failing the list.
  const md = '- a\n  ```ts\n  line1;\n  line2;\n  ```\n- b\n\nAfter.';
  const ast = convertToAst(md);
  assert.deepStrictEqual(ast, [
    {
      type: 'list',
      content: [
        { type: 'list-item', content: ['a'] },
        { type: 'list-item', content: ['b'] },
      ],
    },
    { type: 'code', paren: 'ts', language: 'ts', content: [], raw: 'line1;\nline2;' },
    { type: 'paragraph', content: ['After.'] },
  ]);
  const result = convertMarkdownToAtDoc(md);
  assert.ok(result.ok);
  assert.ok(result.notes.some((n) => n.includes('moved')));
});

test('task list checkboxes degrade to plain-text markers with a note', () => {
  const result = convertMarkdownToAtDoc('- [ ] todo\n- [x] done\n');
  assert.ok(result.ok);
  assert.strictEqual(result.notes.length, 1); // deduplicated, not once per item
  const text = result.text ?? '';
  assert.ok(text.includes('☐ todo'));
  assert.ok(text.includes('☑ done'));
});

// ---------------------------------------------------------------------------
// Quote / hr / code / mermaid
// ---------------------------------------------------------------------------

test('blockquote wraps its lines in an explicit paragraph', () => {
  const ast = convertToAst('> hello\n> world\n');
  assert.deepStrictEqual(ast, [
    { type: 'quote', content: [{ type: 'paragraph', content: ['hello world'] }] },
  ]);
});

test('nested blockquote', () => {
  const ast = convertToAst('> outer\n>> inner\n');
  assert.deepStrictEqual(ast, [
    {
      type: 'quote',
      content: [
        { type: 'paragraph', content: ['outer'] },
        { type: 'quote', content: [{ type: 'paragraph', content: ['inner'] }] },
      ],
    },
  ]);
});

test('GitHub-style admonition quotes map to the matching @Doc callout', () => {
  const ast = convertToAst('> [!TIP]\n> be cool\n');
  assert.strictEqual(ast.length, 1);
  assert.strictEqual(ast[0].type, 'tip');
  assert.deepStrictEqual(ast[0].content, [{ type: 'paragraph', content: ['be cool'] }]);

  for (const [marker, type] of [['NOTE', 'note'], ['IMPORTANT', 'important'], ['WARNING', 'warning'], ['CAUTION', 'caution']] as const) {
    const one = convertToAst(`> [!${marker}]\n> body\n`);
    assert.strictEqual(one[0].type, type);
  }
});

test('a quote without an admonition marker stays a plain @quote', () => {
  // The literal brackets come back as their own string segments — they lex
  // as SLOT_OPEN/SLOT_CLOSE tokens and parseSlotContent hands them back
  // one by one. Same text, just segmented.
  const ast = convertToAst('> [not an admonition] text\n');
  assert.deepStrictEqual(ast, [
    { type: 'quote', content: [{ type: 'paragraph', content: ['[', 'not an admonition', ']', ' text'] }] },
  ]);
});

test('horizontal rule variants', () => {
  for (const hr of ['---', '***', '___', '- - -']) {
    assert.deepStrictEqual(convertToAst(hr), [{ type: 'hr', content: [] }]);
  }
});

test('fenced code block keeps its language', () => {
  const ast = convertToAst('```ts\nconst x = 1;\n```');
  assert.deepStrictEqual(ast, [{ type: 'code', paren: 'ts', language: 'ts', content: [], raw: 'const x = 1;' }]);
});

test('fenced code block with no language', () => {
  const ast = convertToAst('```\nplain\n```');
  assert.deepStrictEqual(ast, [{ type: 'code', language: undefined, content: [], raw: 'plain' }]);
});

test('fenced code block tagged "mermaid" becomes @mermaid, not @code', () => {
  const ast = convertToAst('```mermaid\ngraph TD; A-->B;\n```');
  assert.deepStrictEqual(ast, [{ type: 'mermaid', content: [], raw: 'graph TD; A-->B;' }]);
});

test('a code block with unbalanced brackets stays a @code block, via the strong quote', () => {
  // An EBNF grammar quoting "[" / "]" as literal terminals. The depth-counting
  // "[...]" form can't hold this and @code defines no escapes, so this used to
  // degrade to an inline @raw — losing the language tag and the block
  // rendering, which for a 165-line grammar meant one unreadable run-on line.
  // The strong quote "{[" … "]}" reads verbatim, so the block survives intact.
  const md = '# Title\n\n```ebnf\ncell = { any-char - "," - "]" } ;\nrow = "[" , cell , "]" ;\n```\n\nAfter.';
  const ast = convertToAst(md);
  assert.deepStrictEqual(ast, [
    { type: 'heading', level: 1, content: ['Title'] },
    {
      type: 'code',
      paren: 'ebnf',
      language: 'ebnf',
      content: [],
      raw: 'cell = { any-char - "," - "]" } ;\nrow = "[" , cell , "]" ;',
    },
    { type: 'paragraph', content: ['After.'] },
  ]);
  const result = convertMarkdownToAtDoc(md);
  assert.ok(result.ok);
  assert.match(result.text!, /@code\(ebnf\)\{\[/);
  // No note: nothing was lost, so there is nothing to warn about.
  assert.ok(!result.notes.some((n) => n.includes('@code')));
});

test('a code block ending in "@" keeps its language tag too', () => {
  // The trailing "@" is what the *escaped* form can't hold (it fuses with the
  // closing "]"), but the strong quote has no escapes for it to fuse with.
  const md = '# Title\n\n```text\nline one [unbalanced\nline two ends @\n```\n\nAfter.';
  const ast = convertToAst(md);
  assert.deepStrictEqual(ast, [
    { type: 'heading', level: 1, content: ['Title'] },
    { type: 'code', paren: 'text', language: 'text', content: [], raw: 'line one [unbalanced\nline two ends @' },
    { type: 'paragraph', content: ['After.'] },
  ]);
});

test('a one-line block showing a lone escape stays a @code block', () => {
  // A doc explaining @Doc's own "@]"/"@[" escapes shows a lone "]" or "[" as
  // an isolated example throughout — Inline Syntax Specification §9 is exactly
  // this. Every one of them used to become an inline @raw.
  const md = '```text\n@]\n```';
  const ast = convertToAst(md);
  assert.deepStrictEqual(ast, [{ type: 'code', paren: 'text', language: 'text', content: [], raw: '@]' }]);
  assert.strictEqual(convertMarkdownToAtDoc(md).text, '@code(text){[@]]}');
});

test('only content that defeats both forms is skipped', () => {
  // Unbalanced brackets rule out "[...]"; a "]}" ends the strong quote early.
  const md = '# Title\n\n```text\na ] b ]} c\n```\n\nAfter.';
  const ast = convertToAst(md);
  assert.deepStrictEqual(ast, [
    { type: 'heading', level: 1, content: ['Title'] },
    { type: 'paragraph', content: ['After.'] },
  ]);
  const result = convertMarkdownToAtDoc(md);
  assert.ok(result.ok);
  assert.ok(result.notes.some((n) => n.includes('skipped')));
});

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

test('GFM table', () => {
  const ast = convertToAst('| A | B |\n| - | - |\n| 1 | 2 |\n');
  assert.deepStrictEqual(ast, [
    {
      type: 'table',
      content: [],
      columns: [['A'], ['B']],
      rows: [[['1'], ['2']]],
    },
  ]);
});

test('table row with fewer cells than the header is padded, with a note', () => {
  const result = convertMarkdownToAtDoc('| A | B |\n| - | - |\n| 1 |\n');
  assert.ok(result.ok);
  assert.ok(result.notes.length > 0);
});

test('a comma inside a table cell switches that row to "|" (v0.1.2), not silently miscounted as a column', () => {
  const ast = convertToAst('| A | B |\n| - | - |\n| a, b | c |\n');
  assert.deepStrictEqual(ast, [
    {
      type: 'table',
      content: [],
      columns: [['A'], ['B']],
      rows: [[['a, b'], ['c']]],
    },
  ]);
});

test('a comma inside a single-column table cell is still refused — no second cell to place a "|" between', () => {
  convertFails('| A |\n| - |\n| 80,000 |\n', "row's only cell");
});

// ---------------------------------------------------------------------------
// Footnotes
// ---------------------------------------------------------------------------

test('numeric footnote label round-trips as-is', () => {
  // @defn is an inline node (Inline Spec) — at the document root it comes
  // back wrapped in the same implicit @paragraph any other root-level inline
  // content gets (Parser.ts's parseImplicitParagraph), same as @fn's ref.
  const ast = convertToAst('note[^1].\n\n[^1]: the text.');
  assert.deepStrictEqual(ast, [
    { type: 'paragraph', content: ['note', { type: 'fn', content: [], raw: '1', number: 1 }, '.'] },
    { type: 'paragraph', content: [{ type: 'defn', paren: '1', id: '1', content: ['the text.'] }] },
  ]);
});

test('non-numeric footnote labels are renumbered sequentially, consistently between ref and def', () => {
  const ast = convertToAst('a[^x] b[^y]\n\n[^y]: y text.\n[^x]: x text.');
  const paragraph = ast[0] as DocASTNode;
  const refs = paragraph.content.filter((n): n is DocASTNode => typeof n !== 'string' && n.type === 'fn');
  assert.deepStrictEqual(refs.map((r) => r.number), [1, 2]); // x seen first in the text, gets id 1
  // Both @defn nodes land in the *same* implicit root paragraph: @defn is
  // inline, so the blank line between them never starts a new top-level
  // block (Parser.ts's parseImplicitParagraph only breaks on a real one).
  const defnParagraph = ast[1] as DocASTNode;
  const defs = defnParagraph.content.filter((n): n is DocASTNode => typeof n !== 'string' && n.type === 'defn');
  assert.deepStrictEqual(defs.map((d) => d.id), ['2', '1']); // y def appears first in the source, keeps its own id
});

// ---------------------------------------------------------------------------
// Line breaks
// ---------------------------------------------------------------------------

test('trailing double space forces a hard break (@n)', () => {
  // The leading space on "two" isn't cosmetic slop — @n takes no brackets, so
  // without a non-identifier character between it and the next word, the
  // Lexer's maximal-munch identifier scan would fuse them into one unknown
  // "@ntwo" command and silently reparse as literal text instead of a break.
  const ast = convertToAst('one  \ntwo');
  assert.deepStrictEqual(ast, [{ type: 'paragraph', content: ['one', { type: 'n', content: [] }, ' two'] }]);
});

test('a single newline (soft break) joins as a space', () => {
  // Two adjacent plain-text array entries with nothing between them are not
  // distinguishable from one merged string once serialized — the Parser
  // always hands back maximally-merged text runs.
  const ast = convertToAst('one\ntwo');
  assert.deepStrictEqual(ast, [{ type: 'paragraph', content: ['one two'] }]);
});

// ---------------------------------------------------------------------------
// Refusals — constructs @Doc genuinely cannot represent safely
// ---------------------------------------------------------------------------

test('empty input is refused', () => {
  convertFails('   \n  ', 'no content');
});

test('an unbalanced bracket in plain text is refused, not silently corrupted', () => {
  convertFails('a stray closing bracket ] with no opener', 'unbalanced');
});

test('raw HTML is preserved as plain text with a call-out note', () => {
  const result = convertMarkdownToAtDoc('plain <b>bold</b> text');
  assert.ok(result.ok);
  assert.ok(result.notes.some((n) => n.includes('HTML')));
});

// ---------------------------------------------------------------------------
// Resilience — one bad block shouldn't cost the whole document
// ---------------------------------------------------------------------------

test('one unconvertible block is skipped with a note; the rest of the document still converts', () => {
  const md = '# Before\n\nOK paragraph.\n\na stray closing bracket ] with no opener\n\n# After';
  const ast = convertToAst(md);
  assert.deepStrictEqual(ast, [
    { type: 'heading', level: 1, content: ['Before'] },
    { type: 'paragraph', content: ['OK paragraph.'] },
    { type: 'heading', level: 1, content: ['After'] },
  ]);
  const result = convertMarkdownToAtDoc(md);
  assert.ok(result.ok);
  assert.ok(result.notes.some((n) => n.includes('skipped')));
});

console.log(`${passed} passed, ${failed} failed, ${passed + failed} total.`);
if (failed > 0) process.exit(1);
