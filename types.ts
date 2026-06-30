import { Token } from './Lexer';
import { DocASTNode } from './types';

export class DocParser {
  private tokens: Token[];
  private cursor = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }
  // 主入口過濾增強

    public parse(): DocASTNode[] {
    const ast: DocASTNode[] = [];
    
    while (this.cursor < this.tokens.length) {
        const current = this.tokens[this.cursor];

        // 防禦機制：如果是純空白、純換行符號的 Token，直接消耗並跳過，拒絕產生垃圾節點
        if (current.type === 'TEXT' && current.value.replace(/[\s\n]/g, '') === '') {
        this.cursor++;
        continue;
        }

        if (current.type === 'NODE' && this.isBlockNode(current.value)) {
        const node = this.parseNode();
        if (node) ast.push(node);
        } 
        else {
        const pNode = this.parseParagraph();
        // 防禦機制：再次確認聚合成的段落內容不能只有空白字串
        const hasContent = pNode.content.some(c => 
            typeof c === 'object' || (typeof c === 'string' && c.replace(/[\s\n]/g, '') !== '')
        );
        if (hasContent) {
            ast.push(pNode);
        }
        }
    }
    return ast;
    }

  // 判斷是否為區塊級節00點 (可以根據你的 Spec 自由擴充)
  private isBlockNode(name: string): boolean {
    // 防禦機制：確保把 seo, cols, data 也納入區塊守護，防止它們跟普通文字混在一起
    return ['h1', 'h2', 'h3', 'card', 'table', 'seo', 'p', 'cols', 'data'].includes(name);
  }

  // 核心機制：將最外層的碎片聚合成標準段落 (@p)
  private parseParagraph(): DocASTNode {
    const pNode: DocASTNode = {
      type: 'p',
      modifier: [],
      attributes: { styles: { static: [], dynamic: [] } },
      content: [],
      action: null
    };

    while (this.cursor < this.tokens.length) {
      const current = this.tokens[this.cursor];

      // 如果遇到了下一個明確的區塊級節點，說明當前普通段落必須中斷
      if (current.type === 'NODE' && this.isBlockNode(current.value)) {
        break;
      }

      // 如果在段落內部遇到 NODE (例如 @lang)，它是一個行內語義節點
      if (current.type === 'NODE') {
        const inlineNode = this.parseNode();
        if (inlineNode) pNode.content.push(inlineNode);
      } 
      // 如果是普通文字，直接塞入內容
      else if (current.type === 'TEXT') {
        pNode.content.push(current.value);
        this.cursor++;
      } 
      // 處理其餘非結構符號
      else {
        this.cursor++;
      }
    }

    return pNode;
  }

  // 解析單一標準節點
  // 內部的 parseNode 增強

    private parseNode(): DocASTNode | null {
    const token = this.tokens[this.cursor];
    if (!token || token.type !== 'NODE') return null;

    const node: DocASTNode = {
        type: token.value,
        modifier: [],
        attributes: { styles: { static: [], dynamic: [] } },
        content: [],
        action: null
    };

    this.cursor++; // 跳過 NODE

    // 掃描修飾符與元數據
    while (this.cursor < this.tokens.length) {
        const next = this.tokens[this.cursor];
        if (next.type === 'MODIFIER') {
        node.modifier = next.value.split(',').map(s => s.trim());
        this.cursor++;
        } else if (next.type === 'METADATA') {
        this.parseAttributes(next.value, node);
        this.cursor++;
        } else {
        break;
        }
    }

    // 核心優化：進入內容槽位 [ ... ]
    if (this.tokens[this.cursor]?.type === 'SLOT_OPEN') {
        this.cursor++; // 跳過 [
        
        // 如果是資料密集型節點，開啟純文字黑洞模式，直接吞到該節點的結束方括號為止
        if (node.type === 'data') {
        node.content = [this.parseRawTextSlot()];
        } else {
        // 其餘普通語義節點，依舊允許巢狀嵌套
        node.content = this.parseSlotContent();
        }
        
        this.cursor++; // 跳過 ]
    }

    if (this.tokens[this.cursor]?.type === 'ACTION') {
        node.action = this.tokens[this.cursor].value;
        this.cursor++;
    }

    return node;
    }

  // 解析方括號槽位內部的遞迴內容
  private parseSlotContent(): (DocASTNode | string)[] {
    const content: (DocASTNode | string)[] = [];
    while (this.cursor < this.tokens.length && this.tokens[this.cursor].type !== 'SLOT_CLOSE') {
      const current = this.tokens[this.cursor];
      if (current.type === 'NODE') {
        const childNode = this.parseNode();
        if (childNode) content.push(childNode);
      } else {
        content.push(current.value);
        this.cursor++;
      }
    }
    return content;
  }

  // 樣式元數據解析
  private parseAttributes(rawMeta: string, node: DocASTNode) {
    if (rawMeta.trim().startsWith('"') || rawMeta.trim().startsWith('{')) {
      try {
        node.attributes.rawMetadata = JSON.parse(`{${rawMeta}}`);
        return;
      } catch (e) {}
    }

    const styleTokens = rawMeta.split(/\s+/);
    styleTokens.forEach(style => {
      const dynamicMatch = style.match(/^([a-z]+)-([a-zA-Z0-9]+)$/);
      if (dynamicMatch && (dynamicMatch[2].match(/\d/) || ['fff', '000'].includes(dynamicMatch[2]))) {
        node.attributes.styles.dynamic.push({
          prop: dynamicMatch[1],
          value: dynamicMatch[2]
        });
      } else if (style) {
        node.attributes.styles.static.push(style);
      }
    });
  }
    private parseRawTextSlot(): string {
    let rawText = "";
    // 進入此函數前，Parser 已經消耗了 @data 後面的第一個 '['，所以當前深度設為 1
    let depth = 1; 

    while (this.cursor < this.tokens.length) {
        const current = this.tokens[this.cursor];

        // 如果在黑洞內部又遇到了內層資料列的 '['
        if (current.type === 'SLOT_OPEN') {
        depth++;
        }

        // 如果遇到了 ']'
        if (current.type === 'SLOT_CLOSE') {
        depth--;
        // 只有當深度扣到 0，說明遇到了 @data[...] 最外層的那個右方括號，這才是真正的終點！
        if (depth === 0) {
            break; 
        }
        }

        // 將內容原封不動地還原回字串（包括換行、空格與逗號）
        rawText += current.value;
        this.cursor++;
    }

    return rawText;
    }
}