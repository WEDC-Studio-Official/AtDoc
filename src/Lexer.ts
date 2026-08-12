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

import { getNodeDef } from './registry.ts';
import type { ContentMode } from './registry.ts';

export type TokenType = 'NODE' | 'PAREN' | 'STYLES' | 'SLOT_OPEN' | 'SLOT_CLOSE' | 'RAW' | 'TEXT';

export interface Token {
  type: TokenType;
  value: string;
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
 * and Widget-Blocks.md §4 Mermaid for why this matters in practice) — the
 * termination rule is bracket-depth counting, not "stop at the first
 * unescaped ]" (Inline Syntax Specification §9).
 *
 * `localEscape` enables @raw's four local exceptions (Inline Spec §9), two
 * symmetric pairs for unpaired literal brackets that would otherwise desync
 * the depth counter:
 *   "@]"  → literal "]"   (an unpaired ] that must NOT decrement depth)
 *   "@@]" → literal "@]"
 *   "@["  → literal "["   (an unpaired [ that must NOT increment depth)
 *   "@@[" → literal "@["
 * These do NOT apply to @code/@mermaid, which define no escape mechanism at
 * all. Escaping a bracket that's already part of a balanced pair (e.g.
 * writing "@mark[hello@]" instead of "@mark[hello]") is a misuse — the
 * escaped "]" stops counting toward depth, so the "[" from "@mark[" never
 * finds its balancing close and the scan overruns into the surrounding
 * document. Balanced brackets need no escaping at all; only genuinely
 * unpaired ones do.
 */
function scanDepthRaw(source: string, start: number, localEscape: boolean): { text: string; endPos: number } {
  let depth = 1;
  let buf = '';
  let i = start;
  const n = source.length;

  while (i < n) {
    if (localEscape && source[i] === '@' && source[i + 1] === '@' && source[i + 2] === ']') {
      buf += '@]';
      i += 3;
      continue;
    }
    if (localEscape && source[i] === '@' && source[i + 1] === '@' && source[i + 2] === '[') {
      buf += '@[';
      i += 3;
      continue;
    }
    if (localEscape && source[i] === '@' && source[i + 1] === ']') {
      buf += ']';
      i += 2;
      continue;
    }
    if (localEscape && source[i] === '@' && source[i + 1] === '[') {
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
      if (depth === 0) break;
      buf += ch;
      continue;
    }
    buf += ch;
    i++;
  }

  return { text: buf, endPos: i };
}

/** Flat scan for @kbd's `key` and @fn's `integer` — no nesting, no escapes. */
function scanFlatRaw(source: string, start: number): { text: string; endPos: number } {
  let i = start;
  const n = source.length;
  let buf = '';
  while (i < n && source[i] !== ']') {
    buf += source[i];
    i++;
  }
  return { text: buf, endPos: i + 1 };
}

function scanRawContent(source: string, start: number, mode: ContentMode): { text: string; endPos: number } {
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

  const flushText = () => {
    if (textBuf) {
      tokens.push({ type: 'TEXT', value: textBuf });
      textBuf = '';
    }
  };

  while (i < n) {
    const ch = source[i];

    if (ch === '@') {
      // Step 1 (Inline Spec §2): "@@" is checked first, purely by pattern —
      // before any Command Registry lookup. See Special-Nodes.md §5.
      if (source[i + 1] === '@') {
        textBuf += '@';
        i += 2;
        continue;
      }

      // Step 2: maximal-munch identifier, then registry lookup.
      let j = i + 1;
      while (j < n && IDENT_CHAR.test(source[j])) j++;
      const ident = source.slice(i + 1, j);
      const nodeDef = ident ? getNodeDef(ident) : undefined;

      if (!nodeDef) {
        // Step 3: unknown command → literal text (Inline Spec §6).
        textBuf += source.slice(i, j);
        i = j;
        continue;
      }

      flushText();
      tokens.push({ type: 'NODE', value: ident });
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
          const close = source.indexOf(')', i + 1);
          const end = close === -1 ? n : close;
          tokens.push({ type: 'PAREN', value: source.slice(i + 1, end) });
          i = (close === -1 ? n : close + 1);
          sawParen = true;
        } else if (!sawStyles && source[i] === '{' && !(isRawFamily(nodeDef.content) && source[i + 1] === '[')) {
          // "{[" is the strong-quote content opener, not a styles slot — see
          // the content handling below. There's no ambiguity to resolve:
          // scanStylesEnd() already treats "[" as a terminator because no
          // styles value ever contains one, so "{[" could never have opened a
          // valid styles slot anyway.
          const { end, closed } = scanStylesEnd(source, i + 1);
          tokens.push({ type: 'STYLES', value: source.slice(i + 1, end) });
          i = closed ? end + 1 : end;
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
      // rendering.
      if (isRawFamily(nodeDef.content) && source[i] === '{' && source[i + 1] === '[') {
        const { text, endPos } = scanStrongRaw(source, i + 2);
        tokens.push({ type: 'RAW', value: text });
        i = endPos;
      } else if (source[i] === '[') {
        if (isRawFamily(nodeDef.content)) {
          const { text, endPos } = scanRawContent(source, i + 1, nodeDef.content);
          tokens.push({ type: 'RAW', value: text });
          i = endPos;
        } else {
          tokens.push({ type: 'SLOT_OPEN', value: '[' });
          i++;
        }
      }
      continue;
    }

    if (ch === '[') {
      flushText();
      tokens.push({ type: 'SLOT_OPEN', value: '[' });
      i++;
      continue;
    }
    if (ch === ']') {
      flushText();
      tokens.push({ type: 'SLOT_CLOSE', value: ']' });
      i++;
      continue;
    }

    textBuf += ch;
    i++;
  }

  flushText();
  return tokens;
}
