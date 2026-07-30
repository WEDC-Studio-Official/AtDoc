# @Doc Semantic Inline — Semantic Reference

*[中文版](./Semantic-Inline.zh-TW.md)*

> Companion to [Inline Syntax Specification](../../../Inline-Syntax-Specification.md) §4 (Complete EBNF Definition), and — for `@link` specifically — §8 (`@link` URI Semantics). This document covers meaning, usage, and the open edges of `@sup`, `@sub`, `@kbd`, and `@link`.

## 0. Table of Contents

* [1. Design Philosophy](#1-design-philosophy)
* [2. Why Semantic Inline Nodes Exist](#2-why-semantic-inline-nodes-exist)
* [3. Shape Comparison](#3-shape-comparison)
* [4. Node Reference](#4-node-reference)
  * [Superscript — `@sup`](#superscript--sup)
  * [Subscript — `@sub`](#subscript--sub)
  * [Keyboard Key — `@kbd`](#keyboard-key--kbd)
  * [Link — `@link`](#link--link)
* [5. AST Representation](#5-ast-representation)
* [6. Renderer Independence](#6-renderer-independence)
* [7. AI Generation Stability](#7-ai-generation-stability)
* [8. Design Principle](#8-design-principle)

---

## 1. Design Philosophy

`@sup`, `@sub`, `@kbd`, and `@link` are grouped as "Semantic Inline" in [Block Syntax Specification §2](../../../Block-Syntax-Specification.md#2-document-ast-structure)'s Document AST Structure diagram — not, as it might seem, in README. README's own Node Taxonomy uses a looser, separate pairing: "Inline Semantic" as one of two behavior modes under "Semantic Nodes" (see [README § Node Taxonomy](../../../README.md)), illustrated with a hypothetical `@lang(ja)[日本語]` that names none of these four nodes directly. README's "Core Nodes" list used to include `@link` alongside `@h1`/`@paragraph`/`@table`, which never matched the formal grammar — `@link` is an `inline-node` in the actual EBNF, never a `block-node` — and has since been corrected there. Treat Block Syntax Specification §2 as the authoritative categorization for this document regardless; README's Node Taxonomy remains a separate, less formal narrative. What actually separates this group from Text Formatting (`@bold`, `@italic`, `@underline`, `@del`, `@mark`) is *what* each node names:

```text
Text Formatting  →  How the text should look
Semantic Inline   →  What the text or fragment actually is
```

`@bold[important]` says "make this visually heavier." `@kbd[Ctrl]` says "this fragment is a keyboard key" — a fact about the content, not a styling instruction. A renderer that can't show bold text still knows a `@kbd` node is a key name; a renderer for a keyboard-shortcut index can query every `@kbd` in a document without caring how any of them are drawn.

---

## 2. Why Semantic Inline Nodes Exist

Markdown covers superscript and subscript only through non-standard extensions (`^text^`, `~text~`) that not every parser implements the same way, has no concept of a keyboard-key element at all (authors reach for backtick code spans — `` `Ctrl+C` `` — which conflates "this is a key" with "this is code"), and expresses links positionally (`[text](url)`), which is one of the more error-prone constructs for an LLM to generate reliably (unbalanced brackets, forgotten parens, accidental nesting).

@Doc gives each of these its own explicit node instead of overloading punctuation or borrowing a neighboring primitive:

```text
Meaning
  ↓
AST Node
  ↓
Renderer Adapter
  ↓
Output Target
```

A parser can find every `@kbd` (for a shortcuts index), every `@link` (for a link checker), or every `@sup`/`@sub` (for a citation or chemical-formula scan) directly, without guessing intent from a code span or a bracket-paren pair that might just as easily be plain text.

---

## 3. Shape Comparison

| Node | Slot | Content type | Shape notes |
|---|---|---|---|
| `@sup` | `content` | generic — nestable inline nodes | plain wrapper, no modifier |
| `@sub` | `content` | generic — nestable inline nodes | plain wrapper, no modifier |
| `@kbd` | `"[" key "]"` | `key = { text-char - "]" }` — **not** generic `content` | cannot contain nested inline nodes |
| `@link` | `uri` then `content` | `uri` is a restricted parenthetical; `content` is generic | only node in this group with two slots |

`@kbd`'s bracket looks identical to `@sup[...]` or `@sub[...]` on the page, but it is grammatically a different production — `key`, not `content` (see [Inline Syntax Specification §4](../../../Inline-Syntax-Specification.md#4-完整-ebnf-語法定義)). That means `@kbd[@bold[Ctrl]]` is not a nested bold key — the grammar doesn't route through `inline-node` at all inside `@kbd`'s brackets, the same restriction pattern `@fn[integer]` has among [Footnotes](../Footnotes/Footnotes.md#3-syntax).

---

## 4. Node Reference

### Superscript — `@sup`

```text
E = mc@sup[2]
```

Ordinary nestable `content` — a citation marker, a footnote-style reference glyph, or mathematical/scientific notation. Because `content` allows `inline-node | plain-text-char`, other inline nodes may appear inside (e.g. `@sup[@bold[a]]`), though most real uses are a bare number or short symbol.

---

### Subscript — `@sub`

```text
H@sub[2]O
```

Same shape as `@sup`, opposite visual direction. Typical use: chemical formulas, mathematical indices.

---

### Keyboard Key — `@kbd`

```text
按下@kbd[Ctrl]+@kbd[C]複製。
```

```ebnf
kbd = "@kbd" , "[" , key , "]" ;
key = { text-char - "]" } ;
```

`@kbd`'s content is `key`, not `content` — a raw character sequence excluding `]`, with no nested-node parsing. This is the same "restricted bracket" shape [Footnotes §3](../Footnotes/Footnotes.md#3-syntax) documents for `@fn[integer]`: the bracket exists, but it isn't the general-purpose inline `content` production used almost everywhere else in the grammar.

Use for: a single key or key combination shown as a UI-style key cap (`Ctrl`, `⌘`, `Enter`, `F5`). Not for arbitrary inline code — that remains a renderer/ecosystem gap in the current spec (@Doc has no `@code`-equivalent inline node; `@code` per [Block Syntax Specification §5](../../../Block-Syntax-Specification.md#code) is block-level only).

---

### Link — `@link`

```text
@link(uri)[content]
```

`@link` is the only node in this group with two slots — `uri` first, then `content`:

```ebnf
link = "@link" , uri , content ;
uri  = "(" , { text-char - ")" } , ")" ;
```

Full semantics — scheme inference (`example.com` → `https://example.com`, `test@example.com` → `mailto:...`, `+886912345678` → `tel:...`), the rule that an explicit scheme MUST be used as-is, and the supported-URI examples table — are covered in dedicated detail at [Inline Syntax Specification §8](../../../Inline-Syntax-Specification.md#8-link-uri-semantics); this document does not repeat that content.

Unlike `@kbd`'s `key`, `@link`'s `content` is the standard nestable production — `@link(example.com)[@bold[官方網站]]` is valid, letting link text carry its own inline formatting.

---

## 5. AST Representation

Example:

```text
按下@kbd[Ctrl]+@kbd[C]複製，詳見@link(https://example.com/docs)[官方文件]。
```

```text
Document
└── BlockNodes
    └── ParagraphNode
        ├── TextNode
        │   └── "按下"
        ├── KbdNode
        │   └── Key
        │       └── "Ctrl"
        ├── TextNode
        │   └── "+"
        ├── KbdNode
        │   └── Key
        │       └── "C"
        ├── TextNode
        │   └── "複製，詳見"
        ├── LinkNode
        │   ├── URI
        │   │   └── "https://example.com/docs"
        │   └── Content
        │       └── "官方文件"
        └── TextNode
            └── "。"
```

Because `KbdNode.Key` and `LinkNode.URI` are discrete fields rather than text mixed into a generic content stream, a tool can enumerate every keyboard shortcut or every outbound link in a document without re-parsing prose — the same query-by-structure benefit [Footnotes §6](../Footnotes/Footnotes.md#6-ast-representation) and [Callout Blocks §7](../../Block-Nodes/Callout-Blocks/Callout-Blocks.md#7-ast-representation) get from their own discrete fields.

---

## 6. Renderer Independence

Source:

```text
按下@kbd[Ctrl]+@kbd[S]儲存，或造訪@link(https://example.com)[官方網站]。
```

Web:

```html
<p>按下<kbd>Ctrl</kbd>+<kbd>S</kbd>儲存，或造訪<a href="https://example.com">官方網站</a>。</p>
```

Terminal:

```text
按下 [Ctrl]+[S] 儲存，或造訪 官方網站 (https://example.com)。
```

Documentation platform: a styled key-cap component for `@kbd`, and a native link element (possibly with hover preview) for `@link` — chosen by the adapter, not by the @Doc source.

---

## 7. AI Generation Stability

Markdown's `[text](url)` link syntax is one of the more fragile constructs for a generative model to produce reliably — a missing paren, an unescaped bracket inside link text, or accidental nesting all silently corrupt the structure. `@link(uri)[content]` keeps the two slots unambiguous: `()` is always the URI, `[]` is always the content, matching @Doc's global rule that `[]` has exactly one meaning ([README § Core Syntax](../../../README.md)).

`@kbd`'s restricted `key` slot removes a different failure mode: because nothing inside `@kbd[...]` is parsed as a nested inline node, a model cannot accidentally produce `@kbd[@bold[Ctrl]]` and leave a renderer guessing whether the bold styling should survive inside a key cap. `@sup` and `@sub` stay maximally simple — a plain content wrapper — because superscript/subscript carries no additional structure worth constraining.

---

## 8. Design Principle

Semantic Inline nodes follow the same rule as the rest of @Doc:

```text
Semantic First, Layout Later
```

A `@kbd` is not a code span that happens to look like a key. A `@link` is not a bracket-paren pair the parser has to reverse-engineer. Each node is defined by what it names, not by how any single renderer happens to draw it today.
