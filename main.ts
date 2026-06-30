import { tokenize } from './src/Lexer';
import { DocParser } from './src/Parser';
import { DocTranspiler } from './src/Adapters';

const sourceCode = `@seo {
  "title": "@Doc 2026 Spec",
  "description": "AI-native semantic document runtime"
}

@h1[@Doc 專案規範]

這是普通段落，其中包含行內語義節點：這是 @lang(ja)[日本語] 的展現。

@card(featured){w-300px bg-f8f9fa text-sm}[
  @title[AI 原生語言]
  @text[
    具有確定性語法的結構化 Markdown，專為雙向 AST 設計。
  ]
  @btn(primary)[立即開始](install)
]

@table[
  @cols[id,name,price]

  @data[
    [1,早餐,60]
    [2,午餐,80]
    [3,晚餐,90]
  ]
]
`;

// 執行詞法分析
const tokens = tokenize(sourceCode);
console.log('--- Tokens ---', tokens);

// 生成 Canonical AST
const parser = new DocParser(tokens);
const ast = parser.parse();
console.log('--- AST ---', JSON.stringify(ast, null, 2));

// 雙線適配器輸出
console.log('--- 路線 A (Tailwind JIT) ---');
const tailwindHTML = ast.map(node => DocTranspiler.toTailwindHTML(node)).join('\n');
console.log(tailwindHTML);

console.log('--- 路線 B (Inline Style) ---');
const inlineHTML = ast.map(node => DocTranspiler.toInlineStyleHTML(node)).join('\n');
console.log(inlineHTML);