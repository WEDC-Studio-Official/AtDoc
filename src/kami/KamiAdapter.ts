// KamiAdapter — @Doc AST → Kami 視覺規範 HTML 的獨立 Renderer 分支。
//
// ============================================================================
// 重要聲明 / IMPORTANT NOTICE
// ============================================================================
// 本檔案是「Kami 設計規範」的獨立重新實作（路線 A），並非使用或改寫
// tw93/Kami（https://github.com/tw93/Kami）的原始碼或其 Python/WeasyPrint
// 渲染管線。此處僅依據 Kami 官網公開文件所述之設計 token（色板、字體分工、
// 字級層級、間距/圓角尺度、陰影規則）重新產出對應的 CSS，用於 @Doc 的
// HTML Renderer 分支。
//
// 本檔案位於獨立分支（feat/kami-adapter），在取得 tw93 本人同意前
// 不合併進 main，亦不對外發布。若未取得同意，僅供自用測試。
//
// 已知限制：本 Adapter 僅適用於 HTML/PDF 這類可渲染 CSS 的 Route，
// 不適用於 Terminal、Discord 等純文字 Renderer 目標。
// ============================================================================

import type { DocASTNode } from '../types.ts';

// ----------------------------------------------------------------------------
// Phase 1: Design Tokens
// 來源：Kami 官網公開設計規範（色彩 / 字體 / 字級 / 間距 / 圓角 / 陰影章節）。
// 這些是重新抄錄的 token 值，非原始 CSS/程式碼。
// ----------------------------------------------------------------------------

export const KamiTokens = {
  color: {
    canvas: {
      parchment: '#F5F4ED',
      ivory: '#FAF9F5',
      warmSand: '#E8E6DC',
      deepDark: '#141413',
    },
    brand: {
      inkBlue: '#1B365D',
      inkLight: '#2D5A8A',
      darkSurface: '#30302E',
      error: '#B53333',
    },
    neutral: {
      nearBlack: '#141413',
      darkWarm: '#3D3D3A',
      olive: '#504E49',
      stone: '#6B6A64',
    },
    border: {
      normal: '#E8E6DC',
      soft: '#E5E3D8', // 分隔線用實線，不是虛線
    },
    tagTint: { default: '#EEF2F7' },
  },

  font: {
    // Kami 實際上 --sans 是 --serif 的別名，全站幾乎統一走 serif。
    serif: '"TsangerJinKai02", "Source Han Serif TC", "Songti TC", Georgia, "Charter", serif',
    mono: '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, Monaco, monospace',
  },

  // 字級層級（單位 px，數值取自 Kami 實際 CSS 的 .type-sample.* 系統）
  type: {
    display: { size: '54px', weight: 500, lineHeight: 1.10, letterSpacing: '-0.5px' },
    h1: { size: '30px', weight: 500, lineHeight: 1.20 },
    h2: { size: '22px', weight: 500, lineHeight: 1.25 },
    h3: { size: '17px', weight: 500, lineHeight: 1.30 },
    lede: { size: '15px', weight: 500, lineHeight: 1.55 },
    body: { size: '14px', weight: 500, lineHeight: 1.55 },
    dense: { size: '14px', weight: 500, lineHeight: 1.40 },
    caption: { size: '12px', weight: 500, lineHeight: 1.45 },
    label: { size: '12px', weight: 500, lineHeight: 1.35, letterSpacing: '0.4px', uppercase: true },
  },

  // 間距尺度（4pt 基礎單位，換算 px）
  space: {
    xs: '3px',
    sm: '5px',
    md: '10px',
    lg: '20px',
    xl: '32px',
    xxl: '60px',
    xxxl: '120px',
  },

  radius: {
    xs: '4px',
    code: '6px',
    card: '8px',
    container: '12px',
    featured: '16px',
    large: '24px',
    hero: '32px',
  },

  shadow: {
    ring: '0 0 0 1px var(--kami-ring-warm, #E0DED2)',
    whisper: '0 4px 24px rgba(0,0,0,0.05)',
  },
} as const;

// ----------------------------------------------------------------------------
// Phase 3: 優先權規則 — @mark{color} 顯式指定 vs Kami 預設
// ----------------------------------------------------------------------------
// 規則：
//  1. 使用者省略 styles（@mark[content]）→ 套用 Kami 預設 tint（0.14 / ink-blue）。
//  2. 使用者顯式指定 color token（@mark{red}[...]）→ 尊重意圖，
//     但把顏色收斂進 Kami 的實色 tint 表，而非任意色值，
//     維持「暖調克制、禁 rgba」的視覺一致性。
//  3. 若 color token 不在下列對照表中 → fallback 為 Kami 預設 tint（同規則 1），
//     不拋出錯誤（呼應 Inline Spec §6 Unknown Command Fallback 的容錯精神）。
const MARK_COLOR_TO_KAMI_TINT: Record<string, string> = {
  yellow: '#F3E9C7',
  red: '#F1DCDC',
  green: '#DCE8D6',
  blue: '#D6E1EE',
  orange: '#EEDFC7',
  purple: '#E3DCE8',
  gray: '#E6E4DA',
};
const DEFAULT_MARK_TINT = KamiTokens.color.tagTint.default;

function resolveMarkTint(styles: string[] | undefined): string {
  const colorToken = styles?.find(t => t in MARK_COLOR_TO_KAMI_TINT);
  if (!colorToken) return DEFAULT_MARK_TINT;
  return MARK_COLOR_TO_KAMI_TINT[colorToken] ?? DEFAULT_MARK_TINT;
}

// ----------------------------------------------------------------------------
// Phase 2: 節點映射表（AST → Kami 樣式）— 骨架
// 對照 registry.ts 的 REGISTRY 清單順序；每個節點先列出 TODO，
// 待逐一補上實際 CSS class / inline style。
// ----------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Same trust-boundary stripping as Adapters.ts sanitizeSvg() — kept local to avoid a cross-Route dependency. */
function sanitizeSvg(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
}

function renderChildren(content: (DocASTNode | string)[]): string {
  return content.map(c => (typeof c === 'string' ? escapeHtml(c) : renderKamiNode(c))).join('');
}

export function renderKamiNode(node: DocASTNode): string {
  switch (node.type) {
    // --- Metadata ---
    case 'meta':
      return ''; // 不渲染可見 HTML，同 Adapters.ts 現有行為

    // --- Structural Blocks --- (TODO: 補齊 Kami class/style)
    case 'h': {
      const level = node.level ?? 1;
      // TODO: Display/H1/H2/H3 依 level 對應 KamiTokens.type
      return `<h${level} data-kami="heading" data-level="${level}">${renderChildren(node.content)}</h${level}>`;
    }
    case 'p':
      // TODO: KamiTokens.type.body
      return `<p data-kami="body">${renderChildren(node.content)}</p>`;
    case 'quote':
      // TODO: 左 2px 品牌實線 + olive 色（Kami Quote 元件）
      return `<blockquote data-kami="quote">${renderChildren(node.content)}</blockquote>`;
    case 'list': {
      // Structured 'list-item' nodes come from the shared Parser (Structural-Blocks.md
      // §5 List) — no per-Adapter string splitting needed here anymore. A nested
      // @list is just another content node inside an item, so renderChildren
      // recurses back into this same case for it.
      const items = node.items ?? [];
      const tag = node.ordered ? 'ol' : 'ul';
      const marker = node.ordered ? 'ordered' : 'bullet';
      const li = items.map(i => {
        const valueAttr = node.ordered && i.marker !== undefined ? ` value="${i.marker}"` : '';
        return `<li${valueAttr}>${renderChildren(i.content)}</li>`;
      }).join('');
      return `<${tag} data-kami="list" data-kami-marker="${marker}">${li}</${tag}>`;
    }
    case 'code':
      // TODO: ivory 底 + 0.5px border + 6px 圓角 + mono 字體（Kami Code Block）
      return `<pre data-kami="code"><code class="language-${escapeHtml(node.language ?? 'text')}">${escapeHtml(node.raw ?? '')}</code></pre>`;
    case 'img': {
      // TODO: 對齊 Kami 版面留白規則；決定 @img align 選項 vs Kami 間距優先權
      const opts = node.imgOptions ?? {};
      return `<img data-kami="image" src="${escapeHtml(opts.src ?? '')}">`;
    }
    case 'table': {
      // columns/rows hold inline content (text + a curated set of formatting
      // nodes, see registry.ts's isCellAllowedNode), same shape as `content`
      // elsewhere — render it the same way, then turn @n's "\n" marker into <br>.
      const thead = `<thead><tr>${(node.columns ?? []).map(c => `<th>${renderChildren(c).replace(/\n/g, '<br>')}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${(node.rows ?? []).map(r => `<tr>${r.map(cell => `<td>${renderChildren(cell).replace(/\n/g, '<br>')}</td>`).join('')}</tr>`).join('')}</tbody>`;
      return `<table data-kami="table">${thead}${tbody}</table>`;
    }
    case 'hr':
      return `<hr data-kami="hr">`;
    case 'svg':
      // TODO(feat/kami-adapter, item 11): decide whether Kami recolors inline SVGs
      // or passes them through as-is. Passing through for now — see Adapters.ts
      // sanitizeSvg() for the same trust-boundary stripping applied here.
      return sanitizeSvg(node.raw ?? '');

    // --- Container Blocks --- (TODO)
    case 'details':
      return `<details data-kami="details"><summary>${escapeHtml(node.title ?? '')}</summary>${renderChildren(node.content)}</details>`;
    case 'card':
      // TODO: ivory 底 + 16px 圓角 + whisper shadow（Kami Featured Card）
      return `<article data-kami="card">${node.title ? `<header>${escapeHtml(node.title)}</header>` : ''}${renderChildren(node.content)}</article>`;

    // --- Callout Blocks --- (TODO: border-left 3px 或 solid brand border)
    case 'note':
    case 'tip':
    case 'important':
    case 'warning':
    case 'caution': {
      const labelMap: Record<string, string> = {
        note: 'NOTE', tip: 'TIP', important: 'IMPORTANT', warning: 'WARNING', caution: 'CAUTION',
      };
      return `<aside data-kami="callout" data-variant="${node.type}"><span data-kami="callout-label">${labelMap[node.type]}</span>${node.title ? `<strong>${escapeHtml(node.title)}</strong> ` : ''}${renderChildren(node.content)}</aside>`;
    }

    // --- Widget Blocks --- (TODO)
    case 'tabs': {
      const tabs = node.tabs ?? [];
      const tablist = tabs.map((t, i) => `<button data-kami="tab-trigger" aria-controls="kami-tab-${i}">${escapeHtml(t.title ?? '')}</button>`).join('');
      const panels = tabs.map((t, i) => `<div data-kami="tab-panel" id="kami-tab-${i}">${renderChildren(t.content)}</div>`).join('');
      return `<div data-kami="tabs"><div role="tablist">${tablist}</div>${panels}</div>`;
    }
    case 'tab':
      return `<section data-kami="tab-standalone">${renderChildren(node.content)}</section>`;
    case 'mermaid':
      // TODO: 決定是否重寫 Kami 的 Mermaid 重上色邏輯，或先原樣輸出交給既有 Route
      return `<pre data-kami="mermaid">${escapeHtml(node.raw ?? '')}</pre>`;

    // --- Text Formatting --- (TODO)
    case 'bold':
      return `<strong data-kami="bold">${renderChildren(node.content)}</strong>`;
    case 'italic':
      return `<em data-kami="italic">${renderChildren(node.content)}</em>`;
    case 'underline':
      return `<u data-kami="underline">${renderChildren(node.content)}</u>`;
    case 'del':
      return `<del data-kami="del">${renderChildren(node.content)}</del>`;
    case 'mark': {
      // 優先權規則已實作：見上方 resolveMarkTint()
      const tint = resolveMarkTint(node.styles);
      return `<mark data-kami="mark" style="background-color:${tint};">${renderChildren(node.content)}</mark>`;
    }
    case 'color': {
      // Unlike @mark's named-token palette (resolveMarkTint() above, tuned
      // for pale tint backgrounds), @color is a precise text color, so only
      // literal hex resolves here. Missing/malformed hex falls back to
      // DEFAULT_MARK_TINT — the same default @mark itself falls back to when
      // no styles are given — rather than throwing (Inline Spec §6).
      const colorToken = node.color;
      const isHex = !!colorToken && /^#[0-9a-fA-F]{6}$/.test(colorToken);
      const resolved = isHex ? colorToken : DEFAULT_MARK_TINT;
      return `<span data-kami="color" style="color:${resolved};">${renderChildren(node.content)}</span>`;
    }
    case 'raw':
      return escapeHtml(node.raw ?? '');

    // --- Semantic Inline --- (TODO)
    case 'sup':
      return `<sup data-kami="sup">${renderChildren(node.content)}</sup>`;
    case 'sub':
      return `<sub data-kami="sub">${renderChildren(node.content)}</sub>`;
    case 'kbd':
      return `<kbd data-kami="kbd">${escapeHtml(node.raw ?? '')}</kbd>`;
    case 'link':
      return `<a data-kami="link" href="${escapeHtml(node.uri ?? '')}">${renderChildren(node.content)}</a>`;

    // --- Footnotes ---
    case 'defn':
      return `<li data-kami="footnote" id="fn${escapeHtml(node.id ?? '')}">${renderChildren(node.content)} <a data-kami="footnote-back" href="#fnref${escapeHtml(node.id ?? '')}">↩</a></li>`;
    case 'fn':
      return `<sup data-kami="footnote-ref" id="fnref${node.number}"><a href="#fn${node.number}">${node.number}</a></sup>`;

    // --- Special Nodes ---
    case 'n':
      return '<br>';

    default:
      return `<div data-kami-unknown="${escapeHtml(node.type)}">${renderChildren(node.content)}</div>`;
  }
}

export class KamiTranspiler {
  /** Route C — Kami 設計規範 HTML 輸出。獨立於 Adapters.ts 既有的 tailwind/inline 兩條 Route。 */
  public static toKamiHTML(node: DocASTNode): string {
    return renderKamiNode(node);
  }
}