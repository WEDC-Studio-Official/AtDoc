# @Doc Language Design — Why a Semantic Document IR

*[中文版](./Language-Design-zh-TW.md)*

> This document does not cover node-level syntax (`@bold`, `@table`, `@meta`, etc. — see [Block Syntax Specification](../../Block-Syntax-Specification.md) and [Inline Syntax Specification](../../Inline-Syntax-Specification.md) for that). It answers a narrower question: why does @Doc exist at all, when Markdown, HTML, JSON, and XML already cover "document notation"? The short answer is that none of them were designed for a three-stage pipeline where a model generates the source, a program parses it, and multiple renderers consume the result — and each one breaks that pipeline in a different place.

## 0. Table of Contents

* [1. The Pipeline Shift](#1-the-pipeline-shift)
* [2. Why Not Markdown](#2-why-not-markdown)
* [3. Why Not HTML](#3-why-not-html)
* [4. Why Not JSON](#4-why-not-json)
* [5. Why Not XML](#5-why-not-xml)
* [6. Three Stages, Three Requirements](#6-three-stages-three-requirements)
* [7. The Compiler's View](#7-the-compilers-view)
* [8. Semantic Document IR](#8-semantic-document-ir)
* [9. Design Principle](#9-design-principle)

---

## 1. The Pipeline Shift

Every prior document format was designed for a single author and a single consumption path:

```text
Human
  ↓
Document
  ↓
Renderer
```

A person typed the content. The document only ever needed to survive being read by another human, or converted by one renderer into one final output — HTML, PDF, whatever the target happened to be.

AI generation changes the shape of that pipeline. A document today more commonly goes through:

```text
AI
  ↓
Semantic Document
  ↓
Parser
  ↓
AST
  ↓
Renderer Adapter
  ↓
HTML / PDF / Native App / Search Index / Another AI
```

The document is no longer just "text meant for a human to read." It has become an **intermediate representation** shared between a generator, a parser, and a renderer. A format built for the first pipeline is not automatically fit for the second one — and every format below was built for the first.

This means a document notation for the AI era has to satisfy three stages at once, not just optimize for one of them.

---

## 2. Why Not Markdown

Markdown was designed to be readable and writable by humans in plain text. That design goal makes it forgiving in exactly the way a model-generation target cannot afford to be.

LLMs read Markdown without any trouble. The failure shows up on the *generation* side: ask a model to produce Markdown for a downstream parser, and the output's structure is nearly impossible to guarantee. Indentation-sensitive nesting, list-item drift, table corruption, and parser-dialect divergence are all well-documented failure modes — and CommonMark's formal grammar arrived decades after the format did, patching a syntax that was never designed to be parsed deterministically in the first place.

The deeper problem is that Markdown carries no semantic intent. It can say "this text is bold," but it cannot say "this button is the primary variant" or "this table needs alternating row styling." Any attempt to add domain semantics forces ad hoc extensions — frontmatter, custom containers, embedded HTML — none of them standardized, all of them format-specific escape hatches.

Worst of all for a generative pipeline: a structural mistake in Markdown rarely produces a parse *error*. It produces a silently different parse — a list nests one level off, a paragraph merges with the one above it — with no signal that anything went wrong. That is the failure mode a machine-generation target can least afford.

---

## 3. Why Not HTML

HTML can express almost anything, at the cost of collapsing three separate concerns — structure, presentation, and behavior — into one artifact. It is a render target, not an authoring notation: it encodes *how to draw a rectangle*, not *what the rectangle means*.

For AI generation specifically, HTML has two costs. First, every element requires a matched closing tag, which is both token-expensive and an easy place for a model to drop or mismatch a tag, breaking the render irrecoverably. Second, HTML has no closed vocabulary — a hallucinated tag name (`<fancybutton>`) is not a syntax error, it is just an unknown element the browser silently ignores or mis-renders. There is no schema-level way to catch a fabricated node the way a closed grammar can.

Because presentation is baked into the structure, the same content rendered for a different platform — print, native app, another AI reading it back — usually means rewriting the markup, not just swapping the renderer.

---

## 4. Why Not JSON

JSON solves data interchange, not documents. It has no native concept of a text *flow* — the most basic unit of a document, a sentence with an inline emphasis in the middle of it, has no direct representation. Every tool that has tried to force rich text into JSON has reinvented its own runs/spans schema (Slate, ProseMirror, the Notion API, Contentful's rich-text field) — and none of these schemas ever converged into a standard, because JSON is key-value shaped, not text-flow shaped.

Two more problems are specific to AI generation:

- **No partial validity.** A single dropped comma or bracket invalidates the entire document. A text-based grammar can often still be recognized, or degrade gracefully, around a local mistake — JSON offers no such locality.
- **Token cost.** Nested JSON repeats structural keys (`"type"`, `"children"`, `"props"`, …) at every level. The same semantic content, expressed in a compact notation, is routinely a fraction of the token cost.

JSON is excellent at what it was built for — structured data interchange — and a poor fit for what a document actually is: text-first content with structure layered on top, not structure with text stuffed into leaf values.

---

## 5. Why Not XML

XML is more structurally rigorous than Markdown or JSON — DocBook and XHTML both proved it can express complex documents — but that rigor is paid for in doubled token cost: every node is an open/close tag pair, plus attribute-quoting and entity-escaping overhead (`&amp;`, `&lt;`). For a human authoring once in a validating editor, that cost is invisible. For a model that regenerates content on every turn, it is a real, compounding expense, and it opens two independent failure surfaces instead of one — an unclosed tag *and* a malformed attribute can each break the document on their own.

XML also does not resolve which child element is *content* versus *metadata* — that distinction lives entirely in an external schema (DTD/XSD), not in the grammar itself. A reader (human, parser, or model) has to already know the schema to know which nested element is "the point" and which is bookkeeping. This is precisely the ambiguity @Doc's globally-unique `[]` content slot exists to eliminate — XML never treated it as a first-class design problem.

---

## 6. Three Stages, Three Requirements

**Generation** needs:

- A closed, stable vocabulary of node types.
- One unambiguous representation of "this is content" — never inferred from context.
- Local recoverability — one broken node should not invalidate the whole document, unlike JSON's all-or-nothing validity.
- Low token cost — generation cost and latency both scale with output tokens, so a more compact notation is strictly cheaper at scale.

**Parsing** needs a formal, unambiguous grammar. A parser cannot work from "probably knows what the author meant" — the same input must always produce the same AST. Markdown's indentation and nesting rules are heavily positional and context-dependent; CommonMark formalized *some* of that after the fact, but it is still patching a syntax that was never designed to be parsed deterministically.

**Rendering** needs to decide *how something looks*, never *what it means*. The same AST should compile — without touching the source — to Tailwind HTML, inline-style HTML, a React component tree, PDF, DOCX, a search index, RAG metadata, or a render target that doesn't exist yet. That requires the format to describe semantics, not presentation — the opposite of what HTML does by construction.

---

## 7. The Compiler's View

This is a classic compiler problem, restated for documents: the **frontend** (what the author or the AI writes) should not be coupled to the **backend** (what gets rendered).

Every format above breaks that boundary somewhere:

- Markdown compresses semantics into typography.
- HTML fuses semantics with presentation in the same artifact.
- JSON degrades document flow into an arbitrary data shape.
- XML preserves both, but only by paying for it in verbose, repetitive syntax.

Each one collapses a distinction that a document-as-IR needs to keep intact.

---

## 8. Semantic Document IR

@Doc's premise: **a document is a semantic tree first, and readable text only second.**

That's why the grammar is fixed and formal, not organic:

```text
@node(modifier){styles}[content]<action>
```

Every slot carries exactly one meaning, and that meaning never shifts with context.

@Doc is not a Markdown replacement, and it is not HTML shorthand. It sits between three readers — the AI that generates it, the parser that reads it, and the renderer that draws it — as the intermediate representation none of the formats above were built to be.

---

## 9. Design Principle

```text
Semantic First, Layout Later
```

No format above set out to fail at this. Each optimized for the reader it was built for — Markdown for a human writing prose, HTML for a browser painting pixels, JSON for two programs exchanging data, XML for a validated document tree. @Doc's design goal is different: no participant in the pipeline — human, AI, or compiler — should have to distort its own model of the document to accommodate another's constraints.
