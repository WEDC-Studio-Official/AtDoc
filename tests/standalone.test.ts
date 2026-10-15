// renderStandaloneHtml: one @Doc document exported as a single HTML page.

import assert from 'node:assert';
import { renderStandaloneHtml } from '../src/index.ts';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err instanceof Error ? err.message.split('\n').join('\n        ') : String(err)}`);
  }
}

const doc = '@heading(1)[Hello & bye]\n\n@paragraph[Body]';

test('full page with inline CSS and the title from the first heading', () => {
  const { html, error } = renderStandaloneHtml(doc, { css: '/* INDEX */' });
  assert.strictEqual(error, null);
  assert.ok(html!.startsWith('<!DOCTYPE html>'), html!);
  assert.ok(html!.includes('<style>\n/* INDEX */\n</style>'), html!);
  assert.ok(html!.includes('<title>Hello &amp; bye</title>'), html!);
  assert.ok(html!.includes('<div class="page">'), html!);
});

test('pipeline line markers are stripped', () => {
  const { html } = renderStandaloneHtml(doc, { css: '' });
  assert.ok(!html!.includes('data-line='), html!);
});

test('dark scheme sets data-kami-scheme on <html>; light does not', () => {
  assert.ok(renderStandaloneHtml(doc, { css: '', scheme: 'dark' }).html!.includes('<html lang="zh-Hant" data-kami-scheme="dark">'));
  assert.ok(!renderStandaloneHtml(doc, { css: '' }).html!.includes('data-kami-scheme'));
});

test('title and lang options override the defaults', () => {
  const { html } = renderStandaloneHtml(doc, { css: '', title: 'Custom', lang: 'en' });
  assert.ok(html!.includes('<html lang="en">'), html!);
  assert.ok(html!.includes('<title>Custom</title>'), html!);
});

test('tabs / copy behavior script is always included', () => {
  const { html } = renderStandaloneHtml(doc, { css: '' });
  assert.ok(html!.includes("querySelectorAll('.tabs')") && html!.includes('[data-kami-copy]'), html!);
});

test('Mermaid loads only when the document has a diagram', () => {
  const plain = renderStandaloneHtml(doc, { css: '' }).html!;
  assert.ok(!plain.includes('import mermaid'), 'no diagram, no Mermaid');
  const withDiagram = renderStandaloneHtml('@mermaid[graph TD; A-->B]', { css: '' }).html!;
  assert.ok(withDiagram.includes('import mermaid from'), withDiagram);
  assert.ok(withDiagram.includes('"startOnLoad":true'), withDiagram);
  const disabled = renderStandaloneHtml('@mermaid[graph TD; A-->B]', { css: '', mermaidUrl: null }).html!;
  assert.ok(!disabled.includes('import mermaid'), disabled);
});

test('the title cannot break out of <title>', () => {
  const { html } = renderStandaloneHtml(doc, { css: '', title: '</title><script>x</script>' });
  assert.ok(html!.includes('<title>&lt;/title&gt;&lt;script&gt;x&lt;/script&gt;</title>'), html!);
});

console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total.`);
if (failed > 0) process.exit(1);
