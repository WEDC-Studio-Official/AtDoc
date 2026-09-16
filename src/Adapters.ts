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
// parsed `styles` slot (registry.ts `styles: true`) but this Adapter doesn't
// yet map it to visual output. Everything else renders identically on both routes.

import type { DocASTNode } from './types.js';

type Route = 'tailwind' | 'inline';

// Single-pass escape instead of four chained .replace() calls — each chained
// call allocated its own intermediate string, which showed up as a real
// contributor to GC pressure (StringAdd_CheckNone) on large/text-heavy
// documents (see docs/benchmark.md's Local Environment stage investigation).
// One pass over the string with a lookup table does the same job with a
// quarter of the intermediate allocations.
const ESCAPE_MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const ESCAPE_RE = /[&<>"]/g;
function escapeHtml(s: string): string {
  return s.replace(ESCAPE_RE, (c) => ESCAPE_MAP[c]);
}

// Word's actual Text Highlight Color swatches (Home > Text Highlight Color),
// not a muted/pastel reinterpretation — index.css's `.mark-<token>` classes
// (Route A) mirror these exact values, and `mark` there forces black ink on
// top of them the same way Word never recolors text to match the highlight
// it sits on. orange has no Word highlighter swatch (only 15 fixed colors,
// none named "orange") — borrowed from Word's Standard Colors row instead.
const MARK_COLORS: Record<string, string> = {
  yellow: '#FFFF00',
  red: '#FF0000',
  green: '#00FF00',
  blue: '#0000FF',
  orange: '#FFC000',
  purple: '#800080',
  gray: '#808080',
};
// @color's own named-token palette — deliberately a separate table from
// MARK_COLORS: those are Word's highlight-background swatches, and would read
// as low-contrast, barely-visible text if reused here as a foreground color,
// so @color gets Word's Font Color "Standard Colors" row instead — the same
// per-key split, just Word's other palette rather than a softened one.
// index.css's `.color-<token>`/`.bordered-<token>` classes mirror these.
const COLOR_PRESETS: Record<string, string> = {
  yellow: '#FFFF00',
  red: '#FF0000',
  green: '#00B050',
  blue: '#0070C0',
  orange: '#FFC000',
  purple: '#7030A0',
  gray: '#808080',
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
 * <img>). Explicit {styles} values control the image's border and radius.
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

// Shared output buffer for a single top-level render() call, filled by an
// explicit-stack tree walk instead of ordinary recursion — see the `Frame`
// machinery below. Two separate problems this solves together:
//
//  1. (allocation cost) The old shape had every render*() function return a
//     freshly `.join('')`-ed string that its caller re-embedded in a
//     template literal — a node N levels deep had its rendered text copied
//     again at every one of those N levels on the way back up. Pushing
//     pieces into one shared array and joining exactly once, at the
//     DocTranspiler.toTailwindHTML/toInlineStyleHTML boundary, makes total
//     copying O(output size) instead of O(output size x average depth).
//  2. (stack depth) Plain recursion — renderNode() calling renderChildren()
//     calling renderNode() for each nested node — costs one native JS call
//     stack frame per nesting level. A document with a few thousand levels
//     of nesting (e.g. @bold repeated deeply, or a deeply nested @list) hit
//     "RangeError: Maximum call stack size exceeded" this way — confirmed by
//     hand: this repo's own renderer threw somewhere between 900 and 2000
//     levels of @bold nesting, well within what a generated or
//     copy-pasted-many-times document could produce.
//
// The fix for both: never let rendering one node's children happen via an
// actual function call that itself renders grandchildren before returning.
// Instead, `pushNodeFrames()` below only ever *schedules* work — it pushes
// `Frame`s (open-tag string / a children list to expand later / close-tag
// string) onto an explicit array-backed stack and returns immediately, with
// nothing left pending on the real call stack. `runFrames()` is the one
// place doing repeated work, and it's a flat `while` loop, not recursion —
// so stack depth there is O(1) regardless of document nesting depth; only
// the heap-allocated `stack` array grows with nesting, and that has no
// V8-imposed ceiling the way the native call stack does.
//
// See docs/benchmark.md's Local Environment stage investigation for where
// problem 1 was flagged first; problem 2 was found independently while
// verifying that fix didn't (and structurally couldn't) also fix problem 2.
type Out = string[];

type Frame =
  | string
  | { t: 'children'; content: (DocASTNode | string)[]; route: Route }
  | { t: 'node'; node: DocASTNode; route: Route };

/**
 * Pushes `close`, then a children-frame for `content`, then `open`, in that
 * order — since `stack` is popped LIFO, that makes `open` pop first, then
 * `content`'s own expansion (which may push further frames of its own,
 * arbitrarily deep, all still flat iterations of the same `runFrames` loop),
 * then finally `close`. This is the "open tag, render children, close tag"
 * shape most node types share; the handful that don't (list items, tab
 * triggers/panels — each has its own per-item open/children/close group to
 * sequence) push their own frames directly instead of calling this once.
 */
function pushWrap(stack: Frame[], open: string, content: (DocASTNode | string)[], close: string, route: Route): void {
  stack.push(close);
  stack.push({ t: 'children', content, route });
  stack.push(open);
}

/** Pushes `items` onto `stack` in reverse — so that popping (LIFO) restores their original forward order. Shared by every multi-item case (list, tabs, footnotes) that pushes several same-shaped groups in a row. */
function pushReversed<T>(stack: T[], items: readonly T[]): void {
  for (let i = items.length - 1; i >= 0; i--) stack.push(items[i]);
}

/** The one place that actually does repeated work — everything else only ever pushes onto `stack` and returns. See the `Out`/`Frame` comment above for why this is a flat loop and not recursion. */
function runFrames(stack: Frame[], out: Out): void {
  while (stack.length > 0) {
    const frame = stack.pop()!;
    if (typeof frame === 'string') {
      out.push(frame);
      continue;
    }
    if (frame.t === 'children') {
      const items = frame.content;
      for (let i = items.length - 1; i >= 0; i--) {
        const c = items[i];
        if (typeof c === 'string') {
          if (!isIndentationWhitespace(c)) stack.push(escapeHtml(c));
        } else {
          stack.push({ t: 'node', node: c, route: frame.route });
        }
      }
      continue;
    }
    pushNodeFrames(stack, frame.node, frame.route);
  }
}

/**
 * Renders into a fresh, isolated stack+buffer — for the rare call sites
 * (table cells) that need the complete rendered string in hand before
 * continuing, e.g. to post-process it with .replace(). Safe to run as its
 * own bounded loop rather than pushing onto the caller's `stack`: a table
 * cell's content is restricted by registry.ts's isCellAllowedNode to a
 * shallow set of inline formatting nodes — it can never itself contain the
 * pathological nesting depth this file's `Frame` machinery exists to
 * survive, no matter how deeply the table *itself* is nested inside other
 * content (that ancestor chain is still walked by the caller's own
 * `runFrames`, never by real recursion).
 */
function renderChildrenToString(content: (DocASTNode | string)[], route: Route): string {
  const out: Out = [];
  runFrames([{ t: 'children', content, route }], out);
  return out.join('');
}

/**
 * Recursively collects the plain text of a content list, discarding any
 * formatting nodes' tags — used where the output must be text-only (e.g.
 * @img's alt attribute), unlike the main renderer which renders real markup.
 * A formatting node (e.g. @bold) contributes its own nested content's text;
 * a raw-family node (e.g. @kbd, which has no `content`) contributes its
 * `.raw` text instead. Plain recursion (not the `Frame`/`runFrames` scheme
 * above) — @img's own content is where this is reached from, and that's a
 * single inline node's alt-text source, not the whole-document nesting depth
 * the Frame machinery exists to survive; a document deep enough for this to
 * matter would need to nest an @img's alt content itself, not just nest
 * unrelated content elsewhere and happen to contain an @img somewhere in it.
 */
function extractPlainText(content: (DocASTNode | string)[]): string {
  return content.map(c => {
    if (typeof c === 'string') return c;
    if (c.content.length) return extractPlainText(c.content);
    return c.raw ?? '';
  }).join('');
}

function pushMark(stack: Frame[], node: DocASTNode, route: Route): void {
  const tokens = node.styles ?? [];
  const colorToken = tokens.find(t => resolveColorToken(t) !== undefined);
  const resolvedColor = resolveColorToken(colorToken);

  if (route === 'inline') {
    const styleAttr = resolvedColor ? ` style="background-color: ${resolvedColor};"` : '';
    pushWrap(stack, `<mark${styleAttr}>`, node.content, '</mark>', route);
    return;
  }

  // A literal hex token has no Tailwind-style class equivalent — fall back to inline style for it.
  const isNamedColor = colorToken !== undefined && !HEX_COLOR.test(colorToken);
  const classes = ['mark', ...(isNamedColor ? [`mark-${colorToken}`] : [])];
  const hexStyle = colorToken && !isNamedColor ? ` style="background-color: ${resolvedColor};"` : '';
  pushWrap(stack, `<mark class="${classes.join(' ')}"${hexStyle}>`, node.content, '</mark>', route);
}

/**
 * @bordered — shares @color's exact {styles} slot and darker COLOR_PRESETS
 * swatch (resolveColorPreset), just painted onto a border instead of a
 * foreground color. Retires @mark's old 'bordered' modifier token in favor
 * of being its own first-class node, the same way 'underline' already has
 * its own @underline node and 'strikethrough' already has @del.
 */
function pushBordered(stack: Frame[], node: DocASTNode, route: Route): void {
  const resolvedColor = resolveColorPreset(node.color) ?? 'currentColor';

  if (route === 'inline') {
    pushWrap(stack, `<span style="border: 1px solid ${resolvedColor};">`, node.content, '</span>', route);
    return;
  }

  const isNamedColor = node.color !== undefined && resolveColorPreset(node.color) !== undefined && !HEX_COLOR.test(node.color);
  const classes = ['bordered', ...(isNamedColor ? [`bordered-${node.color}`] : [])];
  const hexStyle = !isNamedColor ? ` style="border: 1px solid ${resolvedColor};"` : '';
  pushWrap(stack, `<span class="${classes.join(' ')}"${hexStyle}>`, node.content, '</span>', route);
}

function pushColor(stack: Frame[], node: DocASTNode, route: Route): void {
  // @color is for a precise text color; unlike @mark it doesn't fall back to
  // a default when the token is missing/unrecognized (this Adapter doesn't
  // maintain a "default color" concept for either node) — an unresolved
  // token just renders as a plain, uncolored <span>, per the Unknown Command
  // Fallback ignore-don't-throw spirit (Inline Spec §6).
  const colorToken = node.color;
  const resolvedColor = resolveColorPreset(colorToken);

  if (route === 'inline') {
    const styleAttr = resolvedColor ? ` style="color: ${resolvedColor};"` : '';
    pushWrap(stack, `<span${styleAttr}>`, node.content, '</span>', route);
    return;
  }

  // A literal hex token has no Tailwind-style class equivalent — fall back to inline style for it.
  const isNamedColor = resolvedColor !== undefined && !HEX_COLOR.test(colorToken!);
  const classes = ['color', ...(isNamedColor ? [`color-${colorToken}`] : [])];
  const hexStyle = resolvedColor && !isNamedColor ? ` style="color: ${resolvedColor};"` : '';
  pushWrap(stack, `<span class="${classes.join(' ')}"${hexStyle}>`, node.content, '</span>', route);
}

/**
 * @card — Card Style v1's two per-instance styles (see resolveCardStyles()).
 * A hex background has no Tailwind-style class equivalent, so it always
 * falls back to inline style on both routes; radius-N is already a valid
 * class-name fragment, so the tailwind route gets a "card-radius-N" modifier
 * class instead, the same way @mark gets "mark-<token>".
 */
function pushCard(stack: Frame[], node: DocASTNode, route: Route): void {
  const { background, radiusToken, radius } = resolveCardStyles(node.styles);
  const header = node.title ? `<header>${escapeHtml(node.title)}</header>` : '';

  if (route === 'inline') {
    const styleParts: string[] = [];
    if (background) styleParts.push(`background-color: ${background};`);
    if (radius) styleParts.push(`border-radius: ${radius};`);
    const styleAttr = styleParts.length ? ` style="${styleParts.join(' ')}"` : '';
    pushWrap(stack, `<article${styleAttr}>${header}`, node.content, '</article>', route);
    return;
  }

  const classes = ['card', ...(radiusToken ? [`card-${radiusToken}`] : [])];
  const styleAttr = background ? ` style="background-color: ${background};"` : '';
  pushWrap(stack, `<article class="${classes.join(' ')}"${styleAttr}>${header}`, node.content, '</article>', route);
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

/**
 * Pushes frames for a sequence of same-shaped `open, children, close` groups
 * — one call site instead of duplicating the "push in reverse so the group
 * order comes out forward" dance in @list/@tabs/footnotes separately. `make`
 * computes one item's (open, content, close) triple; items are pushed group
 * by group from last to first so the *first* item's `open` ends up on top of
 * the stack (popped, i.e. emitted, first).
 */
function pushGroups<T>(stack: Frame[], items: readonly T[], route: Route, make: (item: T, index: number) => { open: string; content: (DocASTNode | string)[]; close: string }): void {
  for (let i = items.length - 1; i >= 0; i--) {
    const { open, content, close } = make(items[i], i);
    pushWrap(stack, open, content, close, route);
  }
}

function pushList(stack: Frame[], node: DocASTNode, route: Route): void {
  // @list items are structured 'list-item' nodes built by the Parser
  // (Structural-Blocks.md §5 List) — every non-empty line is an item, so
  // nested inline nodes (e.g. @bold) inside an item render correctly instead
  // of being flattened to text first. A nested @list is just another content
  // node inside an item, so pushing its item's content as a children-frame
  // (via pushGroups -> pushWrap) schedules a later 'node' frame for it,
  // which comes back through this same case for the nested list.
  const items = node.content.filter((c): c is DocASTNode => typeof c !== 'string' && c.type === 'list-item');
  const tag = node.ordered ? 'ol' : 'ul';
  if (items.length === 0) {
    stack.push(`<${tag}></${tag}>`);
    return;
  }
  stack.push(`</${tag}>`);
  pushGroups(stack, items, route, (i) => ({
    open: `<li${node.ordered && i.marker !== undefined ? ` value="${i.marker}"` : ''}>`,
    content: i.content,
    close: '</li>',
  }));
  stack.push(`<${tag}>`);
}

function pushTabs(stack: Frame[], node: DocASTNode, route: Route): void {
  const tabs = node.tabs ?? [];
  stack.push('</div>'); // closes the outer .tabs
  pushGroups(stack, tabs, route, (t, i) => ({
    open: `<div role="tabpanel" id="tab-panel-${i}">`,
    content: t.content,
    close: '</div>',
  }));
  stack.push('</div>'); // closes [role="tablist"]
  // Triggers have no children of their own (just an escaped title) — pushed
  // as flat strings, in reverse, same as pushGroups but without a wrap.
  pushReversed(stack, tabs.map((t, i) =>
    `<button role="tab" aria-controls="tab-panel-${i}">${escapeHtml(t.title ?? '')}</button>`
  ));
  stack.push('<div class="tabs"><div role="tablist">');
}

/**
 * Pushes the `Frame`s for one node — the same job renderNode() used to do by
 * directly writing to `out` and recursing, except every branch here only
 * ever pushes onto `stack` and returns; nothing recurses. See the `Out`/
 * `Frame` comment above `pushWrap()` for why.
 */
function pushNodeFrames(stack: Frame[], node: DocASTNode, route: Route): void {
  switch (node.type) {
    // Metadata — not rendered as visible HTML (Block Syntax Specification §9).
    case 'meta':
      return;

    // Structural Blocks
    case 'heading': {
      const level = node.level ?? 1;
      pushWrap(stack, `<h${level}>`, node.content, `</h${level}>`, route);
      return;
    }
    case 'paragraph':
      pushWrap(stack, '<p>', node.content, '</p>', route);
      return;
    case 'quote':
      pushWrap(stack, '<blockquote>', node.content, '</blockquote>', route);
      return;
    case 'list':
      pushList(stack, node, route);
      return;
    case 'code':
      stack.push(`<pre><code class="language-${escapeHtml(node.language ?? 'text')}">${escapeHtml(node.raw ?? '')}</code></pre>`);
      return;
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
      stack.push(`<img ${attrs.join(' ')}>`);
      return;
    }
    case 'table': {
      // columns/rows hold inline content (text + a curated set of formatting
      // nodes, see registry.ts's isCellAllowedNode), same shape as `content`
      // elsewhere — render it the same way, then turn @n's "\n" marker into
      // <br>. Each cell needs its own complete rendered string before the
      // "\n" → "<br>" replace can run, so renderChildrenToString() resolves
      // it eagerly (its own bounded stack+loop, not real recursion — see its
      // own comment for why that's safe for a cell specifically) rather than
      // pushing a children-frame that would only resolve later.
      const theadCells = (node.columns ?? [])
        .map(c => `<th>${renderChildrenToString(c, route).replace(/\n/g, '<br>')}</th>`)
        .join('');
      const bodyRows = (node.rows ?? [])
        .map(r => `<tr>${r.map(cell => `<td>${renderChildrenToString(cell, route).replace(/\n/g, '<br>')}</td>`).join('')}</tr>`)
        .join('');
      stack.push(`<table><thead><tr>${theadCells}</tr></thead><tbody>${bodyRows}</tbody></table>`);
      return;
    }
    case 'hr':
      stack.push('<hr>');
      return;
    case 'svg':
      stack.push(sanitizeSvg(node.raw ?? ''));
      return;

    // Container Blocks
    case 'details':
      pushWrap(stack, `<details><summary>${escapeHtml(node.title ?? 'Details')}</summary>`, node.content, '</details>', route);
      return;
    case 'card':
      pushCard(stack, node, route);
      return;

    // Callout Blocks
    case 'note':
    case 'tip':
    case 'important':
    case 'warning':
    case 'caution':
      pushWrap(stack, `<aside class="${node.type}">${node.title ? `<strong>${escapeHtml(node.title)}</strong> ` : ''}`, node.content, '</aside>', route);
      return;

    // Widget Blocks
    case 'tabs':
      pushTabs(stack, node, route);
      return;
    case 'tab':
      // Standalone rendering fallback — normally only reached via @tabs.
      pushWrap(stack, `<section><h4>${escapeHtml(node.title ?? '')}</h4>`, node.content, '</section>', route);
      return;
    case 'mermaid':
      stack.push(`<pre class="mermaid">${escapeHtml(node.raw ?? '')}</pre>`);
      return;

    // Text Formatting
    case 'bold':
      pushWrap(stack, '<strong>', node.content, '</strong>', route);
      return;
    case 'italic':
      pushWrap(stack, '<em>', node.content, '</em>', route);
      return;
    case 'underline':
      pushWrap(stack, '<u>', node.content, '</u>', route);
      return;
    case 'del':
      pushWrap(stack, '<del>', node.content, '</del>', route);
      return;
    case 'mark':
      pushMark(stack, node, route);
      return;
    case 'color':
      pushColor(stack, node, route);
      return;
    case 'bordered':
      pushBordered(stack, node, route);
      return;
    // Inline code. `@raw`'s opaque domain (Inline Syntax Specification §9) is
    // the same thing Markdown's backticks are: content that must not be
    // parsed, shown literally. `<code>` is the semantic tag for exactly that,
    // and its browser default already supplies the monospace font — index.css
    // only adds the tint on top. Distinct from `@code`, which is a block and
    // renders as `<pre><code>`; `pre code` resets the inline decoration.
    case 'raw':
      stack.push(`<code>${escapeHtml(node.raw ?? '')}</code>`);
      return;

    // Semantic Inline
    case 'sup':
      pushWrap(stack, '<sup>', node.content, '</sup>', route);
      return;
    case 'sub':
      pushWrap(stack, '<sub>', node.content, '</sub>', route);
      return;
    case 'kbd':
      stack.push(`<kbd>${escapeHtml(node.raw ?? '')}</kbd>`);
      return;
    case 'link':
      pushWrap(stack, `<a href="${escapeHtml(resolveUri(node.uri ?? ''))}">`, node.content, '</a>', route);
      return;

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
      return;
    case 'fn':
      stack.push(`<sup id="fnref${node.number}"><a href="#fn${node.number}">${node.number}</a></sup>`);
      return;

    // Special Nodes
    case 'n':
      stack.push('<br>');
      return;

    default:
      // Should be unreachable — every registered node is handled above.
      pushWrap(stack, `<div data-node="${escapeHtml(node.type)}">`, node.content, '</div>', route);
      return;
  }
}

/**
 * Walks the whole document collecting every @defn in document order — @defn
 * is a plain inline-node (Footnotes.md §4), so it can appear nested inside
 * @quote/@list/@table cells/etc., not just at the top level. A @defn's own
 * content isn't walked any further once collected — nesting a @defn inside
 * another @defn isn't a meaningful/supported pattern (Footnotes.md §4 only
 * documents ordinary inline content there), so there's nothing useful to
 * find by visiting past it.
 *
 * An explicit stack, not recursion, for the same reason as the `Frame`
 * machinery above: a @defn can be buried arbitrarily deep inside otherwise
 * ordinary nested content, and this walk shouldn't need shallower nesting to
 * survive than rendering itself does.
 */
function collectFootnoteDefns(nodes: (DocASTNode | string)[]): DocASTNode[] {
  const found: DocASTNode[] = [];
  const stack: DocASTNode[] = [];
  pushReversed(stack, nodes.filter((n): n is DocASTNode => typeof n !== 'string'));
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (n.type === 'defn') {
      found.push(n);
      continue;
    }
    // Collect this node's children — content, then columns' cells, then
    // rows' cells, then tabs — into one flat, forward-order list first
    // (matching the traversal order a recursive visit() would use), then
    // push it reversed so popping restores that same forward order.
    const next: DocASTNode[] = [];
    for (const c of n.content ?? []) if (typeof c !== 'string') next.push(c);
    for (const col of n.columns ?? []) for (const c of col) if (typeof c !== 'string') next.push(c);
    for (const row of n.rows ?? []) for (const cell of row) for (const c of cell) if (typeof c !== 'string') next.push(c);
    for (const t of n.tabs ?? []) next.push(t);
    pushReversed(stack, next);
  }
  return found;
}

export class DocTranspiler {
  /** Route A — class-driven (Tailwind-style) output. */
  public static toTailwindHTML(node: DocASTNode): string {
    const out: Out = [];
    runFrames([{ t: 'node', node, route: 'tailwind' }], out);
    return out.join('');
  }

  /** Route B — inline-style output, for universal/legacy targets. */
  public static toInlineStyleHTML(node: DocASTNode): string {
    const out: Out = [];
    runFrames([{ t: 'node', node, route: 'inline' }], out);
    return out.join('');
  }

  /**
   * Collects every @defn in the document and renders them as one real
   * <ol> at the call site's choosing (normally once, after the full
   * document body) — see the 'defn' case in pushNodeFrames() for why
   * in-place rendering isn't an option. Returns '' when the document has no
   * footnotes, so callers can append unconditionally.
   */
  public static renderFootnotes(nodes: DocASTNode[], route: Route): string {
    const defns = collectFootnoteDefns(nodes);
    if (defns.length === 0) return '';
    const out: Out = [];
    const stack: Frame[] = [];
    // A single @defn is only ever called on nodes already destined for the
    // <ol> built below, where a bare <li> is legal HTML — unlike the 'defn'
    // case in pushNodeFrames(), which renders nothing in-place (see there
    // for why).
    pushGroups(stack, defns, route, (d) => ({
      open: `<li id="fn${escapeHtml(d.id ?? '')}">`,
      content: d.content,
      close: ` <a href="#fnref${escapeHtml(d.id ?? '')}">↩</a></li>`,
    }));
    runFrames(stack, out);
    const items = out.join('');
    return route === 'tailwind' ? `<ol class="footnotes">${items}</ol>` : `<ol>${items}</ol>`;
  }
}
