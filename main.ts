import { readFileSync } from 'fs';
import { tokenize } from './src/Lexer.ts';
import { DocParser } from './src/Parser.ts';
import { DocTranspiler } from './src/Adapters.ts';
import { DocSyntaxError } from './src/types.ts';

const sourcePath = new URL('./test.atd', import.meta.url);
const sourceCode = readFileSync(sourcePath, 'utf-8');

// 執行詞法分析
const tokens = tokenize(sourceCode);
console.log('--- Tokens ---', tokens.length, 'tokens');

// 生成 Canonical AST
try {
  const parser = new DocParser(tokens);
  const ast = parser.parse();
  console.log('--- AST ---');
  console.log(JSON.stringify(ast, null, 2));

  // 雙線並行編譯
  const tailwindHTML = ast.map(node => DocTranspiler.toTailwindHTML(node)).join('\n');
  const inlineHTML = ast.map(node => DocTranspiler.toInlineStyleHTML(node)).join('\n');

  console.log('--- Route A: Tailwind JIT HTML ---');
  console.log(tailwindHTML);

  console.log('--- Route B: Universal Inline Style HTML ---');
  console.log(inlineHTML);
} catch (err) {
  if (err instanceof DocSyntaxError) {
    console.error('DocSyntaxError:', err.message);
    process.exitCode = 1;
  } else {
    throw err;
  }
}
