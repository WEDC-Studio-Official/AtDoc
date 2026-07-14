# @Doc Container Blocks — 語義參考文件

*[English version](./Container-Blocks.md)*

> 本文件是 [Block Syntax Specification](../../../Block-Syntax-Specification.md) 第 6 節(Container Blocks)的語義說明文件。語法定義請參閱該節，本文聚焦於 `@details` 與 `@card` 兩個節點的意義、使用時機與設計由來。

## 0. 目錄

* [1. 設計哲學](#1-設計哲學)
* [2. Container Blocks 的由來](#2-container-blocks-的由來)
* [3. 語法](#3-語法)
* [4. 節點說明](#4-節點說明)
  * [Details](#details)
  * [Card](#card)
* [5. 該選哪個節點](#5-該選哪個節點)
* [6. AST 表示](#6-ast-表示)
* [7. Renderer 獨立性](#7-renderer-獨立性)
* [8. AI 生成穩定性](#8-ai-生成穩定性)
* [9. 設計原則](#9-設計原則)

---

## 1. 設計哲學

Container Blocks 將相關內容組合成單一結構單元，但不預設任何排版方式。兩個節點對應兩種不同的組合邏輯：

```text
@details   @card
```

`@details` 處理的是**顯示狀態**——讀者主動展開才會看到的內容。`@card` 處理的是**邊界化分組**——始終可見、被視為一個整體的內容。兩者都不定義外觀，外觀由 Renderer 決定。

---

## 2. Container Blocks 的由來

Markdown 原生沒有「可折疊區塊」或「邊界化內容單元」的概念。作者要嘛直接寫 HTML：

```html
<details>
  <summary>More info</summary>
  ...
</details>
```

要嘛自創一套慣例(粗體標籤、分隔線、縮排)——這些寫法既無法穩定解析，下游也讀不出任何語義。

@Doc 為這兩種模式各自提供一級語義節點，讓意圖——「這段內容可折疊」、「這是一個獨立單元」——不需要依附在任何特定 Renderer 的標記語法上：

```text
語意(Meaning)
  ↓
AST Node
  ↓
Renderer Adapter
  ↓
Output Target
```

Parser 可以直接找出文件中每一個 `@card` 或 `@details`，不需要去猜測哪個 `<div>` 原本是想表達同一件事。

---

## 3. 語法

兩個節點共用同一種結構——可省略的 `(title)` 加上 `block-content`：

```text
@details(title)[content]
@card(title)[content]
```

```ebnf
details = "@details" , [ title ] , block-content ;
card    = "@card" , [ title ] , block-content ;
title   = "(" , text , ")" ;
```

範例：

```text
@details(展開更多資訊)[
內容
]
```

```text
@card(API Key)[
這裡放說明內容。
]
```

`title` 對兩個節點都是選填欄位(參見 [Block Syntax Specification 第 4 節](../../../Block-Syntax-Specification.md#4-shared-components))；省略時，由 Renderer 決定預設呈現方式。

**完全省略 vs. 空括號。** EBNF 將整個 `[ title ]` 標示為可省略，但 `text = { any-unicode-char }` 本身也允許零個字元——因此單就文法而言，`@card()[content]`(空括號)並未被明確排除。本文件將兩者視為等價：完全省略 `(title)`，與括號內為空白或空字串的 `()`，都應正規化為「沒有標題」。Parser 可以選擇在 Strict Mode 下將 `()` 標示為需要提示的寫法(參見 [Inline Syntax Specification 第 11 節](../../../Inline-Syntax-Specification.md#11-parser-recovery-strategy))，但就語義而言，兩者都不帶標題。

---

## 4. 節點說明

### Details

漸進式揭露：內容預設隱藏，由使用者互動後展開。自然對應到 HTML `<details>` / `<summary>`。

```text
@details(展開更多資訊)[
內容
]
```

HTML：

```html
<details>
    <summary>展開更多資訊</summary>
    內容
</details>
```

適用於：讀者可依需求展開的選填或補充內容——例如 FAQ 解答、詳細日誌、「顯示更多」區塊。當 `title` 省略時，Renderer 應提供預設的展開標籤(例如「詳情」)。

---

### Card

邊界明確、始終可見的內容分組——一個獨立的資訊單元，不受任何互動狀態影響。

```text
@card(API Key)[
這裡放說明內容。
]
```

適用於：將標題、說明與相關內容組合成一個單元——預覽面板、摘要區塊、帶標籤的段落。當 `title` 省略時，卡片沒有標題，只保留分組後的內容。

> **範圍說明：**[README](../../../README.md) 開頭的範例展示了 `@card(featured){w-300px bg-f8f9fa text-sm}[...]`，使用的是 @Doc 通用節點文法 `@node(modifier){styles}[content]<action>` 的完整四槽形式。這個四槽結構代表 notation 未來的發展方向；但 `@card` 的 `(modifier)` 與 `{styles}` 槽位**尚未納入正式的 v1.3 EBNF**(見 Block Syntax Specification 第 6 節)，該節目前僅定義 `@card(title)[content]`。請將 README 的範例視為前瞻性示意，而非現行文法。

---

## 5. 該選哪個節點

| 情境 | 對應節點 |
|---|---|
| 內容應預設隱藏，由讀者主動展開 | `@details` |
| 內容應始終可見，並被視為一個整體 | `@card` |

決定因素是**顯示狀態**，不是內容類型——同一段文字依照是否應該預設收合，可以合理地放進任一節點。

---

## 6. AST 表示

範例：

```text
@card(API Key)[
Store your API key in an environment variable.
]
```

```text
Document
└── BlockNodes
    └── ContainerNodes
        └── CardNode
            ├── Title
            │   └── "API Key"
            └── TextNode
                └── "Store your API key in an environment variable."
```

因為 `title` 與 `content` 在 AST 中是各自獨立的欄位而非混合文字，下游工具可以獨立查詢或重新設計標題樣式，而不影響內容本身。

---

## 7. Renderer 獨立性

原始碼：

```text
@details(FAQ)[
This feature is available on all plans.
]
```

Web：

```html
<details>
  <summary>FAQ</summary>
  This feature is available on all plans.
</details>
```

Terminal：

```text
▸ FAQ (expand for details)
```

文件平台：由 Renderer 選擇對應的原生 accordion 或 card 元件——而不是由 @Doc 原始碼決定。

---

## 8. AI 生成穩定性

若沒有專屬節點，模型通常會用不一致、框架綁定的方式表達可折疊區塊與分組內容——原生 `<details>`、自訂 JS accordion、`<div class="collapse">`，或各種臨時的 Markdown 慣例。`@details(title)[content]` 與 `@card(title)[content]` 讓模型針對每種意圖都只有一種確定的輸出形式，結構不再取決於模型訓練時最常見過哪一種 UI 框架。

---

## 9. 設計原則

Container Blocks 遵循與 @Doc 其餘部分相同的原則：

```text
Semantic First, Layout Later
```

card 不是一個有邊框的方塊；details 不是一個 `<details>` 標籤。每個節點是由它組合或揭露的內容定義的，而不是由某個 Renderer 今天剛好怎麼畫它來定義。
