export interface DocASTNode {
  type: string;

  /** Raw text of the "(...)" slot, if present — meaning depends on the node (see `parenRole` in registry.ts). */
  paren?: string;
  /** Parsed "{styles}" tokens — @mark and styled Block Nodes (Inline Syntax Specification §7, Block Syntax Specification §4). */
  styles?: string[];

  /** Generic nestable content — used by every node whose registry `content` mode is 'generic'. */
  content: (DocASTNode | string)[];

  /** Resolved raw text — used by raw-family nodes (@code, @mermaid, @svg, @raw, @kbd, @refn). */
  raw?: string;

  // Convenience fields derived from `paren`, populated per `parenRole`:
  level?: number;                    // @h
  title?: string;                    // @details, @card, callouts, @tab
  language?: string;                 // @code
  uri?: string;                      // @link
  id?: string;                       // @fn
  imgOptions?: Record<string, string>; // @img
  color?: string;                    // @color

  /** @refn only — parsed integer form of `raw`. */
  number?: number;

  // Structured extras for nodes with dedicated sub-grammar:
  columns?: string[];        // @table (from its @cols child)
  rows?: string[][];         // @table (from its @data child)
  tabs?: DocASTNode[];       // @tabs (its @tab children)
  meta?: Record<string, string>; // @meta
  /** @list only — one entry per non-empty line (Structural-Blocks.md §4 List), each a 'list-item' node. */
  items?: DocASTNode[];
}

export class DocSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocSyntaxError';
  }
}
