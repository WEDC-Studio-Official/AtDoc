export interface DocASTNode {
  type: string;

  /** Top-level document nodes only — source character offset of the node's opening "@", used to map it back to an editor line for scroll sync (see pipeline.ts). */
  start?: number;

  /** Raw text of the "(...)" slot, if present — meaning depends on the node (see `parenRole` in registry.ts). */
  paren?: string;
  /** Parsed "{styles}" comma-list tokens — @mark only (Inline Syntax Specification §7). */
  styles?: string[];

  /** Generic nestable content — used by every node whose registry `content` mode is 'generic'. */
  content: (DocASTNode | string)[];

  /** Resolved raw text — used by raw-family nodes (@code, @mermaid, @raw, @kbd, @fn). */
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
  /** Synthetic `type: 'list-item'` nodes only (built by Parser.buildListItems, never a real @command) — set when the item's line had an explicit "N. "/"N)" prefix, so @list(ordered) can restart/resume numbering via `<li value>`. */
  marker?: number;

  // Structured extras for nodes with dedicated sub-grammar:
  /** @table (from its @cols child) — each column is inline content (text + a curated set of formatting nodes, see registry.ts's isCellAllowedNode). */
  columns?: (DocASTNode | string)[][];
  /** @table (from its @data child) — each row is a list of cells, each cell inline content like `columns`. */
  rows?: (DocASTNode | string)[][][];
  tabs?: DocASTNode[];       // @tabs (its @tab children)
  meta?: Record<string, string>; // @meta
}

/** Non-fatal parse issue — surfaced to the editor as a marker instead of aborting the parse. */
export interface DocDiagnostic {
  start: number;
  end: number;
  message: string;
  /**
   * Marker tier. Absent means 'error' (the historical behavior, and what every
   * pre-existing diagnosis site still emits). 'warning' flags constructs that
   * parse but almost certainly not the way the author meant (e.g. an @raw
   * escape that swallowed the intended closing bracket); 'info' is a
   * non-judgmental heads-up (e.g. "this @] is an escape, it won't end the
   * node"). Neither blocks parsing or rendering.
   */
  severity?: 'error' | 'warning' | 'info';
}

export class DocSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocSyntaxError';
  }
}

/**
 * Which renderer/stylesheet pair an Adapter output pairs with.
 *   kami  — src/kami's visual identity: serif, warm parchment, fixed 720px.
 *   index — neutral default stylesheet: system sans-serif, plain white/dark.
 * Both render the same AST; only the Adapter and stylesheet differ.
 */
export type PreviewStyle = 'kami' | 'index';
