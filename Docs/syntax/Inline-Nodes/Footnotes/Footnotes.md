# @Doc Footnotes — Semantic Reference

*[中文版](./Footnotes.zh-TW.md)*

> Companion to [Inline Syntax Specification](../../../Inline-Syntax-Specification.md) §4 (Complete EBNF Definition). The grammar lives there — as `fn` and `refn` inside the `inline-node` alternation, plus the short "Footnotes" comment directly above their productions; there is no dedicated numbered section for footnotes yet (unlike `@mark` at §7, `@link` at §8, or `@raw` at §9). This document covers meaning, usage, and the open edges of `@fn` and `@refn`.

## 0. Table of Contents

* [1. Design Philosophy](#1-design-philosophy)
* [2. Why Footnote Nodes Exist](#2-why-footnote-nodes-exist)
* [3. Syntax](#3-syntax)
* [4. Node Reference](#4-node-reference)
  * [Footnote Reference — `@refn`](#footnote-reference--refn)
  * [Footnote Definition — `@fn`](#footnote-definition--fn)
* [5. Pairing `@refn` and `@fn`](#5-pairing-refn-and-fn)
* [6. AST Representation](#6-ast-representation)
* [7. Renderer Independence](#7-renderer-independence)
* [8. AI Generation Stability](#8-ai-generation-stability)
* [9. Design Principle](#9-design-principle)

---

## 1. Design Philosophy

A footnote is really two nodes pretending to be one feature: a marker at the point of reference in the body text, and a definition holding the actual note — usually rendered somewhere else entirely (end of page, end of document, a hover card). @Doc keeps that split explicit at the grammar level instead of inferring it from position:

```text
@refn   @fn
```

`@refn` is the **reference point** — an in-text marker carrying only a number. `@fn` is the **definition** — a number plus the note's actual content. Neither node alone is "a footnote"; the pair together is.

---

## 2. Why Footnote Nodes Exist

Markdown has no native footnote syntax at all — the common `[^1]` / `[^1]: text` convention is a de facto extension that different parsers implement slightly differently (placement rules, whether multi-paragraph notes are allowed, how the back-reference link is generated). HTML has no footnote element either; authors hand-roll `<sup><a href="#fn1">1</a></sup>` and a matching `<li id="fn1">`, wiring the two together by string-matching an anchor id.

@Doc gives both halves of the pattern an explicit, matched node pair instead of an id string convention:

```text
Meaning
  ↓
AST Node
  ↓
Renderer Adapter
  ↓
Output Target
```

A parser can enumerate every `@refn` and every `@fn` in a document directly, and correlate them by number, without scanning for `href="#fn` substrings.

---

## 3. Syntax

```ebnf
refn = "@refn" , "[" , integer , "]" ;
fn   = "@fn" , modifier , content ;
```

```text
@refn[1]
@fn(1)[content]
```

`@refn`'s bracket is **not** the general-purpose `content` production used elsewhere in the inline grammar — it accepts only `integer` (`digit , { digit }`), nothing else. `@fn` uses `modifier` (`"(" , { text-char - ")" } , ")"` — see [Inline Syntax Specification §4](../../../Inline-Syntax-Specification.md#4-完整-ebnf-語法定義)) for its numbering slot, followed by ordinary `content` (`"[" , { content-element } , "]"`, where `content-element = inline-node | plain-text-char`).

That asymmetry is real, not a typo: `@refn[1]` can only ever hold a bare number, while `@fn(1)[...]`'s parenthesized slot is typed as free text (`modifier`), not `integer`. The grammar does not itself enforce that a `@fn`'s identifier is numeric or that it matches some `@refn`'s number — see [§5](#5-pairing-refn-and-fn).

Example:

```text
Rust 的所有權系統@refn[1]從根本上消除了資料競爭。

@fn(1)[
See The Rust Programming Language, Chapter 4: Understanding Ownership.
]
```

---

## 4. Node Reference

### Footnote Reference — `@refn`

The in-text marker — a superscript-style pointer at the exact spot in the body where a claim needs a citation, without breaking the sentence's reading flow.

```text
這項結論已經過同儕審查@refn[2]。
```

`@refn` carries **only** a number — no content slot, no modifier, nothing else. It is `inline-node`, so it can appear anywhere `inline-stream` can (inside `@p`, `@quote`, `@list`, table cells via `block-content`, etc. — see [Block Syntax Specification §4](../../../Block-Syntax-Specification.md#4-shared-components)).

---

### Footnote Definition — `@fn`

The definition body — the actual note text, keyed by the same number/identifier a `@refn` points at.

```text
@fn(2)[
Peer review completed 2026 Q1 by an independent research group.
]
```

Unlike `@refn`, `@fn`'s content is full `content` — any inline node may appear inside (`@link`, `@bold`, `@mark`, …), so a footnote can cite a source with a working hyperlink rather than plain text. Because `@fn` is also a plain `inline-node`, nothing in the grammar restricts where it must be written — a document convention (e.g. "all `@fn` nodes live at the end of the document") is a house style, not a parser rule.

---

## 5. Pairing `@refn` and `@fn`

The grammar defines both nodes independently — it does **not** require every `@refn[n]` to have a matching `@fn(n)[...]`, or vice versa, and it does not forbid two `@fn` nodes from sharing the same identifier. Correlating `@refn[1]` with `@fn(1)[...]` is a **semantic-level convention**, not a syntax-level guarantee — the same kind of division the EBNF makes elsewhere between what the grammar enforces and what a renderer or linter is expected to check (compare the `@img` option table's extensibility rule in [Block Syntax Specification §5](../../../Block-Syntax-Specification.md#image), which is explicitly deferred to the renderer).

Practical implications:

* A `@refn[3]` with no corresponding `@fn(3)[...]` anywhere in the document is syntactically valid; a renderer MAY render it as a broken/dangling reference, and a linter SHOULD flag it.
* Two `@fn(1)[...]` definitions in the same document is likewise syntactically valid; resolving the collision (first wins, last wins, or error) is a renderer/Strict-Mode decision, not something the EBNF adjudicates.
* Because `@fn`'s identifier slot is `modifier` (free text) rather than `integer`, nothing stops an author writing `@fn(note-a)[...]` instead of a number — but `@refn[...]` can only ever hold digits, so a non-numeric `@fn` identifier can never be targeted by a `@refn`. Treat non-numeric `@fn` identifiers as a foot-gun until the spec clarifies this, not a supported pattern.

---

## 6. AST Representation

Example:

```text
所有權系統@refn[1]消除了資料競爭。

@fn(1)[
See @link(https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html)[The Rust Programming Language, Ch. 4].
]
```

```text
Document
└── BlockNodes
    └── ParagraphNode
        ├── TextNode
        │   └── "所有權系統"
        ├── RefnNode
        │   └── Number
        │       └── 1
        └── TextNode
            └── "消除了資料競爭。"
└── BlockNodes
    └── ParagraphNode
        └── FnNode
            ├── Id
            │   └── "1"
            └── Content
                ├── TextNode
                │   └── "See "
                └── LinkNode
                    ├── URI
                    │   └── "https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html"
                    └── Content
                        └── "The Rust Programming Language, Ch. 4"
```

Because `RefnNode.Number` and `FnNode.Id` are discrete fields rather than text a renderer has to re-parse, a tool can directly answer "which `@refn` markers have no matching `@fn`?" by comparing two sets — the same query-by-structure benefit Callout Blocks get from a dedicated `Title` field (see [Callout Blocks §7](../../Block-Nodes/Callout-Blocks/Callout-Blocks.md#7-ast-representation)).

---

## 7. Renderer Independence

Source:

```text
這是一個論點@refn[1]。

@fn(1)[
補充來源說明。
]
```

Web:

```html
<p>這是一個論點<sup id="fnref1"><a href="#fn1">1</a></sup>。</p>
...
<li id="fn1">補充來源說明。 <a href="#fnref1">↩</a></li>
```

Terminal:

```text
這是一個論點[1]。

[1] 補充來源說明。
```

Documentation platform: a hover-card popover on the reference marker, or an end-of-page notes panel — chosen by the adapter, not by the @Doc source.

---

## 8. AI Generation Stability

Without dedicated nodes, models express footnotes through inconsistent conventions borrowed from whichever Markdown flavor they saw most in training — `[^1]` / `[^1]: text`, raw `<sup>` + manually numbered `<li id="fn...">` pairs, or parenthetical asides mixed into body text. Each convention encodes the reference/definition split differently, and a parser has to guess which one it's looking at.

`@refn[n]` and `@fn(n)[content]` give the model exactly one deterministic shape for each half of the pair. Because `@refn`'s bracket accepts only `integer` — never generic `content` — the model cannot accidentally produce a reference marker containing prose, formatting, or a nested node; the grammar closes off that failure mode structurally rather than relying on the model to self-police.

---

## 9. Design Principle

Footnotes follow the same rule as the rest of @Doc:

```text
Semantic First, Layout Later
```

A footnote reference is not a superscript number. A footnote definition is not a list item at the bottom of a page. Each node is defined by what it points to or what it holds, not by how any single renderer happens to draw it today.
