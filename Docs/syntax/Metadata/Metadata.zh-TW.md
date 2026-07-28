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
metadata = "@meta" , meta-content ;
```

`@meta` 沒有 modifier，也沒有 title——而且跟其他所有 block node 不同，它的內容也不是 `block-content`。它有自己專屬的文法產生式 `meta-content`（參見 [Block Syntax Specification 第 3 節](../../Block-Syntax-Specification.md#3-ebnf)）：`"["`／`"]"` 的詞法掃描方式跟 `block-content` 一樣（未註冊的 `@word` 一樣會依 [Unknown Command Fallback](../../Inline-Syntax-Specification.md#6-unknown-command-fallback) 退回純文字），但 Parser 在語意層級比其他任何節點都嚴格——它會拒絕 `@meta` 內部**任何**已註冊的節點，不只是結構性節點。連 `@bold`、`@n`，甚至 `@raw` 都不例外：

```text
@meta[
title = @bold[Something]
]
```

會拋出 `` `@meta` only accepts plain text in its content slot — found an unexpected `@bold` node ``——沒有任何一種已註冊節點會在 `@meta` 裡被靜默接受或捨棄。

這點值得停下來說明清楚：**`key = value` 這種寫法確實是真正的結構，只是沒有表現成獨立的 EBNF 產生式。** Parser 收集完 `@meta` 的純文字內容之後，會立刻依照 `"\n"` 以及每一行第一個 `"="` 把它拆成 key/value，直接存成 AST 節點上真正的資料（`MetaNode.meta`，一個單純的 `{ [key]: value }` map）——見下方第 6 節。這跟 `@mark` 的 `{styles}` 欄位（參見 [Inline Syntax Specification 第 7 節](../../Inline-Syntax-Specification.md#7-mark-styles-semantics)）不一樣：`@mark` 的逗號 token 切分完全留給 Renderer 處理；`@meta` 的 key-value 結構化在解析階段就完成了，Renderer 根本還沒看到 AST 之前就已經是結構化資料。

這件事有一個實際的後果：上面範例中的 `@Doc` 值之所以安全，純粹是因為 `Doc` 不是已註冊的行內指令名稱——它會依 Unknown Command Fallback 退回成純文字，原封不動變成值的一部分。如果作者需要在值裡包含某個**已註冊**指令名稱的字面文字（`@bold`、`@n` 等），必須跳脫 `@`（`@@`，參見 [Inline Syntax Specification 第 5 節](../../Inline-Syntax-Specification.md#5-escape-rule)）——不跳脫直接寫的話會拋錯，不會像未註冊名稱那樣自動退回或被靜默忽略。

---

## 4. 在文件中的位置

與其他四個 Block Node 家族的所有節點都不同，`@meta` 完全不屬於 `block-node` 的聯集。[Block Syntax Specification 第 2 節](../../Block-Syntax-Specification.md#2-document-ast-structure) 把 `Metadata` 定位成與 `Block Nodes` 平行的手足分支，而不是它的成員之一，最上層的文法也把原因寫得很明白：

```ebnf
document = [ metadata ] , { block-node } ;
```

`@meta` 最多只能出現**一次**，而且只能出現在所有 block-node **之前**——不能出現在文件中段，也不能巢狀放在 `@card` 或 `@details` 裡面。這與 `@tab` 的限定情境（參見 [Widget Blocks § Tabs](../Block-Nodes/Widget-Blocks/Widget-Blocks.zh-TW.md#tabs)）是不同種類的限制：`@tab` 的限制關乎**父節點**——不論 `@tabs` 出現在哪裡，`@tab` 只能出現在其中；而 `@meta` 的限制關乎**文件位置**——只能出現一次，而且只能在最前面。

> [!NOTE]
> **目前 Parser 沒有真的強制執行這條規則。** 上面說的是預期的約定，不是 `Parser.ts` 現在會檢查的東西：它的頂層迴圈允許 `@meta` 出現在文件任何位置、出現任意多次；而 `@card`／`@details` 的子節點也是走同一套一般內容解析，所以巢狀的 `@meta` 目前也不會報錯——`@card[@meta[title=Nested]]` 現在可以正常解析。「只能出現一次、只能在最前面、不能巢狀」是作者應該遵守的約定，不是 Parser 目前保證會擋下違規寫法。

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
        └── meta: { title: "@Doc", author: "WEDC" }
```

key-value 資料**不會**留成一段未結構化的原始字串等工具自己重新解析——`MetaNode.meta` 在 Parser 回傳 AST 的當下就已經是一個單純的 `{ [key]: value }` map 了。這裡確實沒有獨立的 `MetaEntry`／`KeyValuePair`**節點**（它是物件上的一個屬性，不是像 `@table` 的 columns／rows 那樣結構化的子節點），但資料本身完全結構化：使用端直接讀 `node.meta.title` 就好，完全不需要自己切行、切 `=` 號。

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
