// Adapters — render a DocASTNode tree to HTML.
//
// Tag choices follow the "Renderer Independence" examples already committed
// to in the syntax/ reference docs (Structural-Blocks.md §6, Container-Blocks.md
// §7, Callout-Blocks.md §8, Widget-Blocks.md §6, Text-Formatting.md §7,
// Semantic-Inline.md §6, Footnotes.md §7, Special-Nodes.md §8) — this file
// exists to make those examples real, not to invent new ones.
//
// Two routes, differing only where the grammar actually has something to
// differ on — @mark's `{styles}` token list (Inline Syntax Specification §7)
// is the only per-instance style slot formalized in the current EBNF, so
// it's the only place Route A (class-driven) and Route B (inline CSS) genuinely
// diverge. Everything else renders identically on both routes.

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
  const colorToken = tokens.find(t => MARK_COLORS[t]);
  const modifierTokens = tokens.filter(t => MARK_MODIFIERS.includes(t));
  const inner = renderChildren(node.content, route);

  if (route === 'inline') {
    const styleParts: string[] = [];
    if (colorToken) styleParts.push(`background-color: ${MARK_COLORS[colorToken]};`);
    if (modifierTokens.includes('underline')) styleParts.push('text-decoration: underline;');
    if (modifierTokens.includes('strikethrough')) styleParts.push('text-decoration: line-through;');
    if (modifierTokens.includes('bordered')) styleParts.push('border: 1px solid currentColor;');
    const styleAttr = styleParts.length ? ` style="${styleParts.join(' ')}"` : '';
    return `<mark${styleAttr}>${inner}</mark>`;
  }

  const classes = ['mark', ...(colorToken ? [`mark-${colorToken}`] : []), ...modifierTokens.map(t => `mark-${t}`)];
  return `<mark class="${classes.join(' ')}">${inner}</mark>`;
}

function renderList(node: DocASTNode, route: Route): string {
  // @list has no dedicated ListItem AST (Structural-Blocks.md §4 List) —
  // items are literal "- "-prefixed lines inside generic content.
  const flat = node.content.map(c => (typeof c === 'string' ? escapeHtml(c) : renderNode(c, route))).join('');
  const items = flat
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
    .map(line => line.slice(2).trim());
  if (items.length === 0) return '<ul></ul>';
  return `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
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
      if (opts.align) {
        const margin = opts.align === 'center' ? '0 auto' : opts.align === 'right' ? '0 0 0 auto' : '0';
        attrs.push(`style="display:block;margin:${margin};"`);
      }
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
