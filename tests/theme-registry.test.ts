// Theme registry: themes plug in via registerTheme(); the pipeline and the
// PreviewStyle type name no specific theme.
//
// Run: node --import ./tests/ts-resolve-hook.mjs tests/theme-registry.test.ts

import assert from 'node:assert';
import { registerTheme, getTheme, hasTheme, listThemes, getDefaultTheme, resolveTheme } from '../src/themeRegistry.ts';
import { runAtDocPipeline } from '../src/pipeline.ts';
import '../src/index/Adapters.ts'; // registers "index"

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

test('importing the index adapter registers the "index" theme', () => {
  assert.ok(hasTheme('index'));
  assert.strictEqual(getTheme('index')?.label, 'Index');
});

test('a registered theme is used by the pipeline, with no core edit', () => {
  registerTheme({
    id: 'test-cat',
    renderNode: (n) => `<cat>${n.type}</cat>`,
    renderFootnotes: () => '',
  });
  assert.ok(listThemes().some(t => t.id === 'test-cat'));
  const html = runAtDocPipeline('@bold[hi]', 'test-cat').html ?? '';
  assert.ok(html.includes('<cat>paragraph</cat>'), html);
});

test('an unknown or omitted style falls back to the default theme', () => {
  const byDefault = runAtDocPipeline('@bold[hi]').html;
  assert.strictEqual(runAtDocPipeline('@bold[hi]', 'no-such-theme').html, byDefault);
  assert.strictEqual(resolveTheme('no-such-theme').id, getDefaultTheme().id);
});

test('the default theme is always "index", whatever else is registered', () => {
  registerTheme({ id: 'test-other', renderNode: () => 'X', renderFootnotes: () => '' });
  assert.strictEqual(getDefaultTheme().id, 'index');
  assert.strictEqual(runAtDocPipeline('@bold[hi]').html, runAtDocPipeline('@bold[hi]', 'index').html);
});

test('re-registering an id replaces the theme', () => {
  registerTheme({ id: 'test-swap', renderNode: () => 'one', renderFootnotes: () => '' });
  registerTheme({ id: 'test-swap', renderNode: () => 'two', renderFootnotes: () => '' });
  assert.strictEqual(getTheme('test-swap')?.renderNode({ type: 'x' } as never), 'two');
  assert.strictEqual(listThemes().filter(t => t.id === 'test-swap').length, 1);
});

console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total.`);
if (failed > 0) process.exit(1);
