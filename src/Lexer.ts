export type TokenType = 'NODE' | 'MODIFIER' | 'METADATA' | 'SLOT_OPEN' | 'SLOT_CLOSE' | 'ACTION' | 'TEXT';

export interface Token {
  type: TokenType;
  value: string;
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  
  // 為了處理資料矩陣，換個更穩健的原生掃描策略
  const rawTokens = source.match(/@[a-zA-Z0-9_-]+|\([^)]*\)|\{[\s\S]*?\}|\[|\]|[^@[\](){\n]+/g) || [];
  
  let i = 0;
  while (i < rawTokens.length) {
    let token = rawTokens[i]; // 保留原始換行與空格
    if (!token) { 
      i++; 
      continue; 
    }

    const trimmed = token.trim();

    // 語義節點判斷與 Lookahead 防禦機制
    if (token.startsWith('@')) {
      const nodeName = token.slice(1);
      let isRealNode = false;
      
      // 精準偷看：跳過接下來的純空白/純換行 Token
      let nextIdx = i + 1;
      while (nextIdx < rawTokens.length && rawTokens[nextIdx].trim() === '') {
        nextIdx++;
      }
      
      // 偷看第一個遇到的有效符號，必須是 [ ( { 之一才是真正的語義節點
      if (nextIdx < rawTokens.length) {
        const nextValidToken = rawTokens[nextIdx].trim();
        if (nextValidToken === '[' || nextValidToken.startsWith('(') || nextValidToken.startsWith('{')) {
          isRealNode = true;
        }
      }
      
      if (isRealNode) {
        tokens.push({ type: 'NODE', value: nodeName });
      } else {
        tokens.push({ type: 'TEXT', value: token }); // 完美降級為純文字，例如 @Doc
      }
    }
    // 修飾符與尾綴動作判斷
    else if (trimmed.startsWith('(')) {
      const isAction = tokens.length > 0 && tokens[tokens.length - 1].type === 'SLOT_CLOSE';
      tokens.push({ type: isAction ? 'ACTION' : 'MODIFIER', value: trimmed.slice(1, -1) });
    }
    // 元數據區塊判斷
    else if (trimmed.startsWith('{')) {
      tokens.push({ type: 'METADATA', value: trimmed.slice(1, -1) });
    }
    // 符號唯一性：槽位開啟
    else if (trimmed === '[') {
      tokens.push({ type: 'SLOT_OPEN', value: '[' });
    }
    // 符號唯一性：槽位閉合
    else if (trimmed === ']') {
      tokens.push({ type: 'SLOT_CLOSE', value: ']' });
    }
    // 純文字、換行與空格兜底
    else {
      tokens.push({ type: 'TEXT', value: token });
    }
    
    i++;
  }
  
  return tokens;
}