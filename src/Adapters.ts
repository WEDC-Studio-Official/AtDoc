// Adapters — render a DocASTNode tree to HTML.
//
// Tag choices follow the "Renderer Independence" examples already committed
// to in the syntax/ reference docs (Structural-Blocks.md §6, Container-Blocks.md
// §7, Callout-Blocks.md §8, Widget-Blocks.md §6, Text-Formatting.md §7,
// Semantic-Inline.md §6, Footnotes.md §7, Special-Nodes.md §8) — this file
// exists to make those examples real, not to invent new ones.
//
// Two routes, differing only where the grammar actually has something to
// differ on — @mark's and @color's color tokens (Inline Syntax Specification
// §7, Block Syntax Specification §4) are the only per-instance style slots
// this Adapter maps to output, so they're the only place Route A
// (class-driven) and Route B (inline CSS) genuinely diverge. Container and
// Callout Blocks also carry a parsed `styles` slot (registry.ts `styles: true`)
// but this Adapter doesn't yet map it to visual output — see KamiAdapter.ts
// for the Renderer branch that does. Everything else renders identically on
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
const MARK_MODIFIERS = ['underline', 'strikethrough', 'bordered'];

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Shared style-token color resolver — accepts either a named token
 * (Inline Syntax Specification §7) or a literal "#RRGGBB" hex token, used by
 * both @mark's {styles} slot and @color's required "(#hex)" paren.
 * Unknown/malformed tokens resolve to undefined so callers can fall back
 * silently, per §6 Unknown Command Fallback's ignore-don't-throw spirit.
 */
function resolveColorToken(token: string | undefined): string | undefined {
  if (!token) return undefined;
  if (HEX_COLOR.test(token)) return token;
  return MARK_COLORS[token];
}

/** URI scheme inference — Inline Syntax Specification §8 @link URI Semantics. */
function resolveUri(raw: string): string {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return raw; // explicit scheme: MUST be used as-is
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return `mailto:${raw}`;
  if (/^\+?[0-9][0-9\- ]*$/.test(raw)) return `tel:${raw.replace(/[\s-]/g, '')}`;
  return `https://${raw}`;
}

function renderChildren(content: (DocASTNode | string)[], route: Route): string {
  return content.map(c => (typeof c === 'string' ? escapeHtml(c) : renderNode(c, route))).join('');
}

function renderMark(node: DocASTNode, route: Route): string {
  const tokens = node.styles ?? [];
  const colorToken = tokens.find(t => resolveColorToken(t) !== undefined);
  const resolvedColor = resolveColorToken(colorToken);
  const modifierTokens = tokens.filter(t => MARK_MODIFIERS.includes(t));
  const inner = renderChildren(node.content, route);

  if (route === 'inline') {
    const styleParts: string[] = [];
    if (resolvedColor) styleParts.push(`background-color: ${resolvedColor};`);
    if (modifierTokens.includes('underline')) styleParts.push('text-decoration: underline;');
    if (modifierTokens.includes('strikethrough')) styleParts.push('text-decoration: line-through;');
    if (modifierTokens.includes('bordered')) styleParts.push('border: 1px solid currentColor;');
    const styleAttr = styleParts.length ? ` style="${styleParts.join(' ')}"` : '';
    return `<mark${styleAttr}>${inner}</mark>`;
  }

  // A literal hex token has no Tailwind-style class equivalent — fall back to inline style for it.
  const isNamedColor = colorToken !== undefined && !HEX_COLOR.test(colorToken);
  const classes = ['mark', ...(isNamedColor ? [`mark-${colorToken}`] : []), ...modifierTokens.map(t => `mark-${t}`)];
  const hexStyle = colorToken && !isNamedColor ? ` style="background-color: ${resolvedColor};"` : '';
  return `<mark class="${classes.join(' ')}"${hexStyle}>${inner}</mark>`;
}

function renderColor(node: DocASTNode, route: Route): string {
  // @color is for a precise text color, unlike @mark's named-token highlight
  // palette (tuned for pale backgrounds, not readable foreground text) — so
  // it only resolves literal hex, falling back to no explicit color (rather
  // than near-invisible pale text) for anything else, per the Unknown
  // Command Fallback ignore-don't-throw spirit (Inline Spec §6).
  const hex = node.color && HEX_COLOR.test(node.color) ? node.color : undefined;
  const inner = renderChildren(node.content, route);
  if (!hex) return `<span>${inner}</span>`;
  return `<span style="color: ${hex};">${inner}</span>`;
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
  // of being flattened to text first.
  const items = node.items ?? [];
  if (items.length === 0) return '<ul></ul>';
  return `<ul>${items.map(i => `<li>${renderChildren(i.content, route)}</li>`).join('')}</ul>`;
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
    case 'h':
      return `<h${node.level ?? 1}>${renderChildren(node.content, route)}</h${node.level ?? 1}>`;
    case 'p':
      return `<p>${renderChildren(node.content, route)}</p>`;
    case 'quote':
      return `<blockquote>${renderChildren(node.content, route)}</blockquote>`;
    case 'list':
      return renderList(node, route);
    case 'code':
      return `<pre><code class="language-${escapeHtml(node.language ?? 'text')}">${escapeHtml(node.raw ?? '')}</code></pre>`;
    case 'img': {
      const opts = node.imgOptions ?? {};
      const alt = node.content.map(c => (typeof c === 'string' ? c : '')).join('').trim();
      const attrs = [`src="${escapeHtml(opts.src ?? '')}"`, `alt="${escapeHtml(alt)}"`];
      if (opts.width) attrs.push(`width="${escapeHtml(opts.width)}"`);
      if (opts.height) attrs.push(`height="${escapeHtml(opts.height)}"`);
      const styleParts: string[] = [];
      if (opts.align) {
        const margin = opts.align === 'center' ? '0 auto' : opts.align === 'right' ? '0 0 0 auto' : '0';
        styleParts.push(`display:block;margin:${margin};`);
      }
      if (opts.radius) styleParts.push(`border-radius:${escapeHtml(opts.radius)};`);
      if (opts.border) styleParts.push(`border:${escapeHtml(opts.border)};`);
      if (styleParts.length) attrs.push(`style="${styleParts.join('')}"`);
      return `<img ${attrs.join(' ')}>`;
    }
    case 'table': {
      const thead = `<thead><tr>${(node.columns ?? []).map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${(node.rows ?? [])
        .map(r => `<tr>${r.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
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
      return `<article>${node.title ? `<header>${escapeHtml(node.title)}</header>` : ''}${renderChildren(node.content, route)}</article>`;

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
    case 'fn':
      return `<li id="fn${escapeHtml(node.id ?? '')}">${renderChildren(node.content, route)} <a href="#fnref${escapeHtml(node.id ?? '')}">↩</a></li>`;
    case 'refn':
      return `<sup id="fnref${node.number}"><a href="#fn${node.number}">${node.number}</a></sup>`;

    // Special Nodes
    case 'n':
      return '<br>';

    default:
      // Should be unreachable — every registered node is handled above.
      return `<div data-node="${escapeHtml(node.type)}">${renderChildren(node.content, route)}</div>`;
  }
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
}
