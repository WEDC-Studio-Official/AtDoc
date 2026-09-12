// Serializer — the inverse of Lexer + Parser: turns a DocASTNode tree back
// into @Doc source text.
//
// Its contract is deliberately narrow:
//
//   For any `ast` produced by `parse()`, `parse(serialize(ast))` yields an
//   AST deep-equal to `ast` (ignoring `start`, which is a source offset and
//   necessarily changes when the text does).
//
// Note "deep-equal AST", not "identical text". The serializer normalizes:
// aliases resolve to canonical names (@h → @heading, since the AST never
// recorded which spelling the author used), an implicit paragraph may gain or
// lose its `@p[...]` wrapper, and incidental whitespace between structural
// children is dropped. What must survive is the tree.
//
// ## Why it can fail
//
// @Doc has no global escape for "[" and "]" — only "@@" for a literal "@",
// plus @raw's local "@]"/"@[" (Inline Spec §9). Balanced brackets in text need
// no escape (the Parser's parseSlotContent tracks depth and hands them back as
// literal "["/"]" segments), and a parser-produced AST can only ever contain
// balanced ones — parseSlotContent cannot return until depth is back to 0.
//
// A *hand-built* AST has no such guarantee. The Shorthand Engine turning the
// typed line `# foo]bar` into a heading is exactly that case, and there is no
// text that would parse back to it. Rather than emit something that silently
// reparses into a different tree, serialization reports failure and lets the
// caller decide (the Shorthand Engine's answer: leave the author's raw text
// alone). Hence the Result shape instead of a plain string return.

import { getNodeDef, getAllNodeDefs, isCellAllowedNode, deriveParenFields } from './registry';
import type { NodeDef, DerivedParenFields } from './registry';
import type { DocASTNode } from './types';

export type SerializeResult =
  | { ok: true; text: string }
  | { ok: false; reason: string };

/**
 * Where a node is going to sit. Serializing a node is not a property of the
 * node alone: `@tab` is only writable inside `@tabs`, nothing at all is
 * writable inside `@code`'s opaque slot, and text already in the document can
 * change how the node's own first character lexes.
 */
export type Placement =
  | { at: 'root' }
  | { at: 'slot'; parentType: string };

export interface NodeSerializationContext {
  placement: Placement;
  /**
   * The source text immediately before the insertion point, when the caller is
   * patching into an existing document rather than emitting a fresh one.
   *
   * Only the tail matters, and only one thing about it: a bare "@" there is a
   * literal "@" in the source, so appending a node's own "@" would form "@@"
   * and the node would vanish into a literal. serializeDocument() never hits
   * this because it escapes every "@" it writes; a text patch can't, because
   * it doesn't own the text before it.
   */
  precedingSource?: string;
}

/**
 * Thrown internally the moment a node is found to be unrepresentable, so the
 * recursive emit functions can stay `string`-returning instead of threading a
 * Result through every call site. Never escapes this module.
 */
class Unrepresentable extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'Unrepresentable';
  }
}

function bail(reason: string): never {
  throw new Unrepresentable(reason);
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

/**
 * Serializes a whole document (the array `parse()` returns).
 *
 * Deliberately permissive about structure: the Parser recovers from misplaced
 * nodes by recording a diagnostic and keeping them (Editor Mode), so a
 * document mid-edit legitimately contains a `@tab` outside `@tabs`. Refusing
 * to serialize that would make the serializer unusable on exactly the
 * documents the editor holds. Placement is checked at the serializeNode()
 * boundary instead, where the caller is *adding* something and wants the
 * guarantee.
 */
export function serializeDocument(ast: readonly DocASTNode[]): SerializeResult {
  try {
    return { ok: true, text: emitRoot(ast) };
  } catch (err) {
    if (err instanceof Unrepresentable) return { ok: false, reason: err.message };
    throw err;
  }
}

/**
 * Serializes one node for insertion at a known position.
 *
 * The context is required rather than optional because every caller has one,
 * and the failures it prevents are silent: text that parses cleanly into a
 * *different* tree than the caller intended. It does not produce a source
 * patch — see serializeInsertion() below for why that needs more than the AST.
 *
 * Note that an inline node placed `{ at: 'root' }` comes back wrapped in an
 * implicit paragraph on reparse (parseImplicitParagraph), which is legal and
 * intended but means the caller's candidate tree must expect the wrapper.
 * That is what the parse-and-compare step of an atomic commit is for.
 */
export function serializeNode(node: DocASTNode, context: NodeSerializationContext): SerializeResult {
  try {
    checkPlacement(node, context.placement);
    checkPrecedingSource(node, context.precedingSource);
    return { ok: true, text: emitNode(node) };
  } catch (err) {
    if (err instanceof Unrepresentable) return { ok: false, reason: err.message };
    throw err;
  }
}

/**
 * Normalizes a hand-built node into the shape `parse()` would have produced —
 * filling in whichever of `paren` / `level` / `title` / … the caller left out,
 * and refusing when the two halves contradict each other.
 *
 * Needed by the atomic-commit flow, not just internally: after serializing a
 * candidate tree and reparsing it, the reparsed nodes are canonical and the
 * hand-built candidates are not, so comparing them directly reports a
 * difference that isn't one. Compare against this instead.
 *
 * Shallow — it normalizes `node` itself, not its children.
 */
export function canonicalizeNode(node: DocASTNode): { ok: true; node: DocASTNode } | { ok: false; reason: string } {
  const nodeDef = getNodeDef(node.type);
  if (!nodeDef) return { ok: false, reason: `Unknown node type "${node.type}" — not in the registry.` };
  try {
    return { ok: true, node: canonicalize(node, nodeDef) };
  } catch (err) {
    if (err instanceof Unrepresentable) return { ok: false, reason: err.message };
    throw err;
  }
}

/**
 * Checks a hand-built node against everything the Serializer would enforce,
 * without producing text — for validating a candidate node before it is spliced
 * into a document copy.
 */
export function validateSerializableNode(
  node: DocASTNode,
  context: NodeSerializationContext,
): { ok: true } | { ok: false; reason: string } {
  const result = serializeNode(node, context);
  return result.ok ? { ok: true } : result;
}

// serializeInsertion(document, { parentPath, index, node }) -> SourcePatch
// is the third level this module still owes its callers: the one that returns
// a minimal text edit rather than a standalone string, so an editor keeps its
// cursor position and undo granularity.
//
// It cannot be written against the current AST. A patch needs the character
// range it replaces, and the AST records `start` only on top-level nodes
// (Parser.ts sets it in exactly two places) and `end` nowhere at all. The
// options are to add `end` to every node during parsing — the Lexer's tokens
// already carry both offsets, so this is cheap — or to pass the source text
// alongside the AST, or to give up on minimal patches and re-serialize the
// whole document. The first two are complementary: offsets make the patch
// minimal, and the source text is what checkPrecedingSource() below needs to
// inspect. Left unimplemented rather than approximated, since a patch applied
// at the wrong offset corrupts the document silently.

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

/** Content modes whose slot the Lexer scans opaquely — no node can live inside one. */
const OPAQUE_MODES = new Set(['raw', 'raw-escaped', 'key', 'integer']);

function checkPlacement(node: DocASTNode, placement: Placement): void {
  const nodeDef = getNodeDef(node.type);
  if (!nodeDef) return; // emitNode reports the unknown type with a better message

  if (placement.at === 'root') {
    if (nodeDef.restrictedTo) {
      bail(`\`@${nodeDef.name}\` may only appear directly inside \`@${nodeDef.restrictedTo}\`, not at the document root.`);
    }
    return;
  }

  const parentDef = getNodeDef(placement.parentType);
  if (!parentDef) {
    bail(`Unknown parent type "${placement.parentType}" — not in the registry.`);
  }
  if (nodeDef.restrictedTo && nodeDef.restrictedTo !== parentDef.name) {
    bail(`\`@${nodeDef.name}\` may only appear directly inside \`@${nodeDef.restrictedTo}\`, not inside \`@${parentDef.name}\`.`);
  }

  // What the parent's own content grammar admits.
  if (parentDef.content === 'none') {
    bail(`\`@${parentDef.name}\` takes no content slot, so nothing can be placed inside it.`);
  }
  if (OPAQUE_MODES.has(parentDef.content)) {
    bail(`\`@${parentDef.name}\`'s content is scanned opaquely, so \`@${nodeDef.name}\` would be written back as literal text, not a node.`);
  }
  if (parentDef.content === 'table' && nodeDef.name !== 'cols' && nodeDef.name !== 'data') {
    bail(`\`@table\` holds only \`@cols\` and \`@data\`.`);
  }
  if (parentDef.content === 'tabs' && nodeDef.name !== 'tab') {
    bail(`\`@tabs\` holds only \`@tab\` children.`);
  }
  if ((parentDef.content === 'comma-list' || parentDef.content === 'rows') && !isCellAllowedNode(nodeDef.name)) {
    bail(`\`@${nodeDef.name}\` isn't allowed inside a \`@${parentDef.name}\` cell — the Parser drops it with a diagnostic.`);
  }
  if (parentDef.content === 'meta' && nodeDef.name !== 'n' && nodeDef.name !== 'raw') {
    bail(`\`@meta\` holds key = value lines, not \`@${nodeDef.name}\`.`);
  }
}

/**
 * A run of "@" at the end of the preceding source pairs off into literal "@"s
 * (Inline Spec §2 step 1). An odd-length run leaves one unpaired, which would
 * pair with the node's own leading "@" and swallow it.
 */
function checkPrecedingSource(node: DocASTNode, precedingSource: string | undefined): void {
  if (precedingSource === undefined) return;
  const trailingAts = /@*$/.exec(precedingSource)?.[0].length ?? 0;
  if (trailingAts % 2 === 1) {
    bail(
      `The source immediately before the insertion point ends in an unpaired "@", which would pair with \`@${node.type}\`'s own "@" `
      + `and read the node as literal text. The preceding "@" has to be escaped to "@@" in the same edit.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Text escaping
// ---------------------------------------------------------------------------

/**
 * Every "@" becomes "@@" (Inline Spec §2 step 1 resolves that back to a
 * literal "@" before any registry lookup, so it is always safe).
 *
 * Escaping unconditionally rather than only where the "@" would be misread as
 * a command looks heavy-handed — `user@example.com` becomes
 * `user@@example.com` — but selective escaping has a boundary case that bites:
 * a text segment ending in "@" followed by a sibling node emits `a@` + `@bold[x]`
 * = `a@@bold[x]`, where the "@@" is consumed first and the node disappears.
 * Deciding correctly requires looking at the concatenated output rather than
 * each segment alone, which is not worth the readability it buys back.
 */
function escapeAt(text: string): string {
  return text.replace(/@/g, '@@');
}

/**
 * Encodes text for @raw's opaque domain, which has real "[" / "]" escapes
 * (Inline Spec §9) and is therefore the one content mode that can represent
 * anything. Mirrors scanDepthRaw's `localEscape` branch in reverse, longest
 * pattern first, so a literal "@]" in the content round-trips as "@@]".
 */
function escapeRawEscaped(text: string): string {
  // A "@" sitting directly before a bracket has to be written as the
  // three-character "@@[" / "@@]" form, and that form *consumes* its bracket
  // instead of counting it toward depth. So the moment one appears, depth
  // counting can no longer carry any of the other brackets either, and all of
  // them need escaping. Rare enough that a finer analysis isn't worth it.
  const bare = /@[[\]]/.test(text) ? new Set<number>() : matchedBracketPositions(text);

  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '@' && (next === '[' || next === ']')) {
      out += `@@${next}`;
      i++;
      continue;
    }
    if ((ch === '[' || ch === ']') && !bare.has(i)) {
      out += `@${ch}`;
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Positions of the brackets that pair up.
 *
 * scanDepthRaw terminates on depth, not on the first "]", so a matched pair
 * round-trips verbatim — Inline Spec §9 is explicit that balanced brackets
 * need no escape at all ("只要方括號成對，可以直接照抄"). Escaping them anyway
 * is correct but unreadable, and this content is source the author goes on to
 * read and edit: `arr[0]` should stay `arr[0]`, not become `arr@[0@]`.
 */
function matchedBracketPositions(text: string): Set<number> {
  const matched = new Set<number>();
  const open: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '[') open.push(i);
    else if (text[i] === ']' && open.length > 0) {
      matched.add(open.pop()!);
      matched.add(i);
    }
  }
  return matched;
}

/**
 * Net bracket depth of a text run, and whether it ever dipped below its
 * starting level. Child nodes are skipped by the callers: a serialized node is
 * balanced by construction, so it contributes nothing to the surrounding
 * slot's depth.
 */
function bracketBalance(text: string): { depth: number; wentNegative: boolean } {
  let depth = 0;
  let wentNegative = false;
  for (const ch of text) {
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth < 0) wentNegative = true;
    }
  }
  return { depth, wentNegative };
}

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

/**
 * The "(...)" slot's text, or undefined for none.
 *
 * `DocASTNode` stores the slot twice — the raw `paren` text *and* the
 * convenience field its `parenRole` implies (`level`, `title`, `uri`,
 * `imgOptions`, …) — and only the Parser's discipline keeps the two in step.
 * A hand-built node has no such discipline, so the two forms are reconciled
 * here before either is trusted:
 *
 *   - both present and consistent  → the raw text wins (it is what the author
 *     actually wrote, and re-deriving it can lose detail: `@h(7)` clamps to
 *     level 1, but "7" is what the document says)
 *   - both present and conflicting → refused, because there is no basis for
 *     picking one; `{ paren: '2', level: 5 }` is a bug in the caller
 *   - only the convenience field   → the raw text is reconstructed from it,
 *     which is the Shorthand Engine's normal shape
 */
function emitParen(node: DocASTNode, nodeDef: NodeDef): string | undefined {
  const value = node.paren;
  if (value === undefined) return undefined;
  // The Lexer closes the slot at the first ")" (indexOf), and the grammar
  // excludes ")" from the inner char set, so a value containing one cannot be
  // written back.
  if (value.includes(')')) {
    bail(`\`@${node.type}\`'s (${nodeDef.parenRole ?? 'value'}) contains ")", which has no escape.`);
  }
  return `(${value})`;
}

/**
 * Normalizes a node into the shape the Parser would have produced.
 *
 * A missing convenience field is *not* a disagreement — it is un-normalized
 * information, and filling it in is the whole point. `{ type: 'list', paren:
 * 'ordered' }` is exactly what a caller building nodes by hand writes, and the
 * `ordered: true` flag is derivable from the text it already gave us. Only an
 * explicit contradiction (`ordered: false` alongside `(ordered)`) has no basis
 * for repair, because both halves are things the caller deliberately said.
 *
 * Distinguishing the two requires not collapsing `undefined` into `false`
 * along the way, which is why the ordered branch is spelled out rather than
 * folded into the generic comparison below.
 */
function canonicalize(node: DocASTNode, nodeDef: NodeDef): DocASTNode {
  const paren = node.paren ?? derivedParen(node, nodeDef);
  const derived = deriveParenFields(nodeDef.parenRole, paren);

  const conflict = (field: string, expected: unknown, actual: unknown): never =>
    bail(
      `\`@${nodeDef.name}\`'s (${paren}) implies ${field} ${JSON.stringify(expected)}, `
      + `but the node explicitly carries ${JSON.stringify(actual)} — the two can't both be right.`,
    );

  const out: DocASTNode = { ...node };
  if (paren !== undefined) out.paren = paren;

  for (const [field, implied] of Object.entries(derived) as [keyof DerivedParenFields, unknown][]) {
    const actual = node[field];
    if (actual !== undefined && !sameDerivedValue(actual, implied)) {
      conflict(field, implied, actual);
    }
    (out as unknown as Record<string, unknown>)[field] = implied;
  }

  // `ordered` is the one field the Parser leaves off entirely when false, so
  // it never appears in `derived` to be reconciled above. An explicit `true`
  // without the paren to back it is a contradiction; an explicit `false` is
  // just noise, and canonical form drops the key.
  if (nodeDef.parenRole === 'ordered' && derived.ordered === undefined) {
    if (node.ordered === true) conflict('ordered', false, true);
    delete out.ordered;
  }

  return out;
}

function sameDerivedValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // imgOptions — the only derived field that isn't a primitive.
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    return [...keys].every(k => left[k] === right[k]);
  }
  return false;
}

function derivedParen(node: DocASTNode, nodeDef: NodeDef): string | undefined {
  switch (nodeDef.parenRole) {
    case 'level':
      // clampLevel() defaults a missing paren to 1, so level 1 is exactly what
      // "no paren" already means — emitting "(1)" would add a slot the source
      // never had.
      return node.level !== undefined && node.level !== 1 ? String(node.level) : undefined;
    case 'ordered':
      return node.ordered ? 'ordered' : undefined;
    case 'title': return node.title;
    case 'language': return node.language;
    case 'uri': return node.uri;
    case 'id': return node.id;
    case 'options':
      if (!node.imgOptions) return undefined;
      return Object.entries(node.imgOptions).map(([k, v]) => `${k}=${v}`).join(', ');
    default:
      return undefined;
  }
}

/**
 * The "{styles}" slot's text, or undefined for none.
 *
 * The same two-representations problem as emitParen: @color/@bordered take a
 * single swatch value into `color`, every other styled node takes a comma list
 * into `styles`, and the Parser sets exactly one of them (see its
 * isColorSwatch). A node carrying the wrong one — or both — is a shape the
 * Parser would never produce, so it is refused rather than guessed at.
 */
function emitStyles(node: DocASTNode, nodeDef: NodeDef): string | undefined {
  const isColorSwatch = nodeDef.name === 'color' || nodeDef.name === 'bordered';

  if (node.color !== undefined && node.styles !== undefined) {
    bail(`\`@${nodeDef.name}\` carries both \`color\` and \`styles\`; the Parser sets exactly one.`);
  }
  if (isColorSwatch && node.styles !== undefined) {
    bail(`\`@${nodeDef.name}\` takes a single swatch value in \`color\`, not a \`styles\` list.`);
  }
  if (!isColorSwatch && node.color !== undefined) {
    bail(`\`@${nodeDef.name}\` takes a \`styles\` list, not the single-swatch \`color\` field.`);
  }

  const values = node.color !== undefined ? [node.color] : node.styles;
  if (values === undefined) return undefined;

  for (const value of values) {
    // scanStylesEnd() terminates the run at "}", "\n" or "[", and the Parser
    // splits on "," — any of those inside a value would come back as a
    // different token list.
    const bad = ['}', '\n', '[', ','].find(c => value.includes(c));
    if (bad !== undefined) {
      const shown = bad === '\n' ? '\\n' : bad;
      bail(`\`@${node.type}\`'s {styles} value ${JSON.stringify(value)} contains "${shown}", which would end or split the slot.`);
    }
  }
  // An empty array is not the same as no slot at all: `@mark{}[x]` parses to
  // `styles: []`, and dropping the braces would parse back to no `styles` key.
  return `{${values.join(',')}}`;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

/**
 * Emits a mixed text/node run and asserts it can survive being wrapped in
 * "[...]". Balanced literal brackets are fine and need no escape; anything
 * unbalanced would re-lex as a slot boundary and is refused.
 */
function emitSlot(node: DocASTNode, parts: readonly (DocASTNode | string)[]): string {
  const text = emitRun(parts, node.type);
  const textOnly = parts.filter((p): p is string => typeof p === 'string').join('');
  const { depth, wentNegative } = bracketBalance(textOnly);
  if (wentNegative || depth !== 0) {
    bail(`\`@${node.type}\`'s content has an unbalanced "[" or "]" in its text, and @Doc has no escape for either outside \`@raw\`.`);
  }
  return `[${text}]`;
}

/**
 * True when `text` ends with a bare `@command` — no slot after it. Only a node
 * emission can produce one; escaped text can't, because escapeAt() turns every
 * "@" into "@@", and the Lexer resolves that to a literal before it ever looks
 * for a command name.
 */
const BARE_COMMAND_TAIL = /@[a-zA-Z0-9_-]+$/;

/** Characters the Lexer's maximal-munch identifier scan would absorb (mirrors Lexer.ts's IDENT_CHAR). */
const ABSORBED_INTO_COMMAND = /^[a-zA-Z0-9_-]/;

/** Mirrors Parser.ts's isTopLevelBlock — the nodes that terminate an implicit paragraph. */
function isTopLevelBlock(type: string): boolean {
  const nodeDef = getNodeDef(type);
  return !!nodeDef && (nodeDef.kind === 'block' || nodeDef.kind === 'meta') && !nodeDef.restrictedTo;
}

/** Emits a mixed text/node run with no wrapping or balance requirement. */
function emitRun(parts: readonly (DocASTNode | string)[], ownerType: string): string {
  let out = '';
  // Whether the last thing appended was a node that ended in a bare command
  // name — i.e. a void node (@hr, @n) with no "(...)" or "{...}" after it.
  let openCommandName = false;

  for (const part of parts) {
    if (typeof part !== 'string') {
      const emitted = emitNode(part);
      out += emitted;
      openCommandName = BARE_COMMAND_TAIL.test(emitted);
      continue;
    }
    if (openCommandName && part.length > 0) {
      // The Lexer reads a command name by maximal munch and only then looks it
      // up, so `@hr` followed directly by "Please" scans as `@hrPlease`, finds
      // nothing in the registry, and degrades the whole thing to literal text —
      // the node is destroyed, silently.
      if (ABSORBED_INTO_COMMAND.test(part)) {
        bail(
          `Text starting with ${JSON.stringify(part[0])} directly after \`@${ownerType}\`'s void child would extend that node's name `
          + `(the Lexer reads the name by maximal munch), leaving an unknown command that degrades to literal text.`,
        );
      }
      // Same idea one step later: the slot scan runs immediately after *any*
      // command name, including void ones that take no slot.
      if (part.startsWith('(') || part.startsWith('{')) {
        bail(`Text starting with "${part[0]}" directly after \`@${ownerType}\`'s void child would be read as that node's slot, and neither bracket has an escape.`);
      }
    }
    out += escapeAt(part);
    openCommandName = false;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

/**
 * Document root. Unlike a node's "[...]", the root has no closing bracket to
 * defend, so `parseImplicitParagraph` accepts stray brackets there — which is
 * also the only way a parser AST ever holds unbalanced ones. Emitting a
 * top-level paragraph bare (no `@p[...]`) keeps that property, and costs
 * nothing: bare text at the root parses back into a paragraph either way.
 *
 * Three cases still need the explicit wrapper, because bare text cannot
 * express them:
 *
 *  - an empty paragraph (dropped by the `hasContent` check in parse());
 *  - a paragraph directly after another bare one (they would merge into a
 *    single implicit paragraph on the way back in);
 *  - a paragraph after a node that ended in a bare command name — `@hr`
 *    followed by bare "Please use x" scans as the command `@hrPlease`, which
 *    isn't registered, so the Lexer degrades the whole run to literal text and
 *    the `@hr` is destroyed. Here the wrapper is a genuine repair rather than
 *    a refusal: `@hr@paragraph[...]` re-lexes correctly, because "@" is not an
 *    identifier character and so terminates the name scan;
 *  - a paragraph holding a top-level block child. `parseImplicitParagraph`
 *    stops at the first such node, so a bare `@img(...)[alt]` that came from
 *    inside a paragraph reparses as a *sibling* of it, and the paragraph
 *    boundary is lost. Block-inside-paragraph is normal in imported Markdown,
 *    where an image sits mid-sentence.
 */
function emitRoot(ast: readonly DocASTNode[]): string {
  const chunks: string[] = [];
  let prevWasBareParagraph = false;

  for (const node of ast) {
    if (node.type === 'paragraph') {
      const hasContent = node.content.some(c => typeof c !== 'string' || c.trim() !== '');
      const previous = chunks[chunks.length - 1] ?? '';
      const wouldFuse = BARE_COMMAND_TAIL.test(previous);
      const wouldSplit = node.content.some(c => typeof c !== 'string' && isTopLevelBlock(c.type));
      // parse() skips whitespace-only TEXT tokens at the root before it starts
      // an implicit paragraph, so leading blank text would simply vanish.
      const first = node.content[0];
      const wouldLoseLeadingSpace = typeof first === 'string' && first.trim() === '';
      if (hasContent && !prevWasBareParagraph && !wouldFuse && !wouldSplit && !wouldLoseLeadingSpace) {
        chunks.push(emitRun(node.content, 'paragraph'));
        prevWasBareParagraph = true;
        continue;
      }
    }
    chunks.push(emitNode(node));
    prevWasBareParagraph = false;
  }

  return chunks.join('');
}

function emitNode(node: DocASTNode): string {
  // Synthetic, built by Parser.buildListItems rather than written by an
  // author — it has no @command of its own and is only reachable through
  // @list, which renders its items itself.
  if (node.type === 'list-item') {
    bail('`list-item` has no source form of its own — serialize the enclosing `@list` instead.');
  }

  const nodeDef = getNodeDef(node.type);
  if (!nodeDef) {
    bail(`Unknown node type "${node.type}" — not in the registry.`);
  }

  // Everything downstream reads the canonical form, so the emitters never have
  // to ask "is this the raw slot or the derived field" a second time.
  const canonical = canonicalize(node, nodeDef);
  const head = `@${nodeDef.name}${emitParen(canonical, nodeDef) ?? ''}${emitStyles(canonical, nodeDef) ?? ''}`;
  return head + emitContentByMode(canonical, nodeDef);
}

function emitContentByMode(node: DocASTNode, nodeDef: NodeDef): string {
  switch (nodeDef.content) {
    case 'none':
      return '';

    case 'raw': {
      // @code/@mermaid/@svg define no escape mechanism at all (Inline Spec §9
      // is explicit that @raw's exceptions do not extend to them), and
      // scanDepthRaw still tracks depth — so the content must already be
      // balanced for the "[...]" form. When it isn't, the strong quote takes
      // over: it terminates on "]}" and reads everything else verbatim.
      const raw = node.raw ?? '';
      const { depth, wentNegative } = bracketBalance(raw);
      if (!wentNegative && depth === 0) return `[${raw}]`;
      if (!raw.includes(']}')) return `{[${raw}]}`;
      bail(
        `\`@${node.type}\`'s raw content has an unbalanced "[" or "]" and also contains "]}", `
        + `so neither the "[...]" form (which counts depth) nor the strong quote "{[...]}" (which ends at "]}") can hold it.`,
      );
    }

    case 'raw-escaped': {
      const raw = node.raw ?? '';
      // A trailing "@" is the one thing the escaped form cannot encode:
      // scanDepthRaw checks the escape sequences before the closer, so the
      // emitted "@" fuses with the closing "]" into the "@]" escape and the
      // slot never ends there. (Doubling it doesn't help — "@@]" is itself the
      // escape for a literal "@]".) The strong quote has no escapes for it to
      // fuse with, so it can hold what this form can't.
      //
      // Everything else keeps the escaped form: @raw's escapes already handle
      // unbalanced brackets, and `@raw[a@]b]` reads better than `@raw{[a]b]}`
      // for the inline code this node usually carries.
      if (raw.endsWith('@')) {
        if (!raw.includes(']}')) return `{[${raw}]}`;
        bail(`\`@${node.type}\`'s content ends with "@" and contains "]}", so neither form can hold it: the "@" would fuse with the closing "]", and the strong quote would end early.`);
      }
      return `[${escapeRawEscaped(raw)}]`;
    }

    case 'key': {
      // scanFlatRaw stops dead at the first "]" — no nesting, no escapes.
      const raw = node.raw ?? '';
      if (raw.includes(']')) {
        bail(`\`@${node.type}\`'s content contains "]", which ends the slot and has no escape here.`);
      }
      return `[${raw}]`;
    }

    case 'integer': {
      // `raw` and `number` are the same value twice over; the Parser only sets
      // `number` once `raw` has passed the digits check.
      if (node.raw !== undefined && node.number !== undefined && String(node.number) !== node.raw) {
        bail(`\`@${node.type}\` carries raw ${JSON.stringify(node.raw)} but number ${node.number}.`);
      }
      const raw = node.raw ?? (node.number !== undefined ? String(node.number) : '');
      if (!/^[0-9]*$/.test(raw)) {
        bail(`\`@${node.type}[...]\` must contain only digits — got ${JSON.stringify(raw)}.`);
      }
      return `[${raw}]`;
    }

    case 'comma-list':
      return `[${emitCells(node, node.columns ?? [])}]`;

    case 'rows':
      return `[${(node.rows ?? []).map(row => `[${emitCells(node, row)}]`).join('')}]`;

    case 'table':
      // @cols/@data are flattened onto the table node at parse time, so they
      // have to be rebuilt here rather than recursed into.
      return `[@cols[${emitCells(node, node.columns ?? [])}]`
        + `@data[${(node.rows ?? []).map(row => `[${emitCells(node, row)}]`).join('')}]]`;

    case 'tabs':
      return `[${(node.tabs ?? []).map(emitNode).join('')}]`;

    case 'meta':
      return `[\n${Object.entries(node.meta ?? {}).map(([k, v]) => emitMetaLine(node, k, v)).join('\n')}\n]`;

    case 'generic':
    default:
      return node.type === 'list'
        ? emitListItems(node)
        : emitSlot(node, node.content);
  }
}

/**
 * @cols / @data cells. The Parser splits cell text on "," at bracket depth 0,
 * so a comma inside a cell's own text would silently become a column break.
 */
function emitCells(owner: DocASTNode, cells: readonly (DocASTNode | string)[][]): string {
  return cells
    .map(cell => {
      const text = emitRun(cell, owner.type);
      const textOnly = cell.filter((p): p is string => typeof p === 'string').join('');
      const { depth, wentNegative } = bracketBalance(textOnly);
      if (wentNegative || depth !== 0) {
        bail(`A \`@${owner.type}\` cell has an unbalanced "[" or "]" in its text.`);
      }
      if (textOnly.includes(',')) {
        bail(`A \`@${owner.type}\` cell contains ",", which the parser reads as a cell separator.`);
      }
      return text;
    })
    .join(',');
}

function emitMetaLine(node: DocASTNode, key: string, value: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
    bail(`\`@meta\` key ${JSON.stringify(key)} isn't a bare identifier, so it wouldn't parse back.`);
  }
  if (value.includes('\n')) {
    bail(`\`@meta\` value for "${key}" contains a newline, and each entry must fit one line.`);
  }
  // @meta's slot goes through the ordinary Lexer path (it is not raw-family),
  // so a bare "@" in a value would be re-read as a command; collectRawText
  // hands "@@" back as a literal "@".
  const escaped = escapeAt(value);
  const { depth, wentNegative } = bracketBalance(escaped);
  if (wentNegative || depth !== 0) {
    bail(`\`@meta\` value for "${key}" has an unbalanced "[" or "]".`);
  }
  return `${key} = ${escaped}`;
}

/**
 * @list's items, one per line — the shape Parser.buildListItems expects.
 *
 * Two details it enforces on the way back out:
 *
 *  - buildListItems strips an optional leading "- " or "N. " from each item.
 *    An item whose own text happens to start that way therefore needs a
 *    prefix added, or the strip would eat it. `marker` (from "N. ") is
 *    re-emitted for the same reason plus its own: @list(ordered) uses it for
 *    `<li value>`.
 *  - A nested @list is folded into the previous item only when it sits alone
 *    on its line, so it is emitted on one of its own.
 */
function emitListItems(node: DocASTNode): string {
  const DASH_RE = /^[ \t]*-[ \t]+/;
  const NUM_RE = /^[ \t]*\d+[.)][ \t]+/;

  const lines: string[] = [];

  for (const item of node.content) {
    if (typeof item === 'string') {
      if (item.trim() === '') continue; // blank filler between items
      bail('`@list`\'s content holds loose text — expected only `list-item` nodes from the parser.');
    }
    if (item.type !== 'list-item') {
      bail(`\`@list\` contains a "${item.type}" node directly; only \`list-item\` is expected.`);
    }

    // A trailing nested list belongs on its own line to be re-folded here.
    const parts = item.content.slice();
    const nested: DocASTNode[] = [];
    while (parts.length > 0) {
      const last = parts[parts.length - 1];
      if (typeof last === 'string' && last.trim() === '') { parts.pop(); continue; }
      if (typeof last !== 'string' && last.type === 'list') { nested.unshift(parts.pop() as DocASTNode); continue; }
      break;
    }

    let text = emitRun(parts, 'list');
    if (text.includes('\n')) {
      bail('A `@list` item spans multiple lines, which would split it into separate items.');
    }
    const { depth, wentNegative } = bracketBalance(
      parts.filter((p): p is string => typeof p === 'string').join(''),
    );
    if (wentNegative || depth !== 0) {
      bail('A `@list` item has an unbalanced "[" or "]" in its text.');
    }

    if (item.marker !== undefined) {
      text = `${item.marker}. ${text}`;
    } else if (DASH_RE.test(text) || NUM_RE.test(text)) {
      // Would be stripped as a list marker on re-parse — shield it with one.
      text = `- ${text}`;
    }

    lines.push(text);
    for (const sub of nested) lines.push(emitNode(sub));
  }

  return `[${lines.join('\n')}]`;
}

/**
 * Every registry node whose grammar the serializer knows how to write back.
 * Exported for the round-trip test, so a new `ContentMode` added to
 * registry.ts fails loudly here instead of silently serializing to "".
 */
export function unsupportedContentModes(): string[] {
  const handled = new Set([
    'none', 'generic', 'raw', 'raw-escaped', 'key', 'integer',
    'comma-list', 'rows', 'table', 'tabs', 'meta',
  ]);
  return [...new Set(getAllNodeDefs().map(d => d.content))].filter(m => !handled.has(m));
}
