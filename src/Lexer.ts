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

      // Optional "(...)" — modifier/level/title/language/uri/id/options.
      // Grammar excludes ")" from the inner text-char set, so a naive
      // indexOf is faithful (no nested parens are syntactically valid).
      if (source[i] === '(') {
        const close = source.indexOf(')', i + 1);
        const end = close === -1 ? n : close;
        tokens.push({ type: 'PAREN', value: source.slice(i + 1, end) });
        i = (close === -1 ? n : close + 1);
      }

      // Optional "{...}" — styles (only @mark uses it, but tokenize generically).
      if (source[i] === '{') {
        const close = source.indexOf('}', i + 1);
        const end = close === -1 ? n : close;
        tokens.push({ type: 'STYLES', value: source.slice(i + 1, end) });
        i = (close === -1 ? n : close + 1);
      }

      // Void nodes (@hr, @n) take no slot at all — see registry.ts content: 'none'.
      if (nodeDef.content === 'none') {
        continue;
      }

      if (source[i] === '[') {
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
