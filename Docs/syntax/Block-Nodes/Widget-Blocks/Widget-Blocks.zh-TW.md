# @Doc Widget Blocks — 語義參考文件

*[English version](./Widget-Blocks.md)*

> 本文件是 [Block Syntax Specification](../../../Block-Syntax-Specification.md) 第 8 節（Widget Blocks）的語義說明文件。語法定義請參閱該節，本文聚焦於 `@tabs`、`@tab`、`@mermaid` 的意義、使用時機，以及 fallback（降級呈現）的設計理由。

## 0. 目錄

* [1. 設計哲學](#1-設計哲學)
* [2. Widget Blocks 的由來](#2-widget-blocks-的由來)
* [3. 語法](#3-語法)
* [4. 節點說明](#4-節點說明)
  * [Tabs](#tabs)
  * [Mermaid](#mermaid)
* [5. AST 表示](#5-ast-表示)
* [6. Renderer 獨立性](#6-renderer-獨立性)
* [7. AI 生成穩定性](#7-ai-生成穩定性)
* [8. 設計原則](#8-設計原則)

---

## 1. 設計哲學

Structural、Container、Callout Blocks 在任何環境下都能優雅降級——terminal 永遠可以把標題、卡片或警告印成純文字。Widget Blocks 不一樣：它們指名的是一種 Renderer**能力**，而不只是樣式選擇。Renderer 可以自由選擇 `@caution` 要用什麼顏色，但它沒辦法憑空生出 `@tabs` 的互動性，也沒辦法憑空生出 `@mermaid` 需要的繪圖引擎。

```text
@tabs   @mermaid
```

Widget Blocks 是 @Doc 語義與目標平台實際能力交會的邊界。每個 Adapter 都必須為這個家族準備一套明確的 fallback 策略——而不只是挑一種呈現風格。

---

## 2. Widget Blocks 的由來

分頁與圖表都沒有標準的 Markdown 表示法。圖表靠 fenced code block 慣例（```` ```mermaid ````）硬湊出來，也只有部分 Renderer 認得；分頁則完全沒有慣例可言——每個文件框架都自創一套元件（Docusaurus 的 `<Tabs><TabItem>`、VitePress 的自訂容器語法、Nextra 的 `<Tabs.Tab>`），彼此互不相容。

@Doc 為兩者各自提供單一、確定的語法，取代「文件框架剛好發明了什麼就用什麼」：

```text
語意（Meaning）
  ↓
AST Node
  ↓
Renderer Adapter
  ↓
Output Target（互動式 UI、靜態 fallback，或原始圖表語言）
```

作者只需寫一次 `@tabs[...]`：Web adapter 可以渲染成真正可互動的分頁，terminal adapter 可以依序印出每個 `@tab`，PDF adapter 可以將它們逐一排版——全部來自同一份原始碼。

---

## 3. 語法

```ebnf
tabs         = "@tabs" , tabs-content ;
tabs-content = "[" , { tab } , "]" ;
tab          = "@tab" , "(" , text , ")" , block-content ;

mermaid      = "@mermaid" , raw-block-content ;
```

範例：

```text
@tabs[
    @tab(JavaScript)[
        console.log("hi");
    ]

    @tab(Python)[
        print("hi")
    ]
]
```

```text
@mermaid[
graph TD
A --> B
]
```

這個家族與目前介紹過的其他 Block Node 有兩處明顯不同：

* **`@tab` 的標題是必填，不是選填。** 其他每個帶標題的節點（`@details`、`@card`，以及現在的 Callout Blocks）都把 `(title)` 定義成 `[ title ]`——選填。而 `tab = "@tab" , "(" , text , ")" , ...` 的括號外沒有 `[ ]`。一個沒有標籤的分頁在 UI 上根本無法被選取，因此文法直接不允許省略它。
* **`@tab` 不屬於 `block-node`。** EBNF 刻意將它排除在通用的 `block-node` 聯集之外（參見 [Block Syntax Specification 第 3 節](../../../Block-Syntax-Specification.md#3-ebnf)）——它只能出現在 `tabs-content` 內。若在文件頂層或 `@card` 內寫 `@tab(...)[...]`，在 Strict Mode 下屬於錯誤。這是 @Doc 中唯一的**限定情境節點（restricted-context node）**：只在單一位置合法的語法。這與 `@raw` 的 Opaque Domain（參見 [Inline Syntax Specification 第 9 節](../../../Inline-Syntax-Specification.md#9-raw-opaque-domain)）是不同種類的限制——`@raw` 限制的是「內部解析什麼」，`@tab` 限制的是「它能出現在哪裡」。

---

## 4. 節點說明

### Tabs

一組帶標籤、互斥的內容面板——讀者（或 Renderer）一次只選擇檢視其中一個。

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

`@tabs` **只**接受 `@tab` 子節點——不接受裸文字，也不接受其他 block node。Parser 在 Strict Mode 下 MUST 拒絕其他內容，或在 Editor Mode 下自動修正（參見 [Inline Syntax Specification 第 11 節](../../../Inline-Syntax-Specification.md#11-parser-recovery-strategy)）。

適用於：讀者需要在幾個對等選項間切換的情境——同一段程式碼的不同語言版本、依作業系統而異的安裝步驟、不同的設定檔格式。不適用於循序步驟（改用 `@list`），也不適用於應該同時全部可見的內容（改用 `@card`）。

---

### Mermaid

一段原樣傳遞、未經解析的 [Mermaid](https://mermaid.js.org/) 圖表定義。

```text
@mermaid[
graph TD
A --> B
]
```

內容採用 `raw-block-content`——與 `@code`（參見 [Structural Blocks § Code](../Structural-Blocks/Structural-Blocks.zh-TW.md#code)）相同的傳遞行為：括號之間的任何內容都不會被當作 @Doc 語法解讀。Parser 只是把字面上的圖表語言文字，原封不動交給下游知道如何繪製它的引擎。

因為圖表的呈現完全仰賴繪圖引擎是否存在，若 Renderer 不支援 Mermaid，SHOULD 退回成一般的程式碼區塊（顯示原始圖表定義），而不是悄悄捨棄內容——這與 `@code` 在找不到對應語法高亮時採用的原則一致。

---

## 5. AST 表示

範例：

```text
@tabs[
    @tab(JavaScript)[
        console.log("hi");
    ]

    @tab(Python)[
        print("hi")
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
            │       └── "console.log(\"hi\");"
            └── TabNode
                ├── Title
                │   └── "Python"
                └── Content
                    └── "print(\"hi\")"
```

因為每個面板都是各自獨立、帶有自己 `Title` 與 `Content` 的 `TabNode`，工具可以列舉所有分頁、只抽取某個片段的 Python 版本，或標記出只有一個子節點的 `@tabs`——完全不需要解析標記語法。

---

## 6. Renderer 獨立性

原始碼：

```text
@tabs[
    @tab(npm)[
        npm install
    ]

    @tab(pnpm)[
        pnpm install
    ]
]
```

Web：一個可互動的分頁列，一次只顯示一個面板，點擊切換。

Terminal（沒有互動能力）：每個分頁依序印出，各自帶著自己的標籤——

```text
== npm ==
npm install

== pnpm ==
pnpm install
```

文件平台：由 Renderer 選擇該框架原生的分頁元件（`<Tabs>`、`<Tabs.Tab>` 等）——而不是由 @Doc 原始碼決定。

同樣的原則也適用於 `@mermaid`：Web adapter 渲染成 SVG 圖表，terminal 或純文字 adapter 則退回成帶標籤的程式碼區塊，顯示原始圖表定義。

---

## 7. AI 生成穩定性

若沒有專屬節點，模型會依照訓練時看過最多的文件框架 JSX 來表達分頁——`<Tabs><TabItem value="js">`、VitePress 的容器語法、Nextra 元件——猜錯了，輸出就無法在這個專案實際使用的工具鏈上編譯。`@tabs(...)` / `@tab(...)` 讓模型無論目標框架是什麼，都只需要輸出同一種形式；該對應到哪個 UI 元件，是 Adapter 的責任，不是模型的責任。

`@mermaid[...]` 同樣固定了**外層包裝**語法（模型不必再猜測該用 fenced ```` ```mermaid ```` 區塊、自訂 shortcode，還是原始 `<script>` 標籤），同時保留圖表語言本身——它已經有相當程度的標準化——完全不受影響。

---

## 8. 設計原則

Widget Blocks 遵循與 @Doc 其餘部分相同的原則：

```text
Semantic First, Layout Later
```

分頁元件不是由它的點擊事件處理器定義的，Mermaid 圖表也不是由它最終產生的 SVG 定義的。兩者都是由作者寫下的結構化意圖定義的——那個意圖最終如何被實現，完全交給渲染它的一方決定。
