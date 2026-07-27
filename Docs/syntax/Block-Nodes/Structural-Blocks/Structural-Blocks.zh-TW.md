# @Doc Structural Blocks — 語義參考文件

*[English version](./Structural-Blocks.md)*

> 本文件是 [Block Syntax Specification](../../../Block-Syntax-Specification.md) 第 5 節（Structural Blocks）的語義說明文件。語法定義請參閱該節，本文聚焦於 `@h`、`@p`、`@quote`、`@list`、`@code`、`@img`、`@table`、`@hr`、`@svg` 的意義、使用時機，以及目前尚未完全定案的部分。

## 0. 目錄

* [1. 設計哲學](#1-設計哲學)
* [2. Structural Blocks 的由來](#2-structural-blocks-的由來)
* [3. 結構形狀比較](#3-結構形狀比較)
* [4. 節點說明](#4-節點說明)
  * [Heading](#heading)
  * [Paragraph](#paragraph)
  * [Quote](#quote)
  * [List](#list)
  * [Code](#code)
  * [Image](#image)
  * [Table](#table)
  * [Horizontal Rule](#horizontal-rule)
  * [SVG](#svg)
* [5. AST 表示](#5-ast-表示)
* [6. Renderer 獨立性](#6-renderer-獨立性)
* [7. AI 生成穩定性](#7-ai-生成穩定性)
* [8. 設計原則](#8-設計原則)

---

## 1. 設計哲學

Structural Blocks 是文件的骨架——在 Container、Callout、Widget 等區塊有意義之前，每個 Renderer 都必須先支援的最小一組原件。README 稱它們為「Core Nodes」：原子性、無法再分割。

與 Callout Blocks（共用一套嚴重程度文法）或 Container Blocks（共用一套 title+content 文法）不同，Structural Blocks 並不共用單一形狀。每個節點的文法只反映該原件真正需要的東西——標題需要層級，程式碼需要語言與不解析的內容，分隔線則什麼都不需要。

---

## 2. Structural Blocks 的由來

Markdown 本身在這部分已經做得不錯——但它的規則是位置性、對空白敏感的（`#`、四格縮排、以空行結束段落），而這正是 LLM 生成文字（而非人類手打）時最容易出錯的地方。@Doc 保留讀者已經熟悉的這些原件，但明確命名它們，而不是從版面配置中推斷：

```text
Markdown           @Doc
# 標題         →   @h(1)[標題]
純文字         →   @p[純文字]
> 引言         →   @quote[引言]
- 項目         →   @list[- 項目]
```

實際輸出成 HTML／PDF／terminal 仍由 Renderer 決定；原始碼只是不再依賴空白與行位置來表達「這是什麼」。

---

## 3. 結構形狀比較

| 節點 | Modifier／選項 | 內容 | 形狀備註 |
|---|---|---|---|
| `@h` | `(level)`，選填，`1`–`6` | `block-content` | 省略時的預設值見 [Heading](#heading) |
| `@p` | 無 | `block-content` | 最單純的純文字容器 |
| `@quote` | 無 | `block-content` | 沒有獨立的引用來源／作者欄位 |
| `@list` | `(ordered)`，選填（見 [List](#list)） | `block-content` | 任何非空行都是項目——結構化 `ListItem` AST，不再是重新切分的文字 |
| `@code` | `(language)`，選填 | `raw-block-content` | 不解析——概念上與 `@raw` 相同 |
| `@img` | `(image-option-list)` | `block-content`（替代文字） | 唯一擁有結構化 key=value 選項列表的節點 |
| `@table` | 無 | `@cols` + `@data`（非通用 `block-content`） | 唯一擁有專屬子節點文法的節點 |
| `@hr` | 無 | 無——裸 `@hr`，完全不帶任何括號 | 唯一零槽位的節點 |
| `@svg` | 無 | `raw-block-content` | 不解析、不轉義——概念上與 `@code`／`@mermaid` 相同，但輸出為即時繪製的圖形而非文字 |

沒有任何兩列是一樣的，這是刻意的設計——見第 1 節。

---

## 4. 節點說明

### Heading

```text
@h(1)[
Introduction
]
```

HTML：

```html
<h1>Introduction</h1>
```

`level` 接受 `1`–`6`。文法將 `(level)` 標示為選填（`[ "(" , level , ")" ]`），但 [Block Syntax Specification 第 3 節](../../../Block-Syntax-Specification.md#3-ebnf) 並未說明省略時的預設值。本文件將省略層級的 `@h[...]` 視為等同於 `@h(1)[...]`——最高層級標題——直到核心規格另有說明為止。

---

### Paragraph

```text
@p[
Hello World
]
```

HTML：

```html
<p>Hello World</p>
```

沒有 modifier，也沒有 title——最單純的結構區塊。用於不需要引用、列表或程式碼格式的一般本文。

---

### Quote

```text
@quote[
Talk is cheap.
Show me the code.
]
```

HTML：

```html
<blockquote>
Talk is cheap.
Show me the code.
</blockquote>
```

與 `@p` 相同，`@quote` 沒有 modifier——沒有獨立欄位可以放引用來源或作者。作者如果想在引言下方加上「— Linus Torvalds」，只能把它寫成內容的第二行，這與 Callout Blocks 在取得 `(title)` 之前的取捨完全相同（參見 [Callout Blocks 第 3 節](../Callout-Blocks/Callout-Blocks.zh-TW.md#3-語法)）。

---

### List

`block-content` 內任何非空行都是一個項目。行首的 `- ` 為選填、向下相容的寫法，Parser 會自動去除，不再是必要條件：

```text
@list[
Apple
Banana
Orange
]
```

等同於仍然合法的舊寫法：

```text
@list[
- Apple
- Banana
- Orange
]
```

每個項目現在是 Parser 產生的獨立 `ListItem` AST 節點（`node.items`），不再由各個 Renderer 各自把已渲染的文字重新切分一次——因此項目內的行內節點（例如 `@bold[Apple]`）會以結構化子節點保留下來，而不是先被壓平成純文字。（相較之下，[Table](#table) 擁有完全結構化的 `Columns`／`Rows` AST——`@list` 現在也有對應、只是較簡單的保證。）

#### 有序清單

`@list(ordered)[...]` 會渲染成 `<ol>` 而不是預設的 `<ul>`。跟一般 `@list` 一樣，行首的 `- ` 是選填、非必要——純文字行也算一個項目；額外寫 `N. `／`N)` 則是明確指定編號，Parser 會把這個數字存進該 `ListItem` 的 `marker` 欄位；Renderer 只在清單是 `ordered` 時才會把 `marker` 轉成 `<li value="N">`，交給瀏覽器原生 `<ol>` 計數器處理「跳號後自動接續」：

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

沒有新增語法——`@list` 的內容本來就是 `block-content`，巢狀 `@list[...]` 本來就是合法子節點。單獨佔一行的巢狀 `@list[...]`（前後只有空白）會被 Parser 併入**前一個** item 的內容，而不是另開一個新 item：

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

> 這份文件先前提過用 `(modifier)` 陣列（例如 `@list(bullet,number)[...]`）逐層宣告清單型態的方案。實際採用的設計——`@list(ordered)` 加上每個巢狀 `@list` 各自宣告型態——比該提案更簡單。

---

### Code

```text
@code(ts)[
const x = 1;
]
```

HTML：

```html
<pre><code class="language-ts">
const x = 1;
</code></pre>
```

`(language)` 為選填欄位；而且與其他所有 block node 不同，`@code` 的內容是 `raw-block-content`——`@bold`、`@link` 等都不會在其中被解析。這是區塊層級版本的 `@raw` Opaque Domain（參見 [Inline Syntax Specification 第 9 節](../../../Inline-Syntax-Specification.md#9-raw-opaque-domain)）：Parser 一旦看到 `@code(`，直到對應的 `]` 之前的所有內容都會原樣保留。

---

### Image

```text
@img(
https://example.com/logo.png
)[
WEDC Logo
]
```

等同於 `@img(src=https://example.com/logo.png)[...]`，也可以搭配其他選項：

```text
@img(
https://example.com/logo.png,width=200,align=center
)[
WEDC Logo
]
```

`@img` 是唯一一個括號槽位為結構化、可擴充 key=value 列表（而非單一 modifier）的 Structural Block——完整選項表（現已包含 `radius` 與 `border`，直接原樣透傳為 CSS 值）與可擴充規則（無法識別的 key MUST 被忽略，而非拋出錯誤）請見 [Block Syntax Specification 第 5 節 Image](../../../Block-Syntax-Specification.md#image)。

---

### Table

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

唯一擁有專屬子節點文法（而非通用 `block-content`）的 Structural Block——`@cols` 與 `@data` 皆為必填，且順序固定（參見 [Block Syntax Specification 第 5 節 Table](../../../Block-Syntax-Specification.md#table)）。這讓 `@table` 在整個節點家族中擁有最強的 AST 保證：欄位與資料列是結構化資料，不是需要 Renderer 重新解析的文字。

---

### Horizontal Rule

```text
@hr
```

HTML：

```html
<hr>
```

@Doc 中唯一零槽位的節點——沒有 modifier、沒有 styles、沒有 content、沒有 title。`@hr` 純粹是標點符號：它只標示一個段落中斷，不攜帶任何資料。

---

### SVG

```text
@svg[
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <circle cx="5" cy="5" r="4" />
</svg>
]
```

`@svg` 的內容是 `raw-block-content`——與 `@code`／`@mermaid` 同樣不解析——但 Renderer 會**不轉義**地原樣輸出，讓瀏覽器實際繪製出向量圖，而不是把標記印成文字。這跨越了一道信任邊界：Renderer SHOULD 在輸出前過濾掉 `<script>` 標籤與 `on*=` 事件屬性（見 `Adapters.ts` 的 `sanitizeSvg()`），但不可信來源的 `@svg` 內容仍應在渲染之前的階段做內容審核——這裡的過濾是安全網，不是內容安全的保證。

---

## 5. AST 表示

範例：

```text
@table[
    @cols[id,name,price]

    @data[
        [1,早餐,60]
    ]
]
```

```text
Document
└── BlockNodes
    └── StructuralNodes
        └── TableNode
            ├── Columns
            │   ├── "id"
            │   ├── "name"
            │   └── "price"
            └── Rows
                └── Row
                    ├── "1"
                    ├── "早餐"
                    └── "60"
```

與 `@list`（仍只是 `block-content` 內的文字）不同，`@table` 的欄位與資料列是各自獨立的 AST 分支，工具可以直接查詢——例如「找出 price > 70 的所有列」——而不需要重新解析字串。

---

## 6. Renderer 獨立性

原始碼：

```text
@quote[
Talk is cheap. Show me the code.
]
```

Web：

```html
<blockquote>Talk is cheap. Show me the code.</blockquote>
```

Terminal：

```text
> Talk is cheap. Show me the code.
```

文件平台：由 Renderer 選擇對應的原生 blockquote 或 callout 元件——而不是由 @Doc 原始碼決定。

---

## 7. AI 生成穩定性

Markdown 的位置性規則——開頭的 `#`、四格縮排、以空行結束段落——正是生成式模型最容易悄悄出錯的地方：少一個空行，結構的意義就默默改變了。@Doc 用明確的節點名稱取代位置：無論周圍空白如何，`@h(1)[...]` 都不會被誤認成一段剛好以 `#` 字元開頭的段落。

---

## 8. 設計原則

Structural Blocks 遵循與 @Doc 其餘部分相同的原則：

```text
Semantic First, Layout Later
```

即使是最基本的原件，也是由意義而非位置定義的。段落不是由它前面的空行定義的，標題也不是由 `#` 定義的——兩者都是由自己的節點名稱定義的。
