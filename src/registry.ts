// Node registry — the single source of truth the Lexer and Parser both consult
// to know what `@word` means and what shape its slots take.
//
// Mirrors `configs/atdoc-setting.json`'s tokenGroups / specialRules groupings
// (structuralKeywords, containerKeywords, calloutKeywords, widgetKeywords,
// formatKeywords, semanticKeywords, footnoteKeywords, specialKeywords,
// metaKeywords, contextNodes, voidNodes) — keep the two in sync by hand if
// either changes. Content-mode/paren/styles details below come from
// Block-Syntax-Specification.md §3 and Inline-Syntax-Specification.md §4.

export type NodeKind = 'block' | 'inline' | 'meta';

export type ContentMode =
  | 'none'        // bare, no brackets at all (@hr, @n)
  | 'generic'     // "[" { block-element | inline-node | text } "]" — nestable
  | 'raw'         // raw-block-content — unparsed, no escapes (@code, @mermaid)
  | 'raw-escaped' // raw-content — unparsed, local @] / @@] exceptions (@raw)
  | 'key'         // "[" key "]" — raw text excluding "]", no nesting (@kbd)
  | 'integer'     // "[" integer "]" — digits only (@fn)
  | 'comma-list'  // "[" identifier list "]" (@cols)
  | 'rows'        // "[" { row } "]" (@data)
  | 'table'       // "[" @cols @data "]" — fixed two-child structure (@table)
  | 'tabs'        // "[" { @tab } "]" — restricted to @tab children (@tabs)
  | 'meta';       // "[" key = value lines "]" (@meta)

export type ParenMode = 'none' | 'optional' | 'required';

export type ParenRole =
  | 'level'    // @heading
  | 'title'    // @details, @card, callouts, @tab
  | 'language' // @code
  | 'options'  // @img
  | 'uri'      // @link
  | 'id'       // @defn
  | 'ordered'; // @list

export interface NodeDef {
  name: string;
  kind: NodeKind;
  content: ContentMode;
  paren: ParenMode;
  parenRole?: ParenRole;
  styles?: boolean;       // "{styles}" slot allowed — @mark, @color, @bordered, styled Container/Callout Blocks
  restrictedTo?: string;  // only valid as a direct child of this node type
}

function def(partial: Omit<NodeDef, 'name'> & { name: string }): NodeDef {
  return partial;
}

const REGISTRY: NodeDef[] = [
  // Metadata — Block Syntax Specification §9
  def({ name: 'meta', kind: 'meta', content: 'meta', paren: 'none' }),

  // Structural Blocks — §5
  def({ name: 'heading', kind: 'block', content: 'generic', paren: 'optional', parenRole: 'level' }),
  def({ name: 'paragraph', kind: 'block', content: 'generic', paren: 'none' }),
  def({ name: 'quote', kind: 'block', content: 'generic', paren: 'none' }),
  def({ name: 'list', kind: 'block', content: 'generic', paren: 'optional', parenRole: 'ordered' }),
  def({ name: 'code', kind: 'block', content: 'raw', paren: 'optional', parenRole: 'language' }),
  def({ name: 'img', kind: 'block', content: 'generic', paren: 'required', parenRole: 'options' }),
  def({ name: 'table', kind: 'block', content: 'table', paren: 'none' }),
  def({ name: 'cols', kind: 'block', content: 'comma-list', paren: 'none', restrictedTo: 'table' }),
  def({ name: 'data', kind: 'block', content: 'rows', paren: 'none', restrictedTo: 'table' }),
  def({ name: 'hr', kind: 'block', content: 'none', paren: 'none' }),
  def({ name: 'svg', kind: 'block', content: 'raw', paren: 'none' }),

  // Container Blocks — §6
  def({ name: 'details', kind: 'block', content: 'generic', paren: 'optional', parenRole: 'title', styles: true }),
  def({ name: 'card', kind: 'block', content: 'generic', paren: 'optional', parenRole: 'title', styles: true }),

  // Callout Blocks — §7
  def({ name: 'note', kind: 'block', content: 'generic', paren: 'optional', parenRole: 'title', styles: true }),
  def({ name: 'tip', kind: 'block', content: 'generic', paren: 'optional', parenRole: 'title', styles: true }),
  def({ name: 'important', kind: 'block', content: 'generic', paren: 'optional', parenRole: 'title', styles: true }),
  def({ name: 'warning', kind: 'block', content: 'generic', paren: 'optional', parenRole: 'title', styles: true }),
  def({ name: 'caution', kind: 'block', content: 'generic', paren: 'optional', parenRole: 'title', styles: true }),

  // Widget Blocks — §8
  def({ name: 'tabs', kind: 'block', content: 'tabs', paren: 'none' }),
  def({ name: 'tab', kind: 'block', content: 'generic', paren: 'required', parenRole: 'title', restrictedTo: 'tabs' }),
  def({ name: 'mermaid', kind: 'block', content: 'raw', paren: 'none' }),

  // Text Formatting — Inline §4, §7, §9
  def({ name: 'bold', kind: 'inline', content: 'generic', paren: 'none' }),
  def({ name: 'italic', kind: 'inline', content: 'generic', paren: 'none' }),
  def({ name: 'underline', kind: 'inline', content: 'generic', paren: 'none' }),
  def({ name: 'del', kind: 'inline', content: 'generic', paren: 'none' }),
  def({ name: 'mark', kind: 'inline', content: 'generic', paren: 'none', styles: true }),
  def({ name: 'color', kind: 'inline', content: 'generic', paren: 'none', styles: true }),
  // Text outline/border — shares @color's exact {styles} slot (named color
  // token or literal hex) and swatch table, just painted onto a border
  // instead of a foreground color.
  def({ name: 'bordered', kind: 'inline', content: 'generic', paren: 'none', styles: true }),
  def({ name: 'raw', kind: 'inline', content: 'raw-escaped', paren: 'none' }),

  // Semantic Inline — Inline §4, §8
  def({ name: 'sup', kind: 'inline', content: 'generic', paren: 'none' }),
  def({ name: 'sub', kind: 'inline', content: 'generic', paren: 'none' }),
  def({ name: 'kbd', kind: 'inline', content: 'key', paren: 'none' }),
  def({ name: 'link', kind: 'inline', content: 'generic', paren: 'required', parenRole: 'uri' }),

  // Footnotes — Inline §4
  def({ name: 'defn', kind: 'inline', content: 'generic', paren: 'required', parenRole: 'id' }),
  def({ name: 'fn', kind: 'inline', content: 'integer', paren: 'none' }),

  // Special Nodes — Inline §4
  // Note: "@@" (escape) is deliberately NOT registered here. Per Inline Spec §2,
  // it is resolved at Lexer step 1 by character pattern, before any Command
  // Registry lookup — see Special-Nodes.md §5. Registering it as a normal
  // NodeDef would misrepresent it as a registry-driven command like the rest.
  def({ name: 'n', kind: 'inline', content: 'none', paren: 'none' }),
];

const BY_NAME = new Map<string, NodeDef>(REGISTRY.map(d => [d.name, d]));

/**
 * Short aliases for high-frequency commands — resolve transparently to the
 * same NodeDef as their canonical name (so `@h[...]` and `@heading[...]`
 * parse to the identical AST shape, `node.type` always canonical — see
 * Parser.ts's parseNode). `label` is the human-readable name an editor's
 * hover UI can pair with "Alias of @canonical".
 */
interface AliasDef {
  alias: string;
  canonical: string;
  label: string;
}

const ALIASES: AliasDef[] = [
  { alias: 'h', canonical: 'heading', label: 'Heading' },
  { alias: 'p', canonical: 'paragraph', label: 'Paragraph' },
  { alias: 'b', canonical: 'bold', label: 'Bold' },
  { alias: 'i', canonical: 'italic', label: 'Italic' },
  { alias: 'u', canonical: 'underline', label: 'Underline' },
];

const ALIAS_BY_NAME = new Map<string, AliasDef>(ALIASES.map(a => [a.alias, a]));

export function getNodeDef(name: string): NodeDef | undefined {
  const direct = BY_NAME.get(name);
  if (direct) return direct;
  const alias = ALIAS_BY_NAME.get(name);
  return alias ? BY_NAME.get(alias.canonical) : undefined;
}

export function isKnownCommand(name: string): boolean {
  return BY_NAME.has(name) || ALIAS_BY_NAME.has(name);
}

/** Alias metadata for `name`, or undefined if `name` isn't a short alias (including if it's already canonical). */
export function getAliasInfo(name: string): AliasDef | undefined {
  return ALIAS_BY_NAME.get(name);
}

/** The full alias table, for consumers that need to derive keyword lists including short aliases (e.g. src/editor/monarch.ts). */
export function getAllAliasDefs(): readonly AliasDef[] {
  return ALIASES;
}

/**
 * The full node table, for consumers that need to derive keyword lists
 * (e.g. the editor's Monarch tokenizer, src/editor/monarch.ts) instead of
 * hand-copying names. Keeping this as the single export point means new
 * REGISTRY entries automatically flow into anything built from it.
 */
export function getAllNodeDefs(): readonly NodeDef[] {
  return REGISTRY;
}

/**
 * Nodes let through inside @cols/@data cells (Structural-Blocks.md §5 Table
 * only promises plain text there, but most of these just restyle text —
 * bold/color/etc — without affecting the table's own structure, so authors
 * can still use them for cell formatting). New nodes must opt in here
 * explicitly; anything not listed (e.g. @card, @details) is Strict Mode's
 * concern — Parser.ts's parseInlineCellList() throws for it rather than
 * silently dropping it.
 *
 * @defn is deliberately excluded: it's collected document-wide and rendered
 * once as a real `<li>` inside the footnotes `<ol>` (see Adapters.ts's/
 * KamiAdapter.ts's renderFootnotes()), not loose inside a `<td>`.
 * @fn (the footnote *reference*, a self-contained `<sup><a>` back-link) is
 * fine and included — Parser.ts checks this set before its raw-family
 * carve-out so @fn gets parsed as a real node instead of dumped as bare digits.
 */
const CELL_ALLOWED_INLINE: ReadonlySet<string> = new Set([
  'bold', 'italic', 'underline', 'del', 'mark', 'color', 'bordered', 'sup', 'sub', 'link', 'fn',
]);

export function isCellAllowedNode(name: string): boolean {
  return CELL_ALLOWED_INLINE.has(name);
}
