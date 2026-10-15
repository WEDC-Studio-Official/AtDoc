# @Doc — AI-Native Semantic Document Notation

<img src="https://wedc.cc/atd.png" width="64"/>

> 🌐 Other languages: [Traditional Chinese](https://github.com/WEDC-Studio-Official/AtDoc/blob/main/docs/zh-tw/README.md) ・ [Simplified Chinese](https://github.com/WEDC-Studio-Official/AtDoc/blob/main/docs/zh-cn/README.md) ・ [Japanese (AI translation; may contain errors)](https://github.com/WEDC-Studio-Official/AtDoc/blob/main/docs/ja/README.md) ・ [Korean (AI translation; may contain errors)](https://github.com/WEDC-Studio-Official/AtDoc/blob/main/docs/ko/README.md)

---

Every generation of document notation solved the dominant problem of its era:

| Format | Solved |
|:---|:---|
| **Word** | Editing |
| **HTML** | Rendering |
| **Markdown** | Human-friendly authoring |
| **JSON** | Interchange |
| **JSX** | Composition |
| **@Doc** | Semantic co-authoring between humans and AI |

None of them were designed for AI-generated content.

---

**@Doc is a notation designed for three readers:**

- Humans who write content.
- AI that generates content.
- Compilers that render content.

@Doc is not the next Markdown.
It is the missing notation layer between LLM-generated content and render targets.

Three properties that most existing formats optimize for one or two of, but very few treat all three as first-class design goals:

| Property | Markdown | HTML | MDX | @Doc |
|:---|:---:|:---:|:---:|:---:|
| **AI Generation Stability** | ❌ | ⚠️ | ❌ | ✅ |
| **Token Efficiency** | ✅ | ❌ | ❌ | ✅ |
| **Queryable Semantics** | ❌ | ⚠️ | ⚠️ | ✅ |
| **Multi-target Compilation** | ❌ | ❌ | ⚠️ | ✅ |

---

## Why Everything Else Falls Short

### Markdown — Designed for Human Writing, Not Machine Generation

LLMs read Markdown fine. The problem is the reverse: ask an LLM to **generate** Markdown for downstream parsing, and the output structure is nearly impossible to guarantee — indentation ambiguity, nested list drift, broken tables, parser dialect gaps.

Markdown has no semantic intent. It cannot express "this button is primary" or "this table needs alternating rows."

---

### HTML — Structure and Presentation Collapsed Into One

HTML can express anything, at the cost of hard-coding presentation logic into structure. Need the same content rendered on a different platform? Rewrite it. Need an AI to generate stable HTML? Face the risk of hallucinated tags and unclosed elements. HTML is a render target, not a notation.

---

### MDX — Designed for Human Developers, Paid for by AI

MDX fuses documents with code, giving human developers maximum expressiveness. For generative models, that freedom translates into something else: higher structural unpredictability and more brittle output.

| Dimension | MDX | @Doc |
|:---|:---|:---|
| **Core Positioning** | Turns documents into programs (Code-driven) | Turns documents into semantic data (Data-driven) |
| **AI Generation Stability** | Allows arbitrary JS logic; LLMs easily break syntax | Deterministic grammar; LLM output is predictable |
| **Bracket Semantics** | `{}` `[]` `<>` overload multiple meanings | `[]` has one global meaning: **Content** |
| **Token Cost** | Verbose tag closing and JS boilerplate | Grammar is heavily compressed (`w-300px` instead of `w-[300px]`, planned — see the caveat in Core Syntax below) |
| **Error Handling** | Crashes at render time; one bad character can blank the screen | Caught at parse time; the AI can self-correct within seconds |

---

## What @Doc Is

The same @Doc source compiles cleanly to Tailwind JIT HTML, inline-style HTML, or any future render target — without changing a single character of the source.

Structure and presentation are fully separated. Semantics live in the notation, not the renderer.

---

## Core Syntax

The long-term target for every node is the same four-slot structure:

```
@node(modifier){styles}[content]<action>
```

| Slot | Role | Example |
|---|---|---|
| `@node` | Node type | `@heading` (alias `@h`), `@paragraph` (alias `@p`), `@card` |
| `(modifier)` | Variant or attribute | `(primary)`, `(ja)` |
| `{styles}` | Styles or metadata | `{w-300px bg-fff}` |
| `[content]` | Content slot — **globally unique** | `[Submit]` |
| `<action>` | Trailing action | `<submit>`, `<install>` |

> [!NOTE]
> **Planned, not current grammar**: the trailing `<action>` slot is not implemented at all — `src/Lexer.ts` has no corresponding token type, and neither Block nor Inline Syntax Specification's formal EBNF defines this production. The `{w-300px bg-fff}`-style Tailwind class example for `{styles}` above is likewise illustrative, not current syntax: `{styles}` today only accepts a comma-separated list of color tokens (named colors or hex), used by `@mark`/`@color`/`@bordered` (see [Inline Syntax Specification §7](./Inline-Syntax-Specification.md#7-mark--color--bordered-styles-semantics)). Only the first three of the four slots — `@node(modifier){styles}[content]` — are currently parseable and test-covered.

`[]` has exactly one meaning everywhere in @Doc: **content**. The model never has to guess.

---

## Example

```
@meta[
title = @Doc 2026 Spec
description = AI-native semantic document runtime
]

@heading(1)[@Doc Project Specification]

@paragraph[This is a plain paragraph, containing inline semantic nodes.]

@card(featured)[
  @heading[AI-Native Language]
  @paragraph[A structured markup language with deterministic grammar, designed for bidirectional AST]
]

@table[
  @cols[id|name|price]
  @data[
    [1|Breakfast|60]
    [2|Lunch|80]
    [3|Dinner|90]
  ]
]
```

> [!NOTE]
> Table cells are separated with `|` (as of syntax v0.1.2), so commas can appear freely inside a cell (`$1,500`). The older comma-separated form still parses unchanged. See [Block Syntax Specification §5 Table](./Block-Syntax-Specification.md#table).

> [!NOTE]
> The following nodes have been adjusted: `@seo` and `@lang` have been merged into `@meta`; `@title` now uses `@heading` (alias `@h`); `@text` now uses `@paragraph` (alias `@p`); `@btn` is temporarily deprecated. The above is a partial example — the formal specification documents are the source of truth for actual syntax.

---

## Dual-Track Compilation

Same AST, two outputs, source code unchanged:

**Route A — Tailwind JIT**
```html
<h1 class="text-lg w-[120px]">@Doc Project Specification</h1>
```

**Route B — Universal Inline Style**
```html
<h1 class="text-lg" style="width: 120px;">@Doc Project Specification</h1>
```

Dynamic values live in the AST as structured data (`{ prop: "w", value: "120px" }`), not raw strings. The adapter decides the output.

---

## What's New in Syntax v0.1.2

| Change | Where it is specified |
|---|---|
| `@img` alignment: `float-left` / `float-right` (text wraps around the image), plus a bare form `@img(src,float-left)[...]` | [Block Spec §5 Image](./Block-Syntax-Specification.md#image) |
| Table cells separated by `\|`; leading/trailing `\|` tolerated; comma form unchanged | [Block Spec §5 Table](./Block-Syntax-Specification.md#table) |
| `@span(n)[...]` — one table cell covering `n` columns | [Block Spec §5 Table](./Block-Syntax-Specification.md#table) |
| `@spoiler[...]` — inline hidden-until-revealed text | [Inline Spec §15](./Inline-Syntax-Specification.md#15-semantic-inline-spoiler-and-hex) |
| `@hex[#3366ff]` — a color swatch plus its own code (not the same as `@color`) | [Inline Spec §15](./Inline-Syntax-Specification.md#15-semantic-inline-spoiler-and-hex) |
| New diagnostics: row width ≠ column count, bad `@span` / `@hex`, unknown `{styles}` token, unknown `@img` align, non-numeric `@defn` id | [Inline Spec §11 Diagnostics](./Inline-Syntax-Specification.md#diagnostics) |
| `@tabs` DOM ids unique per document; first tab marked selected initially | [Block Spec §8 Tabs](./Block-Syntax-Specification.md#tabs) |

The guiding rule behind most of these: a mistake that used to parse cleanly and then render wrongly (a table with a missing cell, `@card{blue}`, `align=middle`) is now a *visible* diagnostic instead of a silent failure. The document still parses and renders either way.

### Package versus syntax version

`atdoc-core`'s package version (`0.1.x`) and the language's syntax version (`v0.1.2` here) are numbered separately. The package version tracks releases of this repository; the syntax version tracks changes to the grammar. Both specification files carry a revision number of their own (currently v1.5).

---

## Node Taxonomy

### Core Nodes — Structural Primitives
The document skeleton, atoms that can't be broken down further.

`@heading` (alias `@h`) `@paragraph` (alias `@p`) `@quote` `@code` `@list` `@img` `@table` (with its `@cols` / `@data` / `@span` parts)

### Semantic Nodes — Semantic Containers
Two behavior modes:

- **Inline Semantic** — renders as a tagged inline element: `@mark[important]`, `@link(example.com)[link]`, `@spoiler[hidden]`, `@hex[#3366ff]`
- **Block Metadata** — injects host configuration, renders no HTML: `@meta[key = value]`

---

## For AI Developers

Having an LLM generate HTML directly is fragile. @Doc gives the model a constrained, deterministic grammar. Errors surface at parse time, not render time.

Because `[]` is the only content bracket, the model has nothing to collide with.

Token cost is also lower: `w-300px` instead of Tailwind's arbitrary-value syntax `w-[300px]` — the bracket is restored by the compiler, not burned on generation (planned; `{styles}` currently only supports color tokens, see the Core Syntax note above).

---

## For Web Developers

```
npm install atdoc-core
```

```ts
import { tokenize, DocParser, DocTranspiler } from 'atdoc-core';
// or, per-module: import { tokenize } from 'atdoc-core/Lexer';

const tokens = tokenize(source);
const ast = new DocParser(tokens).parse();
const html = ast.map(node => DocTranspiler.toTailwindHTML(node)).join('\n');
```

Feed in @Doc source, get a structured AST out, and render it with an adapter that matches your stack. The package has no runtime dependencies of its own (Mermaid is an optional peer, see below). Plain Node ESM works (no bundler required) — every relative import in the published build carries its explicit `.js` extension, which `moduleResolution: "NodeNext"` requires.

Round-tripping the AST back to @Doc source — for an editor's "safe write-back" after a structural edit — is `serializeDocument`, also exported from the root package (or `atdoc-core/Serializer`):

```ts
import { serializeDocument } from 'atdoc-core';

const result = serializeDocument(ast); // { ok: true, text: string } | { ok: false, reason: string }
```

To export a document as one self-contained HTML page (theme CSS inlined, tabs and copy buttons working, Mermaid loaded from a CDN only when the document has a diagram), use `renderStandaloneHtml`, or the `npm run render -- doc.atd` command in this repo:

```ts
import { renderStandaloneHtml } from 'atdoc-core';
import { readFileSync } from 'node:fs';

const css = readFileSync('node_modules/atdoc-core/index.css', 'utf8');
const { html } = renderStandaloneHtml(source, { css, title: 'My doc' });
```

In the browser, `hydrateMermaidDiagrams` (`atdoc-core/mermaidRenderer`) turns the rendered `@mermaid` blocks into live diagrams with drag-to-pan and wheel zoom. It loads `mermaid` on demand, an optional peer dependency you install yourself (`npm install mermaid`):

```ts
import { hydrateMermaidDiagrams } from 'atdoc-core/mermaidRenderer';

await hydrateMermaidDiagrams(container, 'index');
```

Prefer copying from source instead? `src/` has no extra dependencies either — see [What's in here](#whats-in-here) below.

---

## Design Boundaries

@Doc is intentionally not a programming language. That's not a limitation — it's a weapon.

- No variables
- No conditionals
- No loops
- No macro system

Logic lives in the host application. @Doc owns structure, not behavior. That boundary is what makes AI-generated output permanently predictable. The line is intentional and will not move.

---

## Status

The core Parser, Lexer, and dual-track adapters are functionally usable. The web-native Lexer and Parser are in active development. An interactive Playground and a CLI tool are on the near-term roadmap.

@Doc exists to explore the design space between LLM output and render targets. The core is functional. The rest is being built in the open.

**Target: 1.0 Production release on January 1, 2027.**

---

## What's in here

```
src/            Lexer, Parser, Serializer, registry (single source of truth for nodes), types, pipeline, markdownImport
src/index/      Default renderer plugin: Adapters (two HTML render routes) + index.css
src/editor/     Monarch tokenizer for Monaco-style editors
tests/          Strict Mode test cases for the Lexer/Parser (`tests/cases/*.atd`, expectations in `expected.json`), serializer round-trips, and render verification for the v0.1.2 nodes — run them all with `npm test`
configs/        Node configuration for editor/tooling
*-Specification.md   The authoritative grammar of the language (EBNF + semantic rules)
```

The two `*-Specification.md` files are the authoritative grammar. Code comments occasionally cite per-node companion docs (`Structural-Blocks.md`, `Container-Blocks.md`, …) that aren't part of the v0.1 drop — everything they cover is in the two specifications.

---

## Adding a Renderer Theme

Themes are plugins. A theme is a folder under `src/` whose adapter registers itself with the theme registry (`src/themeRegistry.ts`); nothing in the core — the pipeline, mermaid hydration, or the `PreviewStyle` type — names a specific theme.

```ts
// src/leaf/LeafAdapter.ts
import { registerTheme } from '../themeRegistry.js';

registerTheme({
  id: 'leaf',
  label: 'Leaf',
  renderNode: (node) => renderLeafNode(node),
  renderFootnotes: (ast) => renderLeafFootnotes(ast),
  mermaid: { theme: 'base', themeVariables: { /* optional */ } },
});
```

1. Create `src/<name>/` with a `<Name>Adapter.ts` (registers the theme) and/or `*.css` files. The folder is discovered automatically — `npm run build:css` produces `<name>.css`, and `npm run build:internal` generates the internal entry that imports the adapter.
2. Render with it by id: `runAtDocPipeline(source, 'leaf')`. An unknown or omitted id falls back to the default theme, which is always `index` — internal themes never claim the default.
3. **Not published by default.** Only the themes listed in `package.json` → `atdoc.publicThemes` (currently just `index`) ship. To publish one, add its name there and add `<name>.css` to `files`. `npm run build` refuses to produce a package that contains an unlisted theme.

Registration happens when the adapter module is imported. The package entry imports `index`; every other theme is registered by importing it directly, or, for internal themes, through the generated `dist-internal/internal.js`.

---

## License

MIT — see [LICENSE](../../LICENSE).
