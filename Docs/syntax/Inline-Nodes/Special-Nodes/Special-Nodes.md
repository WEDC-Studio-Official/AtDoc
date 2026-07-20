# @Doc Special Nodes — Semantic Reference

*[中文版](./Special-Nodes.zh-TW.md)*

> Companion to [Inline Syntax Specification](../../../Inline-Syntax-Specification.md) — `@n` and `@@` appear in the `inline-node` alternation at §4, but the rules that actually govern `@@`'s behavior are spread across §1 (Design Philosophy), §2 (Lexer Behavior), §3 (Ambiguity Resolution), §5 (Escape Rule), and §9 (`@raw` Opaque Domain). This document exists mainly to pull those threads together in one place, because `@@` is easy to misread as "just another inline node" when it isn't. Categorized as "Special Nodes" in [Block Syntax Specification §2](../../../Block-Syntax-Specification.md#2-document-ast-structure)'s Document AST Structure diagram.

## 0. Table of Contents

* [1. Design Philosophy](#1-design-philosophy)
* [2. Why Special Nodes Exist](#2-why-special-nodes-exist)
* [3. Shape Comparison](#3-shape-comparison)
* [4. Node Reference](#4-node-reference)
  * [Line Break — `@n`](#line-break--n)
  * [Escape — `@@`](#escape--)
* [5. Lexer Priority — Why `@@` Isn't a Registry Lookup](#5-lexer-priority--why--isnt-a-registry-lookup)
* [6. Escape Scope — Global Rule vs. `@raw` Exceptions](#6-escape-scope--global-rule-vs-raw-exceptions)
* [7. AST Representation](#7-ast-representation)
* [8. Renderer Independence](#8-renderer-independence)
* [9. AI Generation Stability](#9-ai-generation-stability)
* [10. Design Principle](#10-design-principle)

---

## 1. Design Philosophy

`@n` and `@@` are grouped together as "Special Nodes" because both are bracketless — neither takes `content`, a `modifier`, or `styles`. That's where the similarity ends:

```text
@n   →  a semantic marker (line break)
@@   →  a lexer-level escape mechanism
```

`@n` names something, the same way every other inline node does — "this position is a forced line break." `@@` doesn't name anything in the document's meaning; it exists purely to let an author output the character `@` when the following text would otherwise be misread as a command. Presenting both as `inline-node` alternatives in the EBNF (§4) is a grammar-level convenience — it does **not** mean the Lexer treats them the same way at runtime. See [§5](#5-lexer-priority--why--isnt-a-registry-lookup).

---

## 2. Why Special Nodes Exist

**Line breaks.** Markdown's forced line break is famously fragile — two trailing spaces at the end of a line, invisible in most editors and routinely stripped by formatters, tools, and copy-paste. HTML's `<br>` is explicit but ties the source to a render target. `@n` gives the same intent a visible, position-independent token that survives any whitespace-normalizing tool.

**Escaping.** [§1 Design Philosophy of the Inline Spec](../../../Inline-Syntax-Specification.md#1-design-philosophy) establishes "Only Known Commands Trigger Parsing" — an unrecognized `@word` already falls back to plain text automatically (§6), so most literal `@` usage (emails, mentions, unknown tags) needs no escaping at all. `@@` exists for the narrower case where the literal text an author wants to output *is* a registered command name — e.g. writing the four characters `@mark` in a sentence about @Doc's own syntax, without triggering a `mark` node.

```text
Meaning
  ↓
AST Node
  ↓
Renderer Adapter
  ↓
Output Target
```

Both nodes keep intent explicit in the source rather than relying on invisible whitespace (`@n`) or context-dependent guessing (`@@`).

---

## 3. Shape Comparison

| Node | Slot | Notes |
|---|---|---|
| `@n` | none — bare `@n`, no brackets | zero-slot, like `@hr` at block level (see [Structural Blocks: Horizontal Rule](../../Block-Nodes/Structural-Blocks/Structural-Blocks.md#horizontal-rule)) |
| `@@` | none — bare `@@`, no brackets | zero-slot, but the two-character sequence *is* the entire node; there is no separate "trigger + name" the way `@n`, `@mark`, etc. have a one-character-then-identifier shape |

Both are the inline-level equivalent of `@hr`: pure punctuation, no data. Neither can carry a modifier, styles, or content — there is no `@n{...}` or `@@[...]` in the grammar.

---

## 4. Node Reference

### Line Break — `@n`

```text
第一行@n第二行
```

```ebnf
br = "@n" ;
```

A forced line break at an exact position in the text — no leading/trailing whitespace dependency, no invisible characters. Renders to whatever the target's line-break primitive is (`<br>` on the web, `\n` in plain text/terminal output, a paragraph-internal break in DOCX).

`@n` is looked up like any other named command — it goes through the same Command Registry match as `@mark`, `@bold`, `@sup`, etc. (§2 step 2, see [§5](#5-lexer-priority--why--isnt-a-registry-lookup) below). It just happens to be the only registered command with a completely empty grammar.

---

### Escape — `@@`

```text
@@mark
```

```ebnf
escape = "@@" ;
```

Output: a single literal `@` character, followed by whatever comes after — parsed normally from that point on.

```text
Input:  @@mark
Output: @mark
```

```text
Input:  @@bold[hello]
Output: @bold[hello]
```

Full example set and rationale live at [Inline Syntax Specification §5](../../../Inline-Syntax-Specification.md#5-escape-rule); this reference does not repeat every case. The one detail worth restating here: `@@` is **not** "escape the next command" as a unit — it is "collapse these exact two characters into one literal `@`," full stop. Whatever follows is then lexed completely independently, which is why `@@bold[hello]` outputs the literal text `@bold[hello]` rather than, say, a bold node with escaped styling: after the literal `@` is emitted, `bold[hello]` is just plain text with no leading `@` to trigger anything.

---

## 5. Lexer Priority — Why `@@` Isn't a Registry Lookup

The EBNF (§4) lists `escape` as one alternative among many under `inline-node`:

```ebnf
inline-node =
      mark
    | bold
    | ...
    | br
    | escape ;
```

Read on its own, this makes `@@` look structurally identical to `@mark` or `@n` — just another named alternative the parser matches against. It isn't, and [Inline Syntax Specification §2](../../../Inline-Syntax-Specification.md#2-lexer-行為定義) is explicit about the actual order:

```text
當 Lexer 掃描到 @ 時，應依照以下優先順序處理：

1. 若後續為 @@       → 解析為單一純文字 @
2. 若後續符合已註冊之指令名稱 → 進入對應語法解析流程
3. 若不符合任何已知指令    → 整段視為普通文字輸出
```

`@@` is checked at **step 1**, purely by character pattern (is the next character also `@`?) — before the Lexer ever consults the Command Registry. `@n`, `@mark`, and every other named node are matched at **step 2**, which requires the identifier to exist in the registry. In other words:

* `@@` needs no registry entry to be recognized. It would still work even if every named command were removed from the language.
* `@n` needs to be a registered name. If `n` were ever deregistered, `@n` would fall through to step 3 and render as the literal text `@n`, exactly like `@unknown` does today (§6).

This is the detail this document exists to surface: the EBNF's flat `inline-node` alternation is a grammar-presentation convenience, not a statement about Lexer implementation order. Treat `escape` as *lexically* privileged over every other member of that list, not as a peer.

---

## 6. Escape Scope — Global Rule vs. `@raw` Exceptions

The global `@@` rule (§5 of the Inline Spec) applies in ordinary `inline-stream` context — inside `@p`, `@quote`, `@bold`, and so on. It does **not** apply inside `@raw`. [Inline Syntax Specification §9](../../../Inline-Syntax-Specification.md#9-raw-opaque-domain) is explicit:

> 全域 `@@` 轉義規則（第 5 節）不再適用。

Inside `@raw[...]`, only two **local**, unrelated exceptions exist:

| Input | Output | Note |
|---|---|---|
| `@]` | `]` | outputs a literal `]` |
| `@@]` | `@]` | outputs the literal two characters `@]` |

These are not the global `@@` rule reapplied — they're a separate, narrower mechanism scoped only to letting raw content contain a literal `]` (which would otherwise terminate the raw block) without breaking out. A bare `@@` inside `@raw` that isn't immediately followed by `]` is **not** collapsed to a single `@` — it's just two literal `@` characters, because the global escape is off and no local exception matches. The spec's own worked example makes this exact point:

```text
Input:  @raw[@@]
Output: @@
```

The `@@` here sits right before the closing `]` of the raw block. It looks like it should trigger the three-character `@@]` local exception, but that exception requires three literal characters *inside* the content — here there are only two `@` characters followed by the block's *terminating* `]`, not a third content character. So it decomposes as: literal `@@` (unescaped, since global escape is disabled) + the closing `]` (not part of the output at all). Result: `@@`.

**The point to hold onto:** "inside `@raw`" and "in ordinary inline-stream" are two independent escape systems that happen to reuse `@` as a marker. Assuming global `@@` semantics carry into `@raw`, or that `@raw`'s `@]`/`@@]` exceptions apply outside it, both produce wrong output. Neither system falls back to the other.

---

## 7. AST Representation

Example:

```text
第一行@n第二行，這裡示範 @@mark 這個寫法本身。
```

```text
Document
└── BlockNodes
    └── ParagraphNode
        ├── TextNode
        │   └── "第一行"
        ├── BrNode
        ├── TextNode
        │   └── "第二行，這裡示範 "
        ├── TextNode
        │   └── "@mark 這個寫法本身。"
```

Note that `@@mark` never produces an `EscapeNode` or a `MarkNode` in the tree — by the time the Lexer resolves it, it has already been reduced to the literal text `@mark`, indistinguishable in the AST from that same string typed without any `@@` prefix. The escape mechanism operates at the Lexer stage, before node construction — there is no `EscapeNode` in the AST at all.

`BrNode`, by contrast, is a real AST node — a renderer needs to know a forced break occurred, not just see a `\n` character mixed into text (which whitespace-collapsing renderers might otherwise discard).

---

## 8. Renderer Independence

Source:

```text
地址：台北市@n信義區
```

Web:

```html
<p>地址：台北市<br>信義區</p>
```

Terminal / plain text:

```text
地址：台北市
信義區
```

DOCX: a paragraph-internal line break, not a new paragraph.

`@@` has no renderer-facing output of its own — by the time content reaches the AST, `@@mark` is indistinguishable from literally-typed `@mark` text. There is nothing for a renderer to special-case.

---

## 9. AI Generation Stability

Trailing-whitespace line breaks are exactly the kind of thing a generative model — and the pipelines around it (formatters, trimming, diffing) — routinely lose without any visible signal that something changed. `@n` replaces two invisible spaces with four visible characters that survive whitespace normalization anywhere in the pipeline.

`@@` closes a different gap: without it, a model has no deterministic way to output the literal string `@mark` (for documentation *about* @Doc's own syntax, for instance) without risking it being parsed as a real node — especially since [§6 Unknown Command Fallback](../../../Inline-Syntax-Specification.md#6-unknown-command-fallback) means *most* `@word` sequences are already safe as plain text, making the *few* that aren't (registered command names) an easy edge case to overlook. `@@` gives the model one explicit, unconditional way to defeat command recognition regardless of whether the following word happens to be registered.

---

## 10. Design Principle

Special Nodes follow the same rule as the rest of @Doc:

```text
Semantic First, Layout Later
```

`@n` is not two trailing spaces a formatter might strip. `@@` is not a backslash-escape convention borrowed wholesale from another language — it is scoped, prioritized, and deliberately inert everywhere except the one ambiguity it exists to resolve. Both are defined by what they do at the Lexer level, not by how any single renderer happens to draw a line break or how any single tool happens to strip an `@` character.
