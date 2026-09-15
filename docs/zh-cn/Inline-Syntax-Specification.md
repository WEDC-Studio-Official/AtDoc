# @Doc Inline Syntax Specification v1.4

> 🌐 其他语言版本：[English](../en/Inline-Syntax-Specification.md) ・ [繁體中文](../zh-tw/Inline-Syntax-Specification.md) ・ [日本語（AI 翻译，可能有误）](../ja/Inline-Syntax-Specification.md) ・ [한국어（AI 번역，可能有误）](../ko/Inline-Syntax-Specification.md)

## 0. Table of Contents

* [1. Design Philosophy](#1-design-philosophy)
* [2. Lexer 行为定义](#2-lexer-行为定义)
* [3. Ambiguity Resolution Rule](#3-ambiguity-resolution-rule)
* [4. 完整 EBNF 语法定义](#4-完整-ebnf-语法定义)
* [5. Escape Rule](#5-escape-rule)
* [6. Unknown Command Fallback](#6-unknown-command-fallback)
* [7. @mark / @color / @bordered Styles Semantics](#7-mark--color--bordered-styles-semantics)
* [8. @link URI Semantics](#8-link-uri-semantics)
* [9. @raw Opaque Domain](#9-raw-opaque-domain)
* [10. Nested Parsing](#10-nested-parsing)
* [11. Parser Recovery Strategy](#11-parser-recovery-strategy)
* [12. Architecture](#12-architecture)
* [13. Core Principle](#13-core-principle)
* [14. Simplified Syntax Aliases](#14-simplified-syntax-aliases)

---


## 1. Design Philosophy

@Doc 采用：

> **Only Known Commands Trigger Parsing**

只有已知指令具有语法意义。

未知指令永远视为普通文本。

此设计目标：

* 降低学习成本
* 避免与 Email、Mention 系统冲突
* 提高 AI 解析稳定性
* 提高编辑器容错能力
* 保持 DSL 的可扩充性
* 创建稳定且可预测的 AST

---

## 2. Lexer 行为定义

### 指令解析规则

当 Lexer 扫描到 `@` 时，应依照以下优先级处理：

1. 若后续为 `@@`

   * 解析为单一纯文本 `@`

2. 若后续符合已注册之指令名称

   * 进入对应语法解析流程

3. 若不符合任何已知指令

   * 整段视为普通文本输出

---

### 范例

| 输入                 | 结果            |
| ------------------ | ------------- |
| `@mark[hello]`     | 解析为 `mark` 节点 |
| `@@mark`           | 输出 `@mark`    |
| `test@example.com` | 纯文本           |
| `@GitHub`          | 纯文本           |
| `@unknown`         | 纯文本           |

---

## 3. Ambiguity Resolution Rule

由于 @Doc 采用：

> Known Command Recognition

因此 Lexer 必须先尝试辨识已知指令，再退回普通文本模式。

换句话说：

> `inline-node` 的优先权高于 `plain-text-char`。

Lexer 必须遵循：

```text
@ 开头
↓
是否为 @@ ?
↓
是否存在于 Command Registry ?
↓
是 → Inline Node
否 → Plain Text
```

因此：

```text
@mark[hello]
```

必须解析为：

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

## 4. 完整 EBNF 语法定义

```ebnf
(* ==========================================================================
   Entry Point
   ========================================================================== *)

inline-stream =
    { inline-node | plain-text-char } ;

inline-node =
      mark
    | color
    | bordered
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
(* @bordered shares @color's exact {styles} slot and swatch (see §7),
   applied as a text border instead of a foreground color. *)
bordered  = "@bordered" , [ styles ] , content ;
bold      = ( "@bold" | "@b" ) , content ;
italic    = ( "@italic" | "@i" ) , content ;
underline = ( "@underline" | "@u" ) , content ;
del       = "@del" , content ;

raw       = "@raw" , raw-content ;

sup       = "@sup" , content ;
sub       = "@sub" , content ;

(* Footnotes:
   fn   = 正文中的引用点（角标），只带编号
   defn = 脚注定义本体，带编号与实际内容
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

(* raw-content 的实际终止规则是「方括号深度计数」，不是「遇到第一个未跳脱
   的 ]」——balanced-bracket-group 用递归产生式表达「内部只要左右括号成对，
   可以随意嵌套，完全不需要跳脱」；只有真正不成对的方括号才需要跳脱。
   详见 9. @raw Opaque Domain。*)
raw-content =
    "[" , { raw-unit } , "]" ;

raw-unit =
      escaped-at-close-bracket   (* "@@]" → 字面 "@]" *)
    | escaped-at-open-bracket    (* "@@[" → 字面 "@[" *)
    | escaped-close-bracket      (* "@]"  → 字面 "]"（仅用于不成对的 ]） *)
    | escaped-open-bracket       (* "@["  → 字面 "["（仅用于不成对的 [） *)
    | balanced-bracket-group     (* 成对、可嵌套的字面方括号，内容不受限 *)
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

(* Lexer 额外收敛：`text-char` 本身包含换行，字面解读等于「未闭合的 "{" 可以
   一路吞到文档后面任何一个 "}"」——作者还在打字的 "{" 会把中间所有节点
   （例如底下 @code 区块里的大括号之前的一切）整段吃进 styles，从 AST 静默
   消失。styles 实际语意是一小串逗号分隔 token，没有任何范例跨行，编辑器的
   Monarch 规则（/\{[^}]*\}/，逐行比对）本来也不支持跨行，因此 Lexer 在
   "}"、行尾、"["（内容槽开始）三者中最先出现的位置停止扫描，行尾与 "[" 两种
   情况视为未闭合。见 src/Lexer.ts 的 scanStylesEnd()。 *)
styles =
    "{" ,
        { text-char - "}" - newline - "[" } ,
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

### 语法

```text
@@
```

### 输出

```text
@
```

### 用途

当用户需要输出语法关键字本身时使用。

> 此为**全域转义规则**，适用于一般 inline-stream 上下文。
> `@raw` 内部有独立的转义规则，请参见 [9. @raw Opaque Domain](#9-raw-opaque-domain)。

---

### 范例

输入：

```text
@@mark
```

输出：

```text
@mark
```

---

输入：

```text
@@bold[hello]
```

输出：

```text
@bold[hello]
```

---

输入：

```text
Email: test@@example.com
```

输出：

```text
Email: test@example.com
```

虽然此写法合法，但由于：

```text
example
```

并非已知指令，因此实际上可直接写：

```text
Email: test@example.com
```

而不需要跳脱。

---

## 6. Unknown Command Fallback

若 `@` 后方并非合法指令名称，解析器必须退回纯文本模式。

范例：

```text
@github
```

输出：

```text
@github
```

---

```text
test@example.com
```

输出：

```text
test@example.com
```

---

```text
@my_custom_tag
```

输出：

```text
@my_custom_tag
```

---

此规则能有效避免与：

* Email
* 社群帐号
* Discord Mention
* GitHub Username
* Chat Mention System

发生冲突。

---

## 7. @mark / @color / @bordered Styles Semantics

`@mark` 支持可选的 `styles` 修饰语法：

```text
@mark{style}[content]
```

其中：

* `style` 为以逗号分隔的样式标记字符串（style token list）。
* `content` 为被标记的文本内容。
* `styles` 为**可选**（optional）语法，省略时等同纯粹的高亮标记：

```text
@mark[重要内容]
```

---

### Style Token 语意

`style` 内容为以逗号分隔的**颜色 Token（Color Token）**字符串，代表高亮色彩，Renderer 依语意对应到实际颜色值。支持两种写法，可择一使用：

* **具名 Token**（Renderer 自订实际色值）：

  ```text
  yellow / red / green / blue / orange / purple / gray
  ```

* **16 进位 Hex Token**（`#` 开头、6 位十六进位数字，大小写皆可，Renderer MUST 直接使用指定值，不得再映射）：

  ```text
  #ff0000 / #3366FF / #00c896
  ```

  格式不符 `/^#[0-9a-fA-F]{6}$/` 的 token（例如 `#f00`、`#gggggg`）不视为合法 hex token，
  依一般规则走 Unknown Command Fallback 的容错精神（见下方 Renderer 行为）。

> **变更记录**：先前版本另定义了 `underline`／`strikethrough`／`bordered` 三个修饰 Token，已移除。`underline` 与 `@underline` 节点语意重复；`strikethrough` 与 `@del` 节点语意重复；`bordered` 已升格为独立节点 `@bordered`（见下方）。`style` 现在只承载颜色语意，不再混用修饰语意。

---

### 范例

```text
@mark[缺省高亮]
@mark{yellow}[黄色高亮]
@mark{red}[红色高亮]
@mark{#3366ff}[16 进位背景色]
```

---

### @color — 文本改色

`@mark` 改变的是**背景**（高亮），无法改变文本本身的颜色。`@color` 补上这个能力：

```text
@color{#ff0000}[这段文本是红色的]
```

`@color` 与 `@mark` 共用同一个 `{styles}` 字段（见上方 EBNF），本身为**选填**——
省略时 Renderer 退回缺省色，行为与 `@mark[content]` 省略 `{styles}` 时相同。

```text
@color{blue}[这段文本是深蓝色的]
```

`@color` 接受与 `@mark` 相同的七个具名 color token（`yellow`／`red`／`green`／`blue`／
`orange`／`purple`／`gray`），也接受单一 16 进位 hex token（`/^#[0-9a-fA-F]{6}$/`）。
两者语法上共用同一组 token 名称，但**对应的实际色值各自独立**：`@mark` 的色阶是为
浅色高亮背景调校的，直接当作文本前景色会对比度不足、难以阅读，因此 Renderer
通常会维护一份色调较深、专门给 `@color` 用的对照表（而不是重用 `@mark` 那份）。
Renderer MUST 忽略格式不符或无法识别的值并以某种默认值作为 fallback，而非抛出错误：

```text
@color{not-a-color}[这段没有指定颜色，优雅地退回缺省色]
```

> [!IMPORTANT]
> **旧语法已停用**：`@color` 早期版本使用必填的 `(hex-color)` 括号（`@color(#ff0000)[...]`）。
> 那个语法已经移除，不是「忽略后退回默认值」，而是 Parser MUST 直接抛出语法错误
> （Strict Mode）或标记为诊断（Editor Mode）——因为括号写法会让作者误以为颜色有生效，
> 实际上却静默套用了缺省色，这种「看起来设置成功、实际上没有」的落差比直接报错更危险，
> 不适用 [6. Unknown Command Fallback](#6-unknown-command-fallback) 的容错精神。

---

### @bordered — 文本外框

`@bordered` 为文本加上外框，与 `@color` 共用完全相同的 `{styles}` 字段——同样的括号、同样选填、同样的七个具名 token 加 hex，也共用同一份色票对照表（实作上可直接重用 `@color` 的 resolver），只是套用在**外框**而非文本色：

```text
@bordered[缺省外框]
@bordered{blue}[蓝色外框]
@bordered{#3366ff}[16 进位外框色]
```

省略 `{styles}` 或给出无法识别的值时，Renderer 以其缺省外框样式作为 fallback，而非抛出错误，呼应 §6 Unknown Command Fallback 的容错精神。此节点取代了 `@mark` 先前 `{styles}` 中的 `bordered` 修饰 token，成为独立的第一级节点，与 `underline`（已有 `@underline`）、`strikethrough`（已有 `@del`）的角色一致。

---

### Renderer 行为

* Renderer MUST 至少支持 `styles` 省略时的缺省高亮样式（`@mark`）／缺省外框样式（`@bordered`）。
* Renderer MAY 自行决定各具名 color token 对应的实际色值（例如深色模式与浅色模式下的 `yellow` 可不同；`@mark` 与 `@color`／`@bordered` 也可以、通常也应该各自维护不同的对照表，理由见上）；16 进位 hex token 则 MUST 直接使用指定值，不得重新映射。
* Renderer MUST 忽略无法识别的 token（包含格式不符的 hex token），并 SHOULD 以某种默认值作为 fallback，而非抛出错误——此行为与 [6. Unknown Command Fallback](#6-unknown-command-fallback) 中「未知指令退回纯文本」的容错精神一致，但作用范围限定在 `styles` 内部，`@mark[content]`／`@color[content]`／`@bordered[content]` 本身仍会被正常解析为对应节点。fallback 的具体样子由 Renderer 自行决定：可以是「无额外颜色」（沿用缺省文本色／外框色），也可以比照 `@mark` 省略 `styles` 时的缺省高亮色再利用一次（三者共用同一个字段形状，这么做在视觉上是自然的）。
* Token 之间的分隔符固定为半角逗号 `,`，前后允许任意数量空白（Parser 应自动 trim）。此规则适用于 `@mark` 的 `styles`；`@color`／`@bordered` 的 `{}` 内只允许单一 token（color token 或 hex 值），不使用逗号分隔。

---

### EBNF 补充说明

对应 [4. 完整 EBNF 语法定义](#4-完整-ebnf-语法定义) 中：

```ebnf
(* Lexer 额外收敛：`text-char` 本身包含换行，字面解读等于「未闭合的 "{" 可以
   一路吞到文档后面任何一个 "}"」——作者还在打字的 "{" 会把中间所有节点
   （例如底下 @code 区块里的大括号之前的一切）整段吃进 styles，从 AST 静默
   消失。styles 实际语意是一小串逗号分隔 token，没有任何范例跨行，编辑器的
   Monarch 规则（/\{[^}]*\}/，逐行比对）本来也不支持跨行，因此 Lexer 在
   "}"、行尾、"["（内容槽开始）三者中最先出现的位置停止扫描，行尾与 "[" 两种
   情况视为未闭合。见 src/Lexer.ts 的 scanStylesEnd()。 *)
styles =
    "{" ,
        { text-char - "}" - newline - "[" } ,
    "}" ;
```

`styles` 本身在词法层级仅定义为「花括号包裹的任意字符串行」，实际的 token 切分（以逗号分隔、辨识 color token 与 modifier token）属于**语意层级（semantic level）**的处理，非 Lexer/Parser 的语法层责任，而是留给 Renderer 或后续语意分析阶段完成。这样设计可确保：

* 添加 style token（例如未来加入 `italic`、`bold` 等）不需要修改 EBNF 语法定义本身。
* 不同 Renderer 可自行扩充或裁剪其支持的 token 集合，符合 [1. Design Philosophy](#1-design-philosophy) 中「保持 DSL 的可扩充性」的目标。

---

## 8. @link URI Semantics

`@link` 接受任何合法 URI 或 URI-like Identifier。

```text
@link(uri)[content]
```

其中：

* `uri` 为目标资源识别符。
* `content` 为显示文本。

---

### Renderer URI Inference

Renderer MAY 根据 `uri` 的内容自动推导 URI Scheme。

例如：

| 输入                             | Renderer 实际 URI           |
| ------------------------------ | ------------------------- |
| `@link(example.com)[官方网站]`     | `https://example.com`     |
| `@link(test@example.com)[联系我]` | `mailto:test@example.com` |
| `@link(+886912345678)[客服电话]`   | `tel:+886912345678`       |

---

若 `uri` 已明确指定 Scheme：

```text
@link(https://example.com)[官方网站]
@link(mailto:test@example.com)[联系我]
@link(tel:+886912345678)[客服电话]
```

Renderer MUST 直接使用指定值，不得进行推导或修改。

---

### Supported URI Examples

以下皆属合法 `uri`：

```text
https://example.com
mailto:test@example.com
tel:+886912345678
ftp://example.com/file.zip
discord://channel/123
vscode://file/path
file:///tmp/test.txt
```

@Doc 本身不限制 URI 类型。

URI 的实际支持能力由 Renderer 决定。

---

## 9. @raw Opaque Domain

`@raw` 属于：

> Opaque Domain

解析器进入：

```text
@raw[
```

之后：

* 不解析任何内部语法。
* 所有 `@mark`、`@bold`、`@link` 等关键字皆视为纯文本。
* 全域 `@@` 转义规则（[5. Escape Rule](#5-escape-rule)）不再适用，raw 域内是独立的一套局部规则（见下方）。

### 终止规则：方括号深度计数，不是「遇到第一个 `]`」

`@raw[...]` 的实作模型是**方括号深度计数**，这点必须先讲清楚，因为它直接决定了跳脱规则什么时候该用、什么时候不该用：

* `[` 让深度 +1，`]` 让深度 -1；深度归零的那个 `]` 才是真正的结尾。
* 换句话说，**只要方括号成对，可以直接照抄，完全不需要跳脱**——`@raw[@mark[hello]]` 里的 `@mark[hello]` 本身左右括号成对，Parser 会正确在最外层那个 `]` 结束，输出 `@mark[hello]` 原样文本。
* 跳脱规则的存在，是专门给**不成对**的方括号用的——例如只想写一个单独的字面 `]`、或引用一段本身括号不平衡的内容片段。如果对一个本来就成对的方括号多加跳脱（例如把 `@mark[hello]`的结尾写成 `@mark[hello@]`），跳脱消耗掉的 `]` **不会**让深度计数归零，于是前面 `@mark[` 那个 `[` 造成的深度 +1 永远找不到对应的 `]` 抵销，Parser 只能继续往后找，直到把外层更多内容（甚至整份文档）都吞下去才会出错。**平衡的括号直接写；不平衡的括号一律跳脱；转义字符不参与深度计数。**

跳脱规则是对称的——`]` 和 `[` 各自都有「单字符跳脱」与「跳脱『@』本身后面接该字符」两种，共四条，扫描时依下列优先序比对（长的、更明确的串行优先）：

| 优先序 | 输入   | 输出   | 说明                          |
| ------ | ------ | ------ | ----------------------------- |
| 1      | `@@]`  | `@]`   | 输出字面 `@]` 两个字符         |
| 2      | `@@[`  | `@[`   | 输出字面 `@[` 两个字符         |
| 3      | `@]`   | `]`    | 输出**不成对**的字面 `]`（不影响深度计数） |
| 4      | `@[`   | `[`    | 输出**不成对**的字面 `[`（不影响深度计数） |

---

### 范例

输入：

```text
@raw[@mark[hello]]
```

输出：

```text
@mark[hello]
```

> 说明：`@mark[hello]` 本身括号成对，深度计数会 1→2→1，最外层那个 `]` 才让深度归零并结束 `@raw`。**不需要任何跳脱**——这是最常见的用法（在 raw 内容里示范一段完整、括号平衡的 @Doc 语法）。

---

输入：

```text
@raw[@@]
```

输出：

```text
@@
```

> 说明：此处 `@@` 后方紧接的是 raw-content 的结尾 `]`，
> 因此并未触发 `@@]` 特例（`@@]` 须为连续三字符），
> 应拆解为：一般字符 `@@`（原样输出，因全域转义已停用）+ 结尾 `]`。

---

输入：

```text
@raw[今天我怕@]被侦测]
```

输出：

```text
今天我怕]被侦测
```

> 说明：这里的 `@]` 是一个**不成对**的字面 `]`（前面没有对应的 `[`），必须跳脱，否则它会被当成 `@raw` 自己的结尾，让后面的「被侦测」跑到 raw 内容之外。

---

输入：

```text
@raw[今天我怕@@]被侦测]
```

输出：

```text
今天我怕@]被侦测
```

> [!TIP]
> **TIP**：如果用户想在 raw 内容里输出 `@]` 这 2 个字符，
> 只要在前面再加一个 `@`（即 `@@]`）即可，这是 raw 域内的局部转义特例，
> 与第 5 节的全域 `@@` 转义规则彼此独立，互不影响。`@[`／`@@[` 是完全对称的另一组，规则相同，只是方向相反（处理不成对的字面 `[`）。

---

输入（跳脱用在不该用的地方——**反例**）：

```text
@raw[这里的 @mark[hello@] 保持原样]
```

> [!WARNING]
> **不要这样写**：`@mark[hello` 的 `[` 已经让深度 +1，作者原意只是想让 `@mark[hello]` 原样输出（跟上面第一个范例一样，括号本来就成对，完全不需要跳脱），却在结尾多打了一个跳脱符 `@]`。跳脱消耗掉那个 `]` 却不参与深度计数，于是 `@mark[` 造成的深度 +1 永远找不到对应的 `]` 抵销——Parser 会一路往后找，直到吃掉外层更多内容甚至整份文档才报错。正确写法是拿掉多余的 `@`，直接写 `@raw[这里的 @mark[hello] 保持原样]`——括号成对，Parser 自己就能正确配对，不需要人工介入。

### 渲染语义：行内代码

以上规则定义的是 **Parser 行为**（内容不解析、原样保留）。渲染端的对应语义是**行内代码**——与 Markdown 的反引号 `` `code` `` 是同一件事：

* Renderer **SHOULD** 将 `@raw` 输出为等宽（monospace）行内元素。HTML Route 使用 `<code>`。
* 这与 `@code` 区分开来：`@code` 是**区块**（HTML 为 `<pre><code>`），`@raw` 是**行内**。
* 也与 `@kbd` 区分开来：`@kbd` 表示实体按键，惯例上带边框与键帽外观；`@raw` 是代码文本，只需等宽与底色。
* Renderer 不得因此解析内容——渲染语义的加入不改变 opaque domain 的解析规则。

> 为何是 `@raw` 而不是另立节点：`raw-escaped` 是全语言唯一具备正规转义机制（`@]` / `@[` 加方括号深度计数）的内容模式，而「内容不得被解析」正是行内代码的定义性需求。两者的使用情境几乎完全重叠——本节上方每一个示例都在展示代码。

---

## 10. Nested Parsing

由于：

```ebnf
content-element =
      inline-node
    | plain-text-char ;
```

因此 @Doc 支持完整递归嵌套。

例如：

```text
@bold[
    这是粗体，
    里面有
    @mark{yellow}[重要高亮]
    与
    @underline[底线]
]
```

其 AST 结构为：

```text
Bold
├── Text
├── Mark
└── Underline
```

---

## 11. Parser Recovery Strategy

当 Parser 遇到未闭合结构时：

```text
@bold[hello
```

或：

```text
@mark{red}[hello
```

建议提供两种模式：

### Strict Mode

直接抛出语法错误：

```text
Unexpected EOF while parsing @bold
```

> [!TIP]
> **TIP**：AtDoc 选择直接抛出语法错误，并使用异步错误断点修复机制

---

### Editor Mode

允许编辑器自动补全缺失闭合符号：

```text
]
```

以提升即时编辑体验。

---

## 12. Architecture

推荐解析流程：

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

Renderer 可以自由输出：

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

@Doc 的核心目标并非取代 Markdown。

而是创建：

> Human Editable
> Machine Deterministic
> AI Friendly
> Cross Platform

的新一代文档中介格式。

---

## 14. Simplified Syntax Aliases

`@bold`／`@italic`／`@underline` 提供简化别名 `@b`／`@i`／`@u`——纯粹是输入时的简写，Parser 会将其范式为正典名称后才创建 AST 节点（`node.type` 永远是正典名称），Renderer 完全不需要、也不会区分作者实际输入的是哪一种写法。

| Canonical | Alias |
|---|---|
| `@bold` | `@b` |
| `@italic` | `@i` |
| `@underline` | `@u` |

（Block Syntax 的 `@heading`/`@paragraph` 别名 `@h`/`@p` 定义在 Block Syntax Specification §11。）