# @Doc Callout Blocks — Semantic Reference

*[中文版](./Callout-Blocks.zh-TW.md)*

> Companion to [Block Syntax Specification](../../../Block-Syntax-Specification.md) §7 (Callout Blocks). The grammar lives there; this document covers meaning, usage, and rationale for `@note`, `@tip`, `@important`, `@warning`, and `@caution`.

## 0. Table of Contents

* [1. Design Philosophy](#1-design-philosophy)
* [2. Why Callout Blocks Exist](#2-why-callout-blocks-exist)
* [3. Syntax](#3-syntax)
* [4. Callout Taxonomy](#4-callout-taxonomy)
* [5. Node Reference](#5-node-reference)
  * [Note](#note)
  * [Tip](#tip)
  * [Important](#important)
  * [Warning](#warning)
  * [Caution](#caution)
* [6. Choosing the Right Node](#6-choosing-the-right-node)
* [7. AST Representation](#7-ast-representation)
* [8. Renderer Independence](#8-renderer-independence)
* [9. AI Generation Stability](#9-ai-generation-stability)
* [10. Design Principle](#10-design-principle)

---

## 1. Design Philosophy

Callout Blocks are semantic containers in the @Doc AST. Each one names a specific relationship between its content and the reader's attention — context, guidance, priority, risk, or danger — instead of naming a color, icon, or box style.

```text
@note   @tip   @important   @warning   @caution
```

None of them hard-code a fixed appearance — that mapping is the renderer's decision (§8), though §3 covers how an author can still request one directly. All five follow the same grammar, with an optional title (see §3):

```text
@<node>[
content
]
```

---

## 2. Why Callout Blocks Exist

Markdown and HTML express notes and warnings through presentation:

```markdown
> [!CAUTION]
> Do not delete production data.
```

```html
<div class="caution">Do not delete production data.</div>
```

Both describe *how the content looks*, not *what the content means*. A parser reading either form has to reverse-engineer intent from a class name or a bracketed keyword convention that differs from platform to platform (GitHub, Docusaurus, and Obsidian each spell this differently).

@Doc inverts the flow:

```text
Meaning
  ↓
AST Node
  ↓
Renderer Adapter
  ↓
Output Target
```

The document declares *"this is a caution."* The compiler decides *"how should this target render a caution?"* The same `@caution[...]` source can become an HTML `<section>`, a terminal banner, or a Notion callout block — without the source ever changing. This is the same rationale behind the rest of @Doc (see [README](../../../README.md)): structure and presentation stay separated, and semantics live in the notation, not the renderer.

---

## 3. Syntax

All five Callout Blocks share one grammar — a node name, an optional `(title)`, and `block-content`:

```text
@note[content]
@tip[content]
@important[content]
@warning[content]
@caution[content]
```

```text
@note(title)[content]
@tip(title)[content]
@important(title)[content]
@warning(title)[content]
@caution(title)[content]
```

Example:

```text
@caution(Data Loss Risk)[
@bold[Warning]

Before running this database migration, create a complete backup.
This operation is @bold[irreversible] and may permanently remove user data.
]
```

Content follows the standard `block-content` rule (see [Block Syntax Specification §4](../../../Block-Syntax-Specification.md#4-shared-components)), so any inline node (`@bold`, `@link`, …) or nested block may appear inside.

Like Container Blocks (`@details`, `@card` — see [Container Blocks Reference](../Container-Blocks/Container-Blocks.md)), Callout Blocks accept the same `title` production (see [Block Syntax Specification §4](../../../Block-Syntax-Specification.md#4-shared-components)). `title` is a discrete AST field, separate from `content` (§7 below) — an emphasized lead-in such as the `@bold[Warning]` shown above is still ordinary body text, not a substitute for `(title)`.

Node identity being semantic doesn't mean appearance can never be authored directly. @Doc's general node grammar also reserves an optional `{styles}` slot for per-instance visual overrides — e.g. `{bg-fff text-red}` — the same slot `@mark` already uses for inline highlighting (see [Inline Syntax Specification §7](../../../Inline-Syntax-Specification.md#7-mark-styles-semantics)). Unlike `title`, `{styles}` is **not yet part of the formal EBNF** for any block node — Callout or Container — beyond the illustrative shape shown in [README § Core Syntax](../../../README.md). Writing `@caution{bg-fff text-red}[...]` today anticipates the grammar; it is not yet a defined feature.

**Omitted vs. empty title.** The EBNF marks the whole `[ title ]` group optional, but `text = { any-unicode-char }` also permits zero characters, so `@warning()[content]` isn't explicitly ruled out by the grammar alone. This reference treats the two as equivalent: an omitted `(title)` and an empty or whitespace-only `()` both normalize to *no title*. Parsers MAY additionally flag `()` as a Strict Mode lint (see [Inline Syntax Specification §11](../../../Inline-Syntax-Specification.md#11-parser-recovery-strategy)), but semantically neither carries a title.

---

## 4. Callout Taxonomy

```text
Severity scale (low → high):

  @note  →  @tip  →  @important  →  @warning  →  @caution
```

| Node | Purpose | Example |
|---|---|---|
| `@note` | Supplementary context | "This option is only available in development." |
| `@tip` | Optional guidance or best practice | "Enable caching to speed up repeated builds." |
| `@important` | High-priority information the reader must know | "API v2 becomes the default endpoint on 2027-01-01." |
| `@warning` | A potential negative consequence | "This setting may reduce performance." |
| `@caution` | A high-risk or irreversible operation | "This permanently deletes production data." |

`@note`, `@tip`, and `@important` describe **information severity** — how much attention the content deserves. `@warning` and `@caution` describe **risk severity** — how much harm ignoring it could cause. `@caution` sits at the top of that scale: operations that are destructive, irreversible, or require explicit human confirmation before proceeding.

---

## 5. Node Reference

### Note

Supplementary context, background, or clarifying detail that is not required reading.

```text
@note[
This API behavior was introduced in version 2.0.
]
```

Not for: general facts with no document-specific nuance, required reading (`@important`), or risk (`@warning` / `@caution`).

---

### Tip

An optional suggestion that improves efficiency, quality, or experience — never a substitute for a required instruction.

```text
@tip[
Use incremental builds during development to reduce compilation time.
]
```

Incorrect:

```text
@tip[
Always create a backup before deleting production data.
]
```

That statement is a safety requirement, not an optional improvement — it belongs in `@caution`.

---

### Important

Information with a higher priority than the surrounding content: critical announcements, major changes, default behaviors, or constraints that affect decisions.

```text
@important[
The API version 2.0 will become the default endpoint starting January 1, 2027.
Please update your integration before the migration date.
]
```

Not for: danger (`@caution`), or routine context (`@note`).

---

### Warning

A condition or action that may lead to problems if not handled properly — without being destructive or irreversible.

```text
@warning[
This API endpoint will be removed in version 3.0.
]
```

With a title:

```text
@warning(Data Retention Policy)[
This API endpoint will be removed in version 3.0.
]
```

`@warning` answers *"what could go wrong if the reader ignores this?"* — a weaker claim than `@caution`, which answers *"what should the reader avoid doing without explicit confirmation?"*

---

### Caution

High-severity: irreversible operations, destructive actions, security-sensitive changes, or anything requiring explicit human confirmation before execution.

```text
@caution[
This operation is irreversible and may permanently remove user data.
]
```

Reserved for consequences that are hard or impossible to undo — not for routine risk (`@warning`).

---

## 6. Choosing the Right Node

| Situation | Correct Node |
|---|---|
| Background or explanatory detail | `@note` |
| Optional recommendation | `@tip` |
| Must-read / high-priority change | `@important` |
| Possible negative outcome | `@warning` |
| Irreversible or destructive action | `@caution` |

Worked example — the same fact, two different nodes depending on what actually happens:

```text
Incorrect:
@warning[
The production database will be permanently deleted.
]

Correct:
@caution[
The production database will be permanently deleted.
]
```

The deciding factor is consequence severity, not tone of voice.

---

## 7. AST Representation

Every Callout Block becomes an independent, queryable AST node — not a styled paragraph:

```text
@caution(Data Loss Risk)[
@bold[Warning]

Production data will be deleted.
]
```

```text
Document
└── BlockNodes
    └── CalloutNodes
        └── CautionNode
            ├── Title
            │   └── "Data Loss Risk"
            └── Content
                ├── BoldNode
                │   └── "Warning"
                └── TextNode
                    └── "Production data will be deleted."
```

`Title` is a discrete AST field — the same shape Container Blocks use (see [Container Blocks §6](../Container-Blocks/Container-Blocks.md#6-ast-representation)) — so a tool can read a callout's heading directly instead of guessing at content structure (e.g. "the first bold node"). When `(title)` is omitted, the `Title` field is simply absent; any emphasized lead-in inside `content` remains ordinary body text.

Because each node type is explicit in the AST, downstream tools can query by intent instead of scanning text:

```text
Find all CautionNodes
Find all WarningNodes
```

Possible uses: AI safety review, release-note generation, migration analysis, documentation auditing, RAG indexing.

---

## 8. Renderer Independence

Callout Blocks carry semantics only. The same source compiles to different output depending on the target adapter.

Source:

```text
@warning[
This feature requires additional permissions.
]
```

Web:

```html
<aside class="warning">This feature requires additional permissions.</aside>
```

Terminal:

```text
[WARNING]

This feature requires additional permissions.
```

Documentation platform: a native callout component, chosen by the adapter — not by the @Doc source.

---

## 9. AI Generation Stability

Without a dedicated node, models express notes, tips, and warnings through unstable, platform-specific patterns:

```markdown
> Tip:
> Try using ...
```

```html
<div class="hint">...</div>
```

@Doc gives the model one deterministic target per severity level instead:

```text
Node Type = Caution
Content   = ...
```

Because `[]` has exactly one meaning in @Doc — content — the model never has to decide whether a bracket is a link, an attribute, or a component boundary. The compiler and renderer own presentation; the model only owns intent.

---

## 10. Design Principle

Callout Blocks follow the same rule as the rest of @Doc:

```text
Semantic First, Layout Later
```

A caution is not a red box. A tip is not a lightbulb icon. Each node is defined by what it means, not by how any single renderer happens to draw it today.
