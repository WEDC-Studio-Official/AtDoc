# @Doc Widget Blocks — Semantic Reference

*[中文版](./Widget-Blocks.zh-TW.md)*

> Companion to [Block Syntax Specification](../../../Block-Syntax-Specification.md) §8 (Widget Blocks). The grammar lives there; this document covers meaning, usage, and the fallback rationale for `@tabs`, `@tab`, and `@mermaid`.

## 0. Table of Contents

* [1. Design Philosophy](#1-design-philosophy)
* [2. Why Widget Blocks Exist](#2-why-widget-blocks-exist)
* [3. Syntax](#3-syntax)
* [4. Node Reference](#4-node-reference)
  * [Tabs](#tabs)
  * [Mermaid](#mermaid)
* [5. AST Representation](#5-ast-representation)
* [6. Renderer Independence](#6-renderer-independence)
* [7. AI Generation Stability](#7-ai-generation-stability)
* [8. Design Principle](#8-design-principle)

---

## 1. Design Philosophy

Structural, Container, and Callout Blocks all degrade gracefully everywhere — a terminal can always print a heading, a card, or a warning as plain text. Widget Blocks are different: they name a rendering *capability*, not just a style choice. A renderer can pick any color for `@caution`, but it cannot fabricate interactivity for `@tabs` or a diagram engine for `@mermaid` out of nothing.

```text
@tabs   @mermaid
```

Widget Blocks are the boundary where @Doc's semantics meet what the target actually supports. Every adapter needs a deliberate fallback strategy for this family — not just a rendering choice.

---

## 2. Why Widget Blocks Exist

Neither tabs nor diagrams have a standard Markdown representation. Diagrams get bolted on as a fenced-code-block convention (```` ```mermaid ````) that only some renderers honor; tabs have no convention at all — every documentation framework invents its own component (Docusaurus `<Tabs><TabItem>`, VitePress's custom container syntax, Nextra's `<Tabs.Tab>`), and none of them agree.

@Doc gives both a single deterministic grammar instead of "whatever the docs framework happened to invent":

```text
Meaning
  ↓
AST Node
  ↓
Renderer Adapter
  ↓
Output Target (interactive UI, static fallback, or literal diagram source)
```

An author writes `@tabs[...]` once; a web adapter can render live interactive tabs, a terminal adapter can print each `@tab` sequentially, and a PDF adapter can lay them out one after another — all from the same source.

---

## 3. Syntax

```ebnf
tabs         = "@tabs" , tabs-content ;
tabs-content = "[" , { tab } , "]" ;
tab          = "@tab" , "(" , text , ")" , block-content ;

mermaid      = "@mermaid" , raw-block-content ;
```

Example:

```text
@tabs[
    @tab(JavaScript)[
        console.log("hi");
    ]

    @tab(Python)[
        print("hi")
    ]
]
```

```text
@mermaid[
graph TD
A --> B
]
```

Two things set this family apart from every other Block Node discussed so far:

* **`@tab`'s title is required, not optional.** Every other titled node (`@details`, `@card`, and now the Callout Blocks) treats `(title)` as `[ title ]` — optional. `tab = "@tab" , "(" , text , ")" , ...` has no `[ ]` around the parens. A tab with no label isn't addressable in a tab UI, so the grammar simply doesn't allow omitting it.
* **`@tab` is not a `block-node`.** The EBNF deliberately excludes it from the general `block-node` union (see [Block Syntax Specification §3](../../../Block-Syntax-Specification.md#3-ebnf)) — it can only appear inside `tabs-content`. Writing `@tab(...)[...]` at the document's top level, or inside a `@card`, is a Strict Mode error. This is @Doc's only **restricted-context node**: a piece of grammar that's valid in exactly one place. It's a different kind of restriction than `@raw`'s Opaque Domain (see [Inline Syntax Specification §9](../../../Inline-Syntax-Specification.md#9-raw-opaque-domain)) — `@raw` restricts what gets *parsed inside* it, `@tab` restricts *where it may appear*.

---

## 4. Node Reference

### Tabs

A set of labeled, mutually exclusive content panels — the reader (or renderer) picks one view at a time.

```text
@tabs[
    @tab(JavaScript)[
        ...
    ]

    @tab(Python)[
        ...
    ]

    @tab(Rust)[
        ...
    ]
]
```

`@tabs` accepts **only** `@tab` children — no bare text, no other block node. A parser MUST reject anything else in Strict Mode, or auto-correct in Editor Mode (see [Inline Syntax Specification §11](../../../Inline-Syntax-Specification.md#11-parser-recovery-strategy)).

Use for: equivalent alternatives the reader chooses between — language variants of the same snippet, OS-specific instructions, config formats. Not for sequential steps (use `@list`) or content that should all be visible at once (use `@card`).

---

### Mermaid

A literal [Mermaid](https://mermaid.js.org/) diagram definition, passed through unparsed.

```text
@mermaid[
graph TD
A --> B
]
```

Body content is `raw-block-content` — the same passthrough behavior as `@code` (see [Structural Blocks § Code](../Structural-Blocks/Structural-Blocks.md#code)): nothing between the brackets is interpreted as @Doc syntax. The parser hands the literal diagram-language text to whatever downstream engine knows how to draw it.

Because rendering a diagram depends entirely on a diagram engine being available, a renderer with no Mermaid support SHOULD fall back to a plain code block (showing the raw diagram definition) rather than silently dropping the content — the same principle `@code` follows when no syntax highlighter matches its language.

---

## 5. AST Representation

Example:

```text
@tabs[
    @tab(JavaScript)[
        console.log("hi");
    ]

    @tab(Python)[
        print("hi")
    ]
]
```

```text
Document
└── BlockNodes
    └── WidgetNodes
        └── TabsNode
            ├── TabNode
            │   ├── Title
            │   │   └── "JavaScript"
            │   └── Content
            │       └── "console.log(\"hi\");"
            └── TabNode
                ├── Title
                │   └── "Python"
                └── Content
                    └── "print(\"hi\")"
```

Because every panel is a discrete `TabNode` with its own `Title` and `Content`, a tool can enumerate tabs, extract just the Python variant of a snippet, or flag a `@tabs` block that only has one child — all without parsing markup.

---

## 6. Renderer Independence

Source:

```text
@tabs[
    @tab(npm)[
        npm install
    ]

    @tab(pnpm)[
        pnpm install
    ]
]
```

Web: an interactive tab strip, one panel visible at a time, switched by click.

Terminal (no interactivity available): each tab printed sequentially under its own label —

```text
== npm ==
npm install

== pnpm ==
pnpm install
```

Documentation platform: the framework's native tabs component (`<Tabs>`, `<Tabs.Tab>`, etc.), chosen by the adapter — not by the @Doc source.

The same principle applies to `@mermaid`: a web adapter renders an SVG diagram, a terminal or plain-text adapter falls back to the literal diagram source as a labeled code block.

---

## 7. AI Generation Stability

Without a dedicated node, models express tabs through whichever documentation framework's JSX they've seen most in training — `<Tabs><TabItem value="js">`, a VitePress container, a Nextra component — and guessing wrong means the output doesn't compile on this project's actual toolchain. `@tabs(...)` / `@tab(...)` give the model exactly one form regardless of target framework; the adapter — not the model — is responsible for knowing which UI component that maps to.

`@mermaid[...]` similarly fixes the *wrapper* syntax (so the model never has to guess between a fenced ```` ```mermaid ```` block, a custom shortcode, or a raw `<script>` tag) while leaving the diagram language itself — which is already reasonably standardized — untouched.

---

## 8. Design Principle

Widget Blocks follow the same rule as the rest of @Doc:

```text
Semantic First, Layout Later
```

A tabs widget is not defined by its click handler, and a Mermaid diagram is not defined by the SVG it eventually becomes. Both are defined by the structured intent an author wrote down — how that intent gets realized is left entirely to whatever is rendering it.
