# @Doc Text Formatting — 語義參考文件

*[English version](./Text-Formatting.md)*

> 本文件是 [Inline Syntax Specification](../../../Inline-Syntax-Specification.md) 第 4 節(完整 EBNF 語法定義)的語義說明文件——另外還有第 7 節(`@mark` / `@color` Styles Semantics)、第 9 節(`@raw` Opaque Domain)、第 10 節(Nested Parsing)，各自針對這個家族中的一個節點有專屬的詳細說明。本文將 `@bold`、`@italic`、`@underline`、`@del`、`@mark`、`@color`、`@raw` 視為一組整體來說明；若某節點已有自己的獨立章節，本文只做摘要並連結過去，不重複內容。在 [Block Syntax Specification 第 2 節](../../../Block-Syntax-Specification.md#2-document-ast-structure) 的 Document AST Structure 圖中，這一組被歸類為「Text Formatting」。

## 0. 目錄

* [1. 設計哲學](#1-設計哲學)
* [2. Text Formatting 節點的由來](#2-text-formatting-節點的由來)
* [3. 結構形狀比較](#3-結構形狀比較)
* [4. 節點說明](#4-節點說明)
  * [Bold](#bold)
  * [Italic](#italic)
  * [Underline](#underline)
  * [Strikethrough — `@del`](#strikethrough--del)
  * [Mark](#mark)
  * [Color](#color)
  * [Raw](#raw)
* [5. HTML 語義對應(非規範性)](#5-html-語義對應非規範性)
* [6. AST 表示](#6-ast-表示)
* [7. Renderer 獨立性](#7-renderer-獨立性)
* [8. AI 生成穩定性](#8-ai-生成穩定性)
* [9. 設計原則](#9-設計原則)

---

## 1. 設計哲學

Text Formatting 節點描述的是：一段文字片段應該如何在視覺或語義上與周圍文字區隔——強調、刪除線、高亮——但不指定具體的字重、顏色或標籤。七個成員中有五個幾乎共用同一種形狀：

```text
@bold   @italic   @underline   @del   @mark
```

`@color` 是「不指定具體顏色」這條原則刻意的例外——它存在的目的正是讓作者在語意性預設不夠用時，能釘死一個精確的文字顏色。它仍屬於這個家族，是因為它的形狀與 `@mark` 相同(一個行內包裹器加一個額外欄位)，而不是 Structural 或 Container 節點。

`@raw` 是刻意存在的例外：它命名的是「*不解析*格式」這件事，而不是一種格式化樣式。它之所以被歸在這個家族裡，是因為它在文法中佔據的位置相同(一個包裹著方括號內容的 `inline-node`)，而不是因為它與其他成員行為相似。

---

## 2. Text Formatting 節點的由來

Markdown 對這個家族中大多數概念的表達，是靠重新利用標點符號——`**粗體**`、`*斜體*`、`~~刪除線~~`——同一個字元(`*`)根據是單個還是重複，代表兩種不同的意思，而且作者經常在單字邊界上遇到歧義(`foo*bar*baz` vs `foo *bar* baz`)。底線與高亮則完全沒有標準 Markdown 語法；作者只能退回原生 HTML(`<u>`、`<mark>`)，或使用平台專屬的擴充語法。

@Doc 為這些概念各自提供明確的節點名稱，而不是把一小撮標點符號重複套用在多種意義上：

```text
語意(Meaning)
  ↓
AST Node
  ↓
Renderer Adapter
  ↓
Output Target
```

Parser 可以直接找出文件中每一個 `@mark`(用於高亮／註記索引)或每一個 `@del`(用於掃描「哪些內容被刪除了」)，不需要靠數星號的數量來消歧 `*`、`**`、`***`。

---

## 3. 結構形狀比較

| 節點 | Modifier／選項 | 內容型別 | 形狀備註 |
|---|---|---|---|
| `@bold` | 無 | `content`(可巢狀) | 純包裝 |
| `@italic` | 無 | `content`(可巢狀) | 純包裝 |
| `@underline` | 無 | `content`(可巢狀) | 純包裝 |
| `@del` | 無 | `content`(可巢狀) | 純包裝 |
| `@mark` | `{styles}`，選填 | `content`(可巢狀) | 改變的是**背景色**——見下方 [Mark](#mark) |
| `@color` | `{hex-color}`，選填 | `content`(可巢狀) | 改變的是**文字色**——見 [Color](#color) |
| `@raw` | 無 | `raw-content`(不透明，**不可**巢狀) | 這個家族中唯一完全停用行內解析的節點 |

```ebnf
mark      = "@mark" , [ styles ] , content ;
color     = "@color" , [ styles ] , content ;
bold      = "@bold" , content ;
italic    = "@italic" , content ;
underline = "@underline" , content ;
del       = "@del" , content ;

raw       = "@raw" , raw-content ;
```

七個節點中有四個——`@bold`、`@italic`、`@underline`、`@del`——結構完全相同：一個關鍵字，加上單純的 `content`。`@mark` 與 `@color` 在這個形狀上共用同一個進一步的槽位：同樣選填的 `{styles}`——兩者的差異只在於這個槽位內什麼內容算合法(token 列表 vs. 單一 hex 值)，語法形狀本身完全相同。`@raw` 是唯一一個「內容產生式在種類上、而不只是選項上」有所不同的成員——見 [Raw](#raw)。

---

## 4. 節點說明

### Bold

```text
這是@bold[重要]內容。
```

標記一段文字比周圍內容具有更強的重要性。沒有 modifier，也沒有 styles——這個家族中最單純的節點。

---

### Italic

```text
這是@italic[強調]內容。
```

標記一段文字在風格或語義上有所區隔——強調、標題，或外來語詞彙。形狀與 `@bold` 相同。

---

### Underline

```text
這是@underline[底線]內容。
```

形狀同樣相同。與 `@bold`／`@italic` 不同的是，底線在 Markdown 中完全沒有強力的先例——但 @Doc 依然給了它一級節點的地位，而不是逼作者退回原生 `<u>`。

---

### Strikethrough — `@del`

```text
這是@del[刪除線]內容。
```

標記一段文字已被移除、撤回，或不再適用——與「新增內容」在語義上正好相反。形狀與上面三個節點相同。

---

### Mark

```text
@mark[預設高亮]
@mark{yellow}[黃色高亮]
@mark{red,underline}[紅色並加底線]
```

擁有第二個槽位的節點之一：一個選填的 `{styles}` token 列表(具名顏色、hex 顏色、`underline`、`strikethrough`、`bordered`)。完整語意——兩類 token 的定義、Renderer 對無法識別 token 的 fallback 規則，以及為何 `styles` 只是一個詞法層級的產生式(花括號包裹的字元序列，token 切分留給語意層／Renderer 處理)——都已在 [Inline Syntax Specification 第 7 節](../../../Inline-Syntax-Specification.md#7-mark--color-styles-semantics) 詳細說明，本文不再重複。

要注意 `@mark` 的顏色 token 改變的是**背景色**——這正是那組具名色階(`yellow`、`red`、`green`……)調校的用途。真正的文字改色請見下方 [Color](#color)。

---

### Color

```text
@color{#ff0000}[這段文字是紅色的]
```

`@mark` 改變背景色，`@color` 改變的是文字本身的顏色——這是在這個節點出現之前，語法完全沒有答案的一塊空白。它與 `@mark` 共用完全相同的 `{styles}` 槽位——同樣的括號、同樣選填——但只接受字面的 `#RRGGBB` hex 值，不接受 `@mark` 的具名 color token：那七個具名色是為高亮背景調校的淺色調，直接拿來當文字顏色會對比度不足、幾乎看不清。無法識別、格式不符或省略的值(例如 `@color{blue}[...]`、`@color{#zzz}[...]`、`@color[...]`)會優雅地退回預設值，而不是拋出錯誤，呼應 [Inline Syntax Specification 第 6 節](../../../Inline-Syntax-Specification.md#6-unknown-command-fallback)「忽略而非拋錯」的精神。

---

### Raw

```text
@raw[@mark[hello]]
```

輸出：字面文字 `@mark[hello]`——而不是一個 mark 節點。`@raw` 的內容是 `raw-content`，不是 `content`：內部的一切都不會被解析為 @Doc 語法，就連全域 `@@` 轉義規則在其中也會停用(改由兩條範圍更窄的局部例外規則取代：`@]` → `]`、`@@]` → `@]`)。完整規則與範例請見 [Inline Syntax Specification 第 9 節](../../../Inline-Syntax-Specification.md#9-raw-opaque-domain) 以及 [Special Nodes 第 6 節](../Special-Nodes/Special-Nodes.zh-TW.md#6-轉義的作用範圍全域規則-vs-raw-例外)(該節詳細記錄了 `@raw` 局部例外規則與全域轉義規則之間的互動)。

`@raw` 不是「行內程式碼」，儘管它經常被拿來扮演這個角色——它命名的是「*不解析*」這件事，而不是對內容「這是程式碼」的語義宣告。@Doc 目前完全沒有專屬的行內程式碼節點(根據 [Block Syntax Specification 第 5 節](../../../Block-Syntax-Specification.md#code)，`@code` 僅存在於區塊層級)；用 `@raw` 包裝一小段程式碼片段，只是借用它「不解析」的行為，並不像 `@kbd` 宣告「這是一個鍵盤按鍵」那樣宣告「這是程式碼」(見 [Semantic Inline：Keyboard Key](../Semantic-Inline/Semantic-Inline.zh-TW.md#keyboard-key--kbd))。

---

## 5. HTML 語義對應(非規範性)

無論是 Block Syntax Specification 還是 Inline Syntax Specification，都沒有明文規定 `@bold` 或 `@italic` 應該編譯成哪一個 HTML 標籤。一個合理、普遍被期待的對應方式——`@bold` → `<strong>`、`@italic` → `<em>`——選擇的是*語義性*的 HTML(重要性／強調)，而不是純*展示性*的標籤(`<b>`、`<i>`)，這與 @Doc 宣稱的「將意義與外觀分離」目標一致(見 [README § @Doc 是什麼](../../../README.md))。請將這視為一項合理的 Renderer Adapter 實作建議，而不是規範性規則——正式規格把標籤的選擇留給 Renderer 決定，就像它把 `@warning` 的 HTML 輸出也留給 Renderer Adapter 一樣(見 [Callout Blocks 第 8 節](../../Block-Nodes/Callout-Blocks/Callout-Blocks.zh-TW.md#8-renderer-獨立性))。

---

## 6. AST 表示

[Inline Syntax Specification 第 10 節](../../../Inline-Syntax-Specification.md#10-nested-parsing) 給出了這個家族的標準巢狀範例：

```text
@bold[
    這是粗體，
    裡面有
    @mark{yellow}[重要高亮]
    與
    @underline[底線]
]
```

```text
Document
└── BlockNodes
    └── ParagraphNode
        └── BoldNode
            ├── TextNode
            │   └── "這是粗體，裡面有"
            ├── MarkNode
            │   ├── Styles
            │   │   └── ["yellow"]
            │   └── Content
            │       └── "重要高亮"
            ├── TextNode
            │   └── "與"
            └── UnderlineNode
                └── Content
                    └── "底線"
```

`@raw` 產生的是結構上完全不同的樹——單一葉節點，內容是一段不透明字串，與 `@code`、`@mermaid` 在區塊層級使用的形狀相同(見 [Widget Blocks 第 5 節](../../Block-Nodes/Widget-Blocks/Widget-Blocks.zh-TW.md#5-ast-表示))：

```text
Document
└── BlockNodes
    └── ParagraphNode
        └── RawNode
            └── RawContent
                └── "@mark[hello]"
```

因為 `Bold`／`Italic`／`Underline`／`Del`／`Mark` 全都走同一個可巢狀的 `content` 產生式，工具可以任意深度地走訪它們的組合；`Raw` 的內容則是刻意設計成不透明的，所以沒有任何工具能(或應該)去查看它內部的內容。

---

## 7. Renderer 獨立性

原始碼：

```text
這是@bold[重要]內容，這段@del[已過時]。
```

Web：

```html
<p>這是<strong>重要</strong>內容，這段<del>已過時</del>。</p>
```

Terminal：

```text
這是【重要】內容，這段~~已過時~~。
```

文件平台：由 Renderer 選擇對應的原生強調／刪除線元件——而不是由 @Doc 原始碼決定。`@raw` 的輸出依定義在每個目標上都完全一致：括號內原本是什麼字串，就原樣輸出，不做任何解析。

---

## 8. AI 生成穩定性

Markdown 重複利用標點符號的做法，是生成漂移的常見來源：模型得追蹤自己目前在單星號還是雙星號內部、底線與星號哪一個才是目前生效的分隔符，以及單字中間的 `*` 究竟是開始強調、還是單純的字面字元。`@bold[...]`、`@italic[...]`、`@underline[...]`、`@del[...]` 消除了這種歧義——每一個都只有一種寫法，而且 `[]` 在 @Doc 中無論何處都只有一個含義(見 [README § 核心語法](../../../README.md))。

`@raw` 解決的是另一種生成問題：當模型需要把 @Doc 語法的範例當成字面文字輸出時(例如本文件本身，反覆需要展示 @Doc 自身的語法範例)，用 `@raw[...]` 包起來可以保證編譯器不會把範例誤判為真正的節點——不需要手動跳脫範例中的每一個 `@` 和 `[`。

---

## 9. 設計原則

Text Formatting 節點遵循與 @Doc 其餘部分相同的原則：

```text
Semantic First, Layout Later
```

粗體文字不是兩個星號。高亮也不是某個 Renderer 剛好選用的 `<mark>` 標籤。每個節點是由它對一段文字所代表的意義來定義的，而不是由某個 Renderer 今天剛好怎麼畫它來定義的。
