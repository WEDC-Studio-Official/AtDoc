import { DocASTNode, StyleDynamic } from './types';
const TAG_MAP: Record<string, string> = {
  h1: 'h1', h2: 'h2', p: 'p', btn: 'button',
  card: 'article', title: 'header', text: 'section',
  table: 'table', cols: 'tr', data: 'tbody' // 💡 表格語義對齊！
};
export class DocTranspiler {
  
  // 路線 A：Tailwind JIT 適配器（高效 Web 端）
  public static toTailwindHTML(node: DocASTNode): string {
    // 隱藏 SEO 元數據，改為在主機後台輸出或注入 <head>
    if (node.type === 'seo') {
      return ``;
    }

    const tag = TAG_MAP[node.type] || 'div';
    const statics = node.attributes.styles.static;
    const dynamics = node.attributes.styles.dynamic.map((d: any) => `${d.prop}-[${d.value}]`);
    const classAttr = [...statics, ...dynamics].join(' ') ? ` class="${[...statics, ...dynamics].join(' ')}"` : '';

    // 針對 table 內部的特殊清洗邏輯
    // 內部針對表格的清洗增強

    let children = node.content.map(c => {
    if (typeof c === 'string') {
        if (node.type === 'cols') {
        return c.split(',').map(item => `<th>${item.trim()}</th>`).join('');
        }
        if (node.type === 'data') {
        // 防禦機制：將降級的所有 TEXT 合併清洗，按換行或方括號切開
        // 把殘留的 [ ] 去除，並過濾掉空行
        const rows = c.split(/[\n\]\[]+/)
                        .map(row => row.trim())
                        .filter(row => row.length > 0 && row.includes(','));
                        
        return rows.map(row => {
            return `<tr>${row.split(',').map(item => `<td>${item.trim()}</td>`).join('')}</tr>`;
        }).join('');
        }
        return c;
    }
    return DocTranspiler.toTailwindHTML(c);
    }).join('');

    return `<${tag} data-node="${node.type}"${classAttr}>${children}</${tag}>`;
  }

  // 路線 B：Universal Inline Style 適配器（跨平台/老舊環境）
    public static toInlineStyleHTML(node: DocASTNode): string {
    // 完美隱藏 SEO 元數據
    if (node.type === 'seo') {
        return ``;
    }

    // 對齊標準 HTML 語義標籤 (h1, table, tr 等)，不再萬物皆 div
    const tag = TAG_MAP[node.type] || 'div';
    
    const statics = node.attributes.styles.static.join(' ');
    const classAttr = statics ? ` class="${statics}"` : '';

    // 將 dynamic 翻譯成標準的 CSS 行內鍵值對
    const inlineStyles = node.attributes.styles.dynamic.map((d: StyleDynamic) => {
        const propMap: Record<string, string> = { w: 'width', h: 'height', bg: 'background-color' };
        const propName = propMap[d.prop] || d.prop;
        const isColor = /^[0-9a-fA-F]{3,6}$/.test(d.value) && !d.value.endsWith('px');
        const safeValue = isColor ? `#${d.value}` : d.value;
        return `${propName}: ${safeValue};`;
    }).join(' ');

    const styleAttr = inlineStyles ? ` style="${inlineStyles}"` : '';
    
    // 遞迴處理子節點（修正 this 陷阱，並加入 table/data 二維矩陣清洗邏輯）
    const children = node.content.map(c => {
        if (typeof c === 'string') {
        // 處理表格欄位定義 @cols
        if (node.type === 'cols') {
            return c.split(',').map(item => `<th>${item.trim()}</th>`).join('');
        }
        // 處理表格資料列 @data
        if (node.type === 'data') {
            // 清除掉被降級為 TEXT 的二維陣列殘留方括號 [ 和 ]
            const cleanRow = c.replace(/[\[\]]/g, '').trim();
            if (!cleanRow) return '';
            return `<tr>${cleanRow.split(',').map(item => `<td>${item.trim()}</td>`).join('')}</tr>`;
        }
        return c;
        }
        // 修正：將 this.toInlineStyleHTML 改為 DocTranspiler.toInlineStyleHTML 確保 ESM 遞迴安全
        return DocTranspiler.toInlineStyleHTML(c);
    }).join('');

    // 輸出符合標準語義且帶有 Inline Style 的標籤
    return `<${tag} data-node="${node.type}"${classAttr}${styleAttr}>${children}</${tag}>`;
    }
}