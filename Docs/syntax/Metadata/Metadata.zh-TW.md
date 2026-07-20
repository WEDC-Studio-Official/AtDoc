# @Doc Metadata — 語義參考文件

*[English version](./Metadata.md)*

> 本文件是 [Block Syntax Specification](../../Block-Syntax-Specification.md) 第 9 節（Metadata）的語義說明文件。語法定義請參閱該節，本文聚焦於 `@meta` 的意義、使用時機，以及目前尚未完全定案的部分。

## 0. 目錄

* [1. 設計哲學](#1-設計哲學)
* [2. @meta 的由來](#2-meta-的由來)
* [3. 語法](#3-語法)
* [4. 在文件中的位置](#4-在文件中的位置)
* [5. Renderer 對應目標](#5-renderer-對應目標)
* [6. AST 表示](#6-ast-表示)
* [7. AI 生成穩定性](#7-ai-生成穩定性)
* [8. 設計原則](#8-設計原則)

---

## 1. 設計哲學

`@meta` 是 @Doc 中唯一一個完全不描述讀者可見內容的節點——它是一條通道，用來傳遞文件層級的事實（標題、作者、描述、關鍵字），供 Host 應用程式使用，但不會渲染出任何可見的輸出。README 的 Node Taxonomy 把這種模式稱為「Block Metadata」：注入 Host 的設定，不渲染任何 HTML。

```text
@meta[content]
```

它沒有 modifier、沒有 title、也沒有 styles——只是一組關於文件本身的扁平事實集合，與文件的可見結構完全分開。

---

## 2. @meta 的由來

HTML 的 `<meta>` 標籤、OpenGraph 標籤，以及 PDF／DOCX 的文件屬性，本質上都是為同一小撮事實（標題、作者、描述、關鍵字）設計的不同 schema。把其中任何一種直接寫進原始碼，就等於把這份文件永遠綁死在某一個特定目標上。`@meta` 只宣告一次事實、不綁定任何目標，讓每個 Adapter 自行對應到目的地實際需要的 schema：

```text
語意（Meaning）
  ↓
AST Node
  ↓
Renderer Adapter
  ↓
Output Target（HTML <meta>、OpenGraph、PDF 屬性、DOCX 屬性、搜尋索引、RAG metadata）
```

> **範圍說明：**[README](../../README.md) 開頭的範例對同一個概念使用了不同名稱、不同形狀的節點——`@seo { "title": "...", "description": "..." }`，用花括號與類 JSON 內容表示——而且 README 的 Node Taxonomy 也是以 `@seo{...}` 作為「Block Metadata」的代表範例。但正式的 v1.3 文法既沒有定義 `@seo`，也沒有定義 JSON 內容：[Block Syntax Specification 第 9 節](../../Block-Syntax-Specification.md#9-metadata) 只定義了 `@meta[...]`，使用方括號與 `key = value` 文字行。請將 `@seo{...}` 視為較早期或前瞻性的命名，而非現行文法——`@meta` 才是第 9 節與本文件實際定義的節點。

---

## 3. 語法

```text
@meta[
title = @Doc
author = WEDC
description = AI Native Document Format
keywords = parser,ast,dsl
]
```

```ebnf
metadata = "@meta" , block-content ;
```

`@meta` 沒有 modifier，也沒有 title——只有 `block-content`，與所有純文字型 block node 共用的通用內容規則相同（參見 [Block Syntax Specification 第 4 節](../../Block-Syntax-Specification.md#4-shared-components)）。

這點值得停下來說明清楚：**`key = value` 這種寫法本身並不是獨立的文法產生式。** EBNF 中完全沒有 `meta-entry` 或 `key-value-pair` 這類規則——`@meta` 的內容就跟 `@p` 一樣，被當成一般的文字與 inline-stream 解析。把每一行按 `=` 拆成 key 與 value，是**語意層級**的慣例，不是**語法層級**的規則——這與 `@mark` 的 style token 之於 `{styles}` 欄位的關係完全相同（參見 [Inline Syntax Specification 第 7 節](../../Inline-Syntax-Specification.md#7-mark-styles-semantics)）：括號的形狀由文法定義，但括號**內部**什麼東西有意義，留給 Renderer 或後續的語意分析階段處理。

這件事有一個實際的後果：上面範例中的 `@Doc` 值之所以安全，純粹是因為 `Doc` 不是已註冊的行內指令名稱。根據 [Unknown Command Fallback 規則](../../Inline-Syntax-Specification.md#6-unknown-command-fallback)，`@Doc` 會退回成純文字——但如果作者把 `title = @bold[Something]` 寫成 metadata 的值，就會在一行原本應該是扁平 key-value 的文字裡，觸發真正的行內語法解析，因為 `@meta` 的內容是一般的 `block-content`，不是 `raw-block-content`。需要在值裡包含 `@` 開頭文字的作者，應該使用跳脫（`@@`，參見 [Inline Syntax Specification 第 5 節](../../Inline-Syntax-Specification.md#5-escape-rule)）或直接維持純文字。

---

## 4. 在文件中的位置

與其他四個 Block Node 家族的所有節點都不同，`@meta` 完全不屬於 `block-node` 的聯集。[Block Syntax Specification 第 2 節](../../Block-Syntax-Specification.md#2-document-ast-structure) 把 `Metadata` 定位成與 `Block Nodes` 平行的手足分支，而不是它的成員之一，最上層的文法也把原因寫得很明白：

```ebnf
document = [ metadata ] , { block-node } ;
```

`@meta` 最多只能出現**一次**，而且只能出現在所有 block-node **之前**——不能出現在文件中段，也不能巢狀放在 `@card` 或 `@details` 裡面。這與 `@tab` 的限定情境（參見 [Widget Blocks § Tabs](../Block-Nodes/Widget-Blocks/Widget-Blocks.zh-TW.md#tabs)）是不同種類的限制：`@tab` 的限制關乎**父節點**——不論 `@tabs` 出現在哪裡，`@tab` 只能出現在其中；而 `@meta` 的限制關乎**文件位置**——只能出現一次，而且只能在最前面。

---

## 5. Renderer 對應目標

同一個 `@meta[...]` 區塊，不同 Adapter 可以將它對應到完全不同的目的地 schema：

| 目標 | 對應範例 |
|---|---|
| HTML Meta Tags | `<meta name="author" content="WEDC">` |
| OpenGraph | `<meta property="og:description" content="...">` |
| PDF Metadata | Document Info dictionary（`/Author`、`/Title`） |
| DOCX Properties | `core.xml` 文件屬性 |
| Search Index | 全文檢索的索引欄位 |
| RAG Metadata | 附加在檢索段落上的 chunk 層級 metadata |

這些對應方式都沒有寫死在 @Doc 原始碼裡——同一個區塊會依照目標 Adapter 實際實作的 schema 編譯成對應結果。

---

## 6. AST 表示

範例：

```text
@meta[
title = @Doc
author = WEDC
]
```

```text
Document
└── Metadata
    └── MetaNode
        └── Content
            └── "title = @Doc\nauthor = WEDC"
```

請注意，這裡沒有 `MetaEntry` 或 `KeyValuePair` 節點——如第 3 節所述，文法根本沒有把 key/value 行結構化。工具如果想要 `{ title: "@Doc", author: "WEDC" }` 這種真正的 key-value 資料，就得自行解析 `MetaNode.Content`；AST 只保證這個區塊存在且屬於 metadata，並不保證它的內容已經是結構化資料。

---

## 7. AI 生成穩定性

若沒有專屬節點，模型通常會用原生 HTML `<meta>` 標籤、YAML frontmatter，或是臨時拼湊的 JSON 來表達文件 metadata——三種互不相容的慣例，下游工具沒有可靠的方式判斷某份原始碼用的是哪一種。`@meta[...]` 讓模型無論目標為何，都只需要輸出同一種確定的包裝形式；至於要對應到哪個 schema（第 5 節），是 Adapter 的責任，不是模型的責任。

---

## 8. 設計原則

`@meta` 遵循與 @Doc 其餘部分相同的原則：

```text
Semantic First, Layout Later
```

`@meta` 攜帶的是事實，不是標記語法。不論標題最終落在 HTML 的 `<title>` 標籤、PDF 的 Info dictionary，還是 RAG 索引的 metadata 欄位裡，它終究是一個標題——`@meta` 只負責宣告這些事實一次，如何使用則交給每個目標自行決定。
