# @Doc Inline Syntax Specification v1.3

## 0. Table of Contents

* [1. Design Philosophy](#1-design-philosophy)
* [2. Lexer 行為定義](#2-lexer-行為定義)
* [3. Ambiguity Resolution Rule](#3-ambiguity-resolution-rule)
* [4. 完整 EBNF 語法定義](#4-完整-ebnf-語法定義)
* [5. Escape Rule](#5-escape-rule)
* [6. Unknown Command Fallback](#6-unknown-command-fallback)
* [7. @link URI Semantics](#7-link-uri-semantics)
* [7. @raw Opaque Domain](#8-raw-opaque-domain)
* [8. Nested Parsing](#9-nested-parsing)
* [9. Parser Recovery Strategy](#10-parser-recovery-strategy)
* [10. Architecture](#11-architecture)
* [11. Core Principle](#12-core-principle)

---


## 1. Design Philosophy

@Doc 採用：

> **Only Known Commands Trigger Parsing**

只有已知指令具有語法意義。

未知指令永遠視為普通文字。

此設計目標：

* 降低學習成本
* 避免與 Email、Mention 系統衝突
* 提高 AI 解析穩定性
* 提高編輯器容錯能力
* 保持 DSL 的可擴充性
* 建立穩定且可預測的 AST

---

## 2. Lexer 行為定義

### 指令解析規則

當 Lexer 掃描到 `@` 時，應依照以下優先順序處理：

1. 若後續為 `@@`

   * 解析為單一純文字 `@`

2. 若後續符合已註冊之指令名稱

   * 進入對應語法解析流程

3. 若不符合任何已知指令

   * 整段視為普通文字輸出

---

### 範例

| 輸入                 | 結果            |
| ------------------ | ------------- |
| `@mark[hello]`     | 解析為 `mark` 節點 |
| `@@mark`           | 輸出 `@mark`    |
| `test@example.com` | 純文字           |
| `@GitHub`          | 純文字           |
| `@unknown`         | 純文字           |

---

## 3. Ambiguity Resolution Rule

由於 @Doc 採用：

> Known Command Recognition

因此 Lexer 必須先嘗試辨識已知指令，再退回普通文字模式。

換句話說：

> `inline-node` 的優先權高於 `plain-text-char`。

Lexer 必須遵循：

```text
@ 開頭
↓
是否為 @@ ?
↓
是否存在於 Command Registry ?
↓
是 → Inline Node
否 → Plain Text
```

因此：

```text
@mark[hello]
```

必須解析為：

```text
InlineNode(mark)
```

而不是：

```text
Text('@')
Text('m')
Text('a')
Text('r')
Text('k')
...
```

---

## 4. 完整 EBNF 語法定義

```ebnf
(* ==========================================================================
   Entry Point
   ========================================================================== *)

inline-stream =
    { inline-node | plain-text-char } ;

inline-node =
      mark
    | bold
    | italic
    | underline
    | del
    | raw
    | sup
    | sub
    | note
    | notes
    | kbd
    | link
    | br
    | escape ;

(* ==========================================================================
   Inline Nodes
   ========================================================================== *)

mark      = "@mark" , [ styles ] , content ;
bold      = "@bold" , content ;
italic    = "@italic" , content ;
underline = "@underline" , content ;
del       = "@del" , content ;

raw       = "@raw" , raw-content ;

sup       = "@sup" , content ;
sub       = "@sub" , content ;

note      = "@note" , "[" , integer , "]" ;
notes     = "@notes" , modifier , content ;

kbd       = "@kbd" , "[" , key , "]" ;

link      = "@link" , uri , content ;

br        = "@n" ;

escape    = "@@" ;

(* ==========================================================================
   Shared Components
   ========================================================================== *)

content =
    "[" ,
        { content-element } ,
    "]" ;

content-element =
      inline-node
    | plain-text-char ;

raw-content =
    "[" ,
        { raw-char | escaped-bracket } ,
    "]" ;

escaped-bracket =
    "@]" ;

raw-char =
    any-unicode-char - "]" ;

uri =
    "(" ,
        { text-char - ")" } ,
    ")" ;

modifier =
    "(" ,
        { text-char - ")" } ,
    ")" ;

styles =
    "{" ,
        { text-char - "}" } ,
    "}" ;

key =
    { text-char - "]" } ;

integer =
    digit ,
    { digit } ;

digit =
      "0" | "1" | "2" | "3" | "4"
    | "5" | "6" | "7" | "8" | "9" ;

(* ==========================================================================
   Character Sets
   ========================================================================== *)

(* Note:
   plain-text-char has lower precedence than inline-node.

   The lexer MUST always attempt known command recognition
   before falling back to plain text.
*)

plain-text-char =
    any-unicode-char ;

text-char =
    any-unicode-char ;

letter =
    Unicode Letter ;

symbol =
    Unicode Symbol ;
```

---

## 5. Escape Rule

### 語法

```text
@@
```

### 輸出

```text
@
```

### 用途

當使用者需要輸出語法關鍵字本身時使用。

---

### 範例

輸入：

```text
@@mark
```

輸出：

```text
@mark
```

---

輸入：

```text
@@bold[hello]
```

輸出：

```text
@bold[hello]
```

---

輸入：

```text
Email: test@@example.com
```

輸出：

```text
Email: test@example.com
```

雖然此寫法合法，但由於：

```text
example
```

並非已知指令，因此實際上可直接寫：

```text
Email: test@example.com
```

而不需要跳脫。

---

## 6. Unknown Command Fallback

若 `@` 後方並非合法指令名稱，解析器必須退回純文字模式。

範例：

```text
@github
```

輸出：

```text
@github
```

---

```text
test@example.com
```

輸出：

```text
test@example.com
```

---

```text
@my_custom_tag
```

輸出：

```text
@my_custom_tag
```

---

此規則能有效避免與：

* Email
* 社群帳號
* Discord Mention
* GitHub Username
* Chat Mention System

發生衝突。

---

## 7. @link URI Semantics

`@link` 接受任何合法 URI 或 URI-like Identifier。

```text
@link(uri)[content]
```

其中：

* `uri` 為目標資源識別符。
* `content` 為顯示文字。

---

### Renderer URI Inference

Renderer MAY 根據 `uri` 的內容自動推導 URI Scheme。

例如：

| 輸入                             | Renderer 實際 URI           |
| ------------------------------ | ------------------------- |
| `@link(example.com)[官方網站]`     | `https://example.com`     |
| `@link(test@example.com)[聯絡我]` | `mailto:test@example.com` |
| `@link(+886912345678)[客服電話]`   | `tel:+886912345678`       |

---

若 `uri` 已明確指定 Scheme：

```text
@link(https://example.com)[官方網站]
@link(mailto:test@example.com)[聯絡我]
@link(tel:+886912345678)[客服電話]
```

Renderer MUST 直接使用指定值，不得進行推導或修改。

---

### Supported URI Examples

以下皆屬合法 `uri`：

```text
https://example.com
mailto:test@example.com
tel:+886912345678
ftp://example.com/file.zip
discord://channel/123
vscode://file/path
file:///tmp/test.txt
```

@Doc 本身不限制 URI 類型。

URI 的實際支援能力由 Renderer 決定。

---

## 8. @raw Opaque Domain

`@raw` 屬於：

> Opaque Domain

解析器進入：

```text
@raw[
```

之後：

* 不解析任何內部語法。
* 所有 `@mark`、`@bold`、`@link` 等關鍵字皆視為純文字。
* `@@` 不再具有跳脫功能。
* 唯一保留的特殊規則為：

```text
@]
```

代表輸出：

```text
]
```

---

### 範例

輸入：

```text
@raw[@mark[hello]]
```

輸出：

```text
@mark[hello]
```

---

輸入：

```text
@raw[@@]
```

輸出：

```text
@@
```

---

輸入：

```text
@raw[今天我怕@]被偵測]
```

輸出：

```text
今天我怕]被偵測
```

---

## 9. Nested Parsing

由於：

```ebnf
content-element =
      inline-node
    | plain-text-char ;
```

因此 @Doc 支援完整遞迴嵌套。

例如：

```text
@bold[
    這是粗體，
    裡面有
    @mark{yellow}[重要高亮]
    與
    @underline[底線]
]
```

其 AST 結構為：

```text
Bold
├── Text
├── Mark
└── Underline
```

---

## 10. Parser Recovery Strategy

當 Parser 遇到未閉合結構時：

```text
@bold[hello
```

或：

```text
@mark{red}[hello
```

建議提供兩種模式：

### Strict Mode

直接拋出語法錯誤：

```text
Unexpected EOF while parsing @bold
```

---

### Editor Mode

允許編輯器自動補全缺失閉合符號：

```text
]
```

以提升即時編輯體驗。

---

## 11. Architecture

推薦解析流程：

```text
Source Text
    ↓
Lexer
    ↓
Token Stream
    ↓
Parser
    ↓
AST
    ↓
Renderer
```

Renderer 可以自由輸出：

* HTML
* React
* PDF
* DOCX
* Markdown
* Discord
* Terminal
* Custom UI

---

## 12. Core Principle

@Doc 的核心目標並非取代 Markdown。

而是建立：

> Human Editable
> Machine Deterministic
> AI Friendly
> Cross Platform

的新一代文件中介格式。
