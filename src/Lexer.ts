// Lexer — implements Inline Syntax Specification §2 (Lexer 行為定義) precisely:
//
//   1. "@@"                       → literal "@" (checked before any registry lookup)
//   2. "@" + known command name   → NODE token
//   3. "@" + anything else        → literal text
//
// It is registry-aware (see registry.ts) rather than a context-free tokenizer,
// because raw-content nodes (@code, @mermaid, @raw, @kbd, @fn) require the
// Lexer to switch into an opaque scan mode for their bracket content — see
// Inline Syntax Specification §9 (@raw Opaque Domain) and Special-Nodes.md §6.

import { getNodeDef } from './registry';
import type { ContentMode } from './registry';

export type TokenType = 'NODE' | 'PAREN' | 'STYLES' | 'SLOT_OPEN' | 'SLOT_CLOSE' | 'RAW' | 'TEXT';

export interface Token {
  type: TokenType;
  value: string;
  /** Source character offsets — lets consumers (e.g. editor diagnostics) map a token back to a range. */
  start: number;
  end: number;
  /** RAW tokens only — false if the scan ran out of input before finding the closing "]" (mid-typing, or a genuinely unterminated block). Lets consumers (e.g. the editor's completion provider) tell "caret still inside raw content" apart from "raw content already closed". */
  closed?: boolean;
  /** raw-escaped RAW tokens only — each local escape sequence the scan consumed ("@]", "@[", "@@]", "@@["), with its source range. Lets the Parser point an editor marker at the exact escape when one looks like it swallowed the intended closing bracket. */
  escapes?: RawEscape[];
}

/** One consumed local escape inside @raw's content — see scanDepthRaw. */
export interface RawEscape {
  start: number;
  end: number;
  /** The literal source characters, e.g. "@]" or "@@[". */
  seq: string;
  /** True when the next source character after the escape is a newline — the signature of an escape that consumed a "]" the author meant as the node's end-of-line closer (see Parser.diagnoseRawEscapes). */
  atLineEnd: boolean;
}

const IDENT_CHAR = /[a-zA-Z0-9_-]/;

/**
 * Scans a strong-quoted slot, starting just after the opening "{[".
 *
 * The content runs verbatim to the first "]}" — no bracket depth, no escapes,
 * nothing to get wrong. That is the whole point: the ordinary "[...]" form
 * terminates on depth, so content whose brackets don't balance cannot be
 * written at all in @code/@mermaid (which define no escapes) and needs
 * hand-escaping in @raw. Measured over 1,632 code fences in real READMEs, 2
 * had unbalanced brackets and 4 contained "]}", with no overlap — so the pair
 * that can't be written one way can always be written the other.
 *
 * A fixed terminator can still be defeated by content that contains "]}", the
 * same way any fixed delimiter can; that content keeps the "[...]" form.
 */
function scanStrongRaw(source: string, start: number): { text: string; endPos: number; closed: boolean } {
  const end = source.indexOf(']}', start);
  if (end === -1) return { text: source.slice(start), endPos: source.length, closed: false };
  return { text: source.slice(start, end), endPos: end + 2, closed: true };
}

function isRawFamily(mode: ContentMode): boolean {
  return mode === 'raw' || mode === 'raw-escaped' || mode === 'key' || mode === 'integer';
}

/**
 * Scans raw, unparsed content starting right after the opening "[".
 * Tracks nested "[" / "]" depth so literal brackets inside code/diagram
 * content don't prematurely terminate the slot (see Text-Formatting.md §4 Raw
 * and Widget-Blocks.md §4 Mermaid for why this matters in practice).
 *
 * `localEscape` enables @raw's four local exceptions (Inline Spec §9):
 *   "@]"  → literal "]"
 *   "@@]" → literal "@]"
 *   "@["  → literal "["
 *   "@@[" → literal "@["
 * These do NOT apply to @code/@mermaid, which define no escape mechanism at all.
 */
function scanDepthRaw(source: string, start: number, localEscape: boolean): { text: string; endPos: number; closed: boolean; escapes: RawEscape[] } {
  let depth = 1;
  let buf = '';
  let i = start;
  const n = source.length;
  const escapes: RawEscape[] = [];

  while (i < n) {
    if (localEscape && source[i] === '@' && source[i + 1] === '@' && source[i + 2] === ']') {
      escapes.push({ start: i, end: i + 3, seq: '@@]', atLineEnd: source[i + 3] === '\n' });
      buf += '@]';
      i += 3;
      continue;
    }
    if (localEscape && source[i] === '@' && source[i + 1] === '@' && source[i + 2] === '[') {
      escapes.push({ start: i, end: i + 3, seq: '@@[', atLineEnd: source[i + 3] === '\n' });
      buf += '@[';
      i += 3;
      continue;
    }
    if (localEscape && source[i] === '@' && source[i + 1] === ']') {
      escapes.push({ start: i, end: i + 2, seq: '@]', atLineEnd: source[i + 2] === '\n' });
      buf += ']';
      i += 2;
      continue;
    }
    if (localEscape && source[i] === '@' && source[i + 1] === '[') {
      escapes.push({ start: i, end: i + 2, seq: '@[', atLineEnd: source[i + 2] === '\n' });
      buf += '[';
      i += 2;
      continue;
    }

    const ch = source[i];
    if (ch === '[') {
      depth++;
      buf += ch;
      i++;
      continue;
    }
    if (ch === ']') {
      depth--;
      i++;
      if (depth === 0) return { text: buf, endPos: i, closed: true, escapes };
      buf += ch;
      continue;
    }
    buf += ch;
    i++;
  }

  // Ran out of input before depth reached 0 — genuinely unterminated (or, for
  // the editor's incremental re-tokenize of `textBeforeCaret`, just not typed
  // that far yet). See Token.closed.
  return { text: buf, endPos: i, closed: false, escapes };
}

/** Flat scan for @kbd's `key` and @fn's `integer` — no nesting, no escapes. */
function scanFlatRaw(source: string, start: number): { text: string; endPos: number; closed: boolean } {
  let i = start;
  const n = source.length;
  let buf = '';
  while (i < n && source[i] !== ']') {
    buf += source[i];
    i++;
  }
  if (i >= n) return { text: buf, endPos: i, closed: false }; // ran out before finding "]"
  return { text: buf, endPos: i + 1, closed: true };
}

function scanRawContent(source: string, start: number, mode: ContentMode): { text: string; endPos: number; closed: boolean; escapes?: RawEscape[] } {
  if (mode === 'key' || mode === 'integer') return scanFlatRaw(source, start);
  return scanDepthRaw(source, start, mode === 'raw-escaped');
}

/**
 * Finds where a "{styles}" run ends, scanning from just after the "{".
 * Returns the index of the terminator and whether it was a real "}".
 *
 * Deliberately stricter than the EBNF, which defines the inner set as
 * `text-char - "}"` and leaves `text-char = any-unicode-char` — i.e. a
 * {styles} run could technically span lines and swallow anything. Taken
 * literally, a half-typed "{" (`@h(4){` with the "}" not there yet) eats the
 * rest of the document up to whatever "}" appears next — a brace inside an
 * unrelated `@code` block, say — silently deleting every node in between
 * from the AST. Nothing legitimate needs that reach: a styles run is a short
 * comma-separated token list, no spec example spans lines, and the editor's
 * Monarch rule (/\{[^}]*\}/, matched per line) never supported it either.
 * So the scan stops at:
 *   "}"            — the real terminator (closed: true)
 *   end of line    — unterminated; the author is mid-typing
 *   "["            — unterminated; the content slot has started, and no
 *                    styles value ever contains "["
 * Both unterminated cases still produce a STYLES token so the Parser can
 * flag the slot itself (e.g. "@heading has no {styles} slot"), just one that
 * stops before it can damage the rest of the document.
 */
function scanStylesEnd(source: string, start: number): { end: number; closed: boolean } {
  const n = source.length;
  let i = start;
  while (i < n) {
    const ch = source[i];
    if (ch === '}') return { end: i, closed: true };
    if (ch === '\n' || ch === '[') return { end: i, closed: false };
    i++;
  }
  return { end: n, closed: false };
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const n = source.length;
  let i = 0;
  let textBuf = '';
  let textStart = -1;

  const appendText = (s: string, pos: number) => {
    if (textBuf === '') textStart = pos;
    textBuf += s;
  };

  const flushText = () => {
    if (textBuf) {
      tokens.push({ type: 'TEXT', value: textBuf, start: textStart, end: textStart + textBuf.length });
      textBuf = '';
      textStart = -1;
    }
  };

  while (i < n) {
    const ch = source[i];

    if (ch === '@') {
      // Step 1 (Inline Spec §2): "@@" is checked first, purely by pattern —
      // before any Command Registry lookup. See Special-Nodes.md §5.
      if (source[i + 1] === '@') {
        appendText('@', i);
        i += 2;
        continue;
      }

      const nodeStart = i;
      // Step 2: maximal-munch identifier, then registry lookup.
      let j = i + 1;
      while (j < n && IDENT_CHAR.test(source[j])) j++;
      const ident = source.slice(i + 1, j);
      const nodeDef = ident ? getNodeDef(ident) : undefined;

      if (!nodeDef) {
        // Step 3: unknown command → literal text (Inline Spec §6).
        appendText(source.slice(i, j), i);
        i = j;
        continue;
      }

      flushText();
      tokens.push({ type: 'NODE', value: ident, start: nodeStart, end: j });
      i = j;

      // Optional "(...)" and "{...}" — modifier/level/title/language/uri/id/
      // options, and styles respectively. Canonical order is (paren) before
      // {styles} (Block Syntax Specification §6/§7), but a swapped `{styles}
      // (title)` must still tokenize as STYLES then PAREN rather than let the
      // out-of-place "(" decay into literal TEXT — otherwise the Parser never
      // sees a PAREN token to flag with a specific "wrong order" error, and
      // authors just get a misleading "expects a content slot" instead.
      // Grammar excludes ")"/"}" from the inner text-char sets, so a naive
      // indexOf is faithful for "(...)" (no nesting is syntactically valid,
      // and Block Spec §5's @img example genuinely spans lines). "{...}" gets
      // the stricter scanStylesEnd() instead — see there for why.
      let sawParen = false;
      let sawStyles = false;
      while (!sawParen || !sawStyles) {
        if (!sawParen && source[i] === '(') {
          const parenStart = i;
          const close = source.indexOf(')', i + 1);
          const end = close === -1 ? n : close;
          const parenEnd = close === -1 ? n : close + 1;
          tokens.push({ type: 'PAREN', value: source.slice(i + 1, end), start: parenStart, end: parenEnd });
          i = parenEnd;
          sawParen = true;
        } else if (!sawStyles && source[i] === '{' && !(isRawFamily(nodeDef.content) && source[i + 1] === '[')) {
          // "{[" is the strong-quote content opener, not a styles slot — see
          // the content handling below. There's no ambiguity to resolve:
          // scanStylesEnd() already treats "[" as a terminator because no
          // styles value ever contains one, so "{[" could never have opened a
          // valid styles slot anyway.
          const stylesStart = i;
          const { end, closed } = scanStylesEnd(source, i + 1);
          const stylesEnd = closed ? end + 1 : end;
          tokens.push({ type: 'STYLES', value: source.slice(i + 1, end), start: stylesStart, end: stylesEnd });
          i = stylesEnd;
          sawStyles = true;
        } else {
          break;
        }
      }

      // Void nodes (@hr, @n) take no slot at all — see registry.ts content: 'none'.
      if (nodeDef.content === 'none') {
        continue;
      }

      // Strong quote: "{[" ... "]}" runs verbatim to the first "]}", with no
      // depth counting and no escapes at all. It exists because @code and
      // @mermaid define no escape mechanism (Inline Spec §9), so a fenced
      // block whose brackets don't balance — an EBNF grammar quoting "[" and
      // "]" as terminals, say — simply had no representation and had to be
      // degraded to an inline @raw, losing both its language tag and its block
      // rendering. Carrying no escapes, it also emits no escape notices.
      if (isRawFamily(nodeDef.content) && source[i] === '{' && source[i + 1] === '[') {
        const slotStart = i;
        const { text, endPos, closed } = scanStrongRaw(source, i + 2);
        tokens.push({ type: 'RAW', value: text, start: slotStart, end: endPos, closed });
        i = endPos;
      } else if (source[i] === '[') {
        if (isRawFamily(nodeDef.content)) {
          const slotStart = i;
          const { text, endPos, closed, escapes } = scanRawContent(source, i + 1, nodeDef.content);
          const rawTok: Token = { type: 'RAW', value: text, start: slotStart, end: endPos, closed };
          if (escapes && escapes.length > 0) rawTok.escapes = escapes;
          tokens.push(rawTok);
          i = endPos;
        } else {
          tokens.push({ type: 'SLOT_OPEN', value: '[', start: i, end: i + 1 });
          i++;
        }
      }
      continue;
    }

    if (ch === '[') {
      flushText();
      tokens.push({ type: 'SLOT_OPEN', value: '[', start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === ']') {
      flushText();
      tokens.push({ type: 'SLOT_CLOSE', value: ']', start: i, end: i + 1 });
      i++;
      continue;
    }

    appendText(ch, i);
    i++;
  }

  flushText();
  return tokens;
}
