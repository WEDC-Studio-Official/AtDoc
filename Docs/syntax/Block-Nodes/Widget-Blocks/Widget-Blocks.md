# @Doc Widget Blocks — Semantic Reference

*[中文版](./Widget-Blocks.zh-TW.md)*

> Companion to [Block Syntax Specification](../../../Block-Syntax-Specification.md) §8 (Widget Blocks). The grammar lives there; this document covers meaning, usage, and the open edges of `@tabs`, `@tab`, and `@mermaid`.

## 0. Table of Contents

* [1. Design Philosophy](#1-design-philosophy)
* [2. Why Widget Blocks Exist](#2-why-widget-blocks-exist)
* [3. Shape Comparison](#3-shape-comparison)
* [4. Node Reference](#4-node-reference)
  * [Tabs](#tabs)
  * [Mermaid](#mermaid)
* [5. AST Representation](#5-ast-representation)
* [6. Renderer Independence](#6-renderer-independence)
* [7. AI Generation Stability](#7-ai-generation-stability)
* [8. Design Principle](#8-design-principle)

---

## 1. Design Philosophy

Widget Blocks cover content that needs more structure than a Structural Block but doesn't fit the shared title+content shape of Container or Callout Blocks. README's Node Taxonomy names only "Core Nodes" and "Semantic Nodes" at the top level; Widget Blocks is a category introduced at the Block Syntax Specification level (see [§2 Document AST Structure](../../../Block-Syntax-Specification.md#2-document-ast-structure)) for block-level components whose grammar is bespoke to the widget itself.

```text
@tabs / @tab   @mermaid
```

Like Structural Blocks (see [Structural Blocks §1](../Structural-Blocks/Structural-Blocks.md#1-design-philosophy)), the two members of this family don't share one shape: `@tabs` is a restrictive container that only accepts `@tab` children, and `@mermaid` is an opaque, unparsed content domain. What unites them under "Widget" is that both render as a self-contained interactive or embedded unit — not that they share a grammar.

---

## 2. Why Widget Blocks Exist

Some content isn't a paragraph, isn't a collapsible section, and isn't a severity-graded callout — it's a small, self-contained component with its own internal rules: a tabbed switcher, an embedded diagram language. Markdown has no native answer for either; authors fall back to raw HTML (`<div class="tabs">...`), framework-specific MDX components, or fenced code blocks that a renderer has to special-case by matching the language string (` ```mermaid `).

@Doc gives each of these an explicit node instead of overloading an existing primitive:

```text
Meaning
  ↓
AST Node
  ↓
Renderer Adapter
  ↓
Output Target
```

A parser can find every `@tabs` or `@mermaid` in a document directly, without scanning for a `class="tabs"` attribute or matching a fenced-code-block language tag against a known list.

---

## 3. Shape Comparison

| Node | Modifier / Option | Content | Shape notes |
|---|---|---|---|
| `@tabs` | — | `{ @tab }` only — not generic `block-content` | only node whose content is restricted to a single child node type |
| `@tab` | `(text)`, **required**, not optional | `block-content` | not part of `block-node`; valid only inside `@tabs` (see [Tabs](#tabs)) |
| `@mermaid` | — | `raw-block-content` | unparsed — same idea as `@code`, but without even a `(language)` slot |

No two rows are identical — the same "no shared shape" observation [Structural Blocks §3](../Structural-Blocks/Structural-Blocks.md#3-shape-comparison) makes about `@heading`, `@code`, `@table`, and `@hr`.

---

## 4. Node Reference

### Tabs

`@tabs` accepts **only** one or more `@tab` children — no other block-node and no bare text:

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

* `@tab(title)[content]` — `title` is the tab's display label, and `content` is full `block-content` (any block-node or inline-stream may appear inside).
* Unlike `(title)` on Container Blocks (`@details`, `@card`) or Callout Blocks, `@tab`'s `(text)` is **not optional** in the EBNF (`tab = "@tab" , "(" , text , ")" , block-content`) — there is no bracketed `[ ... ]` around it. A tab with no label has no defined form.
* If `@tabs[...]` contains anything other than `@tab` (bare text, or another block-node), the parser MUST treat it as a syntax error in Strict Mode, or auto-correct/flag it in Editor Mode (see [Block Syntax Specification §8 Tabs](../../../Block-Syntax-Specification.md#tabs)).

`@tab` is deliberately excluded from the `block-node` alternation in the EBNF (see [Block Syntax Specification §3](../../../Block-Syntax-Specification.md#3-ebnf), the note directly above `metadata =`), so it cannot appear at the document's top level or inside another block's `block-content` — only inside `@tabs`. This mirrors the Opaque Domain idea behind `@raw` (see [Inline Syntax Specification §9](../../../Inline-Syntax-Specification.md#9-raw-opaque-domain)): a piece of syntax that is only meaningful inside one specific context.

---

### Mermaid

```text
@mermaid[
graph TD
A --> B
]
```

`@mermaid`'s content is `raw-block-content` — the same unparsed-body idea `@code` uses (see [Structural Blocks: Code](../Structural-Blocks/Structural-Blocks.md#code)), except `@mermaid` has no `(language)` slot at all, since the diagram language is implied by the node name itself. Once the parser sees `@mermaid[`, nothing inside is treated as @Doc syntax — no `@bold`, no `@link`, no nested block — until the matching `]`.

Use for: any diagram expressed in Mermaid's own text syntax (flowcharts, sequence diagrams, state diagrams, etc.). The renderer is responsible for actually running a Mermaid engine, or falling back to a plain code block, on targets that can't render diagrams.

---

## 5. AST Representation

Example:

```text
@tabs[
    @tab(JavaScript)[
        @code(js)[console.log("hi")]
    ]

    @tab(Python)[
        @code(py)[print("hi")]
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
            │       └── CodeNode (js) → "console.log(\"hi\")"
            └── TabNode
                ├── Title
                │   └── "Python"
                └── Content
                    └── CodeNode (py) → "print(\"hi\")"
```

`@mermaid`, by contrast, produces a single leaf node whose body is stored as an opaque string, the same way `@code` does:

```text
Document
└── BlockNodes
    └── WidgetNodes
        └── MermaidNode
            └── RawContent
                └── "graph TD\nA --> B"
```

Because `@tab` titles are a discrete `Title` field rather than mixed text, a tool can list every tab label in a `@tabs` block without re-parsing content — the same benefit Container Blocks get from a dedicated `Title` field (see [Container Blocks §6](../Container-Blocks/Container-Blocks.md#6-ast-representation)).

---

## 6. Renderer Independence

Source:

```text
@tabs[
    @tab(npm)[npm install]
    @tab(pnpm)[pnpm add]
]
```

Web: a native tab-switcher component, chosen by the adapter.

Terminal:

```text
[npm] npm install
[pnpm] pnpm add
```

Source:

```text
@mermaid[
graph TD
A --> B
]
```

Web: a rendered diagram (Mermaid engine, or an SVG).

Terminal / plain text: a fenced code block containing the raw Mermaid source, since no target can be assumed to render diagrams.

---

## 7. AI Generation Stability

Without a dedicated node, models express tab switchers through inconsistent, framework-specific markup — a `<div class="tabs">` with hand-rolled JS, an MDX `<Tabs><Tab>` pair, or a heading-per-tab convention that a renderer has to reverse-engineer. `@tabs[ @tab(title)[content] ... ]` gives the model exactly one deterministic shape, and restricting `@tabs`'s children to `@tab` alone (§4) means a model cannot accidentally produce a `@tabs` block containing loose text that a parser would have to guess how to handle.

`@mermaid`'s opaque body removes a different failure mode: because nothing inside `@mermaid[...]` is parsed as @Doc syntax, a model generating Mermaid source (which has its own `-->`, `[]`, and `{}` conventions) never has those characters misinterpreted as @Doc brackets.

---

## 8. Design Principle

Widget Blocks follow the same rule as the rest of @Doc:

```text
Semantic First, Layout Later
```

A tab switcher is not a `<div>` with JavaScript. A diagram is not a fenced code block that happens to say `mermaid`. Each node is defined by what it is, not by how any single renderer happens to draw it today.
