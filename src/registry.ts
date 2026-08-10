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

/**
 * Which closed token set a node's "{styles}" slot accepts. Doubles as "does
 * this node have a {styles} slot at all" — `undefined` means the grammar
 * defines none, and Parser.ts rejects one rather than silently swallowing it.
 */
export type StyleSet =
  | 'color'  // named color token or "#RRGGBB" — @mark/@color/@bordered (Inline Spec §7) and Container/Callout Blocks
  | 'card'   // Card Style v1: "#RRGGBB" background + "radius-N" (Block Spec §6)
  | 'image'; // Image Style v1: "#RRGGBB" border color + "radius-N" (Block Spec §5)

/**
 * How a "(...)" slot's raw text becomes the convenience field its `parenRole`
 * implies. Lives here rather than in the Parser because `parenRole` does —
 * the Serializer needs the same mapping to check that a hand-built node's
 * `level`/`imgOptions`/... actually agree with its `paren`, and a second copy
 * of the rules is exactly how the two would drift apart.
 */
export function parseImgOptions(raw: string): Record<string, string> {
  const options: Record<string, string> = {};
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  parts.forEach((part, idx) => {
    const eq = part.indexOf('=');
    if (eq === -1) {
      if (idx === 0) options.src = part; // first bare option defaults to src — Block Syntax Spec §5 Image
      return;
    }
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) options[key] = value;
  });
  return options;
}

/** @heading's level, defaulting a missing or out-of-range "(...)" to 1. */
export function clampLevel(raw: string | undefined): number {
  const lvl = parseInt(raw ?? '1', 10);
  return Number.isFinite(lvl) && lvl >= 1 && lvl <= 6 ? lvl : 1;
}

/** @list's "(ordered)" flag. */
export function isOrderedParen(raw: string | undefined): boolean {
  return /^\s*ordered\s*$/i.test(raw ?? '');
}

/** The convenience fields a `parenRole` derives from its "(...)" text. */
export interface DerivedParenFields {
  level?: number;
  title?: string;
  language?: string;
  uri?: string;
  id?: string;
  imgOptions?: Record<string, string>;
  ordered?: boolean;
}

/**
 * What a "(...)" slot implies, in exactly the shape the Parser records it.
 *
 * Note which keys are *present with an undefined value*: the Parser assigns
 * `title`/`language`/`uri`/`id` unconditionally, so `@card[x]` really does
 * carry `title: undefined` rather than no key at all. Reproducing that
 * faithfully is what lets a canonicalized node compare deep-equal to a parsed
 * one — `{ title: undefined }` and `{}` are different objects to
 * assert.deepStrictEqual.
 *
 * `ordered` is the exception the Parser sets only when true, per DocASTNode's
 * own documentation ("unset/false renders as a bullet list"), so a non-ordered
 * @list has no key at all.
 */
export function deriveParenFields(role: ParenRole | undefined, paren: string | undefined): DerivedParenFields {
  switch (role) {
    case 'level': return { level: clampLevel(paren) };
    case 'title': return { title: paren };
    case 'language': return { language: paren };
    case 'uri': return { uri: paren };
    case 'id': return { id: paren };
    case 'options': return { imgOptions: parseImgOptions(paren ?? '') };
    case 'ordered': return isOrderedParen(paren) ? { ordered: true } : {};
    default: return {};
  }
}

export interface NodeDef {
  name: string;
  kind: NodeKind;
  content: ContentMode;
  paren: ParenMode;
  parenRole?: ParenRole;
  styles?: StyleSet;      // "{styles}" slot allowed, and which token set it takes
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
  def({ name: 'img', kind: 'block', content: 'generic', paren: 'required', parenRole: 'options', styles: 'image' }),
  def({ name: 'table', kind: 'block', content: 'table', paren: 'none' }),
  def({ name: 'cols', kind: 'block', content: 'comma-list', paren: 'none', restrictedTo: 'table' }),
  def({ name: 'data', kind: 'block', content: 'rows', paren: 'none', restrictedTo: 'table' }),
  def({ name: 'hr', kind: 'block', content: 'none', paren: 'none' }),
  def({ name: 'svg', kind: 'block', content: 'raw', paren: 'none' }),

  // Container Blocks — §6
  def({ name: 'details', kind: 'block', content: 'generic', paren: 'optional', parenRole: 'title', styles: 'color' }),
  def({ name: 'card', kind: 'block', content: 'generic', paren: 'optional', parenRole: 'title', styles: 'card' }),

  // Callout Blocks — §7
  def({ name: 'note', kind: 'block', content: 'generic', paren: 'optional', parenRole: 'title', styles: 'color' }),
  def({ name: 'tip', kind: 'block', content: 'generic', paren: 'optional', parenRole: 'title', styles: 'color' }),
  def({ name: 'important', kind: 'block', content: 'generic', paren: 'optional', parenRole: 'title', styles: 'color' }),
  def({ name: 'warning', kind: 'block', content: 'generic', paren: 'optional', parenRole: 'title', styles: 'color' }),
  def({ name: 'caution', kind: 'block', content: 'generic', paren: 'optional', parenRole: 'title', styles: 'color' }),

  // Widget Blocks — §8
  def({ name: 'tabs', kind: 'block', content: 'tabs', paren: 'none' }),
  def({ name: 'tab', kind: 'block', content: 'generic', paren: 'required', parenRole: 'title', restrictedTo: 'tabs' }),
  def({ name: 'mermaid', kind: 'block', content: 'raw', paren: 'none' }),

  // Text Formatting — Inline §4, §7, §9
  def({ name: 'bold', kind: 'inline', content: 'generic', paren: 'none' }),
  def({ name: 'italic', kind: 'inline', content: 'generic', paren: 'none' }),
  def({ name: 'underline', kind: 'inline', content: 'generic', paren: 'none' }),
  def({ name: 'del', kind: 'inline', content: 'generic', paren: 'none' }),
  def({ name: 'mark', kind: 'inline', content: 'generic', paren: 'none', styles: 'color' }),
  def({ name: 'color', kind: 'inline', content: 'generic', paren: 'none', styles: 'color' }),
  // Text outline/border — shares @color's exact {styles} slot (named color
  // token or literal hex) and swatch table, just painted onto a border
  // instead of a foreground color.
  def({ name: 'bordered', kind: 'inline', content: 'generic', paren: 'none', styles: 'color' }),
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
 * Adapters.ts's renderFootnotes()), not loose inside a `<td>`.
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

// ---------------------------------------------------------------------------
// Slot value suggestions — editor-facing metadata, same "registry is the one
// source of truth" idea as getAliasInfo()'s `label`. An editor's completion
// provider (Web's loadAtDocLanguage.ts) offers these once the caret is inside
// a node's "(...)" or "{...}", so the suggestion lists can't drift from the
// grammar the Lexer/Parser actually enforce.
// ---------------------------------------------------------------------------

export interface SlotSuggestion {
  /** Shown in the completion list. */
  label: string;
  /** Text to insert; may carry "${1:...}" snippet placeholders. Defaults to `label`. */
  insert?: string;
  /** Short right-hand hint explaining what the value does. */
  detail: string;
}

/** Named color tokens shared by @mark/@color/@bordered and the Container/Callout Blocks (Inline Spec §7). */
const NAMED_COLOR_TOKENS: readonly string[] = [
  'yellow', 'red', 'green', 'blue', 'orange', 'purple', 'gray',
];

/** Languages offered for @code's "(language)" — a convenience list, not a closed set; any string is valid. */
const CODE_LANGUAGES: readonly string[] = [
  'ts', 'tsx', 'js', 'jsx', 'json', 'html', 'css', 'scss', 'python',
  'bash', 'sql', 'go', 'rust', 'java', 'c', 'cpp', 'yaml', 'markdown', 'text',
];

/** @img's "(image-option-list)" keys — Block Spec §5's option table. */
const IMAGE_OPTIONS: readonly SlotSuggestion[] = [
  { label: 'src=', insert: 'src=${1}', detail: '圖片來源 URL（第一個選項可省略 key）' },
  { label: 'width=', insert: 'width=${1:200}', detail: '顯示寬度' },
  { label: 'height=', insert: 'height=${1:150}', detail: '顯示高度' },
  { label: 'align=', insert: 'align=${1|left,center,right|}', detail: '對齊方式' },
  { label: 'radius=', insert: 'radius=${1:8px}', detail: '圓角（任意 CSS 值；{radius-N} 會覆蓋它）' },
  { label: 'border=', insert: 'border=${1:1px solid #ccc}', detail: '外框（任意 CSS 值；{#RRGGBB} 會覆蓋它）' },
];

/**
 * What to offer inside `name`'s "(...)" slot. Empty for free-text roles
 * (title/uri/id) — there's nothing meaningful to enumerate, so the editor
 * should stay quiet rather than guess.
 */
export function getParenSuggestions(name: string): SlotSuggestion[] {
  const nodeDef = getNodeDef(name);
  if (!nodeDef || nodeDef.paren === 'none') return [];
  switch (nodeDef.parenRole) {
    case 'level':
      return [1, 2, 3, 4, 5, 6].map(n => ({ label: String(n), detail: `第 ${n} 層標題` }));
    case 'ordered':
      return [{ label: 'ordered', detail: '有序清單（省略則為項目清單）' }];
    case 'language':
      return CODE_LANGUAGES.map(lang => ({ label: lang, detail: '語法高亮語言' }));
    case 'options':
      return IMAGE_OPTIONS.map(o => ({ ...o }));
    default: // 'title' | 'uri' | 'id' — free text
      return [];
  }
}

/**
 * What to offer inside `name`'s "{styles}" slot, per its StyleSet. Empty when
 * the node has no {styles} slot at all — the editor shows nothing and
 * Parser.ts separately flags the slot itself as a grammar error.
 */
export function getStyleSuggestions(name: string): SlotSuggestion[] {
  const nodeDef = getNodeDef(name);
  switch (nodeDef?.styles) {
    case 'color':
      return [
        ...NAMED_COLOR_TOKENS.map(token => ({ label: token, detail: '具名色票' })),
        { label: '#RRGGBB', insert: '#${1:3366ff}', detail: '16 進位色值（直接採用，不重新映射）' },
      ];
    case 'card':
      return [
        { label: '#RRGGBB', insert: '#${1:3366ff}', detail: '背景色（Card Style v1）' },
        { label: 'radius-N', insert: 'radius-${1:12}', detail: '圓角像素值（Card Style v1）' },
      ];
    case 'image':
      return [
        { label: '#RRGGBB', insert: '#${1:3366ff}', detail: '外框色，套用為 1px 實線（Image Style v1）' },
        { label: 'radius-N', insert: 'radius-${1:12}', detail: '圓角像素值（Image Style v1）' },
      ];
    default:
      return [];
  }
}
