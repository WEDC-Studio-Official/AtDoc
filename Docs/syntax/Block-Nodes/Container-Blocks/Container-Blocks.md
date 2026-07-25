# @Doc Container Blocks — Semantic Reference

*[中文版](./Container-Blocks.zh-TW.md)*

> Companion to [Block Syntax Specification](../../../Block-Syntax-Specification.md) §6 (Container Blocks). The grammar lives there; this document covers meaning, usage, and rationale for `@details` and `@card`.

## 0. Table of Contents

* [1. Design Philosophy](#1-design-philosophy)
* [2. Why Container Blocks Exist](#2-why-container-blocks-exist)
* [3. Syntax](#3-syntax)
* [4. Node Reference](#4-node-reference)
  * [Details](#details)
  * [Card](#card)
* [5. Choosing the Right Node](#5-choosing-the-right-node)
* [6. AST Representation](#6-ast-representation)
* [7. Renderer Independence](#7-renderer-independence)
* [8. AI Generation Stability](#8-ai-generation-stability)
* [9. Design Principle](#9-design-principle)

---

## 1. Design Philosophy

Container Blocks group related content into a single structural unit without prescribing layout. Two nodes cover two distinct groupings:

```text
@details   @card
```

`@details` is about **visibility state** — content the reader reveals on demand. `@card` is about **bounded grouping** — content that belongs together as one always-visible unit. Neither implies a specific visual treatment; the renderer decides.

---

## 2. Why Container Blocks Exist

Markdown has no native concept of a collapsible section or a bounded content unit. Authors either drop into raw HTML:

```html
<details>
  <summary>More info</summary>
  ...
</details>
```

or invent ad hoc conventions (bold labels, horizontal rules, indentation) that don't parse reliably and carry no semantic meaning downstream.

@Doc gives both patterns first-class semantic nodes, so intent — *"this is collapsible"*, *"this is a self-contained unit"* — survives independent of any specific renderer's markup:

```text
Meaning
  ↓
AST Node
  ↓
Renderer Adapter
  ↓
Output Target
```

A parser can find every `@card` or every `@details` in a document without guessing which `<div>` was meant to be one.

---

## 3. Syntax

Both nodes accept the same shape — an optional `(title)`, an optional `{styles}`, then `block-content`:

```text
@details(title)[content]
@card(title){styles}[content]
```

```ebnf
details = "@details" , [ title ] , [ styles ] , block-content ;
card    = "@card" , [ title ] , [ styles ] , block-content ;
title   = "(" , text , ")" ;
styles  = "{" , { text-char - "}" } , "}" ;
```

Examples:

```text
@details(展開更多資訊)[
內容
]
```

```text
@card(API Key){blue,bordered}[
這裡放說明內容。
]
```

`title` is optional for both nodes (see [Block Syntax Specification §4](../../../Block-Syntax-Specification.md#4-shared-components)); when omitted, the renderer supplies its own default presentation. `styles` is likewise optional and, as of Block Syntax Specification v1.4, formally part of both nodes' EBNF — token semantics (named color tokens, hex tokens, modifier tokens) reuse [Inline Syntax Specification §7](../../../Inline-Syntax-Specification.md#7-mark--color-styles-semantics) verbatim; whether/how a given renderer maps them to visual output is still a renderer decision (see §5 note below).

**Omitted vs. empty title.** The EBNF marks the whole `[ title ]` group optional, but `text = { any-unicode-char }` also permits zero characters, so `@card()[content]` isn't explicitly ruled out by the grammar alone. This reference treats the two as equivalent: an omitted `(title)` and an empty or whitespace-only `()` both normalize to *no title*. Parsers MAY additionally flag `()` as a Strict Mode lint (see [Inline Syntax Specification §11](../../../Inline-Syntax-Specification.md#11-parser-recovery-strategy)), but semantically neither carries a title.

---

## 4. Node Reference

### Details

Progressive disclosure: content is hidden by default and revealed by user interaction. Maps naturally to HTML `<details>` / `<summary>`.

```text
@details(展開更多資訊)[
內容
]
```

HTML:

```html
<details>
    <summary>展開更多資訊</summary>
    內容
</details>
```

Use for: optional or supplementary content the reader can expand on demand — FAQ answers, verbose logs, "show more" sections. When `title` is omitted, the renderer should fall back to a generic disclosure label (e.g. "Details").

---

### Card

A bounded, always-visible grouping of related content — a discrete informational unit, not tied to any interaction state.

```text
@card(API Key)[
這裡放說明內容。
]
```

Use for: grouping a title, description, and related content into one unit — a preview panel, a summary block, a labeled section. When `title` is omitted, the card has no heading, only grouped content.

> **Scope note (updated for v1.4):** the [README](../../../README.md) introductory example shows `@card(featured){w-300px bg-f8f9fa text-sm}[...]`. The `{styles}` slot is now formal grammar (Block Syntax Specification §6, v1.4) — see §3 above. The `(title)` slot, however, is still specifically a title (`parenRole: 'title'` in `registry.ts`), not a free-form `(modifier)` slot for arbitrary Tailwind-style class strings like `featured` in that README example; `@card`'s paren always resolves to `node.title`. Treat the README's `(modifier)` reading of that slot as forward-looking, not the current grammar — only the `{styles}` half of that example is real today.

---

## 5. Choosing the Right Node

| Situation | Correct Node |
|---|---|
| Content should stay hidden until the reader opts in | `@details` |
| Content should always be visible, grouped as one unit | `@card` |

The deciding factor is **visibility state**, not content type — the same paragraph can legitimately live inside either node depending on whether it should be collapsed by default.

---

## 6. AST Representation

Example:

```text
@card(API Key)[
Store your API key in an environment variable.
]
```

```text
Document
└── BlockNodes
    └── ContainerNodes
        └── CardNode
            ├── Title
            │   └── "API Key"
            └── TextNode
                └── "Store your API key in an environment variable."
```

Because `title` and `content` are separate AST fields rather than mixed text, downstream tools can query or restyle titles independently of body content.

---

## 7. Renderer Independence

Source:

```text
@details(FAQ)[
This feature is available on all plans.
]
```

Web:

```html
<details>
  <summary>FAQ</summary>
  This feature is available on all plans.
</details>
```

Terminal:

```text
▸ FAQ (expand for details)
```

Documentation platform: a native accordion or card component, chosen by the adapter — not by the @Doc source.

---

## 8. AI Generation Stability

Without a dedicated node, models express collapsible sections and grouped content through inconsistent, framework-specific patterns — raw `<details>`, custom JS accordions, `<div class="collapse">`, or ad hoc Markdown conventions. `@details(title)[content]` and `@card(title)[content]` give the model exactly one deterministic form per intent, so structure doesn't depend on which UI framework the model has seen most in training.

---

## 9. Design Principle

Container Blocks follow the same rule as the rest of @Doc:

```text
Semantic First, Layout Later
```

A card is not a bordered box. A details block is not a `<details>` tag. Each node is defined by what it groups or reveals, not by how any single renderer happens to draw it today.
