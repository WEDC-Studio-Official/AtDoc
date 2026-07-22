import { readFileSync, writeFileSync } from 'fs';
import { tokenize } from '../Lexer.ts';
import { DocParser } from '../Parser.ts';
import { KamiTranspiler } from './KamiAdapter.ts';
import { DocSyntaxError } from '../types.ts';

const sourcePath = new URL('./article.atd', import.meta.url);
const sourceCode = readFileSync(sourcePath, 'utf-8');
const tokens = tokenize(sourceCode);

try {
  const ast = new DocParser(tokens).parse();
  const bodyHTML = ast.map(node => KamiTranspiler.toKamiHTML(node)).join('\n');
  const fullHTML = `<!DOCTYPE html>
<html lang="zh-Hant">
<head><meta charset="UTF-8"><link rel="stylesheet" href="kami.css"></head>
<body><div class="page">${bodyHTML}</div></body>
</html>`;
  writeFileSync(new URL('./Kami.html', import.meta.url), fullHTML, 'utf-8');
  console.log('Generated Kami.html');
} catch (err) {
  if (err instanceof DocSyntaxError) console.error('DocSyntaxError:', err.message);
  else throw err;
}