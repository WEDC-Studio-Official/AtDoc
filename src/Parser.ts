// Parser — recursive-descent, driven entirely by registry.ts's NodeDef table.
// Runs in Strict Mode per Inline Syntax Specification §11 ("AtDoc 選擇直接拋出
// 語法錯誤，並使用非同步錯誤斷點修復機制"): malformed input throws a
// DocSyntaxError rather than silently recovering.

import type { Token } from './Lexer.ts';
import { DocSyntaxError } from './types.ts';
import type { DocASTNode } from './types.ts';
import { getNodeDef } from './registry.ts';
import type { NodeDef } from './registry.ts';

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
        const child = this.parseNode('p');
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

    return { type: 'p', content };
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

    const node: DocASTNode = { type: name, content: [] };

    if (this.tokens[this.cursor]?.type === 'PAREN') {
      node.paren = this.tokens[this.cursor].value;
      this.cursor++;
    }
    if (nodeDef.paren === 'required' && node.paren === undefined) {
      throw new DocSyntaxError(`\`@${name}\` requires a parenthesized ${nodeDef.parenRole ?? 'value'} — e.g. \`@${name}(...)\`.`);
    }

    switch (nodeDef.parenRole) {
      case 'level': node.level = clampLevel(node.paren); break;
      case 'title': node.title = node.paren; break;
      case 'language': node.language = node.paren; break;
      case 'uri': node.uri = node.paren; break;
      case 'id': node.id = node.paren; break;
      case 'options': node.imgOptions = parseImgOptions(node.paren ?? ''); break;
      case 'color': node.color = node.paren; break;
      case 'ordered': node.ordered = /^\s*ordered\s*$/i.test(node.paren ?? ''); break;
    }

    if (this.tokens[this.cursor]?.type === 'STYLES') {
      node.styles = this.tokens[this.cursor].value.split(',').map(s => s.trim()).filter(Boolean);
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
            throw new DocSyntaxError(`\`@${node.type}[...]\` must contain only digits — got \`${node.raw}\` (Inline Syntax Specification §4: refn = "@refn", "[", integer, "]").`);
          }
          node.number = parseInt(node.raw, 10);
        }
        return node;
      }

      case 'comma-list': {
        this.expectSlotOpen(node.type);
        const raw = this.collectRawText(node.type);
        this.expectSlotClose(node.type);
        node.columns = raw.split(',').map(s => s.trim()).filter(Boolean);
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

  /** Like parseSlotContent, but for content modes that only ever hold plain text (comma-list, meta, table rows). */
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

  private parseDataRows(): string[][] {
    const rows: string[][] = [];
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
      const raw = this.collectRawText('data row');
      this.expectSlotClose('data row');
      rows.push(raw.split(',').map(s => s.trim()));
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
