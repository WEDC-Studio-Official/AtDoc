export interface StyleDynamic {
  prop: string;
  value: string;
}

export interface VisualStyles {
  static: string[];
  dynamic: StyleDynamic[];
}

export interface DocASTNode {
  type: string;
  modifier: string[];
  attributes: {
    styles: VisualStyles;
    rawMetadata?: any; // 用於儲存 @seo 這種 Block Metadata 的 JSON 物件
  };
  content: (DocASTNode | string)[]; // 內容槽位可以包含子節點或純文字
  action: string | null;
}