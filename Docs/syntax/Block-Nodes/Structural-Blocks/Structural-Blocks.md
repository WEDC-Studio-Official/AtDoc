# @Doc Structural Blocks — Semantic Reference

*[中文版](./Structural-Blocks.zh-TW.md)*

> Companion to [Block Syntax Specification](../../../Block-Syntax-Specification.md) §5 (Structural Blocks). The grammar lives there; this document covers meaning, usage, and the open edges of `@h`, `@p`, `@quote`, `@list`, `@code`, `@img`, `@table`, `@hr`, and `@svg`.

## 0. Table of Contents

* [1. Design Philosophy](#1-design-philosophy)
* [2. Why Structural Blocks Exist](#2-why-structural-blocks-exist)
* [3. Shape Comparison](#3-shape-comparison)
* [4. Node Reference](#4-node-reference)
  * [Heading](#heading)
  * [Paragraph](#paragraph)
  * [Quote](#quote)
  * [List](#list)
  * [Code](#code)
  * [Image](#image)
  * [Table](#table)
  * [Horizontal Rule](#horizontal-rule)
  * [SVG](#svg)
* [5. AST Representation](#5-ast-representation)
* [6. Renderer Independence](#6-renderer-independence)
* [7. AI Generation Stability](#7-ai-generation-stability)
* [8. Design Principle](#8-design-principle)

---

## 1. Design Philosophy

Structural Blocks are the document's skeleton — the smallest set of primitives every renderer must support before Container, Callout, or Widget blocks make sense. README calls them "Core Nodes": atomic, not further divisible.

Unlike Callout Blocks (one shared severity grammar) or Container Blocks (one shared title+content grammar), Structural Blocks don't share a single shape. Each node's grammar reflects only what that specific primitive needs — a heading needs a level, code needs a language and unparsed content, a horizontal rule needs nothing at all.

---

## 2. Why Structural Blocks Exist

Markdown already covers this ground reasonably well for humans — but its rules are positional and whitespace-sensitive (`#`, four-space indents, blank-line-terminated paragraphs), which is exactly the kind of ambiguity that breaks when an LLM generates the text instead of a human typing it. @Doc keeps the same primitives readers already know, but names them explicitly instead of inferring them from layout:

```text
Markdown           @Doc
# Title       →    @h(1)[Title]
plain text    →    @p[plain text]
> quoted      →    @quote[quoted]
- item        →    @list[- item]
```

The renderer still decides the actual HTML/PDF/terminal output; the source just stops depending on whitespace and line position to say what something is.

---

## 3. Shape Comparison

| Node | Modifier / Option | Content | Shape notes |
|---|---|---|---|
| `@h` | `(level)`, optional, `1`–`6` | `block-content` | see [Heading](#heading) for the missing default |
| `@p` | — | `block-content` | plain text container |
| `@quote` | — | `block-content` | no distinct citation/author field |
| `@list` | `(ordered)`, optional (see [List](#list)) | `block-content` | every non-empty line is an item — a structured `ListItem` AST, not re-split text |
| `@code` | `(language)`, optional | `raw-block-content` | unparsed — same idea as `@raw` |
| `@img` | `(image-option-list)` | `block-content` (alt text) | only node with a structured key=value option list |
| `@table` | — | `@cols` + `@data` (not generic `block-content`) | only node with dedicated sub-node grammar |
| `@hr` | — | none — bare `@hr`, no brackets at all | only node with zero slots |
| `@svg` | — | `raw-block-content` | unparsed, unescaped — same idea as `@code`/`@mermaid`, but rendered as a live graphic, not text |

No two rows are identical. That's intentional — see §1.

---

## 4. Node Reference

### Heading

```text
@h(1)[
Introduction
]
```

HTML:

```html
<h1>Introduction</h1>
```

`level` accepts `1`–`6`. The grammar marks `(level)` optional (`[ "(" , level , ")" ]`), but [Block Syntax Specification §3](../../../Block-Syntax-Specification.md#3-ebnf) doesn't state a default when it's omitted. This reference treats a level-less `@h[...]` as equivalent to `@h(1)[...]` — a top-level heading — until the core spec says otherwise.

---

### Paragraph

```text
@p[
Hello World
]
```

HTML:

```html
<p>Hello World</p>
```

No modifier, no title — the plainest structural block. Use for ordinary body text that isn't quoted, listed, or coded.

---

### Quote

```text
@quote[
Talk is cheap.
Show me the code.
]
```

HTML:

```html
<blockquote>
Talk is cheap.
Show me the code.
</blockquote>
```

Like `@p`, `@quote` has no modifier — there's no dedicated field for a citation or attribution. An author who wants "— Linus Torvalds" under a quote has to write it as a second line of content, the same trade-off Callout Blocks had before they gained `(title)` (see [Callout Blocks §3](../Callout-Blocks/Callout-Blocks.md#3-syntax)).

---

### List

Every non-empty line inside `block-content` is an item. A leading `- ` is accepted and stripped for backward compatibility, but no longer required:

```text
@list[
Apple
Banana
Orange
]
```

is equivalent to the older, still-valid:

```text
@list[
- Apple
- Banana
- Orange
]
```

Each item is now a dedicated `ListItem` AST node (`node.items`) built by the Parser, not by each renderer re-splitting rendered text — so inline nodes inside an item (e.g. `@bold[Apple]`) survive as structured children instead of being flattened first. (Compare [Table](#table), which has a fully structured `Columns`/`Rows` AST — `@list` now has an equivalent, if simpler, guarantee.)

#### Ordered lists

`@list(ordered)[...]` renders as `<ol>` instead of the default `<ul>`. Like plain `@list`, a leading `- ` is optional — a bare text line is still a valid item. An item can additionally start with `N. ` / `N)` to give it an explicit number — the Parser stores it as that `ListItem`'s `marker`, and the Renderer only turns it into `<li value="N">` when the list is `ordered`, letting the browser's native `<ol>` counter handle "jump then auto-resume":

```text
@list(ordered)[
- Apple
- Banana
3. Cherry
- Date
]
```

Renders `1. Apple`, `2. Banana`, `3. Cherry` (explicit), `4. Date` (auto-resumed).

#### Nested lists

No new syntax — `@list`'s content is already `block-content`, so a nested `@list[...]` is already a legal child. A line holding nothing but a nested `@list[...]` (surrounded only by whitespace) is folded by the Parser into the **previous** item's content instead of starting a new item:

```text
@list[
- Fruits
  @list[
  - Apple
  - Banana
  ]
- Vegetables
]
```

In the AST, the inner `@list` node ends up inside the `Fruits` `ListItem`'s `content` array; the Renderer needs no extra logic — recursing into `content` naturally produces a nested `<ul>`/`<ol>`.

> An earlier note in this doc floated a `(modifier)` array (e.g. `@list(bullet,number)[...]`) for declaring list type per nesting level. The design actually shipped — `@list(ordered)` plus each nested `@list` declaring its own type — is simpler than that proposal.

---

### Code

```text
@code(ts)[
const x = 1;
]
```

HTML:

```html
<pre><code class="language-ts">
const x = 1;
</code></pre>
```

`(language)` is optional, and unlike every other block node's content, `@code`'s body is `raw-block-content` — none of `@bold`, `@link`, etc. are parsed inside it. This is the block-level equivalent of `@raw`'s Opaque Domain (see [Inline Syntax Specification §9](../../../Inline-Syntax-Specification.md#9-raw-opaque-domain)): once the parser sees `@code(`, everything until the matching `]` is preserved verbatim.

---

### Image

```text
@img(
https://example.com/logo.png
)[
WEDC Logo
]
```

Equivalent to `@img(src=https://example.com/logo.png)[...]`, and combinable with other options:

```text
@img(
https://example.com/logo.png,width=200,align=center
)[
WEDC Logo
]
```

`@img` is the only Structural Block whose parenthesized slot is a structured, extensible key=value list rather than a single modifier — see [Block Syntax Specification §5 Image](../../../Block-Syntax-Specification.md#image) for the full option table (now including `radius` and `border`, passed through verbatim as CSS values) and the extensibility rule (unrecognized keys MUST be ignored, not rejected).

---

### Table

```text
@table[
    @cols[id,name,price]

    @data[
        [1,早餐,60]
        [2,午餐,80]
        [3,晚餐,90]
    ]
]
```

The only Structural Block with dedicated sub-node grammar instead of generic `block-content` — `@cols` and `@data` are required, in that order (see [Block Syntax Specification §5 Table](../../../Block-Syntax-Specification.md#table)). This gives `@table` the strongest AST guarantees in the family: columns and rows are structured data, not text a renderer has to re-parse.

---

### Horizontal Rule

```text
@hr
```

HTML:

```html
<hr>
```

The only node in @Doc with zero slots — no modifier, no styles, no content, no title. `@hr` is pure punctuation: it marks a break and carries no data at all.

---

### SVG

```text
@svg[
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <circle cx="5" cy="5" r="4" />
</svg>
]
```

`@svg`'s content is `raw-block-content` — same unparsed treatment as `@code`/`@mermaid` — but the renderer emits it **unescaped**, so the browser actually draws the vector graphic instead of printing markup as text. That crosses a trust boundary: renderer SHOULD strip `<script>` tags and `on*=` event handler attributes before emitting (see `Adapters.ts`'s `sanitizeSvg()`), but untrusted `@svg` content still deserves review upstream of rendering — sanitization here is a safety net, not a content-security guarantee.

---

## 5. AST Representation

Example:

```text
@table[
    @cols[id,name,price]

    @data[
        [1,早餐,60]
    ]
]
```

```text
Document
└── BlockNodes
    └── StructuralNodes
        └── TableNode
            ├── Columns
            │   ├── "id"
            │   ├── "name"
            │   └── "price"
            └── Rows
                └── Row
                    ├── "1"
                    ├── "早餐"
                    └── "60"
```

Unlike `@list` (still just text inside `block-content`), `@table`'s rows and columns are separate AST branches a tool can query directly — e.g. "find all rows where price > 70" — without re-parsing a string.

---

## 6. Renderer Independence

Source:

```text
@quote[
Talk is cheap. Show me the code.
]
```

Web:

```html
<blockquote>Talk is cheap. Show me the code.</blockquote>
```

Terminal:

```text
> Talk is cheap. Show me the code.
```

Documentation platform: a native blockquote or callout component, chosen by the adapter — not by the @Doc source.

---

## 7. AI Generation Stability

Markdown's positional rules — a leading `#`, a four-space indent, a blank line ending a paragraph — are exactly the kind of thing generative models get subtly wrong: one missing blank line and the structure silently changes meaning. @Doc replaces position with an explicit node name: `@h(1)[...]` cannot be confused with a paragraph that merely starts with the character `#`, regardless of surrounding whitespace.

---

## 8. Design Principle

Structural Blocks follow the same rule as the rest of @Doc:

```text
Semantic First, Layout Later
```

Even the most basic primitives are defined by meaning, not position. A paragraph is not defined by the blank line before it, and a heading is not defined by a `#` — both are defined by their node name.
