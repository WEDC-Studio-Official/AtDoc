# @Doc Widget Blocks — 語義參考文件

*[English version](./Widget-Blocks.md)*

> 本文件是 [Block Syntax Specification](../../../Block-Syntax-Specification.md) 第 8 節(Widget Blocks)的語義說明文件。語法定義請參閱該節，本文聚焦於 `@tabs`、`@tab`、`@mermaid` 的意義、使用時機，以及目前尚未完全定案的部分。

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

Widget Blocks 涵蓋的內容，比 Structural Block 需要更多結構，卻又不符合 Container Block 或 Callout Block 共用的 title+content 形狀。README 的節點分類（Node Taxonomy）在最上層只命名了「Core Nodes」與「Semantic Nodes」；Widget Blocks 是 Block Syntax Specification 這一層才引入的分類（見 [第 2 節 Document AST Structure](../../../Block-Syntax-Specification.md#2-document-ast-structure)），專門收納那些文法完全為該元件量身打造的區塊層級元件。

```text
@tabs / @tab   @mermaid
```

與 Structural Blocks 一樣（見 [Structural Blocks 第 1 節](../Structural-Blocks/Structural-Blocks.zh-TW.md#1-設計哲學)），這個家族的兩個成員並不共用單一形狀：`@tabs` 是限制性容器，只接受 `@tab` 子節點；`@mermaid` 則是不透明、不解析的內容域。把它們歸在「Widget」之下的原因，是兩者都會渲染成一個自成一體的互動或嵌入單元——而不是因為它們共用同一套文法。

---

## 2. Widget Blocks 的由來

有些內容既不是段落，也不是可折疊區塊，更不是有嚴重程度分級的 callout——而是一個帶有自身內部規則、自成一體的小型元件：分頁切換器、嵌入式圖表語言。Markdown 對這兩者都沒有原生支援；作者只能退回原生 HTML（`<div class="tabs">...`）、框架綁定的 MDX 元件，或是靠 Renderer 比對語言字串（` ```mermaid `）特判的 fenced code block。

@Doc 為這些內容各自提供明確的節點，而不是把既有原件硬套上去：

```text
語意(Meaning)
  ↓
AST Node
  ↓
Renderer Adapter
  ↓
Output Target
```

Parser 可以直接找出文件中每一個 `@tabs` 或 `@mermaid`，不需要去掃描 `class="tabs"` 屬性，也不需要拿 fenced code block 的語言標籤去比對一份已知清單。

---

## 3. 結構形狀比較

| 節點 | Modifier／選項 | 內容 | 形狀備註 |
|---|---|---|---|
| `@tabs` | 無 | `{ @tab }`——非通用 `block-content` | 唯一將內容限制為單一子節點型別的節點 |
| `@tab` | `(text)`，**必填**，非選填 | `block-content` | 不屬於 `block-node`；僅在 `@tabs` 內有效(見 [Tabs](#tabs)) |
| `@mermaid` | 無 | `raw-block-content` | 不解析——概念上與 `@code` 相同，但連 `(language)` 欄位都沒有 |

沒有任何兩列是一樣的——這與 [Structural Blocks 第 3 節](../Structural-Blocks/Structural-Blocks.zh-TW.md#3-結構形狀比較) 對 `@h`、`@code`、`@table`、`@hr` 所做的「不共用形狀」觀察一致。

---

## 4. 節點說明

### Tabs

`@tabs` **僅能**接受一個或多個 `@tab` 子節點——不接受其他 block-node，也不接受裸文字：

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

* `@tab(標題)[內容]`——`標題` 是分頁的顯示名稱，`內容` 為完整的 `block-content`（可包含任意 block-node 或 inline-stream）。
* 與 Container Blocks（`@details`、`@card`）或 Callout Blocks 上的 `(title)` 不同，`@tab` 的 `(text)` 在 EBNF 中**並非選填**（`tab = "@tab" , "(" , text , ")" , block-content`）——外層沒有 `[ ... ]` 包住它。沒有標籤的分頁不屬於已定義的合法形式。
* 若 `@tabs[...]` 內出現 `@tab` 以外的任何東西（裸文字，或其他 block-node），Parser 在 Strict Mode 下 MUST 視為語法錯誤，或在 Editor Mode 下自動修正／提示（見 [Block Syntax Specification 第 8 節 Tabs](../../../Block-Syntax-Specification.md#tabs)）。

`@tab` 被刻意排除在 EBNF 的 `block-node` 選項之外（見 [Block Syntax Specification 第 3 節](../../../Block-Syntax-Specification.md#3-ebnf) 中緊接在 `metadata =` 前的說明），因此它無法出現在文件頂層，也無法出現在其他區塊的 `block-content` 中——只能存在於 `@tabs` 之內。這與 `@raw` 背後的 Opaque Domain 概念相同（見 [Inline Syntax Specification 第 9 節](../../../Inline-Syntax-Specification.md#9-raw-opaque-domain)）：一段語法，只在特定上下文中才有意義。

---

### Mermaid

```text
@mermaid[
graph TD
A --> B
]
```

`@mermaid` 的內容是 `raw-block-content`——與 `@code` 使用的「不解析內容」概念相同（見 [Structural Blocks：Code](../Structural-Blocks/Structural-Blocks.zh-TW.md#code)），差別在於 `@mermaid` 完全沒有 `(language)` 欄位，因為圖表語言已經由節點名稱本身表明。Parser 一旦看到 `@mermaid[`，內部的一切都不會被當成 @Doc 語法解析——沒有 `@bold`、沒有 `@link`、也沒有巢狀區塊——直到對應的 `]` 為止。

適用於：任何以 Mermaid 自身文字語法表達的圖表（流程圖、循序圖、狀態圖等）。實際執行 Mermaid 引擎進行渲染，或在無法渲染圖表的目標上退回純程式碼區塊，都是 Renderer 的責任。

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

相較之下，`@mermaid` 產生的是單一葉節點，內容以不透明字串儲存，與 `@code` 的做法相同：

```text
Document
└── BlockNodes
    └── WidgetNodes
        └── MermaidNode
            └── RawContent
                └── "graph TD\nA --> B"
```

因為 `@tab` 的標題是獨立的 `Title` 欄位而非混雜在文字中，工具可以直接列出 `@tabs` 區塊裡的每一個分頁標籤，而不需要重新解析內容——這與 Container Blocks 因為擁有獨立 `Title` 欄位而得到的好處相同（見 [Container Blocks 第 6 節](../Container-Blocks/Container-Blocks.zh-TW.md#6-ast-表示)）。

---

## 6. Renderer 獨立性

原始碼：

```text
@tabs[
    @tab(npm)[npm install]
    @tab(pnpm)[pnpm add]
]
```

Web：由 Renderer 選擇對應的原生分頁切換元件。

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

Web：渲染後的圖表(Mermaid 引擎，或輸出為 SVG)。

Terminal／純文字：包含原始 Mermaid 原始碼的 fenced code block——因為不能假設所有目標都能渲染圖表。

---

## 7. AI 生成穩定性

若沒有專屬節點，模型通常會用不一致、框架綁定的標記來表達分頁切換器——手刻 JS 的 `<div class="tabs">`、MDX 的 `<Tabs><Tab>` 配對，或是靠「一個標題對應一個分頁」的慣例讓 Renderer 自行逆向猜測。`@tabs[ @tab(標題)[內容] ... ]` 讓模型只有一種確定的輸出形式；而將 `@tabs` 的子節點限制為 `@tab`(第 4 節)，也代表模型不會不小心生成一個內含散落文字、讓 Parser 得自行猜測如何處理的 `@tabs` 區塊。

`@mermaid` 的不透明內容則消除了另一種失效模式：因為 `@mermaid[...]` 內部不會被當成 @Doc 語法解析，模型在生成 Mermaid 原始碼(它有自己的一套 `-->`、`[]`、`{}` 慣例)時，這些字元永遠不會被誤判為 @Doc 的括號語法。

---

## 8. 設計原則

Widget Blocks 遵循與 @Doc 其餘部分相同的原則：

```text
Semantic First, Layout Later
```

分頁切換器不是一個加了 JavaScript 的 `<div>`。圖表也不是恰好寫著 `mermaid` 的 fenced code block。每個節點是由它「是什麼」定義的，而不是由某個 Renderer 今天剛好怎麼畫它來定義。
