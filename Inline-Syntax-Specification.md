# @Doc Inline Syntax Specification v1.4

## 0. Table of Contents

* [1. Design Philosophy](#1-design-philosophy)
* [2. Lexer 行為定義](#2-lexer-行為定義)
* [3. Ambiguity Resolution Rule](#3-ambiguity-resolution-rule)
* [4. 完整 EBNF 語法定義](#4-完整-ebnf-語法定義)
* [5. Escape Rule](#5-escape-rule)
* [6. Unknown Command Fallback](#6-unknown-command-fallback)
* [7. @mark / @color Styles Semantics](#7-mark--color-styles-semantics)
* [8. @link URI Semantics](#8-link-uri-semantics)
* [9. @raw Opaque Domain](#9-raw-opaque-domain)
* [10. Nested Parsing](#10-nested-parsing)
* [11. Parser Recovery Strategy](#11-parser-recovery-strategy)
* [12. Architecture](#12-architecture)
* [13. Core Principle](#13-core-principle)

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
    | color
    | bold
    | italic
    | underline
    | del
    | raw
    | sup
    | sub
    | fn
    | defn
    | kbd
    | link
    | br
    | escape ;

(* ==========================================================================
   Inline Nodes
   ========================================================================== *)

mark      = "@mark" , [ styles ] , content ;
color     = "@color" , [ styles ] , content ;
bold      = "@bold" , content ;
italic    = "@italic" , content ;
underline = "@underline" , content ;
del       = "@del" , content ;

raw       = "@raw" , raw-content ;

sup       = "@sup" , content ;
sub       = "@sub" , content ;

(* Footnotes:
   fn   = 正文中的引用點（角標），只帶編號
   defn = 腳注定義本體，帶編號與實際內容
*)
fn        = "@fn" , "[" , integer , "]" ;
defn      = "@defn" , modifier , content ;

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

(* raw-content 的實際終止規則是「方括號深度計數」，不是「遇到第一個未跳脫
   的 ]」——balanced-bracket-group 用遞迴產生式表達「內部只要左右括號成對，
   可以隨意巢狀，完全不需要跳脫」；只有真正不成對的方括號才需要跳脫。
   詳見 9. @raw Opaque Domain。*)
raw-content =
    "[" , { raw-unit } , "]" ;

raw-unit =
      escaped-at-close-bracket   (* "@@]" → 字面 "@]" *)
    | escaped-at-open-bracket    (* "@@[" → 字面 "@[" *)
    | escaped-close-bracket      (* "@]"  → 字面 "]"（僅用於不成對的 ]） *)
    | escaped-open-bracket       (* "@["  → 字面 "["（僅用於不成對的 [） *)
    | balanced-bracket-group     (* 成對、可巢狀的字面方括號，內容不受限 *)
    | raw-char ;

balanced-bracket-group =
    "[" , { raw-unit } , "]" ;

escaped-at-close-bracket = "@@]" ;
escaped-at-open-bracket  = "@@[" ;
escaped-close-bracket    = "@]" ;
escaped-open-bracket     = "@[" ;

raw-char =
    any-unicode-char - "]" - "[" ;

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

(* @color's semantic constraint on its {styles} content — see §7 for the
   full validation rule (must match /^#[0-9a-fA-F]{6}$/); the terminal itself
   is grammar-level only, exact digit-count/case validation is semantic-level,
   same split as `styles` below. *)
hex-color =
    "#" , hex-digit , hex-digit , hex-digit , hex-digit , hex-digit , hex-digit ;

hex-digit =
      digit
    | "a" | "b" | "c" | "d" | "e" | "f"
    | "A" | "B" | "C" | "D" | "E" | "F" ;

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

> 此為**全域轉義規則**，適用於一般 inline-stream 上下文。
> `@raw` 內部有獨立的轉義規則，請參見 [9. @raw Opaque Domain](#9-raw-opaque-domain)。

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

## 7. @mark / @color Styles Semantics

`@mark` 支援可選的 `styles` 修飾語法：

```text
@mark{style}[content]
```

其中：

* `style` 為以逗號分隔的樣式標記字串（style token list）。
* `content` 為被標記的文字內容。
* `styles` 為**可選**（optional）語法，省略時等同純粹的高亮標記：

```text
@mark[重要內容]
```

---

### Style Token 語意

`style` 內容目前定義為以下兩類 token，可混用並以逗號分隔：

**1. 顏色 Token（Color Token）**

代表高亮色彩，Renderer 依語意對應到實際顏色值。支援兩種寫法，可擇一使用：

* **具名 Token**（Renderer 自訂實際色值）：

  ```text
  yellow / red / green / blue / orange / purple / gray
  ```

* **16 進位 Hex Token**（`#` 開頭、6 位十六進位數字，大小寫皆可，Renderer MUST 直接使用指定值，不得再映射）：

  ```text
  #ff0000 / #3366FF / #00c896
  ```

  格式不符 `/^#[0-9a-fA-F]{6}$/` 的 token（例如 `#f00`、`#gggggg`）不視為合法 hex token，
  依一般規則走 Unknown Command Fallback 的容錯精神（見下方 Renderer 行為）。

**2. 修飾 Token（Modifier Token）**

代表額外的視覺或語意修飾，非顏色本身：

```text
underline   (加底線)
strikethrough (加刪除線)
bordered    (加外框)
```

---

### 範例

```text
@mark[預設高亮]
@mark{yellow}[黃色高亮]
@mark{red,underline}[紅色並加底線]
@mark{blue,bordered}[藍色並加外框]
@mark{#3366ff}[16 進位背景色]
```

---

### @color — 文字改色

`@mark` 改變的是**背景**（高亮），無法改變文字本身的顏色。`@color` 補上這個能力：

```text
@color{#ff0000}[這段文字是紅色的]
```

`@color` 與 `@mark` 共用同一個 `{styles}` 欄位（見上方 EBNF），本身為**選填**——
省略時 Renderer 退回預設色，行為與 `@mark[content]` 省略 `{styles}` 時相同。

```text
@color{blue}[這段文字是深藍色的]
```

`@color` 接受與 `@mark` 相同的七個具名 color token（`yellow`／`red`／`green`／`blue`／
`orange`／`purple`／`gray`），也接受單一 16 進位 hex token（`/^#[0-9a-fA-F]{6}$/`）。
兩者語法上共用同一組 token 名稱，但**對應的實際色值各自獨立**：`@mark` 的色階是為
淺色高亮背景調校的，直接當作文字前景色會對比度不足、難以閱讀，因此 Renderer
通常會維護一份色調較深、專門給 `@color` 用的對照表（而不是重用 `@mark` 那份）。
Renderer MUST 忽略格式不符或無法識別的值並以某種預設值作為 fallback，而非拋出錯誤：

```text
@color{not-a-color}[這段沒有指定顏色，優雅地退回預設色]
```

---

### Renderer 行為

* Renderer MUST 至少支援 `styles` 省略時的預設高亮樣式。
* Renderer MAY 自行決定各具名 color token 對應的實際色值（例如深色模式與淺色模式下的 `yellow` 可不同；`@mark` 與 `@color` 也可以、通常也應該各自維護不同的對照表，理由見上）；16 進位 hex token 則 MUST 直接使用指定值，不得重新映射。
* Renderer MUST 忽略無法識別的 token（包含格式不符的 hex token），並 SHOULD 以某種預設值作為 fallback，而非拋出錯誤——此行為與 [6. Unknown Command Fallback](#6-unknown-command-fallback) 中「未知指令退回純文字」的容錯精神一致，但作用範圍限定在 `styles` 內部，`@mark[content]`／`@color[content]` 本身仍會被正常解析為對應節點。fallback 的具體樣子由 Renderer 自行決定：可以是「無額外顏色」（沿用預設文字色），也可以比照 `@mark` 省略 `styles` 時的預設高亮色再利用一次（兩者共用同一個欄位，這麼做在視覺上是自然的）。
* Token 之間的分隔符固定為半形逗號 `,`，前後允許任意數量空白（Parser 應自動 trim）。此規則適用於 `@mark` 的 `styles`；`@color` 的 `{}` 內只允許單一 token（color token 或 hex 值），不使用逗號分隔——`@color{blue,bordered}` 這樣的內容會被當成一整個無法識別的字串，退回預設值，而不是被切成多個 token。

---

### EBNF 補充說明

對應 [4. 完整 EBNF 語法定義](#4-完整-ebnf-語法定義) 中：

```ebnf
styles =
    "{" ,
        { text-char - "}" } ,
    "}" ;
```

`styles` 本身在詞法層級僅定義為「花括號包裹的任意字元序列」，實際的 token 切分（以逗號分隔、辨識 color token 與 modifier token）屬於**語意層級（semantic level）**的處理，非 Lexer/Parser 的語法層責任，而是留給 Renderer 或後續語意分析階段完成。這樣設計可確保：

* 新增 style token（例如未來加入 `italic`、`bold` 等）不需要修改 EBNF 語法定義本身。
* 不同 Renderer 可自行擴充或裁剪其支援的 token 集合，符合 [1. Design Philosophy](#1-design-philosophy) 中「保持 DSL 的可擴充性」的目標。

---

## 8. @link URI Semantics

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

## 9. @raw Opaque Domain

`@raw` 屬於：

> Opaque Domain

解析器進入：

```text
@raw[
```

之後：

* 不解析任何內部語法。
* 所有 `@mark`、`@bold`、`@link` 等關鍵字皆視為純文字。
* 全域 `@@` 轉義規則（[5. Escape Rule](#5-escape-rule)）不再適用，raw 域內是獨立的一套局部規則（見下方）。

### 終止規則：方括號深度計數，不是「遇到第一個 `]`」

`@raw[...]` 的實作模型是**方括號深度計數**，這點必須先講清楚，因為它直接決定了跳脫規則什麼時候該用、什麼時候不該用：

* `[` 讓深度 +1，`]` 讓深度 -1；深度歸零的那個 `]` 才是真正的結尾。
* 换句話說，**只要方括號成對，可以直接照抄，完全不需要跳脫**——`@raw[@mark[hello]]` 裡的 `@mark[hello]` 本身左右括號成對，Parser 會正確在最外層那個 `]` 結束，輸出 `@mark[hello]` 原樣文字。
* 跳脫規則的存在，是專門給**不成對**的方括號用的——例如只想寫一個單獨的字面 `]`、或引用一段本身括號不平衡的內容片段。如果對一個本來就成對的方括號多加跳脫（例如把 `@mark[hello]`的結尾寫成 `@mark[hello@]`），跳脫消耗掉的 `]` **不會**讓深度計數歸零，於是前面 `@mark[` 那個 `[` 造成的深度 +1 永遠找不到對應的 `]` 抵銷，Parser 只能繼續往後找，直到把外層更多內容（甚至整份文件）都吞下去才會出錯。**平衡的括號直接寫；不平衡的括號一律跳脫；跳脫字元不參與深度計數。**

跳脫規則是對稱的——`]` 和 `[` 各自都有「單字元跳脫」與「跳脫『@』本身後面接該字元」兩種，共四條，掃描時依下列優先序比對（長的、更明確的序列優先）：

| 優先序 | 輸入   | 輸出   | 說明                          |
| ------ | ------ | ------ | ----------------------------- |
| 1      | `@@]`  | `@]`   | 輸出字面 `@]` 兩個字元         |
| 2      | `@@[`  | `@[`   | 輸出字面 `@[` 兩個字元         |
| 3      | `@]`   | `]`    | 輸出**不成對**的字面 `]`（不影響深度計數） |
| 4      | `@[`   | `[`    | 輸出**不成對**的字面 `[`（不影響深度計數） |

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

> 說明：`@mark[hello]` 本身括號成對，深度計數會 1→2→1，最外層那個 `]` 才讓深度歸零並結束 `@raw`。**不需要任何跳脫**——這是最常見的用法（在 raw 內容裡示範一段完整、括號平衡的 @Doc 語法）。

---

輸入：

```text
@raw[@@]
```

輸出：

```text
@@
```

> 說明：此處 `@@` 後方緊接的是 raw-content 的結尾 `]`，
> 因此並未觸發 `@@]` 特例（`@@]` 須為連續三字元），
> 應拆解為：一般字元 `@@`（原樣輸出，因全域轉義已停用）+ 結尾 `]`。

---

輸入：

```text
@raw[今天我怕@]被偵測]
```

輸出：

```text
今天我怕]被偵測
```

> 說明：這裡的 `@]` 是一個**不成對**的字面 `]`（前面沒有對應的 `[`），必須跳脫，否則它會被當成 `@raw` 自己的結尾，讓後面的「被偵測」跑到 raw 內容之外。

---

輸入：

```text
@raw[今天我怕@@]被偵測]
```

輸出：

```text
今天我怕@]被偵測
```

> [!TIP]
> **TIP**：如果使用者想在 raw 內容裡輸出 `@]` 這 2 個字元，
> 只要在前面再加一個 `@`（即 `@@]`）即可，這是 raw 域內的局部轉義特例，
> 與第 5 節的全域 `@@` 轉義規則彼此獨立，互不影響。`@[`／`@@[` 是完全對稱的另一組，規則相同，只是方向相反（處理不成對的字面 `[`）。

---

輸入（跳脫用在不該用的地方——**反例**）：

```text
@raw[這裡的 @mark[hello@] 保持原樣]
```

> [!WARNING]
> **不要這樣寫**：`@mark[hello` 的 `[` 已經讓深度 +1，作者原意只是想讓 `@mark[hello]` 原樣輸出（跟上面第一個範例一樣，括號本來就成對，完全不需要跳脫），卻在結尾多打了一個跳脫符 `@]`。跳脫消耗掉那個 `]` 卻不參與深度計數，於是 `@mark[` 造成的深度 +1 永遠找不到對應的 `]` 抵銷——Parser 會一路往後找，直到吃掉外層更多內容甚至整份文件才報錯。正確寫法是拿掉多餘的 `@`，直接寫 `@raw[這裡的 @mark[hello] 保持原樣]`——括號成對，Parser 自己就能正確配對，不需要人工介入。

---

## 10. Nested Parsing

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

## 11. Parser Recovery Strategy

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

> [!TIP]
> **TIP**：AtDoc 選擇直接拋出語法錯誤，並使用非同步錯誤斷點修復機制

---

### Editor Mode

允許編輯器自動補全缺失閉合符號：

```text
]
```

以提升即時編輯體驗。

---

## 12. Architecture

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

## 13. Core Principle

@Doc 的核心目標並非取代 Markdown。

而是建立：

> Human Editable
> Machine Deterministic
> AI Friendly
> Cross Platform

的新一代文件中介格式。