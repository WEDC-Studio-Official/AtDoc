export interface DocASTNode {
  type: string;

  /** Raw text of the "(...)" slot, if present — meaning depends on the node (see `parenRole` in registry.ts). */
  paren?: string;
  /** Parsed "{styles}" comma-list tokens — @mark and styled Block Nodes (Inline Syntax Specification §7, Block Syntax Specification §4). */
  styles?: string[];

  /** Generic nestable content — used by every node whose registry `content` mode is 'generic'. */
  content: (DocASTNode | string)[];

  /** Resolved raw text — used by raw-family nodes (@code, @mermaid, @svg, @raw, @kbd, @fn). */
  raw?: string;

  // Convenience fields derived from `paren`, populated per `parenRole`:
  level?: number;                    // @heading
  title?: string;                    // @details, @card, callouts, @tab
  language?: string;                 // @code
  uri?: string;                      // @link
  id?: string;                       // @defn
  imgOptions?: Record<string, string>; // @img
  color?: string;                    // @color, @bordered
  /** @list only — true when `@list(ordered)`; unset/false renders as a bullet list. */
  ordered?: boolean;

  /** @fn only — parsed integer form of `raw`. */
  number?: number;

  // Structured extras for nodes with dedicated sub-grammar:
  /** @table (from its @cols child) — each column is inline content (text + a curated set of formatting nodes, see registry.ts's isCellAllowedNode). */
  columns?: (DocASTNode | string)[][];
  /** @table (from its @data child) — each row is a list of cells, each cell inline content like `columns`. */
  rows?: (DocASTNode | string)[][][];
  tabs?: DocASTNode[];       // @tabs (its @tab children)
  meta?: Record<string, string>; // @meta
  /** @list only — one entry per non-empty line (Structural-Blocks.md §4 List), each a 'list-item' node. */
  /** 'list-item' only — explicit numeric marker from a leading "N. "/"N)" prefix, letting @list(ordered) restart/resume numbering via `<li value>`. Ignored when the parent @list isn't ordered. */
  marker?: number;
}

export class DocSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocSyntaxError';
  }
}
