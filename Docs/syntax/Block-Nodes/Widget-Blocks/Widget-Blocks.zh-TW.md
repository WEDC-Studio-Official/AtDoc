# @Doc Widget Blocks — 語義參考文件

*[English version](./Widget-Blocks.md)*

> 本文件是 [Block Syntax Specification](../../../Block-Syntax-Specification.md) 第 8 節（Widget Blocks）的語義說明文件。語法定義請參閱該節，本文聚焦於 `@tabs`、`@tab`、`@mermaid` 的意義、使用時機，以及尚未定案的部分。

## 0. 目錄

* [1. 設計哲學](#1-設計哲學)
* [2. Widget Blocks 的由來](#2-widget-blocks-的由來)
* [3. 結構形狀比較](#3-結構形狀比較)
* [4. 節點說明](#4-節點說明)
  * [Tabs](#tabs)
  * [Mermaid](#mermaid)
* [5. AST 表示](#5-ast-表示)
* [6. Renderer 獨立性](#6-renderer-獨立性)
* [7. AI 生成穩定性](#7-ai-生成穩定性)
* [8. 設計原則](#8-設計原則)

---

## 1. 設計哲學

Widget Blocks 涵蓋的內容，比 Structural Block 需要更多結構，卻又不符合 Container Block 或 Callout Block 共用的「標題 + 內容」形狀。README 的 Node Taxonomy 頂層只命名了「Core Nodes」與「Semantic Nodes」；Widget Blocks 是在 Block Syntax Specification 這個層級才引入的分類（見 [第 2 節 Document AST Structure](../../../Block-Syntax-Specification.md#2-document-ast-structure)），用來歸類那些文法完全是為該 widget 量身打造的區塊層級元件。

```text
@tabs / @tab   @mermaid
```

跟 Structural Blocks 一樣（見 [Structural Blocks 第 1 節](../Structural-Blocks/Structural-Blocks.md#1-design-philosophy)），這個家族的兩個成員並不共用同一種形狀：`@tabs` 是只接受 `@tab` 子節點的限制性容器，`@mermaid` 則是一個不透明、不解析的內容領域。把它們歸在「Widget」這個名字底下的原因，是兩者都會渲染成一個自成一體的互動或內嵌單元——不是因為它們共用文法。

---

## 2. Widget Blocks 的由來

有些內容既不是段落，也不是可摺疊的區塊，更不是分級的警告框——它是一個帶有自己內部規則的小型獨立元件：一個分頁切換器、一種內嵌的圖表語言。Markdown 對這兩者都沒有原生的表示法；作者只能退回原始 HTML（`<div class="tabs">...`）、特定框架的 MDX 元件，或是靠 fenced code block 硬湊、讓 Renderer 去比對語言字串（```` ```mermaid ````）才能特殊處理。

@Doc 為兩者各自提供一個明確的節點，而不是把既有的基本語法硬套上去：

```text
語意（Meaning）
  ↓
AST Node
  ↓
Renderer Adapter
  ↓
Output Target
```

Parser 可以直接找出文件裡每一個 `@tabs` 或 `@mermaid`，不需要去掃描 `class="tabs"` 屬性，也不需要拿 fenced code block 的語言標籤去比對一份已知清單。

---

## 3. 結構形狀比較

| 節點 | Modifier／選項 | 內容 | 形狀備註 |
|---|---|---|---|
| `@tabs` | 無 | 只能是 `{ @tab }`——不是通用的 `block-content` | 唯一一個內容被限定成單一子節點型別的節點 |
| `@tab` | `(text)`，**必填**，非選填 | `block-content` | 不屬於 `block-node`；只能出現在 `@tabs` 內（見 [Tabs](#tabs)） |
| `@mermaid` | 無 | `raw-block-content` | 不解析——跟 `@code` 同樣的概念，但連 `(language)` 欄位都沒有 |

沒有任何兩列是相同的——這跟 [Structural Blocks 第 3 節](../Structural-Blocks/Structural-Blocks.md#3-shape-comparison) 對 `@h`、`@code`、`@table`、`@hr` 做的「沒有共用形狀」觀察一致。

---

## 4. 節點說明

### Tabs

`@tabs` **只**接受一個或多個 `@tab` 子節點——不接受其他 block-node，也不接受裸文字：

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

* `@tab(title)[content]`——`title` 是分頁的顯示標籤，`content` 是完整的 `block-content`（內部可以放任何 block-node 或 inline-stream）。
* 跟 Container Blocks（`@details`、`@card`）或 Callout Blocks 的 `(title)` 不同，`@tab` 的 `(text)` 在 EBNF 裡**不是選填**（`tab = "@tab" , "(" , text , ")" , block-content`）——括號外沒有 `[ ... ]` 包起來。沒有標籤的分頁沒有定義的形式。
* 如果 `@tabs[...]` 裡出現 `@tab` 以外的任何東西（裸文字，或其他 block-node），Parser 在 Strict Mode 下 MUST 視為語法錯誤，或在 Editor Mode 下自動修正／標記（見 [Block Syntax Specification 第 8 節 Tabs](../../../Block-Syntax-Specification.md#tabs)）。

`@tab` 在 EBNF 裡被刻意排除在 `block-node` 聯集之外（見 [Block Syntax Specification 第 3 節](../../../Block-Syntax-Specification.md#3-ebnf)，緊接在 `metadata =` 上方的那則註記），所以它不能出現在文件頂層，也不能出現在其他節點的 `block-content` 裡——只能出現在 `@tabs` 內。這呼應了 `@raw` 背後的 Opaque Domain 概念（見 [Inline Syntax Specification 第 9 節](../../../Inline-Syntax-Specification.md#9-raw-opaque-domain)）：一段語法只在單一特定情境下才有意義。

---

### Mermaid

```text
@mermaid[
graph TD
A --> B
]
```

`@mermaid` 的內容是 `raw-block-content`——跟 `@code` 用的是同一套「內容不解析」概念（見 [Structural Blocks: Code](../Structural-Blocks/Structural-Blocks.md#code)），差別是 `@mermaid` 完全沒有 `(language)` 欄位，因為圖表語言已經由節點名稱本身表明。Parser 一看到 `@mermaid[`，在對應的 `]` 出現之前，裡面的任何內容都不會被當成 @Doc 語法解讀——沒有 `@bold`，沒有 `@link`，也沒有巢狀 block。

適用於：任何用 Mermaid 自己的文字語法表示的圖表（流程圖、循序圖、狀態圖等）。實際執行 Mermaid 引擎去繪圖，或是在無法渲染圖表的目標上退回成一般程式碼區塊，是 Renderer 的責任。

---

## 5. AST 表示

範例：

```text
@tabs[
    @tab(JavaScript)[
        @code(js)[console.log("hi")]
    ]

    @tab(Python)[
        @code(py)[print("hi")]
    ]
]
```

```text
Document
└── BlockNodes
    └── WidgetNodes
        └── TabsNode
            ├── TabNode
            │   ├── Title
            │   │   └── "JavaScript"
            │   └── Content
            │       └── CodeNode (js) → "console.log(\"hi\")"
            └── TabNode
                ├── Title
                │   └── "Python"
                └── Content
                    └── CodeNode (py) → "print(\"hi\")"
```

相對地，`@mermaid` 產生的是單一葉節點，本體儲存成一段不透明字串，跟 `@code` 一樣：

```text
Document
└── BlockNodes
    └── WidgetNodes
        └── MermaidNode
            └── RawContent
                └── "graph TD\nA --> B"
```

因為 `@tab` 的標題是獨立的 `Title` 欄位，而不是混在文字裡，工具可以列出 `@tabs` 區塊裡的每一個分頁標籤，完全不需要重新解析內容——這跟 Container Blocks 靠專屬 `Title` 欄位得到的好處一樣（見 [Container Blocks 第 6 節](../Container-Blocks/Container-Blocks.md#6-ast-representation)）。

---

## 6. Renderer 獨立性

原始碼：

```text
@tabs[
    @tab(npm)[npm install]
    @tab(pnpm)[pnpm add]
]
```

Web：由 Adapter 自行選擇的原生分頁切換元件。

Terminal：

```text
[npm] npm install
[pnpm] pnpm add
```

原始碼：

```text
@mermaid[
graph TD
A --> B
]
```

Web：渲染出來的圖表（Mermaid 引擎，或一張 SVG）。

Terminal／純文字：一個包著原始 Mermaid 原始碼的 fenced code block——因為不能假設任何目標都能渲染圖表。

---

## 7. AI 生成穩定性

若沒有專屬節點，模型會用不一致、特定框架的標記來表達分頁切換器——一個手刻 JS 的 `<div class="tabs">`、一組 MDX 的 `<Tabs><Tab>`，或是一種要靠 Renderer 逆向工程猜測的「每個標題一個分頁」慣例。`@tabs[ @tab(title)[content] ... ]` 給模型唯一一種確定的形狀，而把 `@tabs` 的子節點限制成只能是 `@tab`（第 4 節）意味著模型不可能不小心產生一個裡面混著裸文字、讓 Parser 得自己猜怎麼處理的 `@tabs` 區塊。

`@mermaid` 不透明的本體則排除了另一種失敗模式：因為 `@mermaid[...]` 裡面完全不會被當成 @Doc 語法解析，模型生成的 Mermaid 原始碼（有自己的 `-->`、`[]`、`{}` 慣例）就不會被誤判成 @Doc 的括號。

---

## 8. 設計原則

Widget Blocks 遵循與 @Doc 其餘部分相同的原則：

```text
Semantic First, Layout Later
```

分頁切換器不是一個帶 JavaScript 的 `<div>`。圖表也不是恰好標了 `mermaid` 的 fenced code block。每個節點的定義來自它「是什麼」，而不是某個 Renderer 今天剛好怎麼畫它。
