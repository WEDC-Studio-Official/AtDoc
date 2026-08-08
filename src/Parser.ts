// Parser — recursive-descent, driven entirely by registry.ts's NodeDef table.
// Runs in Strict Mode per Inline Syntax Specification §11 ("AtDoc 選擇直接拋出
// 語法錯誤，並使用非同步錯誤斷點修復機制"): malformed input throws a
// DocSyntaxError rather than silently recovering.

import type { Token } from './Lexer.ts';
import { DocSyntaxError } from './types.ts';
import type { DocASTNode } from './types.ts';
import { getNodeDef, isCellAllowedNode } from './registry.ts';
import type { NodeDef } from './registry.ts';

/** Content modes the Lexer scans opaquely into a single RAW token (@raw, @code, @mermaid, @kbd, @fn). */
function isRawFamilyContent(content: NodeDef['content'] | undefined): boolean {
  return content === 'raw' || content === 'raw-escaped' || content === 'key' || content === 'integer';
}

function parseImgOptions(raw: string): Record<string, string> {
  const options: Record<string, string> = {};
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  parts.forEach((part, idx) => {
    const eq = part.indexOf('=');
    if (eq === -1) {
      if (idx === 0) options.src = part; // first bare option defaults to src — Block Syntax Spec §5 Image
      return;
    }
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) options[key] = value;
  });
  return options;
}

function clampLevel(raw: string | undefined): number {
  const lvl = parseInt(raw ?? '1', 10);
  return Number.isFinite(lvl) && lvl >= 1 && lvl <= 6 ? lvl : 1;
}

const LIST_DASH_RE = /^[ \t]*-[ \t]+/;
const LIST_NUM_RE = /^[ \t]*(\d+)[.)][ \t]+/;

/**
 * @list item semantics (Structural-Blocks.md §5 List): every non-empty line
 * is an item. A leading "- " is stripped when present, for backward
 * compatibility with the old dash-prefixed style — it is no longer required.
 * A leading "N. "/"N)" is also stripped and kept as `marker`, letting
 * @list(ordered) restart/resume its numbering via `<li value>`.
 * Splits on the raw content stream (not re-rendered HTML), so inline nodes
 * (e.g. @bold) inside an item survive as structured children instead of
 * being flattened to text.
 *
 * A line holding nothing but a single nested @list (plus surrounding
 * whitespace) isn't a new item — it's folded into the previous item's
 * content as that item's sub-list, so nesting works with plain indentation
 * and no dedicated syntax.
 */
function buildListItems(content: (DocASTNode | string)[]): DocASTNode[] {
  const lines: (DocASTNode | string)[][] = [[]];

  for (const part of content) {
    if (typeof part !== 'string') {
      lines[lines.length - 1].push(part);
      continue;
    }
    const segments = part.split('\n');
    segments.forEach((seg, idx) => {
      if (idx > 0) lines.push([]);
      if (seg !== '') lines[lines.length - 1].push(seg);
    });
  }

  const items: DocASTNode[] = [];
  for (const line of lines) {
    const meaningful = line.filter(part => typeof part !== 'string' || part.trim() !== '');
    if (meaningful.length === 1 && typeof meaningful[0] !== 'string' && (meaningful[0] as DocASTNode).type === 'list') {
      const prev = items[items.length - 1];
      if (prev) {
        prev.content.push(meaningful[0]);
        continue;
      }
    }

    let marker: number | undefined;
    if (line.length && typeof line[0] === 'string') {
      const first = line[0] as string;
      const numMatch = first.match(LIST_NUM_RE);
      if (numMatch) {
        marker = parseInt(numMatch[1], 10);
        line[0] = first.slice(numMatch[0].length);
      } else {
        line[0] = first.replace(LIST_DASH_RE, '');
      }
    }

    const isBlank = line.every(part => typeof part === 'string' && part.trim() === '');
    if (isBlank) continue;

    const item: DocASTNode = { type: 'list-item', content: line };
    if (marker !== undefined) item.marker = marker;
    items.push(item);
  }
  return items;
}

export class DocParser {
  private tokens: Token[];
  private cursor = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public parse(): DocASTNode[] {
    const ast: DocASTNode[] = [];

    while (this.cursor < this.tokens.length) {
      const cur = this.tokens[this.cursor];

      if (cur.type === 'TEXT' && cur.value.trim() === '') {
        this.cursor++;
        continue;
      }

      if (cur.type === 'NODE' && this.isTopLevelBlock(cur.value)) {
        const node = this.parseNode(undefined);
        if (node) ast.push(node);
        continue;
      }

      // Leniency: stray inline content at document top level gets wrapped in
      // an implicit @p, the same forgiving behavior the previous prototype had.
      const p = this.parseImplicitParagraph();
      const hasContent = p.content.some(c => typeof c !== 'string' || c.trim() !== '');
      if (hasContent) ast.push(p);
    }

    return ast;
  }

  private isTopLevelBlock(name: string): boolean {
    const nodeDef = getNodeDef(name);
    return !!nodeDef && (nodeDef.kind === 'block' || nodeDef.kind === 'meta') && !nodeDef.restrictedTo;
  }

  private parseImplicitParagraph(): DocASTNode {
    const content: (DocASTNode | string)[] = [];

    while (this.cursor < this.tokens.length) {
      const cur = this.tokens[this.cursor];

      if (cur.type === 'NODE' && this.isTopLevelBlock(cur.value)) break;

      if (cur.type === 'NODE') {
        const child = this.parseNode('paragraph');
        if (child) content.push(child);
        continue;
      }
      if (cur.type === 'TEXT') {
        content.push(cur.value);
        this.cursor++;
        continue;
      }
      if (cur.type === 'SLOT_OPEN') {
        content.push('[');
        this.cursor++;
        continue;
      }
      if (cur.type === 'SLOT_CLOSE') {
        content.push(']');
        this.cursor++;
        continue;
      }
      this.cursor++;
    }

    return { type: 'paragraph', content };
  }

  /**
   * Parses one node starting at the current NODE token.
   * `parentType` is the immediate containing node's type (or undefined at
   * document root) — used to enforce `restrictedTo` (Widget-Blocks.md §3,
   * Structural-Blocks.md §5 Table: @tab/@cols/@data are only valid inside
   * their specific parent).
   */
  private parseNode(parentType: string | undefined): DocASTNode | null {
    const token = this.tokens[this.cursor];
    if (!token || token.type !== 'NODE') return null;

    const name = token.value;
    const nodeDef = getNodeDef(name);
    if (!nodeDef) {
      throw new DocSyntaxError(`Internal error: "@${name}" reached the Parser but isn't registered — the Lexer should never have emitted a NODE token for it.`);
    }
    if (nodeDef.restrictedTo && nodeDef.restrictedTo !== parentType) {
      const where = parentType ? `inside \`@${parentType}\`` : 'at the document root';
      throw new DocSyntaxError(`\`@${name}\` may only appear directly inside \`@${nodeDef.restrictedTo}\` — found ${where}.`);
    }

    this.cursor++; // consume NODE

    // node.type is always the canonical registry name — @h/@p/@b/@i/@u
    // resolve transparently via registry.ts's alias table (getNodeDef), so
    // the AST never distinguishes how the author spelled the command.
    const node: DocASTNode = { type: nodeDef.name, content: [] };

    if (this.tokens[this.cursor]?.type === 'PAREN') {
      node.paren = this.tokens[this.cursor].value;
      this.cursor++;
    }
    // A `(paren)` written after `{styles}` (e.g. `@img{radius-8}(src=...)[...]`,
    // `@card{radius-12}(Title)[...]`) is a common ordering mistake — the EBNF
    // requires [paren] before [styles] (Block Syntax Specification §6/§7).
    // Peek past a leading STYLES token for it here, before the "required"
    // check below, so a required-paren node (@img) reports the specific
    // reordering problem instead of a misleading "requires a parenthesized
    // X" (the paren IS there, just in the wrong slot).
    if (nodeDef.paren !== 'none' && node.paren === undefined
      && this.tokens[this.cursor]?.type === 'STYLES' && this.tokens[this.cursor + 1]?.type === 'PAREN') {
      throw new DocSyntaxError(`\`@${name}\`'s parenthesized ${nodeDef.parenRole ?? 'value'} must come before \`{styles}\`, not after — write \`@${name}(...)  {...}  [...]\`.`);
    }
    if (nodeDef.paren === 'required' && node.paren === undefined) {
      throw new DocSyntaxError(`\`@${name}\` requires a parenthesized ${nodeDef.parenRole ?? 'value'} — e.g. \`@${name}(...)\`.`);
    }
    // @color's "(hex)" paren syntax was retired in favor of sharing @mark's
    // "{styles}" slot — the old form is now a hard error instead of silently
    // discarding the value, so nobody accidentally ships an uncolored @color.
    if (nodeDef.name === 'color' && node.paren !== undefined) {
      throw new DocSyntaxError(`\`@color\` no longer accepts a parenthesized value — use \`@color{${node.paren}}\` instead of \`@color(${node.paren})\`.`);
    }

    switch (nodeDef.parenRole) {
      case 'level': node.level = clampLevel(node.paren); break;
      case 'title': node.title = node.paren; break;
      case 'language': node.language = node.paren; break;
      case 'uri': node.uri = node.paren; break;
      case 'id': node.id = node.paren; break;
      case 'options': node.imgOptions = parseImgOptions(node.paren ?? ''); break;
      case 'ordered': node.ordered = /^\s*ordered\s*$/i.test(node.paren ?? ''); break;
    }

    if (this.tokens[this.cursor]?.type === 'STYLES') {
      const raw = this.tokens[this.cursor].value;
      // Only the nodes whose grammar actually defines a "{styles}" slot get
      // one (registry.ts's `styles` StyleSet). The Lexer tokenizes "{...}"
      // after *any* node name generically, so without this check a slot the
      // EBNF never granted — `@heading(1){radius-12}[...]` — was silently
      // swallowed and dropped, leaving the author to wonder why their styles
      // did nothing.
      if (!nodeDef.styles) {
        throw new DocSyntaxError(`\`@${name}\` has no \`{styles}\` slot.`);
      }
      // @color and @bordered both take a single color-token value, not a
      // comma-separated token list — unlike every other {styles} consumer,
      // so they get their own field instead of the generic split-into-array
      // handling below. @bordered applies that value as a border instead of
      // a foreground color (see Adapters.ts).
      if (nodeDef.name === 'color' || nodeDef.name === 'bordered') {
        node.color = raw.trim();
      } else {
        node.styles = raw.split(',').map(s => s.trim()).filter(Boolean);
      }
      this.cursor++;
    }

    return this.parseContentByMode(node, nodeDef);
  }

  private parseContentByMode(node: DocASTNode, nodeDef: NodeDef): DocASTNode {
    switch (nodeDef.content) {
      case 'none':
        return node;

      case 'raw':
      case 'raw-escaped':
      case 'key':
      case 'integer': {
        const t = this.tokens[this.cursor];
        if (!t || t.type !== 'RAW') {
          throw new DocSyntaxError(`\`@${node.type}\` expects a content slot \`[...]\` immediately after it.`);
        }
        node.raw = t.value;
        this.cursor++;
        if (nodeDef.content === 'integer') {
          if (!/^[0-9]+$/.test(node.raw)) {
            throw new DocSyntaxError(`\`@${node.type}[...]\` must contain only digits — got \`${node.raw}\` (Inline Syntax Specification §4: fn = "@fn", "[", integer, "]").`);
          }
          node.number = parseInt(node.raw, 10);
        }
        return node;
      }

      case 'comma-list': {
        this.expectSlotOpen(node.type);
        const cells = this.parseInlineCellList(node.type);
        this.expectSlotClose(node.type);
        // Unlike @data rows, empty columns (trailing comma, "@cols[]") are dropped
        // rather than kept — there's no fixed column count to stay aligned with.
        node.columns = cells.filter(cell => cell.length > 0);
        return node;
      }

      case 'rows': {
        this.expectSlotOpen(node.type);
        node.rows = this.parseDataRows();
        this.expectSlotClose(node.type);
        return node;
      }

      case 'table': {
        this.expectSlotOpen(node.type);
        this.skipWhitespaceText();
        const colsTok = this.tokens[this.cursor];
        if (!colsTok || colsTok.type !== 'NODE' || colsTok.value !== 'cols') {
          throw new DocSyntaxError('`@table` requires `@cols` as its first child (Block Syntax Specification §5 Table).');
        }
        const colsNode = this.parseNode(node.type)!;

        this.skipWhitespaceText();
        const dataTok = this.tokens[this.cursor];
        if (!dataTok || dataTok.type !== 'NODE' || dataTok.value !== 'data') {
          throw new DocSyntaxError('`@table` requires `@data` as its second child, immediately after `@cols` (Block Syntax Specification §5 Table).');
        }
        const dataNode = this.parseNode(node.type)!;

        this.skipWhitespaceText();
        this.expectSlotClose(node.type);

        node.columns = colsNode.columns;
        node.rows = dataNode.rows;
        return node;
      }

      case 'tabs': {
        this.expectSlotOpen(node.type);
        const tabs: DocASTNode[] = [];
        // eslint-disable-next-line no-constant-condition
        while (true) {
          this.skipWhitespaceText();
          const t = this.tokens[this.cursor];
          if (!t) throw new DocSyntaxError('`@tabs[...]` is missing its closing `]`.');
          if (t.type === 'SLOT_CLOSE') { this.cursor++; break; }
          if (t.type !== 'NODE' || t.value !== 'tab') {
            const found = t.type === 'NODE' ? `@${t.value}` : t.value;
            throw new DocSyntaxError(`\`@tabs\` only accepts \`@tab\` children — found \`${found}\` (Block Syntax Specification §8 Tabs).`);
          }
          tabs.push(this.parseNode(node.type)!);
        }
        node.tabs = tabs;
        return node;
      }

      case 'meta': {
        this.expectSlotOpen(node.type);
        const raw = this.collectRawText(node.type);
        this.expectSlotClose(node.type);
        node.meta = {};
        raw.split('\n').forEach(line => {
          const m = line.match(/^\s*([a-zA-Z0-9_-]+)\s*=\s*(.*?)\s*$/);
          if (m) node.meta![m[1]] = m[2];
        });
        return node;
      }

      case 'generic':
      default: {
        this.expectSlotOpen(node.type);
        node.content = this.parseSlotContent(node.type);
        this.expectSlotClose(node.type);
        if (node.type === 'list') {
          node.items = buildListItems(node.content);
        }
        return node;
      }
    }
  }

  /** Depth-aware: a literal, unpaired "[" typed as plain text (e.g. "array[0]") stays transparent instead of prematurely closing the slot. */
  private parseSlotContent(parentType: string): (DocASTNode | string)[] {
    const content: (DocASTNode | string)[] = [];
    let depth = 0;

    while (this.cursor < this.tokens.length) {
      const cur = this.tokens[this.cursor];

      if (cur.type === 'SLOT_CLOSE' && depth === 0) break;

      if (cur.type === 'NODE') {
        const child = this.parseNode(parentType);
        if (child) content.push(child);
        continue;
      }
      if (cur.type === 'SLOT_OPEN') {
        depth++;
        content.push('[');
        this.cursor++;
        continue;
      }
      if (cur.type === 'SLOT_CLOSE') {
        depth--;
        content.push(']');
        this.cursor++;
        continue;
      }
      if (cur.type === 'TEXT') {
        content.push(cur.value);
        this.cursor++;
        continue;
      }
      // PAREN / STYLES / RAW should never surface here — they're always
      // consumed inline by parseNode right after their own NODE token.
      this.cursor++;
    }

    return content;
  }

  /** Like parseSlotContent, but for content modes that only ever hold plain text (currently just @meta's key=value lines). */
  private collectRawText(ownerName: string): string {
    let buf = '';
    let depth = 0;

    while (this.cursor < this.tokens.length) {
      const cur = this.tokens[this.cursor];
      if (cur.type === 'SLOT_CLOSE' && depth === 0) break;

      if (cur.type === 'NODE') {
        throw new DocSyntaxError(`\`@${ownerName}\` only accepts plain text in its content slot — found an unexpected \`@${cur.value}\` node.`);
      }
      if (cur.type === 'SLOT_OPEN') { depth++; buf += '['; this.cursor++; continue; }
      if (cur.type === 'SLOT_CLOSE') { depth--; buf += ']'; this.cursor++; continue; }

      buf += cur.value;
      this.cursor++;
    }

    return buf;
  }

  /**
   * Trims leading/trailing whitespace-only string chunks off a cell's inline
   * content array — the array equivalent of `str.trim()` for a mixed text/node list.
   */
  private trimCellEdges(cell: (DocASTNode | string)[]): (DocASTNode | string)[] {
    const out = cell.slice();
    while (out.length && typeof out[0] === 'string') {
      const t = (out[0] as string).replace(/^\s+/, '');
      if (t === '') { out.shift(); continue; }
      out[0] = t;
      break;
    }
    while (out.length && typeof out[out.length - 1] === 'string') {
      const t = (out[out.length - 1] as string).replace(/\s+$/, '');
      if (t === '') { out.pop(); continue; }
      out[out.length - 1] = t;
      break;
    }
    return out;
  }

  /**
   * Parses @cols/@data content as comma-separated cells, each cell holding inline
   * content (text plus a curated set of formatting nodes — @n, @raw/@code/@kbd/...,
   * and whatever registry.ts's isCellAllowedNode() lets through, e.g. @bold/@mark/
   * @link). Anything else is unsupported here and throws (Strict Mode, Inline
   * Syntax Specification §11) rather than being silently dropped.
   *
   * Commas only split cells at this slot's own depth — a comma inside a nested
   * node's own "[...]" (e.g. `@bold[a,b]`) stays literal, since that TEXT token
   * is emitted while `depth > 0`.
   */
  private parseInlineCellList(ownerName: string): (DocASTNode | string)[][] {
    const cells: (DocASTNode | string)[][] = [[]];
    let depth = 0;

    const currentCell = () => cells[cells.length - 1];
    const pushText = (s: string) => { if (s !== '') currentCell().push(s); };

    while (this.cursor < this.tokens.length) {
      const cur = this.tokens[this.cursor];
      if (cur.type === 'SLOT_CLOSE' && depth === 0) break;

      if (cur.type === 'TEXT') {
        if (depth === 0 && cur.value.includes(',')) {
          const parts = cur.value.split(',');
          pushText(parts[0]);
          for (let k = 1; k < parts.length; k++) {
            cells.push([]);
            pushText(parts[k]);
          }
        } else {
          pushText(cur.value);
        }
        this.cursor++;
        continue;
      }

      if (cur.type === 'SLOT_OPEN') { depth++; pushText('['); this.cursor++; continue; }
      if (cur.type === 'SLOT_CLOSE') { depth--; pushText(']'); this.cursor++; continue; }

      if (cur.type === 'NODE') {
        const nodeDef = getNodeDef(cur.value);
        if (nodeDef?.content === 'none') {
          pushText('\n'); // @n — line break marker; renderer turns it into <br>
          this.cursor++;
          continue;
        }
        // Checked before the raw-family carve-out below: @fn is content:'integer'
        // (raw-family) but needs the real-node path so it renders as its actual
        // `<sup><a>` back-link instead of being dumped as bare digit text.
        if (nodeDef && isCellAllowedNode(cur.value)) {
          const child = this.parseNode(ownerName);
          if (child) currentCell().push(child);
          continue;
        }
        if (isRawFamilyContent(nodeDef?.content)) {
          this.cursor++; // consume NODE
          // An optional "(...)" (e.g. @code's language tag) can sit between the
          // NODE and its RAW content — consume and discard it, same as every
          // other raw-family node's value gets flattened to plain text here.
          // Without this, `@code(js)[...]` would find a PAREN token where it
          // expects RAW and throw a misleading "expects a content slot" error.
          if (this.tokens[this.cursor]?.type === 'PAREN') this.cursor++;
          const rawTok = this.tokens[this.cursor];
          if (!rawTok || rawTok.type !== 'RAW') {
            throw new DocSyntaxError(`\`@${cur.value}\` expects a content slot \`[...]\` immediately after it.`);
          }
          pushText(rawTok.value);
          this.cursor++;
          continue;
        }
        // Structural/disallowed node (e.g. @card, @table, @details) isn't part
        // of this slot's grammar — Strict Mode throws rather than silently
        // dropping it.
        throw new DocSyntaxError(`\`@${ownerName}\` only accepts plain text and inline formatting (@bold, @italic, @mark, @n, @raw, ...) in its content slot — found an unexpected \`@${cur.value}\` node.`);
      }

      // PAREN / STYLES / RAW should never surface loose here — always consumed
      // inline by parseNode/the raw-family branch right after their own NODE token.
      this.cursor++;
    }

    return cells.map((cell) => this.trimCellEdges(cell));
  }

  private parseDataRows(): (DocASTNode | string)[][][] {
    const rows: (DocASTNode | string)[][][] = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      this.skipWhitespaceText();
      const t = this.tokens[this.cursor];
      if (!t) throw new DocSyntaxError('`@data[...]` is missing its closing `]`.');
      if (t.type === 'SLOT_CLOSE') break; // caller (expectSlotClose) consumes it

      if (t.type !== 'SLOT_OPEN') {
        throw new DocSyntaxError('Each row inside `@data[...]` must start with `[` (Block Syntax Specification §5 Table).');
      }
      this.cursor++; // consume the row's own "["
      // Unlike @cols, empty cells are kept (not filtered) — a row's cell count
      // must stay aligned with the table's column count.
      const cells = this.parseInlineCellList('data row');
      this.expectSlotClose('data row');
      rows.push(cells);
    }
    return rows;
  }

  private skipWhitespaceText(): void {
    while (this.tokens[this.cursor]?.type === 'TEXT' && this.tokens[this.cursor].value.trim() === '') {
      this.cursor++;
    }
  }

  private expectSlotOpen(ownerName: string): void {
    const t = this.tokens[this.cursor];
    if (!t || t.type !== 'SLOT_OPEN') {
      throw new DocSyntaxError(`\`@${ownerName}\` expects a content slot \`[...]\` immediately after it.`);
    }
    this.cursor++;
  }

  private expectSlotClose(ownerName: string): void {
    const t = this.tokens[this.cursor];
    if (!t || t.type !== 'SLOT_CLOSE') {
      throw new DocSyntaxError(`\`@${ownerName}\` is missing its closing \`]\` (unexpected end of input — see Inline Syntax Specification §11 Parser Recovery Strategy).`);
    }
    this.cursor++;
  }
}
