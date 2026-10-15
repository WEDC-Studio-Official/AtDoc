// Renders one @Doc document into a complete, self-contained HTML page: the
// theme's CSS inlined, footnotes, @tabs switching and code copy buttons all
// in the one file, so it opens straight from disk.
//
// A pure string function — no file system access. The caller reads the CSS
// and passes it in (the command-line version is scripts/render-html.mjs).
// The theme must already be registered; an unknown theme id falls back to
// the default theme, exactly as runAtDocPipeline() does.

import { runAtDocPipeline } from './pipeline.js';
import { resolveTheme } from './themeRegistry.js';
import type { DocDiagnostic } from './types.js';

export interface StandaloneOptions {
  /** Theme id ('index' or any other registered theme). Defaults to 'index'. */
  theme?: string;
  /** The theme's full stylesheet, placed into a <style> tag as-is. */
  css: string;
  /** The page <title>. Defaults to the text of the document's first heading, then '@Doc'. */
  title?: string;
  /** The <html lang> attribute. Defaults to 'zh-Hant'. */
  lang?: string;
  /** 'dark' sets data-kami-scheme="dark" on <html>, which turns on the dark variables of themes that have them. */
  scheme?: 'light' | 'dark';
  /** ES module URL Mermaid is loaded from, only when the document has an @mermaid diagram. null never loads it. */
  mermaidUrl?: string | null;
}

export interface StandaloneResult {
  /** The full HTML page; null when the document has a syntax error. */
  html: string | null;
  error: string | null;
  diagnostics: DocDiagnostic[];
}

const DEFAULT_MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

// The zero-height markers the pipeline puts before each block for the
// Playground's scroll sync; a standalone page has no use for them.
const LINE_MARKER_RE = /<div data-line="\d+" style="height:0;overflow:hidden"><\/div>/g;

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function firstHeadingText(html: string): string | null {
  const m = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/.exec(html);
  if (!m) return null;
  const text = m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
  return text || null;
}

// Tabs (both the data-kami="tabs" widget and index's .tabs) and every theme's
// copy button. Plain JavaScript, no framework.
const BEHAVIOR_SCRIPT = `<script>
document.querySelectorAll('.tabs').forEach(function (el) { el.setAttribute('data-enhanced', 'true'); });
document.addEventListener('click', function (e) {
  var trigger = e.target.closest('[data-kami="tab-trigger"]');
  if (trigger) {
    e.preventDefault();
    var widget = trigger.closest('[data-kami="tabs"]');
    if (!widget) return;
    var panelId = trigger.getAttribute('aria-controls');
    widget.querySelectorAll('[data-kami="tab-trigger"]').forEach(function (btn) {
      btn.setAttribute('aria-selected', String(btn === trigger));
    });
    widget.querySelectorAll('[data-kami="tab-panel"]').forEach(function (panel) {
      panel.setAttribute('data-kami-active', String(panel.id === panelId));
    });
    return;
  }
  var copy = e.target.closest('[data-kami-copy]');
  if (copy && navigator.clipboard) navigator.clipboard.writeText(copy.getAttribute('data-kami-copy') || '');
});
</script>`;

export function renderStandaloneHtml(source: string, options: StandaloneOptions): StandaloneResult {
  const theme = options.theme ?? 'index';
  const result = runAtDocPipeline(source, theme);
  if (result.html === null) {
    return { html: null, error: result.error, diagnostics: result.diagnostics };
  }
  const body = result.html.replace(LINE_MARKER_RE, '');
  const title = options.title ?? firstHeadingText(body) ?? '@Doc';
  const schemeAttr = options.scheme === 'dark' ? ' data-kami-scheme="dark"' : '';

  const mermaidUrl = options.mermaidUrl === undefined ? DEFAULT_MERMAID_URL : options.mermaidUrl;
  let mermaidScript = '';
  if (mermaidUrl && body.includes('class="mermaid"')) {
    // The theme's own Mermaid palette (registerTheme's `mermaid` field), the
    // same one hydrateMermaidDiagrams() uses.
    const config = { startOnLoad: true, ...(resolveTheme(theme).mermaid ?? {}) };
    mermaidScript = `<script type="module">
import mermaid from ${JSON.stringify(mermaidUrl)};
mermaid.initialize(${JSON.stringify(config)});
</script>`;
  }

  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(options.lang ?? 'zh-Hant')}"${schemeAttr}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${options.css}
</style>
</head>
<body>
<div class="page">
${body}
</div>
${BEHAVIOR_SCRIPT}${mermaidScript ? `\n${mermaidScript}` : ''}
</body>
</html>
`;
  return { html, error: null, diagnostics: result.diagnostics };
}
