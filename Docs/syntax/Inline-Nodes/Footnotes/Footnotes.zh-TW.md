# @Doc Footnotes — 語義參考文件

*[English version](./Footnotes.md)*

> 本文件是 [Inline Syntax Specification](../../../Inline-Syntax-Specification.md) 第 4 節(完整 EBNF 語法定義)的語義說明文件。語法定義位於該節——`fn` 與 `refn` 是 `inline-node` 選項之一，緊接在其產生式上方還有一段簡短的「Footnotes」註解；目前尚未像 `@mark`(第 7 節)、`@link`(第 8 節)、`@raw`(第 9 節)那樣擁有專屬的獨立章節。本文聚焦於 `@fn` 與 `@refn` 的意義、使用時機，以及目前尚未完全定案的部分。

## 0. 目錄

* [1. 設計哲學](#1-設計哲學)
* [2. Footnote 節點的由來](#2-footnote-節點的由來)
* [3. 語法](#3-語法)
* [4. 節點說明](#4-節點說明)
  * [Footnote Reference — `@refn`](#footnote-reference--refn)
  * [Footnote Definition — `@fn`](#footnote-definition--fn)
* [5. `@refn` 與 `@fn` 的配對](#5-refn-與-fn-的配對)
* [6. AST 表示](#6-ast-表示)
* [7. Renderer 獨立性](#7-renderer-獨立性)
* [8. AI 生成穩定性](#8-ai-生成穩定性)
* [9. 設計原則](#9-設計原則)

---

## 1. 設計哲學

腳注其實是兩個節點假裝成一個功能：正文中的引用標記，以及真正存放註解內容的定義——通常渲染在完全不同的位置(頁尾、文件末尾、hover 卡片)。@Doc 在文法層級就明確拆開這兩者，而不是從位置去推斷：

```text
@refn   @fn
```

`@refn` 是**引用點**——正文中只帶編號的標記。`@fn` 是**定義本體**——編號加上實際的註解內容。單獨一個節點都不構成「一個腳注」，兩者合在一起才是。

---

## 2. Footnote 節點的由來

Markdown 原生完全沒有腳注語法——常見的 `[^1]` / `[^1]: text` 慣例是一種事實上的擴充語法，不同 Parser 的實作細節略有差異(放置規則、是否允許多段落註解、反向連結怎麼生成)。HTML 也沒有腳注元素；作者只能手刻 `<sup><a href="#fn1">1</a></sup>` 搭配對應的 `<li id="fn1">`，靠比對錨點 id 字串把兩者串起來。

@Doc 為這個模式的兩個半邊各自提供明確、成對的節點，而不是靠 id 字串慣例：

```text
語意(Meaning)
  ↓
AST Node
  ↓
Renderer Adapter
  ↓
Output Target
```

Parser 可以直接列舉文件中每一個 `@refn` 與每一個 `@fn`，並依編號互相對應，不需要掃描 `href="#fn` 這類子字串。

---

## 3. 語法

```ebnf
refn = "@refn" , "[" , integer , "]" ;
fn   = "@fn" , modifier , content ;
```

```text
@refn[1]
@fn(1)[content]
```

`@refn` 的括號內容**並非**行內文法其他節點共用的通用 `content` 產生式——它只接受 `integer`(`digit , { digit }`)，不接受其他任何東西。`@fn` 使用 `modifier`(`"(" , { text-char - ")" } , ")"`，見 [Inline Syntax Specification 第 4 節](../../../Inline-Syntax-Specification.md#4-完整-ebnf-語法定義))作為編號欄位，其後接一般的 `content`(`"[" , { content-element } , "]"`，其中 `content-element = inline-node | plain-text-char`)。

這個不對稱是真實存在的，不是筆誤：`@refn[1]` 永遠只能放一個裸數字，而 `@fn(1)[...]` 括號內的欄位型別是自由文字(`modifier`)，不是 `integer`。文法本身並不會強制 `@fn` 的識別碼一定要是數字，也不會強制它一定對應某個 `@refn` 的編號——見 [第 5 節](#5-refn-與-fn-的配對)。

範例：

```text
Rust 的所有權系統@refn[1]從根本上消除了資料競爭。

@fn(1)[
See The Rust Programming Language, Chapter 4: Understanding Ownership.
]
```

---

## 4. 節點說明

### Footnote Reference — `@refn`

正文中的標記——一個上標樣式的指標，精準指向本文中需要引註的那個位置，同時不打斷句子的閱讀流暢度。

```text
這項結論已經過同儕審查@refn[2]。
```

`@refn` **僅**帶有一個編號——沒有內容欄位、沒有 modifier，什麼都沒有。它屬於 `inline-node`，因此可以出現在任何 `inline-stream` 能出現的地方(`@p`、`@quote`、`@list`、透過 `block-content` 出現在表格儲存格中等——見 [Block Syntax Specification 第 4 節](../../../Block-Syntax-Specification.md#4-shared-components))。

---

### Footnote Definition — `@fn`

定義本體——實際的註解文字，以與某個 `@refn` 所指向的相同編號／識別碼作為鍵值。

```text
@fn(2)[
Peer review completed 2026 Q1 by an independent research group.
]
```

與 `@refn` 不同，`@fn` 的內容是完整的 `content`——內部可以放任何行內節點(`@link`、`@bold`、`@mark` 等)，因此腳注可以引用一個帶有可點擊超連結的來源，而不只是純文字。因為 `@fn` 本身也只是一個普通的 `inline-node`，文法完全沒有限制它必須寫在哪裡——「所有 `@fn` 都放在文件最後」這類慣例屬於文件風格，不是 Parser 的規則。

---

## 5. `@refn` 與 `@fn` 的配對

文法各自獨立定義了這兩個節點——它**並不要求**每一個 `@refn[n]` 都要有對應的 `@fn(n)[...]`，反之亦然，也沒有禁止兩個 `@fn` 共用同一個識別碼。將 `@refn[1]` 與 `@fn(1)[...]` 互相對應，屬於**語意層級的慣例**，而非語法層級的保證——這與 EBNF 在其他地方對「文法強制規定的事」與「留給 Renderer 或 Linter 檢查的事」所做的區分是同一種思路(可對照 [Block Syntax Specification 第 5 節](../../../Block-Syntax-Specification.md#image) 中 `@img` 選項表的可擴充規則，該規則也明確交給 Renderer 處理)。

實務上的意涵：

* 文件中若有 `@refn[3]`，但找不到任何對應的 `@fn(3)[...]`，這在語法上仍然合法；Renderer MAY 將它渲染為失效／懸空的引用，Linter SHOULD 對此提出警告。
* 同一份文件中出現兩個 `@fn(1)[...]` 定義，同樣在語法上合法；如何解決這個衝突(取第一個、取最後一個，或直接報錯)是 Renderer／Strict Mode 的決策，EBNF 本身並不裁決。
* 因為 `@fn` 的識別碼欄位型別是 `modifier`(自由文字)而非 `integer`，沒有任何規則阻止作者寫成 `@fn(note-a)[...]` 而非數字——但 `@refn[...]` 永遠只能放數字，所以非數字的 `@fn` 識別碼永遠不可能被任何 `@refn` 指向。在規格明確定案之前，請將非數字的 `@fn` 識別碼視為一個潛在陷阱，而不是受支援的寫法。

---

## 6. AST 表示

範例：

```text
所有權系統@refn[1]消除了資料競爭。

@fn(1)[
See @link(https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html)[The Rust Programming Language, Ch. 4].
]
```

```text
Document
└── BlockNodes
    └── ParagraphNode
        ├── TextNode
        │   └── "所有權系統"
        ├── RefnNode
        │   └── Number
        │       └── 1
        └── TextNode
            └── "消除了資料競爭。"
└── BlockNodes
    └── ParagraphNode
        └── FnNode
            ├── Id
            │   └── "1"
            └── Content
                ├── TextNode
                │   └── "See "
                └── LinkNode
                    ├── URI
                    │   └── "https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html"
                    └── Content
                        └── "The Rust Programming Language, Ch. 4"
```

因為 `RefnNode.Number` 與 `FnNode.Id` 是各自獨立的欄位，而不是需要 Renderer 重新解析的文字，工具可以直接透過比對兩個集合，回答「哪些 `@refn` 標記找不到對應的 `@fn`？」這類問題——這與 Callout Blocks 因為擁有獨立 `Title` 欄位而得到的「依結構查詢」好處相同(見 [Callout Blocks 第 7 節](../../Block-Nodes/Callout-Blocks/Callout-Blocks.zh-TW.md#7-ast-表示))。

---

## 7. Renderer 獨立性

原始碼：

```text
這是一個論點@refn[1]。

@fn(1)[
補充來源說明。
]
```

Web：

```html
<p>這是一個論點<sup id="fnref1"><a href="#fn1">1</a></sup>。</p>
...
<li id="fn1">補充來源說明。 <a href="#fnref1">↩</a></li>
```

Terminal：

```text
這是一個論點[1]。

[1] 補充來源說明。
```

文件平台：在引用標記上顯示 hover 卡片，或是頁尾的註解面板——由 Renderer 選擇要用哪一種，而不是由 @Doc 原始碼決定。

---

## 8. AI 生成穩定性

若沒有專屬節點，模型通常會借用訓練資料中最常見的 Markdown 慣例來表達腳注——`[^1]` / `[^1]: text`、手刻的 `<sup>` 搭配手動編號的 `<li id="fn...">` 配對，或是把附註文字直接混雜在正文的括號裡。每一種慣例對「引用／定義」的拆分方式都不一樣，Parser 得自行猜測眼前這份文件用的是哪一種。

`@refn[n]` 與 `@fn(n)[content]` 讓模型針對配對的兩個半邊，各自只有一種確定的輸出形式。因為 `@refn` 的括號只接受 `integer`——而不是通用的 `content`——模型不可能不小心生成一個內含散文、格式化文字或巢狀節點的引用標記；這個失效模式是被文法本身結構性地排除掉的，而不是仰賴模型自律。

---

## 9. 設計原則

Footnotes 遵循與 @Doc 其餘部分相同的原則：

```text
Semantic First, Layout Later
```

腳注引用不是一個上標數字。腳注定義也不是頁尾的一個列表項目。每個節點是由它指向什麼、或它裝載了什麼內容來定義的，而不是由某個 Renderer 今天剛好怎麼畫它來定義。
