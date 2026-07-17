# @Doc Semantic Inline — 語義參考文件

*[English version](./Semantic-Inline.md)*

> 本文件是 [Inline Syntax Specification](../../../Inline-Syntax-Specification.md) 第 4 節(完整 EBNF 語法定義)的語義說明文件；`@link` 另有專屬的第 8 節(`@link` URI Semantics)。本文聚焦於 `@sup`、`@sub`、`@kbd`、`@link` 的意義、使用時機，以及目前尚未完全定案的部分。

## 0. 目錄

* [1. 設計哲學](#1-設計哲學)
* [2. Semantic Inline 節點的由來](#2-semantic-inline-節點的由來)
* [3. 結構形狀比較](#3-結構形狀比較)
* [4. 節點說明](#4-節點說明)
  * [Superscript — `@sup`](#superscript--sup)
  * [Subscript — `@sub`](#subscript--sub)
  * [Keyboard Key — `@kbd`](#keyboard-key--kbd)
  * [Link — `@link`](#link--link)
* [5. AST 表示](#5-ast-表示)
* [6. Renderer 獨立性](#6-renderer-獨立性)
* [7. AI 生成穩定性](#7-ai-生成穩定性)
* [8. 設計原則](#8-設計原則)

---

## 1. 設計哲學

README 的節點分類將 `@sup`、`@sub`、`@kbd`、`@link` 歸類在「Semantic Inline」之下——這是 Semantic Nodes 兩種行為模式之一(見 [README § 節點分類](../../../README.md))：渲染為「帶標籤的行內元素」的節點。這個分類與 Text Formatting(`@bold`、`@italic`、`@underline`、`@del`、`@mark`)的差別在於：每個節點命名的**是什麼**：

```text
Text Formatting  →  文字應該長什麼樣子
Semantic Inline   →  這段文字或片段實際上是什麼
```

`@bold[重要]` 表達的是「讓這段文字視覺上更粗重」。`@kbd[Ctrl]` 表達的是「這個片段是一個鍵盤按鍵」——這是內容本身的事實，而不是樣式指示。就算 Renderer 沒有能力顯示粗體，它仍然知道 `@kbd` 節點代表一個按鍵名稱；一個專門製作快捷鍵索引的工具，可以直接查詢文件中所有的 `@kbd`，完全不需要在乎每一個節點最終被畫成什麼樣子。

---

## 2. Semantic Inline 節點的由來

Markdown 對上標與下標只透過非標準擴充語法支援(`^text^`、`~text~`)，而且不同 Parser 的實作方式不盡相同；對「鍵盤按鍵」這種元素則完全沒有對應概念，作者只能借用反引號的行內程式碼(`` `Ctrl+C` ``)，把「這是一個按鍵」與「這是程式碼」混為一談；而連結則以位置性語法表達(`[text](url)`)，這也是 LLM 較容易生成失誤的結構之一(括號不平衡、忘記加小括號、意外的巢狀)。

@Doc 為這些內容各自提供明確的節點，而不是把標點符號硬套上去，或借用旁邊的原件：

```text
語意(Meaning)
  ↓
AST Node
  ↓
Renderer Adapter
  ↓
Output Target
```

Parser 可以直接找出文件中每一個 `@kbd`(用於製作快捷鍵索引)、每一個 `@link`(用於連結檢查)，或每一個 `@sup`／`@sub`(用於掃描引用註記或化學式)，不需要靠猜測從行內程式碼或一組括號＋小括號中推斷意圖——那組符號組合同樣可能只是純文字。

---

## 3. 結構形狀比較

| 節點 | 槽位 | 內容型別 | 形狀備註 |
|---|---|---|---|
| `@sup` | `content` | 通用——可巢狀行內節點 | 純包裝，無 modifier |
| `@sub` | `content` | 通用——可巢狀行內節點 | 純包裝，無 modifier |
| `@kbd` | `"[" key "]"` | `key = { text-char - "]" }`——**非**通用 `content` | 無法包含巢狀行內節點 |
| `@link` | `uri` 接 `content` | `uri` 為受限的括號欄位；`content` 為通用 | 這組節點中唯一擁有兩個槽位的節點 |

`@kbd` 的括號在版面上看起來與 `@sup[...]` 或 `@sub[...]` 一模一樣，但在文法上它是不同的產生式——是 `key`，不是 `content`(見 [Inline Syntax Specification 第 4 節](../../../Inline-Syntax-Specification.md#4-完整-ebnf-語法定義))。這代表 `@kbd[@bold[Ctrl]]` 並不是一個巢狀了粗體的按鍵——`@kbd` 括號內根本不會走 `inline-node` 這條路徑，這與 [Footnotes](../Footnotes/Footnotes.zh-TW.md#3-語法) 中 `@refn[integer]` 的限制模式相同。

---

## 4. 節點說明

### Superscript — `@sup`

```text
E = mc@sup[2]
```

一般可巢狀的 `content`——可用於引註標記、腳注樣式的參考符號，或數學／科學記號。由於 `content` 允許 `inline-node | plain-text-char`，內部可以放其他行內節點(例如 `@sup[@bold[a]]`)，不過實務上大多是裸數字或簡短符號。

---

### Subscript — `@sub`

```text
H@sub[2]O
```

與 `@sup` 形狀相同，視覺方向相反。典型用途：化學式、數學下標索引。

---

### Keyboard Key — `@kbd`

```text
按下@kbd[Ctrl]+@kbd[C]複製。
```

```ebnf
kbd = "@kbd" , "[" , key , "]" ;
key = { text-char - "]" } ;
```

`@kbd` 的內容是 `key`，不是 `content`——一段排除 `]` 的原始字元序列，不會解析任何巢狀節點。這與 [Footnotes 第 3 節](../Footnotes/Footnotes.zh-TW.md#3-語法) 對 `@refn[integer]` 所描述的「受限括號」形狀相同：括號確實存在，但它不是文法中幾乎到處通用的行內 `content` 產生式。

適用於：單一按鍵或以 UI 風格按鍵帽呈現的組合鍵(`Ctrl`、`⌘`、`Enter`、`F5`)。不適用於任意行內程式碼——這在目前的規格中仍是一塊 Renderer／生態系尚未補上的空缺(@Doc 目前沒有對應 `@code` 的行內節點；根據 [Block Syntax Specification 第 5 節](../../../Block-Syntax-Specification.md#code)，`@code` 僅存在於區塊層級)。

---

### Link — `@link`

```text
@link(uri)[content]
```

`@link` 是這組節點中唯一擁有兩個槽位的節點——先是 `uri`，接著是 `content`：

```ebnf
link = "@link" , uri , content ;
uri  = "(" , { text-char - ")" } , ")" ;
```

完整語意——scheme 自動推導(`example.com` → `https://example.com`、`test@example.com` → `mailto:...`、`+886912345678` → `tel:...`)、明確指定 scheme 時 MUST 直接採用的規則，以及支援的 URI 範例表——都已在 [Inline Syntax Specification 第 8 節](../../../Inline-Syntax-Specification.md#8-link-uri-semantics) 詳細說明，本文不再重複。

與 `@kbd` 的 `key` 不同，`@link` 的 `content` 是標準的可巢狀產生式——`@link(example.com)[@bold[官方網站]]` 是合法寫法，讓連結文字可以攜帶自己的行內樣式。

---

## 5. AST 表示

範例：

```text
按下@kbd[Ctrl]+@kbd[C]複製，詳見@link(https://example.com/docs)[官方文件]。
```

```text
Document
└── BlockNodes
    └── ParagraphNode
        ├── TextNode
        │   └── "按下"
        ├── KbdNode
        │   └── Key
        │       └── "Ctrl"
        ├── TextNode
        │   └── "+"
        ├── KbdNode
        │   └── Key
        │       └── "C"
        ├── TextNode
        │   └── "複製，詳見"
        ├── LinkNode
        │   ├── URI
        │   │   └── "https://example.com/docs"
        │   └── Content
        │       └── "官方文件"
        └── TextNode
            └── "。"
```

因為 `KbdNode.Key` 與 `LinkNode.URI` 是各自獨立的欄位，而不是混雜在通用內容流中的文字，工具可以在不重新解析本文的情況下，直接列舉文件中的每一個快捷鍵或每一個外部連結——這與 [Footnotes 第 6 節](../Footnotes/Footnotes.zh-TW.md#6-ast-表示) 及 [Callout Blocks 第 7 節](../../Block-Nodes/Callout-Blocks/Callout-Blocks.zh-TW.md#7-ast-表示) 因為擁有各自獨立欄位而得到的「依結構查詢」好處相同。

---

## 6. Renderer 獨立性

原始碼：

```text
按下@kbd[Ctrl]+@kbd[S]儲存，或造訪@link(https://example.com)[官方網站]。
```

Web：

```html
<p>按下<kbd>Ctrl</kbd>+<kbd>S</kbd>儲存，或造訪<a href="https://example.com">官方網站</a>。</p>
```

Terminal：

```text
按下 [Ctrl]+[S] 儲存，或造訪 官方網站 (https://example.com)。
```

文件平台：`@kbd` 對應一個帶樣式的按鍵帽元件，`@link` 對應原生連結元素(可能還帶 hover 預覽)——由 Renderer 選擇要用哪一種，而不是由 @Doc 原始碼決定。

---

## 7. AI 生成穩定性

Markdown 的 `[text](url)` 連結語法，是生成式模型較容易生成失誤的結構之一——少一個小括號、連結文字內未跳脫的方括號，或意外的巢狀，都會悄悄破壞結構。`@link(uri)[content]` 讓兩個槽位維持明確：`()` 永遠是 URI，`[]` 永遠是內容，與 @Doc 的全域規則一致——`[]` 只有一個含義([README § 核心語法](../../../README.md))。

`@kbd` 受限的 `key` 槽位則消除了另一種失效模式：因為 `@kbd[...]` 內部不會被解析為巢狀行內節點，模型不可能不小心生成 `@kbd[@bold[Ctrl]]`，讓 Renderer 得自行猜測按鍵帽裡的粗體樣式該不該保留。`@sup` 與 `@sub` 則盡量維持最簡單的形式——純粹的內容包裝——因為上標／下標本身沒有值得額外約束的結構。

---

## 8. 設計原則

Semantic Inline 節點遵循與 @Doc 其餘部分相同的原則：

```text
Semantic First, Layout Later
```

`@kbd` 不是一段恰好看起來像按鍵的行內程式碼。`@link` 也不是一組讓 Parser 得自行逆向工程的括號＋小括號組合。每個節點是由它命名的東西定義的，而不是由某個 Renderer 今天剛好怎麼畫它來定義。
