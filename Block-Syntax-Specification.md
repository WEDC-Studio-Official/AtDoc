# @Doc Block Syntax Specification v1.3

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

---

## 1. Design Philosophy

@Doc Block Syntax 採用：

> **Semantic First, Layout Later**

區塊節點描述的是：

> 文件的語意（What）

而不是：

> 呈現方式（How）

因此 @Doc 不提供：

* `@div`
* `@span`
* `@flex`
* `@grid`
* `@row`
* `@col`
* `@class`
* `@style`

Renderer 可以根據平台自由決定：

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
│   │   ├── @h
│   │   ├── @p
│   │   ├── @quote
│   │   ├── @list
│   │   ├── @code
│   │   ├── @img
│   │   ├── @table
│   │   └── @hr
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
    │   ├── @bold
    │   ├── @italic
    │   ├── @underline
    │   ├── @del
    │   └── @raw
    │
    ├── Semantic Inline
    │   ├── @sup
    │   ├── @sub
    │   ├── @kbd
    │   └── @link
    │
    ├── Footnotes
    │   ├── @fn
    │   └── @refn
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
   `tab` 不屬於 block-node。
   它是 @tabs 專屬的子節點語法，只能出現在 tabs-content 內，
   詳見下方 "Widget-Specific Grammar: @tabs"。
*)

metadata =
    "@meta" , block-content ;

heading =
    "@h" ,
    [ "(" , level , ")" ] ,
    block-content ;

paragraph =
    "@p" , block-content ;

quote =
    "@quote" , block-content ;

list =
    "@list" , block-content ;

code =
    "@code" ,
    [ language ] ,
    raw-block-content ;

image =
    "@img" ,
    "(" ,
        image-option-list ,
    ")" ,
    block-content ;

hr =
    "@hr" ;

details =
    "@details" ,
    [ title ] ,
    block-content ;

card =
    "@card" ,
    [ title ] ,
    block-content ;

note =
    "@note" ,
    block-content ;

tip =
    "@tip" ,
    block-content ;

important =
    "@important" ,
    block-content ;

warning =
    "@warning" ,
    block-content ;

caution =
    "@caution" ,
    block-content ;

mermaid =
    "@mermaid" ,
    raw-block-content ;

(* ==========================================================================
   Structural-Specific Grammar: @img

   @img 的括號內容不是單一裸文字，而是以逗號分隔的
   key=value 選項列表（image-option-list），可擴充。
   第一個選項若省略 key，預設視為 src。
   ========================================================================== *)

image-option-list =
    image-option ,
    { "," , image-option } ;

image-option =
      src-option
    | width-option
    | height-option
    | align-option ;

src-option =
    [ "src=" ] , url ;

width-option =
    "width=" , integer ;

height-option =
    "height=" , integer ;

align-option =
    "align=" , ( "left" | "center" | "right" ) ;

url =
    { text-char - "," - ")" } ;

(* ==========================================================================
   Widget-Specific Grammar: @table

   @table 不使用通用的 block-content，
   而是擁有專屬的結構化語法（Columns + Rows）。
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

column-list =
    identifier ,
    { "," , identifier } ;

data =
    "@data" ,
    "[" ,
        { row } ,
    "]" ;

row =
    "[" ,
        cell ,
        { "," , cell } ,
    "]" ;

cell =
    { any-unicode-char - "," - "]" } ;

identifier =
    letter ,
    { letter | digit | "_" } ;

(* ==========================================================================
   Widget-Specific Grammar: @tabs / @tab

   @tab 僅能出現在 @tabs 的 tabs-content 內，
   不屬於通用 block-node 集合，因此無法單獨出現在
   document 頂層或其他 block-content 之中。
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

> `integer`、`text-char` 等終結符定義沿用 Inline Spec 第 4 節
> （完整 EBNF 語法定義）中的 `integer` 與 `text-char` 產生式，
> 兩份文件共用同一套字元集定義，此處不重複列出。

---

## 5. Structural Blocks

### Heading

```text
@h(1)[
Introduction
]
```

HTML:

```html
<h1>Introduction</h1>
```

---

### Paragraph

```text
@p[
Hello World
]
```

HTML:

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

```text
@list[
- Apple
- Banana
- Orange
]
```

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

`@img` 的括號內容為以逗號分隔的 key=value 選項列表（`image-option-list`），可擴充。第一個選項若省略 `key=`，預設視為 `src`：

```text
@img(
https://example.com/logo.png
)[
WEDC Logo
]
```

等同於：

```text
@img(src=https://example.com/logo.png)[
WEDC Logo
]
```

搭配其他選項使用：

```text
@img(
https://example.com/logo.png,width=200,align=center
)[
WEDC Logo
]
```

目前支援的選項：

| 選項          | 說明                                | 範例值                    |
| ------------- | ----------------------------------- | -------------------------- |
| `src`（可省略）| 圖片來源 URL                        | `src=https://...`         |
| `width`       | 顯示寬度（單位由 Renderer 決定）     | `width=200`                |
| `height`      | 顯示高度（單位由 Renderer 決定）     | `height=150`               |
| `align`       | 對齊方式                            | `align=left/center/right`  |

> [!TIP]
> **TIP**：這裡的擴充方式與 Inline Spec 第 7 節 `@mark Styles Semantics`
> 是同一套設計哲學——語法層只定義「括號內是逗號分隔的選項列表」，
> 實際的 key 集合屬於語意層，未來新增選項（例如 `alt`、`loading`）
> 不需要修改 EBNF 本身。Renderer MUST 忽略無法識別的 key，
> 並 SHOULD 以「僅套用 `src`」作為 fallback，而非拋出錯誤。

---

### Table

`@table` 內部結構固定為 `@cols` + `@data` 兩個專屬子節點，**順序固定，兩者皆為必填**：

```text
@table[
    @cols[id,name,price]

    @data[
        [1,早餐,60]
        [2,午餐,80]
        [3,晚餐,90]
    ]
]
```

* `@cols[...]`：以逗號分隔的欄位識別符（identifier）列表，定義欄位順序與數量。
* `@data[...]`：每一列包裝在 `[...]` 中，`cell` 數量 SHOULD 與 `@cols` 定義的欄位數量一致；Parser MAY 對數量不符的列拋出警告或錯誤（由 Strict / Editor Mode 決定，參見 Inline Spec 第 11 節 Parser Recovery Strategy）。

> [!TIP]
> **TIP**：`@cols` 與 `@data` 順序固定且皆為必填，這是刻意的設計取捨——
> 犧牲一點靈活性，換取 Parser 與 AI 生成內容時的高度可預測性。

AST:

```text
Table
├── Columns
│   ├── id
│   ├── name
│   └── price
└── Rows
    ├── Row [1, 早餐, 60]
    ├── Row [2, 午餐, 80]
    └── Row [3, 晚餐, 90]
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

## 6. Container Blocks

### Details

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

---

### Card

```text
@card(API Key)[
這裡放說明內容。
]
```

---

## 7. Callout Blocks

### Note

```text
@note[
這是一般資訊。
]
```

---

### Tip

```text
@tip[
這是一個最佳實踐建議。
]
```

---

### Important

```text
@important[
請優先閱讀此內容。
]
```

---

### Warning

```text
@warning[
刪除後將無法復原。
]
```

---

### Caution

```text
@caution[
此操作可能造成資料遺失。
]
```

---

## 8. Widget Blocks

### Tabs

`@tabs` 內部**僅能**包含一個或多個 `@tab` 子節點，不接受其他 block-node 或裸文字：

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

* `@tab(標題)[內容]`：`標題` 為分頁顯示名稱，`內容` 為完整 `block-content`（可包含任意 block-node 與 inline-stream）。
* 若 `@tabs[...]` 內出現非 `@tab` 的節點（例如裸文字或其他 block-node），Parser MUST 視為語法錯誤（Strict Mode）或由 Editor Mode 自動忽略 / 提示修正。

> [!TIP]
> **TIP**：`@tab` 之所以不併入 `block-node`，是為了避免它被誤用在
> `@tabs` 以外的地方（例如直接放在文件頂層）。這與 Inline Spec 中
> `@raw` 的 Opaque Domain 設計精神類似：特定語法只在特定上下文中有效。

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

Renderer 可映射至：

* HTML Meta Tags
* OpenGraph
* PDF Metadata
* DOCX Properties
* Search Index
* RAG Metadata

---

## 10. Core Principle

@Doc Block Syntax 的目標並非建立新的 HTML。

而是建立：

> Human Editable
> Machine Deterministic
> AI Friendly
> Cross Platform

的文件 AST。

HTML 是 Renderer。

Markdown 是 Renderer。

React 是 Renderer。

而 @Doc 是：

> Source of Truth.