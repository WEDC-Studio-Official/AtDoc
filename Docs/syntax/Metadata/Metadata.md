# @Doc Metadata — Semantic Reference

*[中文版](./Metadata.zh-TW.md)*

> Companion to [Block Syntax Specification](../../Block-Syntax-Specification.md) §9 (Metadata). The grammar lives there; this document covers meaning, usage, and the open edges of `@meta`.

## 0. Table of Contents

* [1. Design Philosophy](#1-design-philosophy)
* [2. Why @meta Exists](#2-why-meta-exists)
* [3. Syntax](#3-syntax)
* [4. Position in the Document](#4-position-in-the-document)
* [5. Renderer Mapping Targets](#5-renderer-mapping-targets)
* [6. AST Representation](#6-ast-representation)
* [7. AI Generation Stability](#7-ai-generation-stability)
* [8. Design Principle](#8-design-principle)

---

## 1. Design Philosophy

`@meta` is the one node in @Doc that doesn't describe reader-facing content at all — it's a channel for document-level facts (title, author, description, keywords) that a Host application consumes without rendering any visible output. README's Node Taxonomy calls this pattern "Block Metadata": configuration injected into the Host, rendering no HTML.

```text
@meta[content]
```

It takes no modifier, no title, no styles — just a flat bag of facts about the document itself, separate from the document's visible structure.

---

## 2. Why @meta Exists

HTML `<meta>` tags, OpenGraph tags, and PDF/DOCX document properties are all different schemas for essentially the same handful of facts — title, author, description, keywords. Writing any one of them directly into the source ties that document to one specific target forever. `@meta` declares the facts once, target-agnostic, and lets each adapter map them to whatever schema the destination actually expects:

```text
Meaning
  ↓
AST Node
  ↓
Renderer Adapter
  ↓
Output Target (HTML <meta>, OpenGraph, PDF properties, DOCX properties, search index, RAG metadata)
```

> **Scope note:** [README](../../README.md)'s introductory example uses a differently-named, differently-shaped node for this same idea — `@seo { "title": "...", "description": "..." }`, with curly braces and JSON-like content — and README's Node Taxonomy cites `@seo{...}` as its canonical "Block Metadata" example. The formal v1.3 grammar defines neither `@seo` nor JSON content: [Block Syntax Specification §9](../../Block-Syntax-Specification.md#9-metadata) defines only `@meta[...]`, using square brackets and `key = value` text lines. Treat `@seo{...}` as an earlier or aspirational naming, not current grammar — `@meta` is what §9 and this document actually define.

---

## 3. Syntax

```text
@meta[
title = @Doc
author = WEDC
description = AI Native Document Format
keywords = parser,ast,dsl
]
```

```ebnf
metadata = "@meta" , meta-content ;
```

`@meta` takes no modifier and no title — and unlike every other block node, its content isn't `block-content` either. It has its own dedicated grammar production, `meta-content` (see [Block Syntax Specification §3](../../Block-Syntax-Specification.md#3-ebnf)): the `"["`/`"]"` pair lexes the same way `block-content`'s does (an unregistered `@word` still falls back to plain text per [Unknown Command Fallback](../../Inline-Syntax-Specification.md#6-unknown-command-fallback)), but the Parser is semantically stricter here than anywhere else in the grammar — it rejects **every** registered node inside `@meta`, not just structural ones. Not `@bold`, not `@n`, not even `@raw`:

```text
@meta[
title = @bold[Something]
]
```

throws `` `@meta` only accepts plain text in its content slot — found an unexpected `@bold` node `` — there is no case where a recognized node is silently accepted or dropped inside `@meta`.

That's worth pausing on: **the `key = value` lines *are* real structure, just not one expressed as a separate EBNF production.** Once the Parser has collected `@meta`'s plain-text content, it immediately splits it on `"\n"` and the first `"="` on each line and stores the result as actual key-value data on the AST node itself (`MetaNode.meta`, a plain `{ [key]: value }` map) — see §6 below. This is different from `@mark`'s `{styles}` slot (see [Inline Syntax Specification §7](../../Inline-Syntax-Specification.md#7-mark-styles-semantics)), where the comma-token splitting is left entirely to the Renderer: for `@meta`, the key-value structuring happens during parsing, before any Renderer ever sees the AST.

One practical consequence: the value `@Doc` in the example above is only safe because `Doc` isn't a registered inline command name — it falls back to plain text per Unknown Command Fallback and becomes part of the value, unchanged. Authors who need a value containing the literal text of a *registered* command name (`@bold`, `@n`, etc.) must escape the `@` (`@@`, see [Inline Syntax Specification §5](../../Inline-Syntax-Specification.md#5-escape-rule)) — writing it unescaped throws, it does not fall back or get silently dropped the way an unregistered name does.

---

## 4. Position in the Document

Unlike every node in the other four Block Node families, `@meta` is not part of the `block-node` alternation at all. [Block Syntax Specification §2](../../Block-Syntax-Specification.md#2-document-ast-structure) places `Metadata` as a sibling of `Block Nodes`, not a member of it, and the top-level grammar makes the reason explicit:

```ebnf
document = [ metadata ] , { block-node } ;
```

`@meta` may appear **at most once**, and only **before** every block-node — never in the middle of a document, never nested inside a `@card` or `@details`. This is a different kind of restricted-context node than `@tab` (see [Widget Blocks § Tabs](../Block-Nodes/Widget-Blocks/Widget-Blocks.md#tabs)): `@tab`'s restriction is about *parent* — it's only valid inside `@tabs`, wherever that appears — while `@meta`'s restriction is about *document position* — it's only valid once, and only first.

> [!NOTE]
> **Not currently enforced by the Parser.** The rule above is the intended contract, not something `Parser.ts` currently checks: its top-level loop accepts `@meta` anywhere among the document's block nodes, any number of times, and generic content parsing (the same path `@card`/`@details` use for their children) will happily parse a nested `@meta` too — `@card[@meta[title=Nested]]` parses without error today. Treat "at most once, only first, never nested" as what authors should write, not a guarantee the Parser rejects violations of.

---

## 5. Renderer Mapping Targets

The same `@meta[...]` block can be mapped by different adapters to entirely different destination schemas:

| Target | Example mapping |
|---|---|
| HTML Meta Tags | `<meta name="author" content="WEDC">` |
| OpenGraph | `<meta property="og:description" content="...">` |
| PDF Metadata | Document Info dictionary (`/Author`, `/Title`) |
| DOCX Properties | `core.xml` document properties |
| Search Index | Indexed fields for full-text search |
| RAG Metadata | Chunk-level metadata attached to retrieved passages |

None of these are hardcoded in the @Doc source — the same block compiles to whichever schema the target adapter implements.

---

## 6. AST Representation

Example:

```text
@meta[
title = @Doc
author = WEDC
]
```

```text
Document
└── Metadata
    └── MetaNode
        └── meta: { title: "@Doc", author: "WEDC" }
```

The key-value pairs are **not** left as an unstructured raw string for a tool to re-parse — `MetaNode.meta` is already a plain `{ [key]: value }` map by the time the Parser returns the AST. There's no separate `MetaEntry`/`KeyValuePair` *node* (it's a plain object property, not a child in the `content` tree the way `@table`'s columns/rows are structured extras), but the data itself is fully structured: a consumer reads `node.meta.title` directly — it never has to split lines or `=` signs itself.

---

## 7. AI Generation Stability

Without a dedicated node, models express document metadata as raw HTML `<meta>` tags, YAML frontmatter, or ad hoc JSON — three incompatible conventions with no reliable way for downstream tooling to tell which one a given source is using. `@meta[...]` gives the model one deterministic wrapper regardless of target; mapping it to the right schema (§5) is the adapter's job, not the model's.

---

## 8. Design Principle

`@meta` follows the same rule as the rest of @Doc:

```text
Semantic First, Layout Later
```

`@meta` carries facts, not markup. A title is a title whether it ends up in an HTML `<title>` tag, a PDF's Info dictionary, or a RAG index's metadata field — `@meta` just states what the facts are, once, and lets every target decide how to use them.
