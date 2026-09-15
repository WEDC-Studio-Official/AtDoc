// Shared serializer round-trip corpus.
//
// THIS FILE MUST BE BYTE-IDENTICAL IN BOTH REPOSITORIES:
//   AtDoc      tests/fixtures/roundtrip-cases.ts
//   Web        apps/atdoc/tests/fixtures/roundtrip-cases.ts
//
// The two repos carry hand-synced copies of the language core, and their
// Parsers differ on purpose — AtDoc's throws DocSyntaxError on the first
// problem (Strict Mode), Web's collects diagnostics and recovers (Editor
// Mode). A corpus that lives in only one of them proves the round-trip
// property for that repo's dialect and nothing more, which is how the
// `ordered: false` divergence went unnoticed: both Parsers rendered lists
// identically, and only an AST-equality test could have caught it.
//
// So: every case here must be *strictly valid* @Doc, accepted by both modes
// without a diagnostic. Cases that exercise Editor Mode's recovery belong in
// the Web-side test file, not here.
//
// (The real fix is a shared @atdoc/core package. Until that exists, keeping
// this file identical by hand is the cheapest thing that actually detects
// dialect drift.)

export const ROUNDTRIP_CASES: Record<string, string> = {
  // content: 'meta'
  'meta block': '@meta[\ntitle = Hello World\nauthor = Kami\nversion = 1.0\n]',

  // content: 'none'
  'void nodes': '@hr',
  // The space after "@n" is load-bearing, not formatting. The Lexer reads a
  // command name by maximal munch, so "@nline" scans as the name "nline",
  // finds nothing in the registry, and the whole run degrades to literal text —
  // this case previously read "@p[line one@nline two]" and contained no @n
  // node at all, quietly testing nothing.
  'void node inline': '@p[line one@n line two]',
  'void node followed by a block': '@hr\nPlease use the other one.',

  // content: 'generic' — structural
  'heading with level': '@heading(2)[Section]',
  'heading default level': '@heading[Untitled]',
  'heading alias canonicalizes': '@h(3)[Via alias]',
  'explicit paragraph': '@p[A paragraph.]',
  'implicit paragraph': 'Just some loose text.',
  'adjacent paragraphs': '@p[first]@p[second]',
  'quote': '@quote[To be or not to be.]',
  'blocks separated by text': '@hr\nBetween the rules\n@hr',

  // content: 'generic' — inline formatting
  'inline formatting': '@p[@b[bold] @i[italic] @u[under] @del[struck]]',
  'semantic inline': '@p[H@sub[2]O and x@sup[2] and @kbd[Ctrl]]',
  'link': '@p[see @link(https://example.com/a?b=1)[the docs]]',
  'footnotes': '@p[claim@fn[1]] @defn(1)[the source]',
  'nested inline': '@p[@b[bold with @i[italic] inside]]',

  // {styles}
  'mark with styles': '@p[@mark{yellow}[highlighted]]',
  'color swatch': '@p[@color{#ff3366}[tinted]]',
  'bordered swatch': '@p[@bordered{blue}[outlined]]',
  'empty styles slot': '@p[@mark{}[no tokens]]',
  'card with title and styles': '@card(Notice){#123456,radius-12}[Card body]',
  'details': '@details(More){gray}[Hidden content]',

  // callouts
  'callouts': '@note(Heads up)[note body]@tip[tip body]@warning(Careful){red}[warn body]',

  // content: 'raw' / 'raw-escaped'
  'code block': '@code(ts)[const xs = [1, 2, 3];\nconsole.log(xs);]',
  'code without language': '@code[plain text]',
  'mermaid': '@mermaid[graph TD;\n  A-->B;]',
  'svg': '@svg[<circle cx="1" cy="1" r="1"/>]',
  'raw with escapes': '@p[@raw[a@]b@[c]]',
  'raw with literal at-escape': '@p[@raw[keep @@] verbatim]]',
  // Balanced brackets inside @raw need no escape — scanDepthRaw terminates on
  // depth, not on the first "]" (Inline Spec §9: "只要方括號成對，可以直接照
  // 抄"). Escaping them anyway round-trips but turns `arr[0]` into `arr@[0@]`,
  // and this is source the author reads and edits.
  'raw with balanced brackets stays verbatim': '@p[@raw[arr[0]] and @raw[obj["key"]]]',
  'raw with nested balanced brackets': '@p[@raw[x[[nested]]y]]',
  // Only the genuinely unmatched ones are escaped.
  'raw with one unmatched bracket': '@p[@raw[a@]b] and @raw[c@[d]]',
  // A "@" directly before a bracket has to use the three-char form, which
  // consumes the bracket instead of counting it — so everything gets escaped.
  'raw with an at-sign fused to a bracket': '@p[@raw[a@[@@]b]]',

  // content: 'key' / 'integer'
  'kbd': '@p[@kbd[Ctrl+Shift+P]]',
  'fn reference': '@p[note@fn[42]]',

  // content: 'table' (flattens @cols/@data onto the table node)
  'table': '@table[@cols[Name,Size]@data[[atd,4KB][doc,12KB]]]',
  'table with formatted cells': '@table[@cols[@b[Name],Size]@data[[@i[atd],4KB]]]',
  // Inline code in a table cell — the shape of essentially every API table.
  // `@raw` was missing from the cell allow-list while it was only an escape
  // mechanism, so the node was dropped and its text dumped in as a bare
  // string: the cell still read correctly but lost its monospace, and the
  // stray split showed up as a round-trip difference.
  'table with inline code cells': '@table[@cols[Browser,ID]@data[[Chrome,@raw[chrome]][Edge,@raw[edge]]]]',
  'table cell mixing text and inline code': '@table[@cols[A,B]@data[[MDN @raw[browser-compat-data],x]]]',
  'table with empty cell': '@table[@cols[A,B]@data[[1,][,2]]]',

  // content: 'tabs'
  'tabs': '@tabs[@tab(First)[one]@tab(Second)[two]]',
  'tabs with whitespace': '@tabs[\n  @tab(First)[one]\n  @tab(Second)[two]\n]',

  // content: 'generic' with @list post-processing
  'bullet list': '@list[- alpha\n- beta\n- gamma]',
  'list without dashes': '@list[alpha\nbeta]',
  'ordered list': '@list(ordered)[1. first\n2. second]',
  'ordered list with jump': '@list(ordered)[1. first\n5. fifth]',
  'nested list': '@list[- outer\n@list[- inner]\n- after]',
  'list with inline nodes': '@list[- @b[bold] item\n- plain item]',
  'list with surrounding blank lines': '@list[\n- alpha\n- beta\n]',
  // The item's own text starts with what looks like a marker, so the emitted
  // form has to shield it or buildListItems strips it a second time.
  'list item starting with a dash': '@list[- - not a bullet\n- plain]',
  'list item starting with a number': '@list[- 3. not a marker\n- plain]',

  // @img
  'img with options and styles': '@img(src=/a.png, width=200, align=center){#ff0000,radius-8}[Alt text]',
  'img minimal': '@img(/a.png)[]',

  // Brackets and "@" in ordinary text
  'balanced brackets in text': '@p[array[0] and dict[key] both work]',
  'unbalanced bracket at root': 'a stray ] bracket at the root',
  'unbalanced open bracket at root': 'a stray [ bracket at the root',
  'literal at-sign': '@p[mail me at user@@example.com]',
  'at-sign before a command name': '@p[the @@code node]',
  'brackets around a node': '@p[[@b[wrapped]]]',
};

/**
 * Hand-built (non-parser-produced) nodes that must serialize to exactly this
 * text. Kept alongside the source corpus because the canonicalization rules
 * they pin down — fill an absent convenience field, refuse an explicit
 * contradiction — are the ones most likely to drift between copies.
 */
export const CANONICALIZATION_CASES: { name: string; node: unknown; text: string }[] = [
  { name: 'heading from `level` alone', node: { type: 'heading', level: 3, content: ['Title'] }, text: '@heading(3)[Title]' },
  { name: 'level-1 heading omits the paren', node: { type: 'heading', level: 1, content: ['Title'] }, text: '@heading[Title]' },
  { name: 'link from `uri` alone', node: { type: 'link', uri: 'https://a.b', content: ['text'] }, text: '@link(https://a.b)[text]' },
  { name: 'list from `paren` alone', node: { type: 'list', paren: 'ordered', content: [] }, text: '@list(ordered)[]' },
  { name: 'card from `paren` alone', node: { type: 'card', paren: 'Title', content: ['x'] }, text: '@card(Title)[x]' },
  { name: 'img from `paren` alone', node: { type: 'img', paren: 'src=/a.png', content: [] }, text: '@img(src=/a.png)[]' },
  { name: 'out-of-range level keeps its raw paren', node: { type: 'heading', paren: '7', level: 1, content: ['x'] }, text: '@heading(7)[x]' },
  // Strong quote — "{[" … "]}" reads verbatim to the first "]}", so it holds
  // content the depth-counting "[...]" form can't. @code and @mermaid define
  // no escapes at all, so before this they had no representation and had to be
  // degraded to an inline @raw, losing the language tag and the block layout.
  {
    // The line that actually defeats the depth form, straight out of the spec's
    // own EBNF: the "]" terminal is quoted before the "[" one, so depth goes
    // negative immediately.
    name: 'unbalanced brackets in @code use the strong quote',
    node: { type: 'code', language: 'ebnf', content: [], raw: 'raw-char =\n    any-unicode-char - "]" - "[" ;' },
    text: '@code(ebnf){[raw-char =\n    any-unicode-char - "]" - "[" ;]}',
  },
  {
    name: 'balanced brackets keep the plain form',
    node: { type: 'code', language: 'js', content: [], raw: 'const a = [1, 2];' },
    text: '@code(js)[const a = [1, 2];]',
  },
  {
    // @raw's escapes cannot encode a trailing "@" — it fuses with the closing
    // "]" into the "@]" escape. The strong quote has no escapes to fuse with.
    name: 'raw content ending in "@" uses the strong quote',
    node: { type: 'raw', content: [], raw: 'user@' },
    text: '@raw{[user@]}',
  },
];

/**
 * Hand-built *documents* — the array shape, not a single node — and the exact
 * text serializeDocument must produce.
 *
 * A separate group because emitRoot makes decisions no single-node case can
 * reach: whether a top-level paragraph may be written bare, and whether the
 * chunk before it would swallow it. Nor can ROUNDTRIP_CASES reach them, since
 * a parser-produced paragraph following a block always begins with the newline
 * that separated them in the source, and that newline is exactly what makes
 * the dangerous shapes safe. Only a program building nodes directly — the
 * Markdown importer — produces them.
 */
export const DOCUMENT_CASES: { name: string; ast: unknown[]; text: string }[] = [
  {
    // `@hr` + bare "Please" would scan as the command `@hrPlease`, which isn't
    // registered, so the Lexer degrades the whole run to literal text and the
    // rule is destroyed. The wrapper is the repair: "@" ends an identifier.
    name: 'paragraph after a void node keeps its wrapper',
    ast: [{ type: 'hr', content: [] }, { type: 'paragraph', content: ['Please use the other one.'] }],
    text: '@hr@paragraph[Please use the other one.]',
  },
  {
    // Nothing to fuse with, so the paragraph stays bare.
    name: 'paragraph after a slotted node stays bare',
    ast: [{ type: 'heading', level: 1, content: ['Title'] }, { type: 'paragraph', content: ['Body text.'] }],
    text: '@heading[Title]Body text.',
  },
  {
    // Two bare paragraphs would merge into one on the way back in.
    name: 'the second of two adjacent paragraphs keeps its wrapper',
    ast: [{ type: 'paragraph', content: ['first'] }, { type: 'paragraph', content: ['second'] }],
    text: 'first@paragraph[second]',
  },
];

/** Hand-built nodes the Serializer must refuse, with a fragment of the reason. */
export const REFUSAL_CASES: { name: string; node: unknown; reason: string }[] = [
  { name: 'unbalanced "]" in generic content', node: { type: 'heading', level: 1, content: ['foo]bar'] }, reason: 'unbalanced' },
  { name: 'unbalanced "[" in generic content', node: { type: 'paragraph', content: ['foo[bar'] }, reason: 'unbalanced' },
  // Unbalanced brackets in raw content are no longer a refusal — the strong
  // quote holds them (see CANONICALIZATION_CASES). Only content that defeats
  // *both* forms is refused: brackets that don't balance, plus a "]}" that
  // ends the strong quote early.
  {
    name: 'raw content that defeats both the depth form and the strong quote',
    node: { type: 'code', content: [], raw: 'a ] b ]} c' },
    reason: 'neither the "[...]" form',
  },
  { name: '"]" in @kbd, which has no escape', node: { type: 'kbd', content: [], raw: 'Ctrl+]' }, reason: 'no escape' },
  { name: '")" in a paren slot', node: { type: 'link', content: ['x'], uri: 'https://a.b/(c)' }, reason: '")"' },
  { name: '"}" in a styles value', node: { type: 'mark', content: ['x'], styles: ['yel}low'] }, reason: 'end or split' },
  { name: '"," in a styles value', node: { type: 'mark', content: ['x'], styles: ['a,b'] }, reason: 'end or split' },
  { name: 'non-digits in @fn', node: { type: 'fn', content: [], raw: '1a' }, reason: 'digits' },
  { name: 'unknown node type', node: { type: 'nonesuch', content: [] }, reason: 'not in the registry' },
  { name: 'bare list-item', node: { type: 'list-item', content: ['x'] }, reason: 'no source form' },
  { name: '`paren` and `level` disagree', node: { type: 'heading', paren: '2', level: 5, content: ['x'] }, reason: "can't both be right" },
  { name: '`paren` and `title` disagree', node: { type: 'card', paren: 'Real', title: 'Other', content: ['x'] }, reason: "can't both be right" },
  { name: '`paren` and `imgOptions` disagree', node: { type: 'img', paren: 'src=/a.png', imgOptions: { src: '/b.png' }, content: [] }, reason: "can't both be right" },
  { name: 'explicit `ordered: false` against (ordered)', node: { type: 'list', paren: 'ordered', ordered: false, content: [] }, reason: "can't both be right" },
  { name: '`ordered: true` with no paren to back it', node: { type: 'list', paren: 'nope', ordered: true, content: [] }, reason: "can't both be right" },
  { name: 'both `color` and `styles` set', node: { type: 'color', color: 'red', styles: ['red'], content: ['x'] }, reason: 'exactly one' },
  { name: 'a swatch node carrying `styles`', node: { type: 'bordered', styles: ['red'], content: ['x'] }, reason: 'not a `styles` list' },
  { name: 'a list-styled node carrying `color`', node: { type: 'mark', color: 'red', content: ['x'] }, reason: 'not the single-swatch' },
  { name: '@fn `raw` and `number` disagree', node: { type: 'fn', raw: '3', number: 7, content: [] }, reason: 'but number 7' },
  {
    // Inside a slot there is no wrapper to add — a void node followed directly
    // by identifier text simply has no source form.
    name: 'text fusing with a void node\'s name inside a slot',
    node: { type: 'paragraph', content: [{ type: 'n', content: [] }, 'line two'] },
    reason: "would extend that node's name",
  },
];
