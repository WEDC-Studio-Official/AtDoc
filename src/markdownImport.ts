// Markdown → @Doc — a "quick input" convenience, not a general-purpose
// converter. It hand-builds a DocASTNode tree from a pragmatic reading of
// CommonMark/GFM and hands it to the existing Serializer, which already owns
// every escaping/balance rule @Doc has (see Serializer.ts's file header).
// Reusing it means a markdown construct that can't be represented safely
// fails loudly (`ok: false` with the Serializer's own reason) instead of
// silently producing @Doc source that reparses into a different tree.
//
// This is deliberately not spec-complete. Constructs with no @Doc
// equivalent (raw HTML blocks, task-list checkboxes, blockquote/list
// alignment edge cases) degrade to plain text or a best-effort approximation
// and are called out in `notes`, rather than blocking the conversion.

import { serializeNode } from './Serializer.js';
import { tokenize } from './Lexer.js';
import { DocParser } from './Parser.js';
import type { DocASTNode } from './types.js';

export interface MarkdownImportResult {
  ok: boolean;
  /** The converted @Doc source — set only when `ok` is true. */
  text?: string;
  /** Why the conversion was refused — set only when `ok` is false. */
  reason?: string;
  /** Non-fatal call-outs: lossy or approximated constructs, even on success. */
  notes: string[];
}

interface Ctx {
  notes: string[];
  getFootnoteId: (label: string) => number;
  refs: Map<string, string>;
}

/** Kept de-duplicated — the same call-out (e.g. "task list checkboxes") is only useful to the user once, however many times its construct occurs. */
function pushNote(notes: string[], message: string): void {
  if (!notes.includes(message)) notes.push(message);
}

export function convertMarkdownToAtDoc(markdown: string): MarkdownImportResult {
  const notes: string[] = [];
  if (!markdown.trim()) {
    return { ok: false, reason: 'There is no content to convert.', notes };
  }

  if (/<\/?[a-zA-Z][a-zA-Z0-9-]*(\s[^<>]*)?>/.test(markdown)) {
    pushNote(notes, 'Raw HTML tags detected — @Doc has no matching node, so they were kept as plain text and will not work as HTML.');
  }

  const normalized = markdown.replace(/\r\n?/g, '\n');
  const { refs, remaining } = extractReferenceDefinitions(normalized.split('\n'));
  const ctx: Ctx = { notes, getFootnoteId: makeFootnoteIdGetter(), refs };

  let ast: DocASTNode[];
  try {
    ast = parseBlocks(remaining, ctx);
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err), notes };
  }

  if (ast.length === 0) {
    return { ok: false, reason: 'There is no convertible content.', notes };
  }

  // Serialized one top-level block at a time (rather than via
  // serializeDocument's whole-tree emitRoot) and joined with blank lines:
  // emitRoot's bare/explicit paragraph juggling exists to make a *parsed*
  // document's plain-text stretches round-trip byte-faithfully, which
  // doesn't matter here — every paragraph already came from an explicit
  // markdown block, so writing each one out as an explicit `@paragraph[...]`
  // is both simpler and, pasted into the editor, more legible than one
  // run-on wall of text.
  //
  // A block that can't be represented (an unbalanced bracket in its own
  // text, a comma in a table cell, ...) is skipped with a note rather than
  // failing the whole paste — one bad paragraph in a long document shouldn't
  // cost every other paragraph the conversion. Only refuse outright when
  // *nothing* survived.
  const parts: string[] = [];
  for (const node of ast) {
    // Already-emitted @Doc source (minimalRawEscape's output) — the Serializer
    // would re-escape it, so it goes into the document verbatim. Still covered
    // by the whole-document reparse check below.
    if (node.type === PRESERIALIZED_TYPE) {
      parts.push(node.raw ?? '');
      continue;
    }
    const r = serializeNode(node, { placement: { at: 'root' } });
    if (!r.ok) {
      pushNote(notes, `One block could not be converted and was skipped: ${r.reason}`);
      continue;
    }
    parts.push(r.text);
  }
  if (parts.length === 0) {
    // Every block was skipped — surface the specific reasons (collected in
    // `notes` above) rather than a generic "nothing converted", since for a
    // short paste this is usually the only block there was.
    const reason = notes.length > 0 ? `Nothing could be converted to @Doc: ${notes.join('; ')}` : 'Nothing could be converted to @Doc.';
    return { ok: false, reason, notes };
  }
  const text = parts.join('\n\n');

  // Belt-and-suspenders: confirm the text we're about to insert actually
  // reparses cleanly. The Parser runs in Editor Mode and almost never throws
  // — it records recoverable problems as diagnostics instead — so checking
  // for a throw alone proves nothing. Any diagnostic here means the emitted
  // source reads back as something other than what was intended (this is
  // exactly how the "@raw content ending in @" serializer bug slipped
  // through before), so treat it as a conversion failure, not a warning.
  try {
    const reparser = new DocParser(tokenize(text));
    reparser.parse();
    // Only error-tier diagnostics abort — 'warning'/'info' are advisory
    // markers (e.g. the @raw escape heads-up) that legal output can carry.
    const errors = reparser.diagnostics.filter((d) => d.severity === undefined || d.severity === 'error');
    if (errors.length > 0) {
      return {
        ok: false,
        reason: `The converted @Doc source produced ${errors.length} diagnostic(s) when re-parsed (first: ${errors[0].message}) — aborted to avoid inserting broken content.`,
        notes,
      };
    }
  } catch (err) {
    return {
      ok: false,
      reason: `The converted @Doc source could not be re-parsed: ${err instanceof Error ? err.message : String(err)}`,
      notes,
    };
  }

  return { ok: true, text, notes };
}

// ---------------------------------------------------------------------------
// Reference-style links: "[ref]: url" definitions, collected up front so
// "[text][ref]" can resolve regardless of where the definition sits.
// ---------------------------------------------------------------------------

function extractReferenceDefinitions(lines: string[]): { refs: Map<string, string>; remaining: string[] } {
  const refs = new Map<string, string>();
  const remaining: string[] = [];
  const RE = /^ {0,3}\[([^\]]+)\]:\s*(\S+)\s*(?:"[^"]*"|'[^']*'|\([^)]*\))?\s*$/;
  for (const line of lines) {
    const m = RE.exec(line);
    if (m) {
      let url = m[2];
      if (url.startsWith('<') && url.endsWith('>')) url = url.slice(1, -1);
      refs.set(m[1].toLowerCase(), url);
      continue;
    }
    remaining.push(line);
  }
  return { refs, remaining };
}

function makeFootnoteIdGetter(): (label: string) => number {
  const map = new Map<string, number>();
  return (label: string) => {
    const key = label.toLowerCase();
    let id = map.get(key);
    if (id === undefined) {
      id = map.size + 1;
      map.set(key, id);
    }
    return id;
  };
}

// ---------------------------------------------------------------------------
// Block level
// ---------------------------------------------------------------------------

const HR_RE = /^ {0,3}((\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})$/;
const ATX_RE = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*#*[ \t]*$/;
const SETEXT_RE = /^ {0,3}(=+|-+)[ \t]*$/;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)[ \t]*$/;
const QUOTE_RE = /^ {0,3}>[ ]?/;
const FOOTNOTE_DEF_RE = /^\[\^([^\]]+)\]:[ \t]?(.*)$/;
const LIST_ITEM_RE = /^( {0,3})([-*+]|\d+[.)])[ \t]+(.*)$/;
const LIST_ITEM_PREFIX_RE = /^ {0,3}([-*+]|\d+[.)])[ \t]+/;

function startsNewBlock(line: string): boolean {
  return (
    ATX_RE.test(line) ||
    QUOTE_RE.test(line) ||
    FENCE_RE.test(line) ||
    HR_RE.test(line) ||
    LIST_ITEM_PREFIX_RE.test(line) ||
    FOOTNOTE_DEF_RE.test(line) ||
    isTableSeparator(line)
  );
}

function isTableSeparator(line: string): boolean {
  return /^ {0,3}\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(line) && line.includes('-');
}

function splitTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s
    .split(/(?<!\\)\|/)
    .map((c) => c.replace(/\\\|/g, '|').trim());
}

function isBracketBalanced(text: string): boolean {
  let depth = 0;
  for (const ch of text) {
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

/**
 * Encodes text for @raw's escape domain with the *minimum* escapes the format
 * actually requires — the property that makes multi-line @raw a readable way
 * to preserve bracket-unbalanced code blocks, instead of the wall of "@[/@]"
 * noise the Serializer's escape-everything encoder produces.
 *
 * The rules (Inline Syntax Specification §9): the scanner counts bracket
 * depth, so *balanced* literal brackets need no escape at all; only unpaired
 * ones do. Two extra constraints come from the scanner's greedy escape
 * matching:
 *   - a literal "@" directly before a bracket must be written as the doubled
 *     escape ("@[" → "@@[", "@]" → "@@]"), or the pair would be misread as an
 *     escape and the "@" silently dropped;
 *   - content ending in "@" is unrepresentable outright (the "@" fuses with
 *     the closing "]" into the "@]" escape) — returns null, caller decides.
 */
const PRESERIALIZED_TYPE = 'preserialized-source';

function minimalRawEscape(text: string): string | null {
  if (text.endsWith('@')) return null;

  type Piece = { out: string; bare?: '[' | ']' };
  const pieces: Piece[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '@' && (next === '[' || next === ']')) {
      pieces.push({ out: `@@${next}` });
      i++;
      continue;
    }
    if (ch === '[' || ch === ']') {
      pieces.push({ out: ch, bare: ch });
      continue;
    }
    pieces.push({ out: ch });
  }

  // Standalone brackets: pair them up; escape only the ones left unmatched.
  const openStack: number[] = [];
  for (let idx = 0; idx < pieces.length; idx++) {
    const piece = pieces[idx];
    if (piece.bare === '[') openStack.push(idx);
    else if (piece.bare === ']') {
      if (openStack.length > 0) openStack.pop();
      else piece.out = '@]';
    }
  }
  for (const idx of openStack) pieces[idx].out = '@[';

  return pieces.map((p) => p.out).join('');
}

function dedent(lines: string[]): string[] {
  let min = Infinity;
  for (const l of lines) {
    if (l.trim() === '') continue;
    min = Math.min(min, l.length - l.trimStart().length);
  }
  if (!Number.isFinite(min)) min = 0;
  return lines.map((l) => l.slice(Math.min(min, l.length)));
}

function parseBlocks(lines: string[], ctx: Ctx): DocASTNode[] {
  const out: DocASTNode[] = [];
  let idx = 0;

  while (idx < lines.length) {
    const line = lines[idx];
    if (line.trim() === '') {
      idx++;
      continue;
    }

    const fence = FENCE_RE.exec(line);
    if (fence) {
      const [, marker, lang] = fence;
      idx++;
      const codeLines: string[] = [];
      const closeRe = new RegExp(`^ {0,3}${marker[0]}{${marker.length},}[ \\t]*$`);
      while (idx < lines.length && !closeRe.test(lines[idx])) {
        codeLines.push(lines[idx]);
        idx++;
      }
      if (idx < lines.length) idx++; // consume closing fence
      const raw = codeLines.join('\n');
      // @code/@mermaid are `content: 'raw'` — no escape at all, so their text
      // must already have balanced brackets (Serializer.ts's emitContentByMode
      // 'raw' case). A code sample that itself *talks about* brackets (an EBNF
      // grammar quoting "[" and "]" as literal terminals, a doc explaining
      // @Doc's own "@]"/"@[" escapes by showing one in isolation) can easily
      // have a genuinely unbalanced count with no fix on this end.
      //
      // @raw's escape domain *can* represent it, and with minimalRawEscape
      // only the unpaired brackets get escapes, so the emitted source stays
      // readable rather than a wall of "@[/@]". Multi-line content bypasses
      // the Serializer (whose escape-everything encoder is corpus-shared with
      // the AtDoc repo) via a pre-serialized part. What's lost is only the
      // formatting tier: the language tag, and block (<pre>) rendering — the
      // preview shows it as inline code with line breaks preserved. The one
      // thing @raw truly cannot hold is content ending in "@"; that rare case
      // is still skipped with a note.
      if (!isBracketBalanced(raw) && raw.includes(']}')) {
        // Defeats both forms: the brackets rule out "[...]" (which counts
        // depth) and the "]}" rules out the strong quote (which ends there).
        const preview = (lang ? `${lang} ` : '') + (codeLines.find((l) => l.trim() !== '')?.trim().slice(0, 40) ?? '');
        pushNote(ctx.notes, `A code block (starting: ${preview}…) has unbalanced square brackets and also contains "]}", so neither form can represent it; it was skipped — please paste it in manually.`);
      } else if (lang === 'mermaid') {
        out.push({ type: 'mermaid', content: [], raw });
      } else {
        out.push({ type: 'code', paren: lang || undefined, content: [], raw });
      }
      continue;
    }

    const atx = ATX_RE.exec(line);
    if (atx) {
      const level = atx[1].length;
      idx++;
      out.push({
        type: 'heading',
        paren: level === 1 ? undefined : String(level),
        content: parseInline((atx[2] ?? '').trim(), ctx),
      });
      continue;
    }

    if (HR_RE.test(line)) {
      idx++;
      out.push({ type: 'hr', content: [] });
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const quoteLines: string[] = [];
      while (idx < lines.length && QUOTE_RE.test(lines[idx])) {
        quoteLines.push(lines[idx].replace(QUOTE_RE, ''));
        idx++;
      }
      // GitHub-style admonition — "> [!TIP]" on the quote's first line — maps
      // one-to-one onto @Doc's callout nodes, so emit the callout rather than
      // a plain @quote carrying "[!TIP]" as literal text.
      const firstContentIdx = quoteLines.findIndex((l) => l.trim() !== '');
      const adm = firstContentIdx >= 0
        ? /^\[!(note|tip|important|warning|caution)\][ \t]*(.*)$/i.exec(quoteLines[firstContentIdx].trim())
        : null;
      if (adm) {
        const rest = quoteLines.slice();
        rest[firstContentIdx] = adm[2];
        out.push({ type: adm[1].toLowerCase(), content: parseBlocks(rest, ctx) });
      } else {
        out.push({ type: 'quote', content: parseBlocks(quoteLines, ctx) });
      }
      continue;
    }

    const fnDef = FOOTNOTE_DEF_RE.exec(line);
    if (fnDef) {
      idx++;
      let text = fnDef[2];
      while (idx < lines.length && /^ {4,}\S/.test(lines[idx])) {
        text += ` ${lines[idx].trim()}`;
        idx++;
      }
      const id = ctx.getFootnoteId(fnDef[1]);
      out.push({ type: 'defn', paren: String(id), content: parseInline(text, ctx) });
      continue;
    }

    if (line.includes('|') && idx + 1 < lines.length && isTableSeparator(lines[idx + 1])) {
      const headerCells = splitTableRow(line);
      idx += 2;
      const rawRows: string[][] = [];
      while (idx < lines.length && lines[idx].trim() !== '' && lines[idx].includes('|')) {
        rawRows.push(splitTableRow(lines[idx]));
        idx++;
      }
      const colCount = headerCells.length;
      if (rawRows.some((r) => r.length !== colCount)) {
        pushNote(ctx.notes, 'Some table rows have a different number of columns than the header; they were padded with blanks or truncated to match.');
      }
      const columns = headerCells.map((c) => parseInline(c, ctx));
      const rows = rawRows.map((r) => {
        const padded = r.slice(0, colCount);
        while (padded.length < colCount) padded.push('');
        return padded.map((c) => parseInline(c, ctx));
      });
      out.push({ type: 'table', content: [], columns, rows });
      continue;
    }

    if (LIST_ITEM_RE.test(line)) {
      const ordered = /^\s*\d/.test(LIST_ITEM_RE.exec(line)![2]);
      const { nodes, nextIdx } = parseListBlock(lines, idx, ordered, ctx);
      out.push(...nodes);
      idx = nextIdx;
      continue;
    }

    // Paragraph — with a setext-heading lookahead on its first line.
    const paraLines: string[] = [line];
    idx++;
    if (idx < lines.length && SETEXT_RE.test(lines[idx])) {
      const level = lines[idx].trim()[0] === '=' ? 1 : 2;
      idx++;
      out.push({
        type: 'heading',
        paren: level === 1 ? undefined : String(level),
        content: parseInline(paraLines[0].trim(), ctx),
      });
      continue;
    }
    while (idx < lines.length && lines[idx].trim() !== '' && !startsNewBlock(lines[idx])) {
      paraLines.push(lines[idx]);
      idx++;
    }
    out.push({ type: 'paragraph', content: buildParagraphContent(paraLines, ctx) });
  }

  return out;
}

const IDENT_CHAR_RE = /^[a-zA-Z0-9_-]/;

function buildParagraphContent(lines: string[], ctx: Ctx): (DocASTNode | string)[] {
  const out: (DocASTNode | string)[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const isLast = i === lines.length - 1;
    let hard = false;
    if (!isLast) {
      if (/ {2,}$/.test(line)) hard = true;
      else if (/\\$/.test(line)) {
        hard = true;
        line = line.slice(0, -1);
      }
    }
    out.push(...parseInline(line.replace(/[ \t]+$/, ''), ctx));
    if (hard) out.push({ type: 'n', content: [] });
    else if (!isLast) out.push(' ');
  }

  // @n is `content: 'none'` — bare, no brackets — so the Lexer's maximal-munch
  // identifier scan (Lexer.ts: "@" + longest run of [a-zA-Z0-9_-]) would read
  // "@n" fused with a directly-following word as one unknown command ("@ntwo"),
  // which falls back to literal text instead of a line break + word. A leading
  // space is invisible right after a rendered <br> and keeps the round trip
  // honest; without it the emitted source would silently reparse as something
  // else entirely.
  for (let i = 0; i < out.length - 1; i++) {
    const cur = out[i];
    const next = out[i + 1];
    if (typeof cur !== 'string' && cur.type === 'n' && typeof next === 'string' && IDENT_CHAR_RE.test(next)) {
      out[i + 1] = ` ${next}`;
    }
  }

  return out;
}

function parseListBlock(
  lines: string[],
  startIdx: number,
  ordered: boolean,
  ctx: Ctx,
): { nodes: DocASTNode[]; nextIdx: number } {
  const items: DocASTNode[] = [];
  // Blocks that can't live inside a @list item (see the serializer note in
  // the item-content loop below) — emitted after the list, order preserved.
  const hoisted: DocASTNode[] = [];
  const baseIndent = LIST_ITEM_RE.exec(lines[startIdx])?.[1].length ?? 0;
  let idx = startIdx;

  while (idx < lines.length) {
    let line = lines[idx];
    if (line.trim() === '') {
      // A blank line between items makes the markdown list "loose", but it's
      // still one list — only stop when what follows the blank(s) isn't a
      // sibling item of the same kind at the same level.
      let j = idx;
      while (j < lines.length && lines[j].trim() === '') j++;
      const nm = j < lines.length ? LIST_ITEM_RE.exec(lines[j]) : null;
      if (!nm || /^\s*\d/.test(nm[2]) !== ordered || nm[1].length > baseIndent) break;
      idx = j;
      line = lines[j];
    }
    const m = LIST_ITEM_RE.exec(line);
    if (!m) break;
    const isOrderedItem = /^\s*\d/.test(m[2]);
    if (isOrderedItem !== ordered) break; // a marker-type switch starts a new sibling list, not this one

    const indent = m[1].length;
    let firstLineText = m[3];
    idx++;

    const contLines: string[] = [];
    while (idx < lines.length) {
      const l = lines[idx];
      if (l.trim() === '') {
        if (idx + 1 < lines.length && /^ {2,}\S/.test(lines[idx + 1])) {
          contLines.push('');
          idx++;
          continue;
        }
        break;
      }
      const lineIndent = l.length - l.trimStart().length;
      if (LIST_ITEM_PREFIX_RE.test(l) && lineIndent <= indent) break; // sibling item
      if (lineIndent < indent + 2) break; // dedented past this item — belongs to an ancestor
      contLines.push(l);
      idx++;
    }

    const taskMatch = /^\[([ xX])\][ \t]+(.*)$/.exec(firstLineText);
    if (taskMatch) {
      pushNote(ctx.notes, 'Task-list checkboxes have no matching @Doc node; they were converted to plain text ☐/☑.');
      firstLineText = `${taskMatch[1].trim() ? '☑' : '☐'} ${taskMatch[2]}`;
    }

    let itemContent: (DocASTNode | string)[];
    if (contLines.length > 0) {
      const dedented = dedent(contLines);
      if (dedented.some((l) => l.trim() !== '' && startsNewBlock(l))) {
        // The continuation carries block-level structure (a nested list, a
        // fenced code block, a quote…) — parse it properly and fold the
        // pieces back into the item. What can fold in is bounded by the
        // Serializer: a @list item must emit as a single line (Serializer.ts's
        // emitListItems), so anything whose emission contains a newline can't
        // live here. In practice that's only multi-line @code/@mermaid —
        // nested @list is the one multi-line construct emitListItems knows
        // how to re-fold, paragraphs flatten to inline content, and the rest
        // (single-line @code, @quote, @table…) all emit newline-free.
        const subBlocks = parseBlocks(dedented, ctx);
        itemContent = parseInline(firstLineText, ctx);
        const trailingLists: DocASTNode[] = [];
        for (const blk of subBlocks) {
          if (blk.type === 'list') {
            // emitListItems only re-folds a nested list at the item's tail,
            // so nested lists go last regardless of source position.
            trailingLists.push(blk);
          } else if (blk.type === PRESERIALIZED_TYPE
            || ((blk.type === 'code' || blk.type === 'mermaid') && (blk.raw ?? '').includes('\n'))) {
            pushNote(ctx.notes, 'A list item contains a multi-line code block, which the single-line @list item limit cannot hold; it was moved to after the list.');
            hoisted.push(blk);
          } else if (blk.type === 'paragraph') {
            if (itemContent.length > 0) itemContent.push(' ');
            itemContent.push(...blk.content);
          } else {
            if (itemContent.length > 0) itemContent.push(' ');
            itemContent.push(blk);
          }
        }
        itemContent.push(...trailingLists);
      } else {
        const joined = [firstLineText, ...dedented.map((l) => l.trim())].filter((l) => l !== '').join(' ');
        itemContent = parseInline(joined, ctx);
      }
    } else {
      itemContent = parseInline(firstLineText, ctx);
    }

    const item: DocASTNode = { type: 'list-item', content: itemContent };
    if (ordered) {
      const num = parseInt(m[2], 10);
      if (Number.isFinite(num)) item.marker = num;
    }
    items.push(item);
  }

  return {
    nodes: [{ type: 'list', paren: ordered ? 'ordered' : undefined, content: items }, ...hoisted],
    nextIdx: idx,
  };
}

// ---------------------------------------------------------------------------
// Inline level
// ---------------------------------------------------------------------------

// Any-length backtick fences, CommonMark-style: N backticks open, the next
// run of exactly N closes, so `` `code` `` can carry a literal backtick.
const CODE_SPAN_RE = /^(`+)([\s\S]+?)\1(?!`)/;
const REFLINK_RE = /^\[([^\]]*)\]\[([^\]]*)\]/;
const FOOTNOTE_REF_RE = /^\[\^([^\]]+)\]/;
const BOLD_ITALIC_RE = /^(\*\*\*|___)([\s\S]+?)\1/;
const BOLD_RE = /^(\*\*|__)([\s\S]+?)\1/;
const ITALIC_RE = /^(\*|_)([\s\S]+?)\1/;
const STRIKE_RE = /^~~([\s\S]+?)~~/;
const MARK_RE = /^==([\s\S]+?)==/;
const AUTOLINK_RE = /^<((?:https?|mailto):[^>\s]+)>/;
const ESCAPED_RE = /^\\([!-/:-@[-`{-~])/;

/** The "(url)" / "(url \"title\")" tail shared by links and images. */
const LINK_TAIL_RE = /^\(\s*(<[^>]*>|[^)\s]*)(?:\s+"[^"]*")?\s*\)/;

/**
 * Index of the "]" closing the "[" at `open`, counting nesting, or -1 if it
 * never closes.
 *
 * A regex can't do this: `[^\]]*` stops at the *first* "]", which cuts
 * `[![alt](img)](url)` — an image used as a link's text — in half. That shape
 * is the badge row at the top of almost every README, and the truncated link
 * text kept a stray "[" that the Serializer then (correctly) refused as
 * unrepresentable, so the whole construct was dropped. It accounted for 168 of
 * 300 real READMEs losing content.
 */
function findClosingBracket(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\') { i++; continue; } // a backslash-escaped bracket isn't structural
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Matches `[text](url)` or `![alt](url)` at the start of `rest`, allowing the
 * text to contain balanced brackets. Returns null when it isn't one.
 */
function matchLinkLike(rest: string, image: boolean): { text: string; url: string; length: number } | null {
  const open = image ? 1 : 0;
  if (image && rest[0] !== '!') return null;
  if (rest[open] !== '[') return null;

  const close = findClosingBracket(rest, open);
  if (close === -1) return null;

  const tail = LINK_TAIL_RE.exec(rest.slice(close + 1));
  if (!tail) return null;

  // CommonMark's pointy-bracket form, `[x](<url with spaces>)`.
  const url = tail[1].startsWith('<') && tail[1].endsWith('>') ? tail[1].slice(1, -1) : tail[1];
  return { text: rest.slice(open + 1, close), url, length: close + 1 + tail[0].length };
}

/**
 * Folds adjacent plain-text segments into one.
 *
 * The Parser accumulates a run of text into a single TEXT token, so
 * `['MDN ', 'browser-compat-data']` is a shape it never produces — but
 * parseInline emits one whenever a rule flushes its buffer and then declines
 * to match (an autolink that turns out not to be one, say). The text is
 * identical either way and renders identically, but the AST isn't deep-equal
 * to what reparsing the serialized output gives back, which quietly breaks the
 * "candidate tree vs reparsed tree" comparison an atomic commit relies on.
 */
function mergeAdjacentText(parts: (DocASTNode | string)[]): (DocASTNode | string)[] {
  const out: (DocASTNode | string)[] = [];
  for (const part of parts) {
    const last = out[out.length - 1];
    if (typeof part === 'string' && typeof last === 'string') {
      out[out.length - 1] = last + part;
    } else {
      out.push(part);
    }
  }
  return out;
}

function parseInline(text: string, ctx: Ctx): (DocASTNode | string)[] {
  return mergeAdjacentText(parseInlineRaw(text, ctx));
}

function parseInlineRaw(text: string, ctx: Ctx): (DocASTNode | string)[] {
  const out: (DocASTNode | string)[] = [];
  let buf = '';
  const flush = () => {
    if (buf) {
      out.push(buf);
      buf = '';
    }
  };

  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    let m: RegExpExecArray | null;

    if ((m = CODE_SPAN_RE.exec(rest))) {
      flush();
      let codeText = m[2];
      // CommonMark strips one space off each end when both are present — the
      // idiom for content that itself starts or ends with a backtick.
      if (codeText.length > 1 && codeText.startsWith(' ') && codeText.endsWith(' ') && codeText.trim() !== '') {
        codeText = codeText.slice(1, -1);
      }
      // Content ending in "@" has no encoding in @raw's *escaped* form (the
      // trailing "@" fuses with the closing "]" into the "@]" escape and the
      // node never terminates), but the strong quote has no escapes for it to
      // fuse with — the Serializer picks that form automatically. Only content
      // that also contains "]}" defeats both, and that keeps its text at the
      // cost of the code styling.
      if (codeText.endsWith('@') && codeText.includes(']}')) {
        pushNote(ctx.notes, 'An inline code span ends with "@" and contains "]}", so neither form can represent it; it was converted to plain text.');
        buf += codeText;
      } else {
        out.push({ type: 'raw', content: [], raw: codeText });
      }
      i += m[0].length;
      continue;
    }
    const image = matchLinkLike(rest, true);
    if (image) {
      flush();
      out.push({ type: 'img', paren: image.url, content: parseInline(image.text, ctx) });
      i += image.length;
      continue;
    }
    const link = matchLinkLike(rest, false);
    if (link) {
      flush();
      out.push({ type: 'link', paren: link.url, content: parseInline(link.text, ctx) });
      i += link.length;
      continue;
    }
    if ((m = REFLINK_RE.exec(rest))) {
      const label = (m[2] || m[1]).toLowerCase();
      const url = ctx.refs.get(label);
      flush();
      if (url) {
        out.push({ type: 'link', paren: url, content: parseInline(m[1], ctx) });
      } else {
        pushNote(ctx.notes, `Reference link [${m[1]}][${m[2]}] has no matching definition; it was kept as plain text.`);
        out.push(m[0]);
      }
      i += m[0].length;
      continue;
    }
    if ((m = FOOTNOTE_REF_RE.exec(rest))) {
      flush();
      const id = ctx.getFootnoteId(m[1]);
      out.push({ type: 'fn', content: [], raw: String(id), number: id });
      i += m[0].length;
      continue;
    }
    if ((m = BOLD_ITALIC_RE.exec(rest))) {
      flush();
      out.push({ type: 'bold', content: [{ type: 'italic', content: parseInline(m[2], ctx) }] });
      i += m[0].length;
      continue;
    }
    if ((m = BOLD_RE.exec(rest))) {
      flush();
      out.push({ type: 'bold', content: parseInline(m[2], ctx) });
      i += m[0].length;
      continue;
    }
    if ((m = ITALIC_RE.exec(rest))) {
      flush();
      out.push({ type: 'italic', content: parseInline(m[2], ctx) });
      i += m[0].length;
      continue;
    }
    if ((m = STRIKE_RE.exec(rest))) {
      flush();
      out.push({ type: 'del', content: parseInline(m[1], ctx) });
      i += m[0].length;
      continue;
    }
    if ((m = MARK_RE.exec(rest))) {
      flush();
      out.push({ type: 'mark', content: parseInline(m[1], ctx) });
      i += m[0].length;
      continue;
    }
    if ((m = AUTOLINK_RE.exec(rest))) {
      flush();
      out.push({ type: 'link', paren: m[1], content: [m[1]] });
      i += m[0].length;
      continue;
    }
    if ((m = ESCAPED_RE.exec(rest))) {
      buf += m[1];
      i += m[0].length;
      continue;
    }

    buf += text[i];
    i++;
  }
  flush();
  return out;
}

/** Every registry node this converter can emit — kept in sync manually since it mirrors hand-picked mappings, not a registry-driven table. */
export const SUPPORTED_MARKDOWN_FEATURES = [
  'ATX headings #–######, Setext headings (===/---)',
  'bold **/__, italic */_, bold-italic ***/___, strikethrough ~~~~',
  'inline code `code` (including the multi-backtick form ``…``), fenced code blocks ```lang',
  'links [text](url), reference links [text][ref], images ![alt](url), autolinks <url>',
  'lists (ordered/unordered, nested, loose, code blocks inside items), task lists (converted to ☐/☑ plain text)',
  'blockquotes > (including nested), GitHub admonitions (> [!TIP] etc. → @tip/@note/…), horizontal rules ---/***/___',
  'GFM tables (alignment information is dropped)',
  'footnotes [^id] / [^id]: text (non-numeric labels are renumbered)',
  '==highlight== → @mark (GFM extension)',
  'hard line breaks (two trailing spaces or a backslash)',
] as const;
