# @Doc Block Syntax Specification v1.4

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
   `tab` 不屬於 block-node。
   它是 @tabs 專屬的子節點語法，只能出現在 tabs-content 內，
   詳見下方 "Widget-Specific Grammar: @tabs"。
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
    "@h" ,
    [ "(" , level , ")" ] ,
    block-content ;

paragraph =
    "@p" , block-content ;

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
    | align-option
    | radius-option
    | border-option ;

src-option =
    [ "src=" ] , url ;

width-option =
    "width=" , integer ;

height-option =
    "height=" , integer ;

align-option =
    "align=" , ( "left" | "center" | "right" ) ;

radius-option =
    "radius=" , text ;

border-option =
    "border=" , text ;

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
    cell ,
    { "," , cell } ;

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

(* A cell isn't plain text only — it also allows a curated subset of
   inline-node (cell-inline-node), the same shape @cols columns and @data
   cells share. The authoritative allowlist lives in registry.ts's
   isCellAllowedNode(), not this grammar — a node outside that set (e.g.
   @card, @table, @details) MUST throw rather than being silently dropped,
   per Strict Mode (Inline Syntax Specification §11). *)
cell =
    { cell-inline-node | any-unicode-char - "," - "]" } ;

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
>
> `styles` 同樣沿用 Inline Spec 第 4 節的 `styles` 產生式（`"{" , { text-char - "}" } , "}"`），
> 语法層仍只定義「花括號包裹的任意字元序列」；Container Blocks（`@details`、`@card`）與
> Callout Blocks（`@note`、`@tip`、`@important`、`@warning`、`@caution`）現在正式將其
> 列入各自的產生式中（見上方第 5–7 節），而不再只是 Parser 端未經 EBNF 明文允許的
> 附帶行為。Token 語意（color token 與 modifier token 的辨識、hex 支援）沿用
> Inline Spec 第 7 節 `@mark Styles Semantics` 的既有規則，Renderer 是否／如何把
> Container／Callout 的 `styles` 映射成視覺樣式由 Renderer 自行決定
> （例如 KamiAdapter.ts 的獨立 Renderer 分支）。

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

任何非空行都是一個項目；行首的 `- ` 為**選填**的向下相容寫法，Parser 會自動去除：

```text
@list[
Apple
Banana
Orange
]
```

等同於：

```text
@list[
- Apple
- Banana
- Orange
]
```

每個項目在 AST 中是一個獨立的 `list-item` 節點（`node.items`），內容可包含行內節點（例如 `@bold`），不再只是純文字：

```text
@list[
@bold[Apple] (今日特價)
Banana
]
```

AST:

```text
List
└── items
    ├── ListItem [ Bold("Apple"), " (今日特價)" ]
    └── ListItem [ "Banana" ]
```

> [!TIP]
> **TIP**：舊版語意要求「必須 `- ` 開頭才算項目」，這與「換行即分段」的直覺不一致，
> 也導致三個 Renderer（Route A / Route B / KamiAdapter）各自用字串處理重新實作
> 一次列表切分邏輯。新語意由 Parser 統一產生 `ListItem` AST，Renderer 只需渲染
> 既有結構，不需要再自己切字串。

#### 有序清單

`@list(ordered)[...]` 會渲染成 `<ol>` 而不是預設的 `<ul>`。跟一般 `@list` 一樣，行首的 `- ` 是選填、非必要——純文字行也算一個項目；額外寫 `N. `／`N)` 則是明確指定編號，Parser 會把這個數字存進該 `ListItem` 的 `marker` 欄位；Renderer 只在 `ordered` 為真時才會把 `marker` 轉成 `<li value="N">`，交給瀏覽器原生的 `<ol>` 計數器處理「跳號後自動接續」：

```text
@list(ordered)[
- Apple
- Banana
3. Cherry
- Date
]
```

渲染結果為 `1. Apple`、`2. Banana`、`3. Cherry`（明確指定）、`4. Date`（自動接續）。

#### 巢狀清單

沒有新增語法——`@list` 的內容本來就是 `block-content`，巢狀 `@list[...]` 已經是合法的子節點。單獨佔一行的巢狀 `@list[...]`（前後只有空白）會被 Parser 併入**前一個** item 的內容，而不是另開一個新 item：

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

AST 上，內層 `@list` 節點會出現在 `Fruits` 這個 `ListItem` 的 `content` 陣列裡；Renderer 不需要任何額外邏輯，遞迴渲染 `content` 時自然會產生巢狀的 `<ul>`/`<ol>`。
> 舊版文件曾提過用 `(modifier)` 陣列（例如 `@list(bullet,number)[...]`）逐層宣告清單型態的方案；上面這個 `@list(ordered)` + 巢狀子清單各自宣告型態的設計，是實際採用、比該提案更簡單的做法。

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
| `radius`      | 圓角（直接透傳給 Renderer 的 CSS 值）| `radius=8px`               |
| `border`      | 外框（直接透傳給 Renderer 的 CSS 值）| `border=1px solid #ccc`    |

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

* `@cols[...]`：以逗號分隔的欄位標題列表，定義欄位順序與數量；每個欄位跟 `@data` 的儲存格一樣是 `cell`（見下方），不限於純文字識別符。
* `@data[...]`：每一列包裝在 `[...]` 中，`cell` 數量 SHOULD 與 `@cols` 定義的欄位數量一致；Parser MAY 對數量不符的列拋出警告或錯誤（由 Strict / Editor Mode 決定，參見 Inline Spec 第 11 節 Parser Recovery Strategy）。

> [!TIP]
> **TIP**：`@cols` 與 `@data` 順序固定且皆為必填，這是刻意的設計取捨——
> 犧牲一點靈活性，換取 Parser 與 AI 生成內容時的高度可預測性。

每個 `cell` 不是單純的純文字——除了文字本身，還允許一組經過篩選的行內格式節點（`@bold`、`@italic`、`@underline`、`@del`、`@mark`、`@color`、`@sup`、`@sub`、`@link`、`@fn`，以及會被轉成換行的 `@n`），因為這些節點只改變文字的呈現方式，不會影響表格本身「欄位對齊資料列」的結構。這份清單由 Renderer 端維護（`registry.ts` 的 `isCellAllowedNode`），語法層本身不限制清單內容，未來可以擴充。不在清單上的節點（例如 `@card`、`@table`、`@details` 這類會帶來自己版面結構的區塊節點）MUST 拋出語法錯誤，而不是被靜默捨棄——這與 Strict Mode（Inline Syntax Specification 第 11 節）「寧可拋錯，也不要吞掉錯誤內容」的精神一致。

> [!NOTE]
> **例外**：raw 家族節點（`@code`、`@mermaid`、`@raw`、`@kbd`）也不在 `isCellAllowedNode` 的清單上，但它們既不是「會帶來自己版面結構的區塊節點」，也不适用上面的 MUST 拋錯規則——`Parser.ts`（`parseInlineCellList`）刻意把它們的原始內容拉平成儲存格裡的純文字，而不是拋錯或當成真正的節點解析。這是跟 `@card`/`@table`/`@details` 那類結構節點分開處理的獨立行為，細節見 `registry.ts`（`CELL_ALLOWED_INLINE` 上方註解）與 `Parser.ts`（`parseInlineCellList` 上方註解）。

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
    ├── Row [1, 早餐, 60]
    ├── Row [2, 午餐, 80]
    └── Row [3, 晚餐, 90]
```

或是帶行內格式的儲存格：

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

`@svg` 與 `@code`／`@mermaid` 同屬 `raw-block-content`——內容原樣保留，Parser 不解析、不轉義：

```text
@svg[
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <circle cx="5" cy="5" r="4" />
</svg>
]
```

> [!TIP]
> **TIP**：`@svg` 的內容是**信任邊界**——它會被 Renderer 原樣輸出成瀏覽器實際渲染
> 的向量圖，而不是像 `@code` 一樣顯示成文字。Renderer SHOULD 在輸出前過濾掉
> `<script>` 與 `on*=` 事件屬性（見 Adapters.ts 的 `sanitizeSvg()`），但這是
> Renderer 職責，不是語法層保證；來源不可信的 `@svg` 內容仍應在更早的階段
> 做內容審核。

---

## 6. Container Blocks

`@details`／`@card` 現在也接受**選填**的 `{styles}`（定義與 token 語意見第 4 節與
Inline Spec 第 7 節），置於 `(title)` 之後、`block-content` 之前：

```text
@card(API Key){blue,bordered}[
這裡放說明內容。
]
```

省略時維持純內容形式，兩者皆合法。Renderer MAY 忽略無法識別的 token
（與 Inline Spec §6 Unknown Command Fallback 精神一致）。

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

`@note`、`@tip`、`@important`、`@warning`、`@caution` 皆可搭配**選填**的 `(title)`（定義見第 4 節），為內容附加一個獨立於本文的標題欄位；亦可搭配**選填**的 `{styles}`（見第 4 節、第 6 節 Container Blocks 的同一套說明），置於 `(title)` 之後；兩者皆省略時則維持純內容形式，皆合法：

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

搭配標題：

```text
@warning(資料保留政策)[
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