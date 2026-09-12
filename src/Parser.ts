// Parser — recursive-descent, driven entirely by registry.ts's NodeDef table.
//
// Editor Mode (Inline Syntax Specification §11 Parser Recovery Strategy): this
// parser never aborts the whole document over one malformed construct. Every
// recoverable problem — an unclosed bracket, a missing required paren, a node
// in the wrong context, a non-digit @fn, an unsupported node in a table cell —
// is recorded in `diagnostics` (surfaced by the editor as a red squiggly, see
// MonacoCodeEditor.tsx's updateDiagnostics()) and the parser recovers with a
// sensible best-effort AST instead of throwing. `DocSyntaxError` is reserved
// for genuine internal invariant violations (a NODE token for an unregistered
// name — the Lexer should never emit one), not for anything a user can type.

import type { Token } from './Lexer';
import { DocSyntaxError } from './types';
import type { DocASTNode, DocDiagnostic } from './types';
import { getNodeDef, isCellAllowedNode, deriveParenFields } from './registry';
import type { NodeDef } from './registry';

/** Content modes the Lexer scans opaquely into a single RAW token (@raw, @code, @mermaid, @kbd, @fn). */
function isRawFamilyContent(content: NodeDef['content'] | undefined): boolean {
  return content === 'raw' || content === 'raw-escaped' || content === 'key' || content === 'integer';
}

// Known @color/@bordered {styles} tokens (Inline Syntax Specification §7) —
// the same seven named colors @mark's {styles} accepts, plus the hex pattern
// — used only for the editor diagnostic below. KamiAdapter.ts owns the actual
// color *resolution* logic; this list exists purely to flag typos in the Playground.
const KNOWN_COLOR_TOKENS = new Set(['yellow', 'red', 'green', 'blue', 'orange', 'purple', 'gray']);
const HEX_STYLE_TOKEN = /^#[0-9a-fA-F]{6}$/;


export class DocParser {
  private tokens: Token[];
  private cursor = 0;

  /** Non-fatal issues collected during parsing (e.g. an unclosed bracket, a node used in the wrong context). */
  public diagnostics: DocDiagnostic[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /** Records a non-fatal issue without aborting the parse — see the file-level Editor Mode comment. Severity defaults to 'error' (omitted on the diagnostic itself, preserving the historical shape). */
  private diagnose(start: number, end: number, message: string, severity?: 'warning' | 'info'): void {
    const d: DocDiagnostic = { start, end, message };
    if (severity) d.severity = severity;
    this.diagnostics.push(d);
  }

  /** Best-effort position for a diagnostic when there's no specific token to blame (e.g. end-of-input). */
  private cursorPos(): number {
    const prev = this.tokens[this.cursor - 1];
    if (prev) return prev.end;
    const cur = this.tokens[this.cursor];
    return cur ? cur.start : 0;
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
        const start = cur.start;
        const node = this.parseNode(undefined);
        if (node) {
          node.start = start;
          ast.push(node);
        }
        continue;
      }

      // Leniency: stray inline content at document top level gets wrapped in
      // an implicit @p, the same forgiving behavior the previous prototype had.
      const implicitStart = cur.start;
      const p = this.parseImplicitParagraph();
      p.start = implicitStart;
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
   * their specific parent). A violation is a diagnostic, not a throw — the
   * node still parses normally, just flagged as misplaced (Editor Mode).
   */
  private parseNode(parentType: string | undefined): DocASTNode | null {
    const token = this.tokens[this.cursor];
    if (!token || token.type !== 'NODE') return null;

    const name = token.value;
    const nodeDef = getNodeDef(name);
    if (!nodeDef) {
      // Genuine internal invariant violation, not a recoverable user error —
      // the registry-aware Lexer should never emit a NODE token it doesn't
      // recognize itself.
      throw new DocSyntaxError(`Internal error: "@${name}" reached the Parser but isn't registered — the Lexer should never have emitted a NODE token for it.`);
    }
    if (nodeDef.restrictedTo && nodeDef.restrictedTo !== parentType) {
      const where = parentType ? `inside \`@${parentType}\`` : 'at the document root';
      this.diagnose(token.start, token.end, `\`@${name}\` may only appear directly inside \`@${nodeDef.restrictedTo}\` — found ${where}.`);
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
    // A `(paren)` swapped after `{styles}` (e.g. `@img{radius-8}(src=...)[...]`)
    // is recovered further down (see the "must come before {styles}" block
    // below) — peek past a leading STYLES token for it here so a
    // required-paren node (@img) doesn't also report a misleading "requires
    // a parenthesized X" (the paren IS there, just in the wrong slot).
    const parenIsSwappedAfterStyles = node.paren === undefined
      && this.tokens[this.cursor]?.type === 'STYLES' && this.tokens[this.cursor + 1]?.type === 'PAREN';
    if (nodeDef.paren === 'required' && node.paren === undefined && !parenIsSwappedAfterStyles) {
      this.diagnose(token.start, token.end, `\`@${name}\` requires a parenthesized ${nodeDef.parenRole ?? 'value'} — e.g. \`@${name}(...)\`.`);
    }
    // @color's "(hex)" paren syntax was retired in favor of sharing @mark's
    // "{styles}" slot — flag the old form instead of silently discarding it.
    if (nodeDef.name === 'color' && node.paren !== undefined) {
      this.diagnose(token.start, token.end, `\`@color\` no longer accepts a parenthesized value — use \`@color{${node.paren}}\` instead of \`@color(${node.paren})\`.`);
    }

    Object.assign(node, deriveParenFields(nodeDef.parenRole, node.paren));

    // @color and @bordered both take a single color-swatch value (hex or
    // named token), not a comma-separated token list like @mark — so they
    // share `node.color` instead of the generic split-into-array handling
    // below. @bordered applies that same value as a border instead of a
    // foreground color (see KamiAdapter.ts).
    const isColorSwatch = nodeDef.name === 'color' || nodeDef.name === 'bordered';

    if (this.tokens[this.cursor]?.type === 'STYLES') {
      const stylesTok = this.tokens[this.cursor];
      const raw = stylesTok.value;
      // Only the nodes whose grammar actually defines a "{styles}" slot get
      // one (registry.ts's `styles` StyleSet). The Lexer tokenizes "{...}"
      // after *any* node name generically, so without this the slot would be
      // silently swallowed and dropped on e.g. `@heading(1){radius-12}[...]`,
      // leaving the author to wonder why their styles did nothing. Flagged
      // but still consumed, per the file-level Editor Mode comment.
      if (!nodeDef.styles) {
        // Underline just the "{" rather than the whole token: a slot the
        // author is still typing has no "}" yet, so the Lexer's token runs to
        // end-of-document and would otherwise paint the rest of the file red.
        this.diagnose(stylesTok.start, stylesTok.start + 1, `\`@${name}\` has no \`{styles}\` slot.`);
      }
      if (isColorSwatch) {
        node.color = raw.trim();
        this.diagnoseUnknownColorValue(nodeDef.name, node.color, raw, stylesTok.start);
      } else {
        node.styles = raw.split(',').map(s => s.trim()).filter(Boolean);
      }
      this.cursor++;
    } else if (isColorSwatch) {
      // No {styles} slot at all — grammatically optional, but flagged all
      // the same, since @color with no explicit value falls back to a
      // rainbow rendering (KamiAdapter.ts) rather than a plain color; @bordered
      // likewise has no meaningful "default" border color to fall back to.
      this.diagnose(token.start, token.end, `\`@${nodeDef.name}\` has no {styles} value — add \`{#hex}\` or \`{colorname}\` to pick an explicit color.`);
    }

    // A `(paren)` written after `{styles}` (e.g. `@card{radius-12}(Title)[...]`,
    // `@img{radius-8}(src=...)[...]`) is a common ordering mistake — the EBNF
    // requires [paren] before [styles] (Block Syntax Specification §5/§6/§7).
    // Flag it with a specific diagnostic and still apply it (best-effort
    // recovery, per the file-level Editor Mode comment) rather than leaving
    // the stray PAREN token to desync the content-slot check right after,
    // which would otherwise also fire a second, more confusing diagnostic.
    if (nodeDef.paren !== 'none' && node.paren === undefined && this.tokens[this.cursor]?.type === 'PAREN') {
      const parenTok = this.tokens[this.cursor];
      this.diagnose(parenTok.start, parenTok.end, `\`@${name}\`'s parenthesized ${nodeDef.parenRole ?? 'value'} must come before \`{styles}\`, not after — write \`@${name}(...)  {...}  [...]\`.`);
      node.paren = parenTok.value;
      this.cursor++;
      Object.assign(node, deriveParenFields(nodeDef.parenRole, node.paren));
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
          this.diagnose(this.cursorPos(), this.cursorPos(), `\`@${node.type}\` expects a content slot \`[...]\` immediately after it.`);
          return node;
        }
        node.raw = t.value;
        this.cursor++;
        if (nodeDef.content === 'raw-escaped') this.diagnoseRawEscapes(t);
        if (nodeDef.content === 'integer') {
          if (!/^[0-9]+$/.test(node.raw)) {
            this.diagnose(t.start, t.end, `\`@${node.type}[...]\` must contain only digits — got \`${node.raw}\` (Inline Syntax Specification §4: fn = "@fn", "[", integer, "]").`);
          } else {
            node.number = parseInt(node.raw, 10);
          }
        }
        return node;
      }

      case 'comma-list': {
        if (!this.trySlotOpen(node.type)) return node;
        const cells = this.parseInlineCellList(node.type);
        this.closeSlot(node.type);
        // Unlike @data rows, empty columns (trailing comma, "@cols[]") are dropped
        // rather than kept — there's no fixed column count to stay aligned with.
        node.columns = cells.filter(cell => cell.length > 0);
        return node;
      }

      case 'rows': {
        if (!this.trySlotOpen(node.type)) return node;
        node.rows = this.parseDataRows();
        this.closeSlot(node.type);
        return node;
      }

      case 'table': {
        if (!this.trySlotOpen(node.type)) return node;
        node.columns = [];
        node.rows = [];

        this.skipWhitespaceText();
        const colsTok = this.tokens[this.cursor];
        if (!colsTok || colsTok.type !== 'NODE' || colsTok.value !== 'cols') {
          this.diagnose(this.cursorPos(), this.cursorPos(), '`@table` requires `@cols` as its first child (Block Syntax Specification §5 Table).');
          this.skipToMatchingSlotClose();
          return node;
        }
        const colsNode = this.parseNode(node.type)!;

        this.skipWhitespaceText();
        const dataTok = this.tokens[this.cursor];
        if (!dataTok || dataTok.type !== 'NODE' || dataTok.value !== 'data') {
          this.diagnose(this.cursorPos(), this.cursorPos(), '`@table` requires `@data` as its second child, immediately after `@cols` (Block Syntax Specification §5 Table).');
          node.columns = colsNode.columns ?? [];
          this.skipToMatchingSlotClose();
          return node;
        }
        const dataNode = this.parseNode(node.type)!;

        this.skipWhitespaceText();
        this.closeSlot(node.type);

        node.columns = colsNode.columns ?? [];
        node.rows = dataNode.rows ?? [];
        return node;
      }

      case 'tabs': {
        if (!this.trySlotOpen(node.type)) return node;
        const tabs: DocASTNode[] = [];
        // eslint-disable-next-line no-constant-condition
        while (true) {
          this.skipWhitespaceText();
          const t = this.tokens[this.cursor];
          if (!t) {
            this.diagnose(this.cursorPos(), this.cursorPos(), '`@tabs[...]` is missing its closing `]`.');
            break;
          }
          if (t.type === 'SLOT_CLOSE') { this.cursor++; break; }
          if (t.type !== 'NODE' || t.value !== 'tab') {
            const found = t.type === 'NODE' ? `@${t.value}` : t.value;
            this.diagnose(t.start, t.end, `\`@tabs\` only accepts \`@tab\` children — found \`${found}\` (Block Syntax Specification §8 Tabs).`);
            // Drop the offending child (fully consumed, so the cursor stays in
            // sync) and keep collecting the remaining valid @tab children.
            if (t.type === 'NODE') this.parseNode(node.type);
            else this.cursor++;
            continue;
          }
          tabs.push(this.parseNode(node.type)!);
        }
        node.tabs = tabs;
        return node;
      }

      case 'meta': {
        if (!this.trySlotOpen(node.type)) return node;
        const raw = this.collectRawText(node.type);
        this.closeSlot(node.type);
        node.meta = {};
        raw.split('\n').forEach(line => {
          const m = line.match(/^\s*([a-zA-Z0-9_-]+)\s*=\s*(.*?)\s*$/);
          if (m) node.meta![m[1]] = m[2];
        });
        return node;
      }

      case 'generic':
      default: {
        if (!this.trySlotOpen(node.type)) return node;
        const rawContent = this.parseSlotContent(node.type);
        // @list's content is still registry 'generic' (any inline/nested node is
        // legal inside it), but its top-level shape is special: each "- "/"N. "
        // prefixed line is its own item. Post-process rather than adding a new
        // registry content mode, since the recursive inline parsing above is
        // identical either way.
        node.content = node.type === 'list' ? this.buildListItems(rawContent) : rawContent;
        this.closeSlot(node.type);
        return node;
      }
    }
  }

  /**
   * Restructures @list's flat inline content into `list-item` nodes (Block
   * Syntax Specification §5 List). A line is anything between "\n" boundaries
   * inside the content's string runs; a DocASTNode segment stays attached to
   * whichever line it falls on.
   *
   * - Every non-blank line is its own item — a leading "- " is optional and
   *   stripped when present, purely for backward compatibility with the old
   *   dash-required style; it was never required to make something an item.
   * - A leading "N. " / "N)" is also optional; when present it's stripped and
   *   kept as `marker` (only meaningful for @list(ordered), see KamiAdapter,
   *   letting the numbering jump/resume via <li value>).
   * - A line that's nothing but a single nested `@list[...]` (plus surrounding
   *   whitespace) isn't a new item — it's folded into the previous item's
   *   content as that item's sub-list.
   * - Blank lines are ignored.
   */
  private buildListItems(content: (DocASTNode | string)[]): DocASTNode[] {
    const lines: (DocASTNode | string)[][] = [[]];
    for (const seg of content) {
      if (typeof seg !== 'string') {
        lines[lines.length - 1].push(seg);
        continue;
      }
      const parts = seg.split('\n');
      lines[lines.length - 1].push(parts[0]);
      for (let k = 1; k < parts.length; k++) lines.push([parts[k]]);
    }

    const items: DocASTNode[] = [];
    const DASH_RE = /^[ \t]*-[ \t]+([\s\S]*)$/;
    const NUM_RE = /^[ \t]*(\d+)[.)][ \t]+([\s\S]*)$/;

    for (const line of lines) {
      const nodeSegs = line.filter((s): s is DocASTNode => typeof s !== 'string');
      const textSegs = line.filter((s): s is string => typeof s === 'string');
      const isBlank = nodeSegs.length === 0 && textSegs.every(t => t.trim() === '');
      if (isBlank) continue;

      const isSoleNestedList = nodeSegs.length === 1 && nodeSegs[0].type === 'list' && textSegs.every(t => t.trim() === '');
      if (isSoleNestedList && items.length > 0) {
        items[items.length - 1].content.push(nodeSegs[0]);
        continue;
      }

      const rest = line.slice();
      let marker: number | undefined;
      const first = rest[0];
      if (typeof first === 'string') {
        const dashMatch = first.match(DASH_RE);
        const numMatch = !dashMatch ? first.match(NUM_RE) : null;
        if (dashMatch) {
          rest[0] = dashMatch[1];
        } else if (numMatch) {
          marker = parseInt(numMatch[1], 10);
          rest[0] = numMatch[2];
        }
        if (rest[0] === '') rest.shift();
      }

      const item: DocASTNode = { type: 'list-item', content: rest };
      if (marker !== undefined) item.marker = marker;
      items.push(item);
    }

    return items;
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

  /**
   * Escape-awareness feedback for @raw (Inline Syntax Specification §9) — the
   * "advance notice" tier of Editor Mode. Never blocks: the content parses
   * exactly as the escape rules say either way.
   *
   * Two tiers:
   *
   *  - warning — the node shows swallow symptoms: it never found its closing
   *    "]" at all, or an escape sat at the very end of a line the content then
   *    ran past. The near-certain cause is an escape that consumed the "]" the
   *    author meant as the node's end (`@raw[@mark[hello@@]]`-style, or a
   *    trailing "@" fusing with the closer). Scoped to escape-at-line-end
   *    rather than "any newline in the content" so a deliberate multi-line
   *    @raw with mid-line escapes (e.g. Markdown import preserving an
   *    unbalanced code block) stays at the info tier.
   *
   *  - info — every other consumed escape gets a quiet heads-up that it *is*
   *    an escape (a literal bracket that neither ends the node nor counts
   *    toward depth). This is what catches the cases no heuristic can: an
   *    accidental `@]` that swallows the rest of its own line still parses
   *    "successfully", and only the author knows it wasn't meant — the note
   *    tells them what the Parser did with what they wrote.
   */
  private diagnoseRawEscapes(t: Token): void {
    const escapes = t.escapes;
    if (!escapes || escapes.length === 0) return;

    // Swallow symptoms, tightly scoped so a *deliberate* multi-line @raw with
    // mid-line escapes stays at the info tier: either the node never closed at
    // all, or an escape sits at the very end of a line the content then ran
    // past — the signature of "@mark[hello@]"-style escapes that consumed the
    // "]" the author meant as the node's end.
    const eolEscapes = escapes.filter(e => e.atLineEnd);
    const symptomatic = t.closed === false || eolEscapes.length > 0;

    if (symptomatic) {
      const culprit = t.closed === false
        ? escapes[escapes.length - 1]
        : eolEscapes[eolEscapes.length - 1];
      const symptom = t.closed === false
        ? 'the node never finds its closing "]"'
        : 'the raw content runs past the end of this line';
      this.diagnose(
        culprit.start, culprit.end,
        `This \`${culprit.seq}\` is read as @raw's escape, so it does not end the node — and ${symptom}, `
        + `which usually means it consumed the "]" that was meant as the end. Balanced brackets need no escape inside @raw; `
        + `escape only unpaired ones (Inline Syntax Specification §9).`,
        'warning',
      );
      return;
    }

    for (const esc of escapes) {
      const decoded = esc.seq === '@@]' ? '@]' : esc.seq === '@@[' ? '@[' : esc.seq === '@]' ? ']' : '[';
      this.diagnose(
        esc.start, esc.end,
        `\`${esc.seq}\` is @raw's escape for a literal "${decoded}" — it neither ends the node nor counts toward bracket depth `
        + `(Inline Syntax Specification §9).`,
        'info',
      );
    }
  }

  /**
   * @color/@bordered's {styles} value is semantically validated here purely
   * for editor feedback (Inline Syntax Specification §7 leaves token *meaning*
   * to the Renderer — an unrecognized value already falls back gracefully at
   * render time — but it's almost always a typo, or a missing value, the
   * author would want flagged, not a silent no-op). An empty `{}` counts as
   * an invalid value here too, same as a real unrecognized token — it's
   * flagged right alongside the case where {styles} is missing entirely (see
   * the call site above).
   */
  private diagnoseUnknownColorValue(nodeName: string, token: string, raw: string, stylesStart: number): void {
    if (nodeName === 'color' && token === 'rainbow') return; // intentionally undocumented — see KamiAdapter.ts's color case
    if (token && (KNOWN_COLOR_TOKENS.has(token) || HEX_STYLE_TOKEN.test(token))) return;
    const leadingWs = raw.length - raw.trimStart().length;
    const tokenStart = stylesStart + 1 + leadingWs; // +1 skips the "{" itself
    const message = token
      ? `Unrecognized value "${token}" inside @${nodeName}'s {styles} — not a known named color or hex value.`
      : `\`@${nodeName}\`'s {styles} is empty — add \`{#hex}\` or \`{colorname}\` to pick an explicit color.`;
    this.diagnose(tokenStart, tokenStart + token.length, message);
  }

  /**
   * Like parseSlotContent, but for content modes that only ever hold plain text
   * (currently just @meta's key=value lines). "@@" already resolves to a literal
   * "@" at the Lexer level (Inline Spec §2 step 1), so it never reaches here as a
   * NODE token. Void nodes (@n, content:'none') and raw-family nodes (@raw/@code/
   * @kbd/..., content:'raw'/'raw-escaped'/'key'/'integer') get a narrow carve-out
   * since they can't recursively contain more of the very commands this slot
   * forbids. Every other @command is still invalid here, but instead of throwing
   * and losing the whole document, it gets fully consumed (to keep the cursor in
   * sync), silently dropped from the output, and recorded in `diagnostics` — the
   * editor renders that as a squiggly + hover, the rendered doc simply doesn't
   * contain it.
   */
  private collectRawText(ownerName: string): string {
    let buf = '';
    let depth = 0;

    while (this.cursor < this.tokens.length) {
      const cur = this.tokens[this.cursor];
      if (cur.type === 'SLOT_CLOSE' && depth === 0) break;

      if (cur.type === 'NODE') {
        const nodeDef = getNodeDef(cur.value);
        if (nodeDef?.content === 'none') {
          buf += '\n'; // @n — line break marker; renderer turns it into <br>
          this.cursor++;
          continue;
        }
        // Only @raw itself (content mode 'raw-escaped', unique to @raw) is part of
        // @meta's grammar — NOT the rest of the raw family (@code/@mermaid/@kbd/@fn).
        // isRawFamilyContent() below is deliberately not used here: it also matches
        // 'raw'/'key'/'integer', which would silently fold @code/@mermaid/@kbd/@fn's
        // raw text into a metadata value with no diagnostic, contradicting the
        // "only plain text, @n, and @raw" message a few lines down.
        if (nodeDef?.content === 'raw-escaped') {
          this.cursor++; // consume NODE
          const rawTok = this.tokens[this.cursor];
          if (!rawTok || rawTok.type !== 'RAW') {
            this.diagnose(this.cursorPos(), this.cursorPos(), `\`@${cur.value}\` expects a content slot \`[...]\` immediately after it.`);
            continue;
          }
          buf += rawTok.value;
          this.cursor++;
          continue;
        }
        // Anything else isn't part of this slot's grammar. Rather than aborting the
        // whole document over one bad node, consume its full subtree (so the cursor
        // stays in sync), drop it from the output, and surface it as an editor
        // diagnostic instead.
        const name = cur.value;
        const start = cur.start;
        this.parseNode(ownerName);
        const end = this.tokens[this.cursor - 1]?.end ?? cur.end;
        this.diagnose(start, end, `Unsupported node "@${name}" inside @${ownerName} — only plain text, @n, and @raw are allowed here.`);
        continue; // nothing appended to buf — the node is dropped entirely
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
   * @link). Anything else is unsupported here: fully consumed (cursor stays in
   * sync), dropped from the output, and recorded as a diagnostic — same policy as
   * collectRawText, just producing structured cells instead of a flat string.
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
        if (nodeDef && isCellAllowedNode(nodeDef.name)) {
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
          // expects RAW and misreport "expects a content slot".
          if (this.tokens[this.cursor]?.type === 'PAREN') this.cursor++;
          const rawTok = this.tokens[this.cursor];
          if (!rawTok || rawTok.type !== 'RAW') {
            this.diagnose(this.cursorPos(), this.cursorPos(), `\`@${cur.value}\` expects a content slot \`[...]\` immediately after it.`);
            continue;
          }
          pushText(rawTok.value);
          this.cursor++;
          continue;
        }
        // Structural/disallowed node (e.g. @card, @table, @details) — consume its
        // full subtree, drop it, and surface a diagnostic instead of throwing.
        const name = cur.value;
        const start = cur.start;
        this.parseNode(ownerName);
        const end = this.tokens[this.cursor - 1]?.end ?? cur.end;
        this.diagnose(start, end, `Unsupported node "@${name}" inside @${ownerName} — only plain text and inline formatting (@bold, @italic, @mark, @n, @raw, ...) are allowed here.`);
        continue;
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
      if (!t) {
        this.diagnose(this.cursorPos(), this.cursorPos(), '`@data[...]` is missing its closing `]`.');
        break;
      }
      if (t.type === 'SLOT_CLOSE') break; // caller (closeSlot) consumes it

      if (t.type !== 'SLOT_OPEN') {
        this.diagnose(t.start, t.end, 'Each row inside `@data[...]` must start with `[` (Block Syntax Specification §5 Table).');
        this.cursor++; // drop the stray token and keep looking for the next real row
        continue;
      }
      this.cursor++; // consume the row's own "["
      // Unlike @cols, empty cells are kept (not filtered) — a row's cell count
      // must stay aligned with the table's column count.
      const cells = this.parseInlineCellList('data row');
      this.closeSlot('data row');
      rows.push(cells);
    }
    return rows;
  }

  private skipWhitespaceText(): void {
    while (this.tokens[this.cursor]?.type === 'TEXT' && this.tokens[this.cursor].value.trim() === '') {
      this.cursor++;
    }
  }

  /**
   * Scans forward tracking SLOT_OPEN/SLOT_CLOSE depth until the bracket that
   * was already opened by the caller (depth starts at 1, representing that
   * "[") finds its match — used to abandon a structurally malformed construct
   * (e.g. `@table` missing `@cols`/`@data`) without losing cursor sync with
   * the rest of the document. Runs out cleanly at end-of-input.
   */
  private skipToMatchingSlotClose(): void {
    let depth = 1;
    while (this.cursor < this.tokens.length) {
      const t = this.tokens[this.cursor];
      if (t.type === 'SLOT_OPEN') depth++;
      if (t.type === 'SLOT_CLOSE') {
        depth--;
        if (depth === 0) { this.cursor++; return; }
      }
      this.cursor++;
    }
  }

  /** Like the old expectSlotOpen, but returns success instead of throwing — a missing "[" is a diagnostic, and the node is left with empty/default content. */
  private trySlotOpen(ownerName: string): boolean {
    const t = this.tokens[this.cursor];
    if (!t || t.type !== 'SLOT_OPEN') {
      this.diagnose(this.cursorPos(), this.cursorPos(), `\`@${ownerName}\` expects a content slot \`[...]\` immediately after it.`);
      return false;
    }
    this.cursor++;
    return true;
  }

  /**
   * Like the old expectSlotClose, but records a diagnostic instead of
   * throwing when the closing "]" is missing. Every content-collecting loop
   * that calls this (parseSlotContent, parseInlineCellList, parseDataRows,
   * the @table/@tabs child loops) only stops without consuming a SLOT_CLOSE
   * when the token stream itself has run out — so reaching here without one
   * always means end-of-input, i.e. an unclosed bracket. Editor Mode treats
   * that as "auto-close at EOF" rather than aborting the whole document.
   */
  private closeSlot(ownerName: string): void {
    const t = this.tokens[this.cursor];
    if (!t || t.type !== 'SLOT_CLOSE') {
      this.diagnose(this.cursorPos(), this.cursorPos(), `\`@${ownerName}\` is missing its closing \`]\` (unexpected end of input).`);
      return;
    }
    this.cursor++;
  }
}
