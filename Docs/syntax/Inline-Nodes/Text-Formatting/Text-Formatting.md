# @Doc Text Formatting — Semantic Reference

*[中文版](./Text-Formatting.zh-TW.md)*

> Companion to [Inline Syntax Specification](../../../Inline-Syntax-Specification.md) §4 (Complete EBNF Definition) — plus §7 (`@mark` Styles Semantics), §9 (`@raw` Opaque Domain), and §10 (Nested Parsing), which each cover one member of this family in dedicated detail. This document covers `@bold`, `@italic`, `@underline`, `@del`, `@mark`, and `@raw` as a group; where a node already has its own numbered section, this reference summarizes and links out rather than repeating it. Categorized as "Text Formatting" in [Block Syntax Specification §2](../../../Block-Syntax-Specification.md#2-document-ast-structure)'s Document AST Structure diagram.

## 0. Table of Contents

* [1. Design Philosophy](#1-design-philosophy)
* [2. Why Text Formatting Nodes Exist](#2-why-text-formatting-nodes-exist)
* [3. Shape Comparison](#3-shape-comparison)
* [4. Node Reference](#4-node-reference)
  * [Bold](#bold)
  * [Italic](#italic)
  * [Underline](#underline)
  * [Strikethrough — `@del`](#strikethrough--del)
  * [Mark](#mark)
  * [Raw](#raw)
* [5. Semantic HTML Mapping (Non-Normative)](#5-semantic-html-mapping-non-normative)
* [6. AST Representation](#6-ast-representation)
* [7. Renderer Independence](#7-renderer-independence)
* [8. AI Generation Stability](#8-ai-generation-stability)
* [9. Design Principle](#9-design-principle)

---

## 1. Design Philosophy

Text Formatting nodes describe how a fragment should be visually or semantically distinguished from surrounding text — emphasized, struck through, highlighted — without dictating a specific font weight, color, or tag. Five of the six members share one shape almost exactly:

```text
@bold   @italic   @underline   @del   @mark
```

`@raw` is the deliberate outlier: it names an *absence* of formatting parsing, not a formatting style. It belongs to this family because it lives in the same part of the grammar (an `inline-node` wrapping a bracketed body), not because it shares the others' behavior.

---

## 2. Why Text Formatting Nodes Exist

Markdown expresses most of this family through repurposed punctuation — `**bold**`, `*italic*`, `~~strikethrough~~ — where the same character (`*`) means two different things depending on whether it's doubled, and where authors regularly hit ambiguity around word boundaries (`foo*bar*baz` vs `foo *bar* baz`). Underline and highlight have no standard Markdown syntax at all; authors fall back to raw HTML (`<u>`, `<mark>`) or platform-specific extensions.

@Doc gives each of these an explicit node name instead of overloading a small set of punctuation characters across multiple meanings:

```text
Meaning
  ↓
AST Node
  ↓
Renderer Adapter
  ↓
Output Target
```

A parser can find every `@mark` (for a highlight/annotation index) or every `@del` (for a "what changed" scan) directly, without disambiguating `*` from `**` from `***` by counting characters.

---

## 3. Shape Comparison

| Node | Modifier / Option | Content type | Shape notes |
|---|---|---|---|
| `@bold` | — | `content` (nestable) | plain wrapper |
| `@italic` | — | `content` (nestable) | plain wrapper |
| `@underline` | — | `content` (nestable) | plain wrapper |
| `@del` | — | `content` (nestable) | plain wrapper |
| `@mark` | `{styles}`, optional | `content` (nestable) | only node in this family with a styles slot — see [§7 below](#mark) |
| `@raw` | — | `raw-content` (opaque, **not** nestable) | only node in this family that disables inline parsing entirely |

```ebnf
mark      = "@mark" , [ styles ] , content ;
bold      = "@bold" , content ;
italic    = "@italic" , content ;
underline = "@underline" , content ;
del       = "@del" , content ;

raw       = "@raw" , raw-content ;
```

Four of the six nodes — `@bold`, `@italic`, `@underline`, `@del` — are structurally identical: a keyword and nothing but `content`. `@mark` adds one optional slot on top of that same shape. `@raw` is the only member whose content production is different in kind, not just in options — see [Raw](#raw).

---

## 4. Node Reference

### Bold

```text
這是@bold[重要]內容。
```

Marks a fragment as having stronger importance than surrounding text. No modifier, no styles — the plainest node in the family.

---

### Italic

```text
這是@italic[強調]內容。
```

Marks a fragment as stylistically or semantically distinct — emphasis, a title, a foreign-language term. Same shape as `@bold`.

---

### Underline

```text
這是@underline[底線]內容。
```

Same shape again. Unlike `@bold`/`@italic`, underline has no strong precedent in Markdown at all — @Doc gives it first-class status anyway, rather than forcing authors into raw `<u>`.

---

### Strikethrough — `@del`

```text
這是@del[刪除線]內容。
```

Marks a fragment as removed, retracted, or no longer applicable — the semantic opposite of newly added content. Same shape as the three nodes above.

---

### Mark

```text
@mark[預設高亮]
@mark{yellow}[黃色高亮]
@mark{red,underline}[紅色並加底線]
```

The only Text Formatting node with a second slot: an optional `{styles}` token list (colors, `underline`, `strikethrough`, `bordered`). Full semantics — the two token categories, renderer fallback rules for unrecognized tokens, and why `styles` is a lexical-only production (a brace-wrapped character run, with token splitting left to the semantic/renderer layer) — are covered in dedicated detail at [Inline Syntax Specification §7](../../../Inline-Syntax-Specification.md#7-mark-styles-semantics); this document does not repeat that content.

---

### Raw

```text
@raw[@mark[hello]]
```

Output: the literal text `@mark[hello]` — not a mark node. `@raw`'s content is `raw-content`, not `content`: nothing inside is parsed as @Doc syntax, and even the global `@@` escape rule is disabled inside it (replaced by two narrower local exceptions, `@]` → `]` and `@@]` → `@]`). Full rules and worked examples live at [Inline Syntax Specification §9](../../../Inline-Syntax-Specification.md#9-raw-opaque-domain) and [Special Nodes §6](../Special-Nodes/Special-Nodes.md#6-escape-scope--global-rule-vs-raw-exceptions) (which documents the interaction between `@raw`'s local exceptions and the global escape rule in detail).

`@raw` is not "inline code," even though it's often reached for in that role — it names an *absence of parsing*, not a semantic claim about the content being code. @Doc currently has no dedicated inline-code node at all (`@code` per [Block Syntax Specification §5](../../../Block-Syntax-Specification.md#code) is block-level only); using `@raw` for a short code fragment borrows its opaque-parsing behavior without asserting "this is code" the way `@kbd` asserts "this is a keyboard key" (see [Semantic Inline: Keyboard Key](../Semantic-Inline/Semantic-Inline.md#keyboard-key--kbd)).

---

## 5. Semantic HTML Mapping (Non-Normative)

Neither the Block Syntax Specification nor the Inline Syntax Specification prescribes which HTML tag `@bold` or `@italic` should compile to. A reasonable, commonly-expected mapping — `@bold` → `<strong>`, `@italic` → `<em>` — favors *semantic* HTML (importance/emphasis) over purely *presentational* tags (`<b>`, `<i>`), consistent with @Doc's stated goal of separating meaning from appearance ([README § What @Doc Is](../../../README.md)). Treat this as sensible renderer-adapter guidance, not a normative rule — the formal spec leaves tag choice to the renderer, the same way it leaves `@warning`'s HTML output to the renderer adapter (see [Callout Blocks §8](../../Block-Nodes/Callout-Blocks/Callout-Blocks.md#8-renderer-independence)).

---

## 6. AST Representation

[Inline Syntax Specification §10](../../../Inline-Syntax-Specification.md#10-nested-parsing) gives the canonical nesting example for this family:

```text
@bold[
    這是粗體，
    裡面有
    @mark{yellow}[重要高亮]
    與
    @underline[底線]
]
```

```text
Document
└── BlockNodes
    └── ParagraphNode
        └── BoldNode
            ├── TextNode
            │   └── "這是粗體，裡面有"
            ├── MarkNode
            │   ├── Styles
            │   │   └── ["yellow"]
            │   └── Content
            │       └── "重要高亮"
            ├── TextNode
            │   └── "與"
            └── UnderlineNode
                └── Content
                    └── "底線"
```

`@raw` produces a structurally different tree — a single leaf node holding an opaque string, the same shape `@code` and `@mermaid` use at the block level (see [Widget Blocks §5](../../Block-Nodes/Widget-Blocks/Widget-Blocks.md#5-ast-representation)):

```text
Document
└── BlockNodes
    └── ParagraphNode
        └── RawNode
            └── RawContent
                └── "@mark[hello]"
```

Because `Bold`/`Italic`/`Underline`/`Del`/`Mark` all route through the same nestable `content` production, a tool can walk arbitrarily deep combinations of them; `Raw`'s content is opaque by design, so no tool can (or should) look inside it.

---

## 7. Renderer Independence

Source:

```text
這是@bold[重要]內容，這段@del[已過時]。
```

Web:

```html
<p>這是<strong>重要</strong>內容，這段<del>已過時</del>。</p>
```

Terminal:

```text
這是【重要】內容，這段~~已過時~~。
```

Documentation platform: native emphasis/strikethrough components, chosen by the adapter — not by the @Doc source. `@raw`'s output is identical across every target by definition: whatever string was inside the brackets, unparsed.

---

## 8. AI Generation Stability

Markdown's overloaded punctuation is a well-documented source of generation drift: a model has to track whether it's inside single or double asterisks, whether underscores or asterisks are the active delimiter, and whether a `*` mid-word starts emphasis or is just a literal character. `@bold[...]`, `@italic[...]`, `@underline[...]`, and `@del[...]` remove that ambiguity — each has one spelling, and `[]` has exactly one meaning everywhere in @Doc ([README § Core Syntax](../../../README.md)).

`@raw` solves a different generation problem: when a model needs to produce example @Doc syntax as literal text (documentation about @Doc itself, as this file repeatedly does), wrapping it in `@raw[...]` guarantees the compiler won't try to parse the example as real nodes — no manual escaping of every `@` and `[` inside the sample required.

---

## 9. Design Principle

Text Formatting nodes follow the same rule as the rest of @Doc:

```text
Semantic First, Layout Later
```

Bold text is not two asterisks. A highlight is not a `<mark>` tag some renderer happened to pick. Each node is defined by what it means for a fragment of text, not by how any single renderer happens to draw it today.
