// Adapters — render a DocASTNode tree to HTML.
//
// Tag choices follow the "Renderer Independence" examples already committed
// to in the syntax/ reference docs (Structural-Blocks.md §6, Container-Blocks.md
// §7, Callout-Blocks.md §8, Widget-Blocks.md §6, Text-Formatting.md §7,
// Semantic-Inline.md §6, Footnotes.md §7, Special-Nodes.md §8) — this file
// exists to make those examples real, not to invent new ones.
//
// Two routes, differing only where the grammar actually has something to
// differ on — @mark's, @color's, and @bordered's color tokens (Inline Syntax
// Specification §7, Block Syntax Specification §4) and @card's Card Style v1
// tokens (Block Syntax Specification §6) are the only per-instance style
// slots this Adapter maps to output with a real Route A/B split (class-driven
// vs inline CSS). @img's Image Style v1 (§5, resolveImageStyles()) is also
// mapped, but always as inline style on both routes — same as the pre-existing
// "(radius=...,border=...)" image options it layers on top of, no Tailwind
// class equivalent attempted. @details and the Callout Blocks also carry a
// parsed `styles` slot (registry.ts's `styles` StyleSet) that this Adapter
// doesn't yet map to visual output. Everything else renders identically on
// both routes.

import type { DocASTNode } from './types.ts';

type Route = 'tailwind' | 'inline';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const MARK_COLORS: Record<string, string> = {
  yellow: '#fff3a3',
  red: '#ffd2d2',
  green: '#d2ffd2',
  blue: '#d2e8ff',
  orange: '#ffe1c2',
  purple: '#e8d2ff',
  gray: '#e0e0e0',
};
// @color's own named-token palette — deliberately a separate table from
// MARK_COLORS: those are pale shades tuned for @mark's highlight background,
// and would read as low-contrast, barely-visible text if reused here as a
// foreground color, so @color gets its own darker, text-appropriate values.
const COLOR_PRESETS: Record<string, string> = {
  yellow: '#9A7B00',
  red: '#A33A3A',
  green: '#3F7A4A',
  blue: '#3569A8',
  orange: '#A9652A',
  purple: '#76509A',
  gray: '#666666',
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const RADIUS_TOKEN = /^radius-(\d+)$/;

/**
 * @mark's {styles} color-token resolver — accepts either a named token
 * (Inline Syntax Specification §7) or a literal "#RRGGBB" hex token.
 * Unknown/malformed tokens resolve to undefined so callers can fall back
 * silently, per §6 Unknown Command Fallback's ignore-don't-throw spirit.
 */
function resolveColorToken(token: string | undefined): string | undefined {
  if (!token) return undefined;
  if (HEX_COLOR.test(token)) return token;
  return MARK_COLORS[token];
}

/** Same idea as resolveColorToken(), but for @color's own {styles} slot and its separate, darker palette (COLOR_PRESETS). */
function resolveColorPreset(token: string | undefined): string | undefined {
  if (!token) return undefined;
  if (HEX_COLOR.test(token)) return token;
  return COLOR_PRESETS[token];
}

/**
 * @card's {styles} resolver — Card Style v1 (Container-Blocks.md §4 Card).
 * Deliberately a closed, cross-platform set of two token shapes, not a CSS
 * escape hatch: a literal "#RRGGBB" hex token for background-color, and a
 * "radius-N" token for a border-radius of N pixels. No named-token palette
 * like @mark/@color have — either token may be present, absent, or both
 * (comma-separated, order doesn't matter); anything else in the list is
 * silently ignored, per §6 Unknown Command Fallback's ignore-don't-throw
 * spirit.
 */
function resolveCardStyles(tokens: string[] | undefined): { background?: string; radiusToken?: string; radius?: string } {
  const background = tokens?.find(t => HEX_COLOR.test(t));
  const radiusToken = tokens?.find(t => RADIUS_TOKEN.test(t));
  const radius = radiusToken ? `${radiusToken.match(RADIUS_TOKEN)![1]}px` : undefined;
  return { background, radiusToken, radius };
}

/**
 * @img's {styles} resolver — Image Style v1 (Block Syntax Specification §5
 * Image). Same two token shapes as Card Style v1 (RADIUS_TOKEN/HEX_COLOR are
 * shared), reused for a different, image-appropriate meaning: a "radius-N"
 * token still means border-radius, but the hex token means *border color*
 * here rather than background — an image already has its own pixel content,
 * so "paint a background behind it" isn't the useful knob a border is. Both
 * radius and border are opt-in (no styles at all → a bare, undecorated
 * <img>, unlike @card whose default radius/background comes from the
 * Renderer's own stylesheet) — that's the point of putting this behind
 * {styles} rather than giving @img the same always-on treatment as @card.
 */
function resolveImageStyles(tokens: string[] | undefined): { borderColor?: string; radiusToken?: string; radius?: string } {
  const borderColor = tokens?.find(t => HEX_COLOR.test(t));
  const radiusToken = tokens?.find(t => RADIUS_TOKEN.test(t));
  const radius = radiusToken ? `${radiusToken.match(RADIUS_TOKEN)![1]}px` : undefined;
  return { borderColor, radiusToken, radius };
}

/** URI scheme inference — Inline Syntax Specification §8 @link URI Semantics. */
function resolveUri(raw: string): string {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return raw; // explicit scheme: MUST be used as-is
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return `mailto:${raw}`;
  if (/^\+?[0-9][0-9\- ]*$/.test(raw)) return `tel:${raw.replace(/[\s-]/g, '')}`;
  return `https://${raw}`;
}

/**
 * True for a text child that's pure formatting whitespace — the author
 * pretty-printed a nested node onto its own indented line, and the Parser
 * (deliberately, per spec — no implicit trimming) kept that indentation as
 * a literal text node. Rendered as-is, it becomes a real, visible space
 * sitting right against the adjacent node's tag boundary (CSS only trims
 * collapsible whitespace at a *line* edge, not at an inline element's inner
 * edge), which is especially obvious once that node has a background or
 * border (@mark, @bordered). A same-line run of spaces with no newline is
 * left untouched — that's the author actually asking for a visible gap.
 */
function isIndentationWhitespace(s: string): boolean {
  return s.includes('\n') && /^\s*$/.test(s);
}

function renderChildren(content: (DocASTNode | string)[], route: Route): string {
  return content
    .map(c => {
      if (typeof c !== 'string') return renderNode(c, route);
      return isIndentationWhitespace(c) ? '' : escapeHtml(c);
    })
    .join('');
}

/**
 * Recursively collects the plain text of a content list, discarding any
 * formatting nodes' tags — used where the output must be text-only (e.g.
 * @img's alt attribute), unlike renderChildren() which renders real markup.
 * A formatting node (e.g. @bold) contributes its own nested content's text;
 * a raw-family node (e.g. @kbd, which has no `content`) contributes its
 * `.raw` text instead.
 */
function extractPlainText(content: (DocASTNode | string)[]): string {
  return content.map(c => {
    if (typeof c === 'string') return c;
    if (c.content.length) return extractPlainText(c.content);
    return c.raw ?? '';
  }).join('');
}

function renderMark(node: DocASTNode, route: Route): string {
  const tokens = node.styles ?? [];
  const colorToken = tokens.find(t => resolveColorToken(t) !== undefined);
  const resolvedColor = resolveColorToken(colorToken);
  const inner = renderChildren(node.content, route);

  if (route === 'inline') {
    const styleAttr = resolvedColor ? ` style="background-color: ${resolvedColor};"` : '';
    return `<mark${styleAttr}>${inner}</mark>`;
  }

  // A literal hex token has no Tailwind-style class equivalent — fall back to inline style for it.
  const isNamedColor = colorToken !== undefined && !HEX_COLOR.test(colorToken);
  const classes = ['mark', ...(isNamedColor ? [`mark-${colorToken}`] : [])];
  const hexStyle = colorToken && !isNamedColor ? ` style="background-color: ${resolvedColor};"` : '';
  return `<mark class="${classes.join(' ')}"${hexStyle}>${inner}</mark>`;
}

/**
 * @bordered — shares @color's exact {styles} slot and darker COLOR_PRESETS
 * swatch (resolveColorPreset), just painted onto a border instead of a
 * foreground color. Retires @mark's old 'bordered' modifier token in favor
 * of being its own first-class node, the same way 'underline' already has
 * its own @underline node and 'strikethrough' already has @del.
 */
function renderBordered(node: DocASTNode, route: Route): string {
  const resolvedColor = resolveColorPreset(node.color) ?? 'currentColor';
  const inner = renderChildren(node.content, route);

  if (route === 'inline') {
    return `<span style="border: 1px solid ${resolvedColor};">${inner}</span>`;
  }

  const isNamedColor = node.color !== undefined && resolveColorPreset(node.color) !== undefined && !HEX_COLOR.test(node.color);
  const classes = ['bordered', ...(isNamedColor ? [`bordered-${node.color}`] : [])];
  const hexStyle = !isNamedColor ? ` style="border: 1px solid ${resolvedColor};"` : '';
  return `<span class="${classes.join(' ')}"${hexStyle}>${inner}</span>`;
}

function renderColor(node: DocASTNode, route: Route): string {
  // @color is for a precise text color; unlike @mark it doesn't fall back to
  // a default when the token is missing/unrecognized (this Adapter doesn't
  // maintain a "default color" concept for either node) — an unresolved
  // token just renders as a plain, uncolored <span>, per the Unknown Command
  // Fallback ignore-don't-throw spirit (Inline Spec §6).
  const colorToken = node.color;
  const resolvedColor = resolveColorPreset(colorToken);
  const inner = renderChildren(node.content, route);

  if (route === 'inline') {
    const styleAttr = resolvedColor ? ` style="color: ${resolvedColor};"` : '';
    return `<span${styleAttr}>${inner}</span>`;
  }

  // A literal hex token has no Tailwind-style class equivalent — fall back to inline style for it.
  const isNamedColor = resolvedColor !== undefined && !HEX_COLOR.test(colorToken!);
  const classes = ['color', ...(isNamedColor ? [`color-${colorToken}`] : [])];
  const hexStyle = resolvedColor && !isNamedColor ? ` style="color: ${resolvedColor};"` : '';
  return `<span class="${classes.join(' ')}"${hexStyle}>${inner}</span>`;
}

/**
 * @card — Card Style v1's two per-instance styles (see resolveCardStyles()).
 * A hex background has no Tailwind-style class equivalent, so it always
 * falls back to inline style on both routes; radius-N is already a valid
 * class-name fragment, so the tailwind route gets a "card-radius-N" modifier
 * class instead, the same way @mark gets "mark-<token>".
 */
function renderCard(node: DocASTNode, route: Route): string {
  const { background, radiusToken, radius } = resolveCardStyles(node.styles);
  const header = node.title ? `<header>${escapeHtml(node.title)}</header>` : '';
  const inner = renderChildren(node.content, route);

  if (route === 'inline') {
    const styleParts: string[] = [];
    if (background) styleParts.push(`background-color: ${background};`);
    if (radius) styleParts.push(`border-radius: ${radius};`);
    const styleAttr = styleParts.length ? ` style="${styleParts.join(' ')}"` : '';
    return `<article${styleAttr}>${header}${inner}</article>`;
  }

  const classes = ['card', ...(radiusToken ? [`card-${radiusToken}`] : [])];
  const styleAttr = background ? ` style="background-color: ${background};"` : '';
  return `<article class="${classes.join(' ')}"${styleAttr}>${header}${inner}</article>`;
}

/**
 * @svg is a raw pass-through node (Widget-Blocks-style raw content, like
 * @mermaid) — its content is trusted markup the Renderer emits unescaped so
 * the browser actually draws the vector graphic instead of printing source.
 * Because that crosses a trust boundary, strip <script> and on*="" handlers
 * before emitting rather than passing the source through untouched.
 */
function sanitizeSvg(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
}

function renderList(node: DocASTNode, route: Route): string {
  // @list items are structured 'list-item' nodes built by the Parser
  // (Structural-Blocks.md §5 List) — every non-empty line is an item, so
  // nested inline nodes (e.g. @bold) inside an item render correctly instead
  // of being flattened to text first. A nested @list is just another content
  // node inside an item, so renderChildren recurses back into renderList for it.
  const items = node.items ?? [];
  const tag = node.ordered ? 'ol' : 'ul';
  if (items.length === 0) return `<${tag}></${tag}>`;
  const li = items.map(i => {
    const valueAttr = node.ordered && i.marker !== undefined ? ` value="${i.marker}"` : '';
    return `<li${valueAttr}>${renderChildren(i.content, route)}</li>`;
  }).join('');
  return `<${tag}>${li}</${tag}>`;
}

function renderTabs(node: DocASTNode, route: Route): string {
  const tabs = node.tabs ?? [];
  const tablist = tabs
    .map((t, i) => `<button role="tab" aria-controls="tab-panel-${i}">${escapeHtml(t.title ?? '')}</button>`)
    .join('');
  const panels = tabs
    .map((t, i) => `<div role="tabpanel" id="tab-panel-${i}">${renderChildren(t.content, route)}</div>`)
    .join('');
  return `<div class="tabs"><div role="tablist">${tablist}</div>${panels}</div>`;
}

function renderNode(node: DocASTNode, route: Route): string {
  switch (node.type) {
    // Metadata — not rendered as visible HTML (Block Syntax Specification §9).
    case 'meta':
      return '';

    // Structural Blocks
    case 'heading':
      return `<h${node.level ?? 1}>${renderChildren(node.content, route)}</h${node.level ?? 1}>`;
    case 'paragraph':
      return `<p>${renderChildren(node.content, route)}</p>`;
    case 'quote':
      return `<blockquote>${renderChildren(node.content, route)}</blockquote>`;
    case 'list':
      return renderList(node, route);
    case 'code':
      return `<pre><code class="language-${escapeHtml(node.language ?? 'text')}">${escapeHtml(node.raw ?? '')}</code></pre>`;
    case 'img': {
      const opts = node.imgOptions ?? {};
      const alt = extractPlainText(node.content).trim();
      const attrs = [`src="${escapeHtml(opts.src ?? '')}"`, `alt="${escapeHtml(alt)}"`];
      if (opts.width) attrs.push(`width="${escapeHtml(opts.width)}"`);
      if (opts.height) attrs.push(`height="${escapeHtml(opts.height)}"`);
      const styleParts: string[] = [];
      if (opts.align) {
        const margin = opts.align === 'center' ? '0 auto' : opts.align === 'right' ? '0 0 0 auto' : '0';
        styleParts.push(`display:block;margin:${margin};`);
      }
      // Image Style v1 ({radius-N,#hex} — see resolveImageStyles()) takes
      // priority over the older, free-form "(radius=...,border=...)" image
      // options when both are present, since the closed {styles} token set
      // is the more deliberate, more recent input; either source alone still
      // works on its own.
      const { borderColor, radius: styleRadius } = resolveImageStyles(node.styles);
      const radius = styleRadius ?? opts.radius;
      const border = borderColor ? `1px solid ${borderColor}` : opts.border;
      if (radius) styleParts.push(`border-radius:${escapeHtml(radius)};`);
      if (border) styleParts.push(`border:${escapeHtml(border)};`);
      if (styleParts.length) attrs.push(`style="${styleParts.join('')}"`);
      return `<img ${attrs.join(' ')}>`;
    }
    case 'table': {
      // columns/rows hold inline content (text + a curated set of formatting
      // nodes, see registry.ts's isCellAllowedNode), same shape as `content`
      // elsewhere — render it the same way, then turn @n's "\n" marker into <br>.
      const thead = `<thead><tr>${(node.columns ?? []).map(c => `<th>${renderChildren(c, route).replace(/\n/g, '<br>')}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${(node.rows ?? [])
        .map(r => `<tr>${r.map(cell => `<td>${renderChildren(cell, route).replace(/\n/g, '<br>')}</td>`).join('')}</tr>`)
        .join('')}</tbody>`;
      return `<table>${thead}${tbody}</table>`;
    }
    case 'hr':
      return '<hr>';
    case 'svg':
      return sanitizeSvg(node.raw ?? '');

    // Container Blocks
    case 'details':
      return `<details><summary>${escapeHtml(node.title ?? 'Details')}</summary>${renderChildren(node.content, route)}</details>`;
    case 'card':
      return renderCard(node, route);

    // Callout Blocks
    case 'note':
    case 'tip':
    case 'important':
    case 'warning':
    case 'caution':
      return `<aside class="${node.type}">${node.title ? `<strong>${escapeHtml(node.title)}</strong> ` : ''}${renderChildren(node.content, route)}</aside>`;

    // Widget Blocks
    case 'tabs':
      return renderTabs(node, route);
    case 'tab':
      // Standalone rendering fallback — normally only reached via @tabs.
      return `<section><h4>${escapeHtml(node.title ?? '')}</h4>${renderChildren(node.content, route)}</section>`;
    case 'mermaid':
      return `<pre class="mermaid">${escapeHtml(node.raw ?? '')}</pre>`;

    // Text Formatting
    case 'bold':
      return `<strong>${renderChildren(node.content, route)}</strong>`;
    case 'italic':
      return `<em>${renderChildren(node.content, route)}</em>`;
    case 'underline':
      return `<u>${renderChildren(node.content, route)}</u>`;
    case 'del':
      return `<del>${renderChildren(node.content, route)}</del>`;
    case 'mark':
      return renderMark(node, route);
    case 'color':
      return renderColor(node, route);
    case 'bordered':
      return renderBordered(node, route);
    case 'raw':
      return escapeHtml(node.raw ?? '');

    // Semantic Inline
    case 'sup':
      return `<sup>${renderChildren(node.content, route)}</sup>`;
    case 'sub':
      return `<sub>${renderChildren(node.content, route)}</sub>`;
    case 'kbd':
      return `<kbd>${escapeHtml(node.raw ?? '')}</kbd>`;
    case 'link':
      return `<a href="${escapeHtml(resolveUri(node.uri ?? ''))}">${renderChildren(node.content, route)}</a>`;

    // Footnotes
    // @defn is a plain inline-node (Footnotes.md §4) — an author writing it
    // as its own line at the document's end (the documented convention) gets
    // it wrapped in an implicit <p> by the Parser's paragraph aggregation.
    // Rendering it here as `<li>` (as this case used to) put flow content
    // inside phrasing-only content, which browsers "fix" by force-closing
    // the <p> right before it, splitting it into two empty <p></p>. So
    // @defn renders as nothing in place; DocTranspiler.renderFootnotes()
    // collects every @defn in the document and renders them together as one
    // real <ol> — the "collected footnotes list" registry.ts already assumed
    // existed (see its CELL_ALLOWED_INLINE comment).
    case 'defn':
      return '';
    case 'fn':
      return `<sup id="fnref${node.number}"><a href="#fn${node.number}">${node.number}</a></sup>`;

    // Special Nodes
    case 'n':
      return '<br>';

    default:
      // Should be unreachable — every registered node is handled above.
      return `<div data-node="${escapeHtml(node.type)}">${renderChildren(node.content, route)}</div>`;
  }
}

/**
 * Renders a single @defn as a real footnotes-list item — unlike the 'defn'
 * case in renderNode() (which renders nothing in-place, see there for why),
 * this is only ever called on nodes already inside the <ol> built by
 * DocTranspiler.renderFootnotes(), where a bare <li> is legal HTML.
 */
function renderFootnoteItem(node: DocASTNode, route: Route): string {
  return `<li id="fn${escapeHtml(node.id ?? '')}">${renderChildren(node.content, route)} <a href="#fnref${escapeHtml(node.id ?? '')}">↩</a></li>`;
}

/**
 * Walks the whole document (recursively — @defn is a plain inline-node, so
 * it can appear nested inside @quote/@list/@table cells/etc., not just at
 * the top level) collecting every @defn in document order. A @defn's own
 * content isn't walked any further once collected — nesting a @defn inside
 * another @defn isn't a meaningful/supported pattern (Footnotes.md §4 only
 * documents ordinary inline content there), so there's nothing useful to
 * find by recursing past it.
 */
function collectFootnoteDefns(nodes: (DocASTNode | string)[]): DocASTNode[] {
  const found: DocASTNode[] = [];
  const visit = (n: DocASTNode) => {
    if (n.type === 'defn') {
      found.push(n);
      return;
    }
    for (const c of n.content ?? []) {
      if (typeof c !== 'string') visit(c);
    }
    for (const col of n.columns ?? []) {
      for (const c of col) if (typeof c !== 'string') visit(c);
    }
    for (const row of n.rows ?? []) {
      for (const cell of row) for (const c of cell) if (typeof c !== 'string') visit(c);
    }
    for (const t of n.tabs ?? []) visit(t);
    for (const item of n.items ?? []) visit(item);
  };
  for (const n of nodes) {
    if (typeof n !== 'string') visit(n);
  }
  return found;
}

export class DocTranspiler {
  /** Route A — class-driven (Tailwind-style) output. */
  public static toTailwindHTML(node: DocASTNode): string {
    return renderNode(node, 'tailwind');
  }

  /** Route B — inline-style output, for universal/legacy targets. */
  public static toInlineStyleHTML(node: DocASTNode): string {
    return renderNode(node, 'inline');
  }

  /**
   * Collects every @defn in the document and renders them as one real
   * <ol> at the call site's choosing (normally once, after the full
   * document body) — see the 'defn' case in renderNode() for why in-place
   * rendering isn't an option. Returns '' when the document has no
   * footnotes, so callers can append unconditionally.
   */
  public static renderFootnotes(nodes: DocASTNode[], route: Route): string {
    const defns = collectFootnoteDefns(nodes);
    if (defns.length === 0) return '';
    const items = defns.map(n => renderFootnoteItem(n, route)).join('');
    return route === 'tailwind' ? `<ol class="footnotes">${items}</ol>` : `<ol>${items}</ol>`;
  }
}
