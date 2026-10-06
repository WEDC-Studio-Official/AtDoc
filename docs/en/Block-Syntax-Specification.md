# @Doc Block Syntax Specification v1.5

> 🌐 Other languages: [Traditional Chinese](https://github.com/WEDC-Studio-Official/AtDoc/blob/main/docs/zh-tw/Block-Syntax-Specification.md) ・ [Simplified Chinese](https://github.com/WEDC-Studio-Official/AtDoc/blob/main/docs/zh-cn/Block-Syntax-Specification.md) ・ [Japanese (AI translation; may contain errors)](https://github.com/WEDC-Studio-Official/AtDoc/blob/main/docs/ja/Block-Syntax-Specification.md) ・ [Korean (AI translation; may contain errors)](https://github.com/WEDC-Studio-Official/AtDoc/blob/main/docs/ko/Block-Syntax-Specification.md)

> [!NOTE]
> **Changelog (syntax v0.1.2, spec v1.5)** — `@img` gains `float-left` / `float-right` alignment and a bare-keyword form of `align` (§5 Image); `@table` cells may now be separated with `|`, and `@span(n)[...]` lets one cell cover several columns (§5 Table); a row whose width does not equal the `@cols` count is now a diagnostic; unrecognized `{styles}` tokens and non-numeric `@defn` ids are now diagnostics (§4, Inline Spec §11); `@tabs` panel ids are now unique across the whole document (§8 Tabs). Two inline nodes, `@spoiler` and `@hex`, are new — see Inline Spec §15.

## 0. Table of Contents

* [1. Design Philosophy](#1-design-philosophy)
* [2. Document AST Structure](#2-document-ast-structure)
* [3. EBNF](#3-ebnf)
* [4. Shared Components](#4-shared-components)
* [5. Structural Blocks](#5-structural-blocks)
* [6. Container Blocks](#6-container-blocks)
* [7. Callout Blocks](#7-callout-blocks)
* [8. Widget Blocks](#8-widget-blocks)
* [9. Metadata](#9-metadata)
* [10. Core Principle](#10-core-principle)
* [11. Simplified Syntax Aliases](#11-simplified-syntax-aliases)

---

## 1. Design Philosophy

@Doc Block Syntax adopts:

> **Semantic First, Layout Later**

Block nodes describe:

> The semantics of the document (What)

rather than:

> The presentation (How)

Therefore @Doc does not provide:

* `@div`
* `@span` *(as a general-purpose layout wrapper)*
* `@flex`
* `@grid`
* `@row`
* `@col`
* `@class`
* `@style`

> [!NOTE]
> **NOTE**: `@span(n)[...]` *does* exist as of v0.1.2, but it is not a generic layout wrapper like an HTML `<span>`/`<div>`. It is a **table-structure marker**: it is only valid as the sole content of a `@data` cell and only says "this cell covers n columns." It carries no styling and no presentation information — see §5 Table.

The renderer can freely decide, based on the platform:

* HTML
* React
* PDF
* DOCX
* Discord
* Terminal
* Notion
* AI UI

---

## 2. Document AST Structure

```text
Document AST
│
├── Metadata
│   └── @meta
│
├── Block Nodes
│   │
│   ├── Structural Blocks
│   │   ├── @heading (alias: @h)
│   │   ├── @paragraph (alias: @p)
│   │   ├── @quote
│   │   ├── @list
│   │   ├── @code
│   │   ├── @img
│   │   ├── @table
│   │   ├── @hr
│   │   └── @svg
│   │
│   ├── Container Blocks
│   │   ├── @details
│   │   └── @card
│   │
│   ├── Callout Blocks
│   │   ├── @note
│   │   ├── @tip
│   │   ├── @important
│   │   ├── @warning
│   │   └── @caution
│   │
│   └── Widget Blocks
│       ├── @tabs
│       ├── @tab
│       └── @mermaid
│
└── Inline Nodes
    │
    ├── Text Formatting
    │   ├── @mark
    │   ├── @color
    │   ├── @bordered
    │   ├── @bold (alias: @b)
    │   ├── @italic (alias: @i)
    │   ├── @underline (alias: @u)
    │   ├── @del
    │   └── @raw
    │
    ├── Semantic Inline
    │   ├── @sup
    │   ├── @sub
    │   ├── @kbd
    │   ├── @link
    │   ├── @spoiler
    │   └── @hex
    │
    ├── Footnotes
    │   ├── @fn
    │   └── @defn
    │
    └── Special Nodes
        ├── @n
        └── @@
```

---

## 3. EBNF

```ebnf
document =
    [ metadata ],
    { block-node } ;

block-node =
      heading
    | paragraph
    | quote
    | list
    | code
    | image
    | table
    | hr
    | svg
    | details
    | card
    | note
    | tip
    | important
    | warning
    | caution
    | tabs
    | mermaid ;

(* Note:
   `tab` is not part of block-node.
   It is child-node syntax exclusive to @tabs, and can only appear within
   tabs-content — see "Widget-Specific Grammar: @tabs" below for details.
*)

metadata =
    "@meta" , meta-content ;

(* meta-content is lexed the same way as block-content — the "[" / "]" pair
   tokenizes normally, so an unregistered "@word" still falls back to plain
   text per §6 Unknown Command Fallback — but Parser.ts is semantically
   stricter here than for any other block node: it rejects every registered
   node inside @meta, not just structural ones, not even @n or @raw. The
   parser then splits the resulting text on newlines and the first "=" on
   each line into key/value pairs and stores them directly on the AST node
   (MetaNode.meta), rather than leaving that structuring to a later pass.
   See Metadata.md §3/§6 for the full behavior and worked examples. *)
meta-content =
    "[" ,
        { text } ,
    "]" ;

heading =
    ( "@heading" | "@h" ) ,
    [ "(" , level , ")" ] ,
    block-content ;

paragraph =
    ( "@paragraph" | "@p" ) , block-content ;

quote =
    "@quote" , block-content ;

list =
    "@list" ,
    [ "(" , "ordered" , ")" ] ,
    block-content ;

code =
    "@code" ,
    [ language ] ,
    raw-block-content ;

image =
    "@img" ,
    "(" ,
        image-option-list ,
    ")" ,
    [ styles ] ,
    block-content ;

hr =
    "@hr" ;

svg =
    "@svg" ,
    raw-block-content ;

details =
    "@details" ,
    [ title ] ,
    [ styles ] ,
    block-content ;

card =
    "@card" ,
    [ title ] ,
    [ styles ] ,
    block-content ;

note =
    "@note" ,
    [ title ] ,
    [ styles ] ,
    block-content ;

tip =
    "@tip" ,
    [ title ] ,
    [ styles ] ,
    block-content ;

important =
    "@important" ,
    [ title ] ,
    [ styles ] ,
    block-content ;

warning =
    "@warning" ,
    [ title ] ,
    [ styles ] ,
    block-content ;

caution =
    "@caution" ,
    [ title ] ,
    [ styles ] ,
    block-content ;

mermaid =
    "@mermaid" ,
    raw-block-content ;

(* ==========================================================================
   Structural-Specific Grammar: @img

   The parenthesized content of @img is not a single bare text, but a
   comma-separated key=value option list (image-option-list), which is
   extensible. If the first option omits the key, it defaults to src.

   The `image` production (above) also has an independent, optional
   [styles] after ")" — Image Style v1, which at the grammar level is
   completely unrelated to image-option-list (it cannot be written inside
   the parentheses); see the "Image Style v1" subsection below for its
   semantics.
   ========================================================================== *)

image-option-list =
    image-option ,
    { "," , image-option } ;

image-option =
      src-option
    | width-option
    | height-option
    | align-option
    | bare-align-option
    | radius-option
    | border-option ;

src-option =
    [ "src=" ] , url ;

width-option =
    "width=" , integer ;

height-option =
    "height=" , integer ;

align-option =
    "align=" , align-value ;

align-value =
      "left"
    | "center"
    | "right"
    | "float-left"
    | "float-right" ;

(* Because align-value is a closed set, a bare item that is exactly one of
   its five values is also accepted as an align-option with no "align="
   key (e.g. @img(src=a.png,float-left)[...]). This is checked BEFORE the
   "first bare item is src" rule, so @img(float-left)[...] reads as align,
   never as a URL that happens to spell "float-left". *)
bare-align-option =
    align-value ;

radius-option =
    "radius=" , text ;

border-option =
    "border=" , text ;

url =
    { text-char - "," - ")" } ;

(* ==========================================================================
   Widget-Specific Grammar: @table

   @table does not use the generic block-content; instead it has its own
   dedicated structured syntax (Columns + Rows).
   ========================================================================== *)

table =
    "@table" , table-content ;

table-content =
    "[" ,
        cols ,
        data ,
    "]" ;

cols =
    "@cols" ,
    "[" ,
        column-list ,
    "]" ;

(* Cell delimiter (v0.1.2): "|" if the row uses "|" anywhere at its own
   top level, otherwise the legacy ",". Decided independently for @cols and
   for each @data row. See §5 Table. *)
cell-delimiter =
    "|" | "," ;

column-list =
    [ "|" ] , cell , { cell-delimiter , cell } , [ "|" ] ;

data =
    "@data" ,
    "[" ,
        { row } ,
    "]" ;

row =
    "[" ,
        [ "|" ] , row-cell , { cell-delimiter , row-cell } , [ "|" ] ,
    "]" ;

(* A cell that is exactly one span-cell counts as n toward the row's width
   instead of 1. A leading and/or trailing "|" is decoration and is
   stripped, each edge independently. *)
row-cell =
      span-cell
    | cell ;

span-cell =
    "@span" , "(" , integer , ")" , "[" , cell , "]" ;

(* A cell isn't plain text only — it also allows a curated subset of
   inline-node (cell-inline-node), the same shape @cols columns and @data
   cells share. The authoritative allowlist lives in registry.ts's
   isCellAllowedNode(), not this grammar — a node outside that set (e.g.
   @card, @table, @details) MUST throw rather than being silently dropped,
   per Strict Mode (Inline Syntax Specification §11). *)
cell =
    { cell-inline-node | any-unicode-char - cell-delimiter - "]" } ;

(* ==========================================================================
   Widget-Specific Grammar: @tabs / @tab

   @tab can only appear within @tabs' tabs-content; it does not belong to
   the generic block-node set, and therefore cannot appear on its own at
   the top level of a document or within any other block-content.
   ========================================================================== *)

tabs =
    "@tabs" , tabs-content ;

tabs-content =
    "[" ,
        { tab } ,
    "]" ;

tab =
    "@tab" ,
    "(" ,
        text ,
    ")" ,
    block-content ;
```

---

## 4. Shared Components

```ebnf
block-content =
    "[" ,
        { block-element } ,
    "]" ;

block-element =
      block-node
    | inline-stream
    | text ;

raw-block-content =
    "[" ,
        { any-unicode-char } ,
    "]" ;

title =
    "(" ,
        text ,
    ")" ;

language =
    "(" ,
        text ,
    ")" ;

level =
      "1"
    | "2"
    | "3"
    | "4"
    | "5"
    | "6" ;

text =
    { any-unicode-char } ;
```

> The terminal definitions `integer`, `text-char`, etc. reuse the `integer`
> and `text-char` productions from Inline Spec §4 (Complete EBNF Grammar
> Definition); both documents share the same character-set definitions, so
> they are not repeated here.
>
> `styles` likewise reuses the `styles` production from Inline Spec §4
> (`"{" , { text-char - "}" } , "}"`); at the grammar level it is still only
> defined as "an arbitrary character sequence wrapped in curly braces."
> Container Blocks (`@details`, `@card`), Callout Blocks (`@note`, `@tip`,
> `@important`, `@warning`, `@caution`), and `@img` now formally include it
> in their respective productions (see §5–7 above), rather than it being
> incidental Parser-side behavior not explicitly sanctioned by the EBNF.
>
> **Token semantics are each node's own rules, not a single shared table.**
> `@note`/`@tip`/`@important`/`@warning`/`@caution`/`@details` reuse the
> existing color token rules from Inline Spec §7 `@mark Styles Semantics`
> (named-token lookup table + hex support); `@card` and `@img` are each
> their own independent, closed token set — `Card Style v1` (see the
> "Card Style v1" subsection in §6 below) and `Image Style v1` (see the
> "Image Style v1" subsection in §5 below) respectively — sharing the same
> `#RRGGBB` / `radius-N` token shapes, but with independent semantics
> (`@card`'s hex is a background color, `@img`'s hex is a border color);
> neither reuses the named color swatch from Inline Spec §7.
> Whether/how the renderer maps `styles` for Container/Callout/`@img` into
> visual styling is left to each renderer to decide.
>
> **Unrecognized tokens are flagged (v0.1.2).** A token that is not part of the
> node's own vocabulary — e.g. `@card{blue}` (`@card` takes `#RRGGBB` /
> `radius-N` only, not named colors) or `@mark{bluee}` — used to be dropped
> silently, leaving the node unstyled with no signal anywhere. The Parser now
> reports it as a diagnostic on the offending token (see Inline Spec §11
> Diagnostics). The document still parses and renders; the token is still ignored.

---

## 5. Structural Blocks

### Heading

The canonical syntax is `@heading`; `@h` is an equivalent Simplified Alias — both parse to the same AST node, and the renderer does not distinguish which form the author actually typed.

```text
@heading(1)[
Introduction
]

@h(1)[
Introduction
]
```

HTML (both forms produce the same output):

```html
<h1>Introduction</h1>
```

---

### Paragraph

The canonical syntax is `@paragraph`; `@p` is an equivalent Simplified Alias.

```text
@paragraph[
Hello World
]

@p[
Hello World
]
```

HTML (both forms produce the same output):

```html
<p>Hello World</p>
```

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

---

### List

Any non-empty line is an item; a leading `- ` is an **optional** backward-compatible form that the Parser automatically strips:

```text
@list[
Apple
Banana
Orange
]
```

This is equivalent to:

```text
@list[
- Apple
- Banana
- Orange
]
```

Each item is an independent `list-item` node in the AST (`node.items`); its content can include inline nodes (e.g. `@bold`), not just plain text:

```text
@list[
@bold[Apple] (today's special)
Banana
]
```

AST:

```text
List
└── items
    ├── ListItem [ Bold("Apple"), " (today's special)" ]
    └── ListItem [ "Banana" ]
```

> [!TIP]
> **TIP**: The old semantics required "must start with `- ` to count as an item," which was inconsistent with the intuition that "a newline means a new item," and also led every renderer (Route A / Route B / ...) to reimplement its own list-splitting logic via string processing. Under the new semantics, the Parser uniformly produces the `ListItem` AST, and renderers only need to render the existing structure without splitting strings themselves.

#### Ordered List

`@list(ordered)[...]` renders as `<ol>` instead of the default `<ul>`. As with a regular `@list`, a leading `- ` is optional and not required — a plain text line still counts as an item; explicitly writing `N. `/`N)` specifies the number explicitly, and the Parser stores that number in the `ListItem`'s `marker` field. The renderer only converts `marker` into `<li value="N">` when `ordered` is true, leaving the native `<ol>` counter in the browser to handle "auto-continuing after a skipped number":

```text
@list(ordered)[
- Apple
- Banana
3. Cherry
- Date
]
```

The rendered result is `1. Apple`, `2. Banana`, `3. Cherry` (explicitly specified), `4. Date` (auto-continued).

#### Nested List

No new syntax is introduced — the content of `@list` is already `block-content`, so a nested `@list[...]` is already a valid child node. A nested `@list[...]` occupying its own line (with only whitespace before and after) is merged by the Parser into the content of the **preceding** item, rather than starting a new item:

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

In the AST, the inner `@list` node appears within the `content` array of the `Fruits` `ListItem`; the renderer needs no extra logic — recursively rendering `content` naturally produces the nested `<ul>`/`<ol>`.
> An older version of the document once mentioned a proposal to declare list type per level using a `(modifier)` array (e.g. `@list(bullet,number)[...]`); the design above — `@list(ordered)` plus nested sublists each declaring their own type — is the simpler approach that was actually adopted, instead of that proposal.

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

---

### Image

The parenthesized content of `@img` is a comma-separated key=value option list (`image-option-list`), which is extensible. If the first option omits `key=`, it defaults to `src`:

```text
@img(
https://example.com/logo.png
)[
WEDC Logo
]
```

This is equivalent to:

```text
@img(src=https://example.com/logo.png)[
WEDC Logo
]
```

Used together with other options:

```text
@img(
https://example.com/logo.png,width=200,align=center
)[
WEDC Logo
]
```

Currently supported options:

| Option | Description | Example value |
| ------------- | ----------------------------------- | -------------------------- |
| `src` (optional) | Image source URL | `src=https://...` |
| `width` | Display width (unit decided by the renderer) | `width=200` |
| `height` | Display height (unit decided by the renderer) | `height=150` |
| `align` | Alignment / text wrap (see below) | `align=left/center/right/float-left/float-right` |
| `radius` | Corner radius (CSS value passed directly through to the renderer) | `radius=8px` |
| `border` | Border (CSS value passed directly through to the renderer) | `border=1px solid #ccc` |

#### Image `align` values (v0.1.2)

The `align` value set is closed:

| Value | Effect |
|---|---|
| `left` | Image aligned left; following content continues **below** the image |
| `center` | Image centered (the previous behavior) |
| `right` | Image aligned right; following content continues **below** the image |
| `float-left` | Image aligned left; following text **wraps around it on the right** |
| `float-right` | Image aligned right; following text **wraps around it on the left** |

```text
@img(./a.png,align=float-left)[Alt text]
```

* **Bare keyword form.** Because the value set is closed, a bare option that is exactly one of the five values is recognized as `align` without the `align=` key: `@img(./a.png,float-left)[...]` is equivalent to `@img(./a.png,align=float-left)[...]`. This check runs *before* the "first bare option is `src`" rule, so `@img(float-left)[...]` (no `src` at all) is an alignment, not a URL that happens to be spelled "float-left".
* **A single option value, not a combination.** There is deliberately no `align=left,float=true` pair — an invalid combination cannot be written at all, and the author (or model) makes one choice instead of two.
* **No `center` + wrap.** Wrapping text on both sides of a centered image is not something CSS `float` can express and most renderers cannot implement it; keeping it would only make renderers fall back to different effects silently.
* **Where the wrap ends.** The wrap is a renderer-level convention, not recorded in the AST: it SHOULD end at the next heading, the next `@hr`, or the end of the enclosing container.
* **Narrow screens and non-flowing targets** (phones, terminals, some PDF): the renderer MAY ignore alignment and wrap and show the image centered or full-width. Alignment is **positional semantics**; it does not promise a pixel-level layout.
* **Unrecognized values** (e.g. `align=middle`, a typo): the renderer ignores the value and uses the default (no alignment). The Parser additionally reports a **warning** diagnostic — the document still renders, so it is not an error, but it is no longer silent.

> [!TIP]
> **TIP**: This extension mechanism follows the same design philosophy as Inline Spec §7 `@mark Styles Semantics` — the grammar level only defines "a comma-separated option list inside parentheses"; the actual set of keys belongs to the semantic level, so adding new options in the future (e.g. `alt`, `loading`) does not require modifying the EBNF itself. The renderer MUST ignore unrecognized keys, and SHOULD fall back to "applying only `src`" rather than throwing an error.

#### Image Style v1

`@img(...)` can be followed by an optional `{styles}` (grammar defined in §4), which shares the same **Card Style v1** token shape (`#RRGGBB` / `radius-N`) as `@card`, but with independent semantics forming its own closed token set — it **does not reuse** the named color swatch from Inline Spec §7, and it is **not** part of `image-option-list` (it cannot be written inside the `(...)` parentheses):

| Token shape | Semantics | Example |
|---|---|---|
| `#RRGGBB` (hexadecimal) | Border color, applied as a 1px solid border | `@img(src=...){#3366ff}[...]` → `border: 1px solid #3366ff` |
| `radius-N` (N is a non-negative integer) | Corner radius, `N` is a pixel value | `@img(src=...){radius-12}[...]` → `border-radius: 12px` |

```text
@img(src=https://example.com/photo.jpg){#3366ff,radius-12}[
WEDC Photo
]
```

When `{styles}` is omitted, the result is a plain, bare `<img>` with no default corner radius or border — unlike `@card`, which usually has the renderer's own static defaults that can be overridden, `{styles}` for `@img` is purely an "optional" switch, not an "override the default" one.

> [!NOTE]
> **NOTE**: The existing `radius`/`border` `(...)` options (see the table above) remain valid, serving as an escape hatch for cases that need arbitrary CSS values (e.g. `border=2px dashed red`); `{styles}` is the cross-platform, closed-token-set shorthand. When both appear together, the renderer SHOULD let `{styles}` override the corresponding `(...)` option (`{radius-N}` overrides `radius=`, `{#RRGGBB}` overrides `border=`), rather than stacking the two or throwing an error.

---

### Table

The internal structure of `@table` is fixed as two dedicated child nodes, `@cols` + `@data`, **in a fixed order, both required**:

```text
@table[
    @cols[id,name,price]

    @data[
        [1,Breakfast,60]
        [2,Lunch,80]
        [3,Dinner,90]
    ]
]
```

* `@cols[...]`: a delimiter-separated list of column headers that defines the column order and count; each column is a `cell` (see below) just like `@data`'s cells, not limited to plain-text identifiers.
* `@data[...]`: each row is wrapped in `[...]`; the row's **width** MUST equal the number of columns defined by `@cols` (a `@span(n)` cell counts as `n`, every other cell as 1). A row whose width differs is reported as a diagnostic — see "Row width" below.

#### Cell delimiter: `|` or `,` (v0.1.2)

`@cols` and each `@data` row originally split cells on `,` only, which left no way to write a cell that itself contains a comma (`$1,500`, `Web, iOS, Android`, `DECIMAL(10,2)`) without silently producing an extra column. As of v0.1.2 the delimiter is chosen **per row** by one mechanical rule:

```text
If "|" appears anywhere at a row's own top level, the row is split on "|";
otherwise it is split on "," exactly as before.
```

```text
@table[
    @cols[Time|Talk|Speaker]

    @data[
        [09:00 - 10:30|Opening keynote|Alice Wang]
        [10:30 - 11:00|@span(2)[Break]]
        [11:00 - 12:00||Data Engineering group]
        [13:30 - 15:00|Table syntax design|Carol Chen, Dana Lin]
    ]
]
```

* **In `|` mode, `,` is ordinary text** — no escaping and no restriction (see the last row's speaker cell above).
* **`,` mode is unchanged.** A row with no `|` parses exactly as before, so existing documents need no migration. The comma form is considered legacy; an Editor Mode implementation MAY mark it as deprecated.
* **Only top-level delimiters split.** A `|` or `,` inside a nested node's own brackets (`@bold[a,b]`, `@raw[a|b]`) stays literal — cell splitting follows bracket depth and never consults the registry. To put a literal `|` in a cell, wrap it in `@raw[...]`, which is also the semantically correct node for the kind of content (code) that usually needs one.
* **Empty cells must be written out.** `[11:00 - 12:00||Data Engineering group]` has a deliberately empty middle cell.
* **A leading and/or trailing `|` is decoration and is stripped, each edge independently.** `[|a|b|c|]` (the Markdown-table habit), `[|a|b|c]`, `[a|b|c|]` and `[a|b|c]` all parse identically. Consequence: an edge `|` can no longer express a genuinely empty *first* or *last* cell — put a placeholder in it or restructure the columns. An empty cell in the *middle* of a row is unaffected.
* Avoid `<...>` as a cell wrapper — that shape is reserved for the `<action>` slot.

#### Column-spanning cells: `@span(n)[...]` (v0.1.2)

```text
[10:30 - 11:00|@span(2)[Break]]
```

A cell whose content is **exactly one** `@span(n)[...]` node (`n` a positive integer) covers `n` columns and counts as `n` toward the row's width, so "every row's width equals the column count" holds with no exceptions. In the example above the row has 2 literal cells but a width of 1 + 2 = 3, matching the three columns of `@cols`. A renderer maps it to its own colspan concept (HTML: `<td colspan="n">`).

* `@span` is only valid as the **sole content of a `@data` cell**. Inside `@cols`, outside a table, or mixed with other content in a cell, it is a misplaced node and is flagged in the same way `@tab` outside `@tabs` is.
* `n` MUST be a plain positive integer. `@span(two)`, `@span(0)` and `@span(2.5)` are reported as their own diagnostic; for the row-width check such a cell is counted as width 1, so the same root cause is not reported twice.
* `@span` has no styling or layout meaning of its own — see the note in §1.

#### Row width

A row whose width (`@span` counted) does not equal the number of columns in `@cols` is reported as a diagnostic, **regardless of which delimiter the row uses**. The Parser never auto-pads or truncates: a silent mismatch renders a table whose columns no longer line up with its header. The diagnostic is an error in Strict Mode and a reported (non-blocking) diagnostic in Editor Mode, and it points at the offending row.

> [!TIP]
> **TIP**: The fixed order and required presence of both `@cols` and `@data` is a deliberate design trade-off — sacrificing a bit of flexibility in exchange for a high degree of predictability, both for the Parser and for AI-generated content.

Each `cell` is not merely plain text — besides the text itself, it also allows a curated set of inline formatting nodes (`@bold`, `@italic`, `@underline`, `@del`, `@mark`, `@color`, `@sup`, `@sub`, `@link`, `@fn`, `@hex`, `@span`, and `@n`, which is converted into a line break), (`@hex` because colour-swatch tables are one of its most common uses; `@span` because that is the only place it means anything; `@spoiler` is deliberately **not** on the list — a table cell is an awkward place for a click-to-reveal span) because these nodes only change how the text is presented and do not affect the table's own "columns aligned with data rows" structure. This list is maintained on the renderer side (`isCellAllowedNode` in `registry.ts`); the grammar level itself does not restrict the list's contents, and it can be extended in the future. A node not on the list (e.g. block nodes that bring their own layout structure, such as `@card`, `@table`, `@details`) MUST throw a syntax error rather than being silently dropped — this is consistent with the spirit of Strict Mode (Inline Syntax Specification §11): "prefer to throw an error rather than swallow erroneous content."

> [!NOTE]
> **Exception**: the raw family of nodes (`@code`, `@mermaid`, `@raw`, `@kbd`) are also not on the `isCellAllowedNode` list, but they are neither "block nodes that bring their own layout structure" nor subject to the MUST-throw rule above — `Parser.ts` (`parseInlineCellList`) deliberately flattens their raw content into plain text inside the cell, rather than throwing an error or parsing them as real nodes. This is separate behavior from how structural nodes like `@card`/`@table`/`@details` are handled; see the comments above `CELL_ALLOWED_INLINE` in `registry.ts` and above `parseInlineCellList` in `Parser.ts` for details.

```text
@table[
    @cols[id,name,note]

    @data[
        [1,@bold[Alice],See @link(https://example.com)[profile]@n more info]
    ]
]
```

AST:

```text
Table
├── Columns
│   ├── id
│   ├── name
│   └── price
└── Rows
    ├── Row [1, Breakfast, 60]
    ├── Row [2, Lunch, 80]
    └── Row [3, Dinner, 90]
```

Or, with cells containing inline formatting:

```text
Table
├── Columns
│   ├── id
│   ├── name
│   └── note
└── Rows
    └── Row [
          "1",
          [ Bold("Alice") ],
          [ "See ", Link("https://example.com", "profile"), "\n", " more info" ]
        ]
```

---

### Horizontal Rule

```text
@hr
```

HTML:

```html
<hr>
```

---

### SVG

`@svg` belongs to `raw-block-content`, the same as `@code`/`@mermaid` — the content is preserved verbatim; the Parser does not parse or escape it:

```text
@svg[
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <circle cx="5" cy="5" r="4" />
</svg>
]
```

> [!TIP]
> **TIP**: The content of `@svg` is a **trust boundary** — it is output verbatim by the renderer as a vector graphic actually rendered by the browser, rather than displayed as text the way `@code` is. The renderer SHOULD filter out `<script>` tags and `on*=` event attributes before output (see `sanitizeSvg()` in `Adapters.ts`), but this is a renderer responsibility, not a grammar-level guarantee; `@svg` content from untrusted sources should still be content-reviewed at an earlier stage.

---

## 6. Container Blocks

`@details`/`@card` now also accept an **optional** `{styles}` (grammar defined in §4), placed after `(title)` and before `block-content`:

```text
@card(API Key){#3366ff,radius-12}[
Put the description content here.
]
```

When omitted, the plain-content form is retained — both are valid. The renderer MAY ignore unrecognized tokens (consistent with the spirit of Inline Spec §6 Unknown Command Fallback). The semantics of `@card`'s `{styles}` tokens are its own closed rule set (`Card Style v1`), unrelated to the named color token lookup table in Inline Spec §7 — see the "Card Style v1" subsection below.

### Details

```text
@details(Show more)[
Content
]
```

HTML:

```html
<details>
    <summary>Show more</summary>
    Content
</details>
```

---

### Card

```text
@card(API Key)[
Put the description content here.
]
```

#### Card Style v1

`@card`'s `{styles}` only allows a small number of cross-platform, high-value styles, deliberately not designed as a general-purpose CSS escape hatch — currently only the following two token shapes are recognized; they can each appear alone, be combined together (comma-separated, order not significant), or be omitted entirely:

| Token shape | Semantics | Example |
|---|---|---|
| `#RRGGBB` (hexadecimal) | Background color, using the value directly | `@card{#3366ff}[...]` → `background-color: #3366ff` |
| `radius-N` (N is a non-negative integer) | Corner radius, `N` is a pixel value | `@card{radius-12}[...]` → `border-radius: 12px` |

```text
@card{#3366ff,radius-12}[
Setting both background color and corner radius at the same time.
]
```

Tokens not in the table above (e.g. named color words, or the color tokens from Inline Spec §7) are always treated as unrecognized; the renderer MUST ignore them rather than throwing an error (consistent with the spirit of Inline Spec §6 Unknown Command Fallback), and fall back to its own default appearance. If `radius-N`'s `N` is not a pure number (e.g. `radius-lg`), it is likewise treated as unrecognized.

---

## 7. Callout Blocks

`@note`, `@tip`, `@important`, `@warning`, and `@caution` can all be paired with an **optional** `(title)` (defined in §4) to attach a title field independent of the body content; they can also be paired with an **optional** `{styles}` (see §4 and the same explanation in §6 Container Blocks), placed after `(title)`. When both are omitted, the plain-content form is retained — all forms are valid:

### Note

```text
@note[
This is general information.
]
```

---

### Tip

```text
@tip[
This is a best-practice recommendation.
]
```

---

### Important

```text
@important[
Please read this content first.
]
```

---

### Warning

```text
@warning[
Cannot be undone after deletion.
]
```

With a title:

```text
@warning(Data Retention Policy)[
Cannot be undone after deletion.
]
```

---

### Caution

```text
@caution[
This operation may cause data loss.
]
```

---

## 8. Widget Blocks

### Tabs

`@tabs` can **only** contain one or more `@tab` child nodes internally; it does not accept other block-nodes or bare text:

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

* `@tab(title)[content]`: `title` is the tab's display name, and `content` is a full `block-content` (may contain any block-node and inline-stream).
* If a node other than `@tab` appears inside `@tabs[...]` (e.g. bare text or another block-node), the Parser MUST treat it as a syntax error (Strict Mode), or Editor Mode automatically ignores it / prompts a fix.

* **Unique ids (v0.1.2).** A renderer that emits DOM ids for the tab widget MUST make them unique across the *whole document*. Numbering panels from 0 inside each `@tabs` block makes two `@tabs` blocks in one document both emit `tab-panel-0`, `tab-panel-1`, … so a trigger's `aria-controls` can no longer resolve to exactly one panel. The reference renderer prefixes a per-document widget counter (`tab-panel-<widget>-<index>`).
* **Initial state.** The reference renderer marks the first tab as selected (`aria-selected="true"` on its trigger, `data-active="true"` on its panel) so the widget has a correct initial state before any script runs.

> [!TIP]
> **TIP**: The reason `@tab` is not folded into `block-node` is to prevent it from being misused outside of `@tabs` (e.g. placed directly at the top level of a document). This is similar in spirit to the Opaque Domain design of `@raw` in the Inline Spec: specific syntax is only valid in a specific context.

---

### Mermaid

```text
@mermaid[
graph TD
A --> B
]
```

---

## 9. Metadata

```text
@meta[
title = @Doc
author = WEDC
description = AI Native Document Format
keywords = parser,ast,dsl
]
```

The renderer can map this to:

* HTML Meta Tags
* OpenGraph
* PDF Metadata
* DOCX Properties
* Search Index
* RAG Metadata

---

## 10. Core Principle

The goal of @Doc Block Syntax is not to invent a new HTML.

but rather to establish:

> Human Editable
> Machine Deterministic
> AI Friendly
> Cross Platform

for the document AST.

HTML is a renderer.

Markdown is a renderer.

React is a renderer.

And @Doc is:

> Source of Truth.

---

## 11. Simplified Syntax Aliases

Some high-frequency commands additionally provide a Simplified Alias — purely a shorthand at input time. The Parser normalizes it to the canonical name before creating the AST node (`node.type` is always the canonical name); the renderer never needs to, and never does, distinguish which form the author actually typed.

Aliases covered by Block Syntax:

| Canonical | Alias |
|---|---|
| `@heading` | `@h` |
| `@paragraph` | `@p` |

(The Inline Syntax aliases `@b`/`@i`/`@u` for `@bold`/`@italic`/`@underline` are defined in the Inline Syntax Specification.)
