// generate.ts — renders an .atd file to a standalone HTML page using the
// default Adapters route.
//
// The counterpart to main.ts, which dumps tokens/AST/both routes to stdout for
// inspection. This one produces something you can open in a browser: Route A's
// HTML plus index.css.
//
// Usage:
//   node src/generate.ts                     # ../test.atd -> src/index.html
//   node src/generate.ts doc.atd out.html
//
// Paths are resolved relative to the current working directory, except the
// defaults, which are relative to this file so the no-argument form works from
// anywhere in the repo.

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { tokenize } from './Lexer.ts';
import { DocParser } from './Parser.ts';
import { DocTranspiler } from './Adapters.ts';
import { DocSyntaxError } from './types.ts';
import type { DocASTNode } from './types.ts';

const [inputArg, outputArg] = process.argv.slice(2);

const inputPath = inputArg
  ? resolve(process.cwd(), inputArg)
  : new URL('../test.atd', import.meta.url);
const outputPath = outputArg
  ? resolve(process.cwd(), outputArg)
  : new URL('./index.html', import.meta.url);

/** Pulls `@meta[title = ...]` out for the page's <title>, if the document set one. */
function documentTitle(ast: DocASTNode[]): string {
  const meta = ast.find(node => node.type === 'meta');
  return meta?.meta?.title ?? 'Untitled';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @tabs click-to-switch. This Route emits a static HTML file with no framework
 * runtime (unlike the Web Playground, which wires the same behavior through
 * React), so the minimal vanilla-JS equivalent is inlined — the same approach
 * src/kami/generate-kami.ts takes.
 *
 * It differs in one way. Adapters.ts's renderTabs() emits no initial selected
 * state, so rather than have the stylesheet hide panels unconditionally (which
 * would leave a scripting-disabled reader with everything after the first tab
 * permanently invisible), the script *opts in* to the hiding by stamping
 * `data-enhanced` on each widget at load. No script, no hiding: every panel
 * renders stacked and readable. index.css keys off that marker.
 */
const TABS_SCRIPT = `<script>
(function () {
  function activate(widget, panelId) {
    widget.querySelectorAll('[role="tab"]').forEach(function (btn) {
      btn.setAttribute('aria-selected', String(btn.getAttribute('aria-controls') === panelId));
    });
    widget.querySelectorAll('[role="tabpanel"]').forEach(function (panel) {
      panel.setAttribute('data-active', String(panel.id === panelId));
    });
  }
  document.querySelectorAll('.tabs').forEach(function (widget) {
    var first = widget.querySelector('[role="tabpanel"]');
    if (!first) return;
    widget.setAttribute('data-enhanced', 'true');
    activate(widget, first.id);
  });
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[role="tab"]');
    if (!trigger) return;
    var widget = trigger.closest('.tabs');
    if (!widget) return;
    e.preventDefault();
    activate(widget, trigger.getAttribute('aria-controls'));
  });
})();
</script>`;

const source = readFileSync(inputPath, 'utf-8');

try {
  const ast = new DocParser(tokenize(source)).parse();
  const body = ast.map(node => DocTranspiler.toTailwindHTML(node)).join('\n');
  const footnotes = DocTranspiler.renderFootnotes(ast);

  const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(documentTitle(ast))}</title>
<link rel="stylesheet" href="index.css">
</head>
<body>
${body}${footnotes ? `\n${footnotes}` : ''}
${TABS_SCRIPT}
</body>
</html>
`;

  writeFileSync(outputPath, html, 'utf-8');
  console.log(`Generated ${outputPath instanceof URL ? outputPath.pathname : outputPath}`);
} catch (err) {
  if (err instanceof DocSyntaxError) {
    console.error('DocSyntaxError:', err.message);
    process.exit(1);
  }
  throw err;
}
