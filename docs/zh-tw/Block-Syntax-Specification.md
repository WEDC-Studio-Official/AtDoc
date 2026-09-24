# @Doc Block Syntax Specification v1.5

> 🌐 其他語言版本：[English](../en/Block-Syntax-Specification.md) ・ [简体中文](../zh-cn/Block-Syntax-Specification.md) ・ [日本語（AI 翻譯，可能有誤）](../ja/Block-Syntax-Specification.md) ・ [한국어（AI 번역，可能有誤）](../ko/Block-Syntax-Specification.md)

> [!NOTE]
> **變更紀錄（語法 v0.1.2、規格 v1.5）**——`@img` 新增 `float-left`／`float-right` 對齊，以及 `align` 的裸關鍵字寫法（第 5 節 Image）；`@table` 儲存格現在可用 `|` 分隔，`@span(n)[...]` 可讓一個儲存格橫跨多欄（第 5 節 Table）；某列的寬度不等於 `@cols` 欄數，現在會產生 diagnostic；無法識別的 `{styles}` token 與非數字的 `@defn` id 現在也會產生 diagnostic（第 4 節、Inline Spec 第 11 節）；`@tabs` 的 panel id 現在在整份文件內唯一（第 8 節 Tabs）。另有兩個行內節點 `@spoiler` 與 `@hex` 為新增，見 Inline Spec 第 15 節。

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

@Doc Block Syntax 採用：

> **Semantic First, Layout Later**

區塊節點描述的是：

> 文件的語意（What）

而不是：

> 呈現方式（How）

因此 @Doc 不提供：

* `@div`
* `@span`（作為通用版面包裝節點）
* `@flex`
* `@grid`
* `@row`
* `@col`
* `@class`
* `@style`

> [!NOTE]
> **NOTE**：`@span(n)[...]` 自 v0.1.2 起**確實存在**，但它不是像 HTML `<span>`／`<div>` 那樣的通用版面包裝節點。它是**表格結構標記**：只能作為 `@data` 儲存格的唯一內容，用來表示「這個儲存格橫跨 n 欄」。它不帶任何樣式或呈現資訊——見第 5 節 Table。

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

   @img 的括號內容不是單一裸文字，而是以逗號分隔的
   key=value 選項列表（image-option-list），可擴充。
   第一個選項若省略 key，預設視為 src。

   `image` 產生式（見上方）在 ")" 之後還有一個獨立的選填 [styles]——
   Image Style v1，語法層與 image-option-list 完全無關（不能寫進括號
   內），語意層見下方「Image Style v1」小節。
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
> 语法層仍只定義「花括號包裹的任意字元序列」；Container Blocks（`@details`、`@card`）、
> Callout Blocks（`@note`、`@tip`、`@important`、`@warning`、`@caution`）與 `@img`
> 現在正式將其列入各自的產生式中（見上方第 5–7 節），而不再只是 Parser 端未經 EBNF
> 明文允許的附帶行為。
>
> **Token 語意是各節點自己的規則，不是單一共用表。** `@note`／`@tip`／`@important`／
> `@warning`／`@caution`／`@details` 沿用 Inline Spec 第 7 節 `@mark Styles Semantics`
> 的既有 color token 規則（具名 token 對照表 + hex 支援）；`@card` 與 `@img` 則各自是
> 獨立的封閉 token 集合——分別是 `Card Style v1`（見下方第 6 節「Card Style v1」小節）
> 與 `Image Style v1`（見下方第 5 節「Image Style v1」小節），共用同一組 `#RRGGBB` /
> `radius-N` token 形狀，但語意各自獨立（`@card` 的 hex 是背景色，`@img` 的 hex 是外框
> 色）；兩者都不沿用 Inline Spec 第 7 節的具名色票。
> Renderer 是否／如何把 Container／Callout／`@img` 的 `styles` 映射成視覺樣式由各
> Renderer 自行決定。
>
> **無法識別的 token 會被標示（v0.1.2）。** 不屬於該節點自身詞彙表的 token——例如
> `@card{blue}`（`@card` 只接受 `#RRGGBB`／`radius-N`，不接受具名色）或
> `@mark{bluee}`——過去會被靜默丟棄，節點就這樣沒有樣式，卻沒有任何地方提示。
> Parser 現在會在該 token 上回報 diagnostic（見 Inline Spec 第 11 節 Diagnostics）。
> 文件仍會照常解析與渲染，該 token 仍然被忽略。

---

## 5. Structural Blocks

### Heading

正典語法為 `@heading`；`@h` 是等效的簡化別名（Simplified Alias），兩者解析為同一個 AST 節點，Renderer 不會區分作者實際輸入的是哪一種寫法。

```text
@heading(1)[
Introduction
]

@h(1)[
Introduction
]
```

HTML（兩種寫法輸出相同）：

```html
<h1>Introduction</h1>
```

---

### Paragraph

正典語法為 `@paragraph`；`@p` 是等效的簡化別名。

```text
@paragraph[
Hello World
]

@p[
Hello World
]
```

HTML（兩種寫法輸出相同）：

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
> 也導致每個 Renderer（Route A / Route B / ...）各自用字串處理重新實作
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
| `align`       | 對齊方式／文字環繞（見下方）          | `align=left/center/right/float-left/float-right` |
| `radius`      | 圓角（直接透傳給 Renderer 的 CSS 值）| `radius=8px`               |
| `border`      | 外框（直接透傳給 Renderer 的 CSS 值）| `border=1px solid #ccc`    |

#### Image `align` 值（v0.1.2）

`align` 的值集合是封閉的：

| 值 | 效果 |
|---|---|
| `left` | 圖片靠左；後續內容接在圖片**下方** |
| `center` | 圖片置中（先前的行為） |
| `right` | 圖片靠右；後續內容接在圖片**下方** |
| `float-left` | 圖片靠左；後續文字**環繞在右側** |
| `float-right` | 圖片靠右；後續文字**環繞在左側** |

```text
@img(./a.png,align=float-left)[替代文字]
```

* **裸關鍵字寫法。** 因為值集合是封閉的，逗號項目只要剛好等於這五個值之一，就會被視為 `align`，不需要 `align=` 這個 key：`@img(./a.png,float-left)[...]` 等同 `@img(./a.png,align=float-left)[...]`。這項檢查在「第一個裸項目就是 `src`」規則**之前**執行，所以 `@img(float-left)[...]`（完全沒有 `src`）是對齊，而不是恰好拼成 "float-left" 的 URL。
* **使用單一選項值，而非組合。** 刻意不提供 `align=left,float=true` 這種組合——無效狀態根本寫不出來，作者（或模型）只需做一次選擇而非兩次。
* **不提供 `center` + 環繞。** 讓文字同時排在置中圖片的左右兩側，是 CSS `float` 無法表達的，多數 renderer 也無法實作；保留只會讓各 renderer 靜默退回不同效果。
* **環繞的結束點。** 環繞是 renderer 層級的慣例，不記錄在 AST 中：SHOULD 在下一個標題、下一個 `@hr`，或所屬容器結束時停止。
* **窄螢幕與無法排版的輸出目標**（手機、terminal、部分 PDF）：renderer MAY 忽略對齊與環繞，改為置中或全寬顯示。對齊是**位置語義**，不承諾像素級版面。
* **無法識別的值**（例如 `align=middle`，或打錯字）：renderer 忽略該值並沿用預設（不對齊）。Parser 另外會回報 **warning** diagnostic——文件仍會渲染，所以不算 error，但不再是靜默的。

> [!TIP]
> **TIP**：這裡的擴充方式與 Inline Spec 第 7 節 `@mark Styles Semantics`
> 是同一套設計哲學——語法層只定義「括號內是逗號分隔的選項列表」，
> 實際的 key 集合屬於語意層，未來新增選項（例如 `alt`、`loading`）
> 不需要修改 EBNF 本身。Renderer MUST 忽略無法識別的 key，
> 並 SHOULD 以「僅套用 `src`」作為 fallback，而非拋出錯誤。

#### Image Style v1

`@img(...)` 後面可以再接一個選填的 `{styles}`（語法定義見第 4 節），與
`@card` 共用同一套 **Card Style v1** token 形狀（`#RRGGBB` / `radius-N`），
但語意獨立、自成一套封閉 token 集合——**不沿用** Inline Spec 第 7 節的
具名色票，也**不是** `image-option-list` 的一部分（不能寫在 `(...)` 括號
內）：

| Token 形狀 | 語意 | 範例 |
|---|---|---|
| `#RRGGBB`（16 進位 hex） | 外框色，套用為 1px 實線外框 | `@img(src=...){#3366ff}[...]` → `border: 1px solid #3366ff` |
| `radius-N`（N 為非負整數） | 圓角，`N` 為像素值 | `@img(src=...){radius-12}[...]` → `border-radius: 12px` |

```text
@img(src=https://example.com/photo.jpg){#3366ff,radius-12}[
WEDC Photo
]
```

省略 `{styles}` 時是純粹的裸 `<img>`，不會有任何預設圓角或外框——這跟
`@card` 通常有 Renderer 自己的靜態預設值可覆蓋不同，`{styles}` 對 `@img`
而言是純粹的「選填」開關，而非「覆蓋預設」。

> [!NOTE]
> **NOTE**：`radius`/`border` 這兩個既有的 `(...)` 選項（見上表）仍然有效，
> 是給需要任意 CSS 值（例如 `border=2px dashed red`）的情境用的逃生口；
> `{styles}` 則是跨平台、封閉 token 集合的簡化寫法。兩者同時出現時，
> Renderer SHOULD 讓 `{styles}` 覆蓋對應的 `(...)` 選項（`{radius-N}` 蓋過
> `radius=`、`{#RRGGBB}` 蓋過 `border=`），而非兩者疊加或拋出錯誤。

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

* `@cols[...]`：以分隔符號分隔的欄位標題列表，定義欄位順序與數量；每個欄位跟 `@data` 的儲存格一樣是 `cell`（見下方），不限於純文字識別符。
* `@data[...]`：每一列包裝在 `[...]` 中，該列的**寬度** MUST 等於 `@cols` 定義的欄位數量（`@span(n)` 儲存格算 `n`，其他儲存格各算 1）。寬度不符的列會回報 diagnostic——見下方「列寬度」。

#### 儲存格分隔符號：`|` 或 `,`（v0.1.2）

`@cols` 與每一列 `@data` 原本只以 `,` 切分儲存格，因此無法寫出本身含有逗號的儲存格（`$1,500`、`Web, iOS, Android`、`DECIMAL(10,2)`），否則會靜默多出一欄。自 v0.1.2 起，分隔符號**逐列**依一條機械式規則決定：

```text
某一列在最外層出現 "|"，就以 "|" 分隔；
否則照舊以 "," 分隔。
```

```text
@table[
    @cols[時間|講題|講者]

    @data[
        [09:00 - 10:30|開幕演講|王小明]
        [10:30 - 11:00|@span(2)[茶歇]]
        [11:00 - 12:00||資料工程小組]
        [13:30 - 15:00|表格語法設計|陳大文, 林美華]
    ]
]
```

* **在 `|` 模式下，`,` 就是一般文字**——不需要轉義，也沒有限制（見上方最後一列的講者儲存格）。
* **`,` 模式維持不變。** 沒有 `|` 的列解析結果與先前完全相同，既有文件不需要遷移。逗號寫法視為舊式；Editor Mode 實作 MAY 將它標示為棄用。
* **只有最外層的分隔符號會切分。** 巢狀節點自己方括號內的 `|` 或 `,`（`@bold[a,b]`、`@raw[a|b]`）維持字面——儲存格切分依方括號深度判斷，不查 registry。若儲存格需要字面的 `|`，用 `@raw[...]` 包起來；需要 `|` 的內容多半是程式碼，用它語義上也正確。
* **空儲存格必須寫出來。** `[11:00 - 12:00||資料工程小組]` 的中間儲存格是刻意留空的。
* **頭尾多一根 `|` 視為裝飾並自動去除，頭尾各自獨立判斷。** `[|a|b|c|]`（Markdown 表格的習慣）、`[|a|b|c]`、`[a|b|c|]` 與 `[a|b|c]` 解析結果完全相同。代價：無法再用邊緣的 `|` 表示「真的留空的第一格或最後一格」——請放一個佔位內容，或調整欄位。列中間的空儲存格不受影響。
* 避免使用 `<...>` 包裹儲存格——該形狀已保留給 `<action>` 槽位。

#### 跨欄儲存格：`@span(n)[...]`（v0.1.2）

```text
[10:30 - 11:00|@span(2)[茶歇]]
```

內容**恰好**是一個 `@span(n)[...]` 節點（`n` 為正整數）的儲存格會橫跨 `n` 欄，並在計算列寬度時算 `n` 而不是 1，因此「每列寬度等於欄數」沒有例外。上例該列有 2 個實際儲存格，寬度為 1 + 2 = 3，符合 `@cols` 的三欄。Renderer 將它對應到自己的 colspan 概念（HTML：`<td colspan="n">`）。

* `@span` 只在**`@data` 儲存格的唯一內容**時有效。放在 `@cols` 內、表格之外，或與儲存格內其他內容混用，都屬於位置錯誤的節點，其標示方式與 `@tabs` 之外的 `@tab` 相同。
* `n` MUST 是純正整數。`@span(two)`、`@span(0)` 與 `@span(2.5)` 會各自回報 diagnostic；在列寬度檢查中，這樣的儲存格以寬度 1 計算，因此同一個根本原因不會被重複回報。
* `@span` 本身沒有樣式或版面意義——見第 1 節的說明。

#### 列寬度

某列的寬度（含 `@span`）不等於 `@cols` 的欄數時，**無論該列使用哪種分隔符號**，都會回報 diagnostic。Parser 絕不自動補齊或截斷：靜默的不符會讓表格欄位與標題對不起來。此 diagnostic 在 Strict Mode 下為 error，在 Editor Mode 下為回報但不阻斷的 diagnostic，且指向有問題的那一列。

> [!TIP]
> **TIP**：`@cols` 與 `@data` 順序固定且皆為必填，這是刻意的設計取捨——
> 犧牲一點靈活性，換取 Parser 與 AI 生成內容時的高度可預測性。

每個 `cell` 不是單純的純文字——除了文字本身，還允許一組經過篩選的行內格式節點（`@bold`、`@italic`、`@underline`、`@del`、`@mark`、`@color`、`@sup`、`@sub`、`@link`、`@fn`、`@hex`、`@span`，以及會被轉成換行的 `@n`），（`@hex` 是因為色票表是它最常見的用途；`@span` 是因為那是它唯一有意義的地方；`@spoiler` 則刻意**不**在清單上——表格儲存格不適合放需要點擊才揭露的片段），因為這些節點只改變文字的呈現方式，不會影響表格本身「欄位對齊資料列」的結構。這份清單由 Renderer 端維護（`registry.ts` 的 `isCellAllowedNode`），語法層本身不限制清單內容，未來可以擴充。不在清單上的節點（例如 `@card`、`@table`、`@details` 這類會帶來自己版面結構的區塊節點）MUST 拋出語法錯誤，而不是被靜默捨棄——這與 Strict Mode（Inline Syntax Specification 第 11 節）「寧可拋錯，也不要吞掉錯誤內容」的精神一致。

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

`@details`／`@card` 現在也接受**選填**的 `{styles}`（語法定義見第 4 節），置於
`(title)` 之後、`block-content` 之前：

```text
@card(API Key){#3366ff,radius-12}[
這裡放說明內容。
]
```

省略時維持純內容形式，兩者皆合法。Renderer MAY 忽略無法識別的 token
（與 Inline Spec §6 Unknown Command Fallback 精神一致）。`@card` 的 `{styles}`
token 語意是自己的一套封閉規則（`Card Style v1`），與 Inline Spec 第 7 節的具名
color token 對照表無關——見下方「Card Style v1」小節。

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

#### Card Style v1

`@card` 的 `{styles}` 只允許少量、跨平台且高價值的樣式，刻意不做成通用 CSS
逃生口——目前只認以下兩種 token 形狀，可各自單獨出現、兩者併用（逗號分隔、
順序不拘），或整段省略：

| Token 形狀 | 語意 | 範例 |
|---|---|---|
| `#RRGGBB`（16 進位 hex） | 背景色，直接採用該色值 | `@card{#3366ff}[...]` → `background-color: #3366ff` |
| `radius-N`（N 為非負整數） | 圓角，`N` 為像素值 | `@card{radius-12}[...]` → `border-radius: 12px` |

```text
@card{#3366ff,radius-12}[
同時設定背景色與圓角。
]
```

不在上表中的 token（例如具名色彩詞、Inline Spec 第 7 節的 color token）一律
視為無法識別，Renderer MUST 忽略而非拋錯（與 Inline Spec §6 Unknown Command
Fallback 精神一致），並沿用 Renderer 自己的預設外觀。`radius-N` 的 `N` 若不是
純數字（例如 `radius-lg`）同樣視為無法識別。

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

* **唯一 id（v0.1.2）。** 為分頁元件輸出 DOM id 的 renderer，MUST 讓它們在*整份文件*內唯一。若每個 `@tabs` 區塊都從 0 開始編 panel，同一份文件中的兩個 `@tabs` 會都輸出 `tab-panel-0`、`tab-panel-1`……，觸發鈕的 `aria-controls` 就無法對應到唯一的 panel。參考實作在 id 前面加上每份文件一個的 widget 計數（`tab-panel-<widget>-<index>`）。
* **初始狀態。** 參考實作會將第一個分頁標為已選取（觸發鈕 `aria-selected="true"`、panel `data-active="true"`），讓元件在任何腳本執行前就有正確的初始狀態。

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

---

## 11. Simplified Syntax Aliases

部分高頻指令額外提供簡化別名（Simplified Alias）——純粹是輸入時的簡寫，Parser 會將其正規化為正典名稱後才建立 AST 節點（`node.type` 永遠是正典名稱），Renderer 完全不需要、也不會區分作者實際輸入的是哪一種寫法。

Block Syntax 涵蓋的別名：

| Canonical | Alias |
|---|---|
| `@heading` | `@h` |
| `@paragraph` | `@p` |

（Inline Syntax 的 `@bold`/`@italic`/`@underline` 別名 `@b`/`@i`/`@u` 定義在 Inline Syntax Specification。）