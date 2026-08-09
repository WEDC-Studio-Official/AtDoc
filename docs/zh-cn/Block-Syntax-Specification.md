# @Doc Block Syntax Specification v1.4

> 🌐 其他语言版本：[English](../en/Block-Syntax-Specification.md) ・ [繁體中文](../zh-tw/Block-Syntax-Specification.md) ・ [日本語（AI 翻译，可能有误）](../ja/Block-Syntax-Specification.md) ・ [한국어（AI 번역，可能有误）](../ko/Block-Syntax-Specification.md)

## 0. Table of Contents

* [1. Design Philosophy](#1-design-philosophy)
* [2. Document AST Structure](#2-document-ast-structure)
* [3. EBNF](#3-ebnf)
* [4. Shared Components](#4-shared-components)
* [5. Structural Blocks](#5-structural-blocks)
* [6. Container Blocks](#6-container-blocks)
* [7. Callout Blocks](#7-callout-blocks)
* [8. Widget Blocks](#8-widget-blocks)
* [9. Metadata](#9-metadata)
* [10. Core Principle](#10-core-principle)
* [11. Simplified Syntax Aliases](#11-simplified-syntax-aliases)

---

## 1. Design Philosophy

@Doc Block Syntax 采用：

> **Semantic First, Layout Later**

区块节点描述的是：

> 文档的语意（What）

而不是：

> 呈现方式（How）

因此 @Doc 不提供：

* `@div`
* `@span`
* `@flex`
* `@grid`
* `@row`
* `@col`
* `@class`
* `@style`

Renderer 可以根据平台自由决定：

* HTML
* React
* PDF
* DOCX
* Discord
* Terminal
* Notion
* AI UI

---

## 2. Document AST Structure

```text
Document AST
│
├── Metadata
│   └── @meta
│
├── Block Nodes
│   │
│   ├── Structural Blocks
│   │   ├── @heading (alias: @h)
│   │   ├── @paragraph (alias: @p)
│   │   ├── @quote
│   │   ├── @list
│   │   ├── @code
│   │   ├── @img
│   │   ├── @table
│   │   ├── @hr
│   │   └── @svg
│   │
│   ├── Container Blocks
│   │   ├── @details
│   │   └── @card
│   │
│   ├── Callout Blocks
│   │   ├── @note
│   │   ├── @tip
│   │   ├── @important
│   │   ├── @warning
│   │   └── @caution
│   │
│   └── Widget Blocks
│       ├── @tabs
│       ├── @tab
│       └── @mermaid
│
└── Inline Nodes
    │
    ├── Text Formatting
    │   ├── @mark
    │   ├── @color
    │   ├── @bordered
    │   ├── @bold (alias: @b)
    │   ├── @italic (alias: @i)
    │   ├── @underline (alias: @u)
    │   ├── @del
    │   └── @raw
    │
    ├── Semantic Inline
    │   ├── @sup
    │   ├── @sub
    │   ├── @kbd
    │   └── @link
    │
    ├── Footnotes
    │   ├── @fn
    │   └── @defn
    │
    └── Special Nodes
        ├── @n
        └── @@
```

---

## 3. EBNF

```ebnf
document =
    [ metadata ],
    { block-node } ;

block-node =
      heading
    | paragraph
    | quote
    | list
    | code
    | image
    | table
    | hr
    | svg
    | details
    | card
    | note
    | tip
    | important
    | warning
    | caution
    | tabs
    | mermaid ;

(* Note:
   `tab` 不属于 block-node。
   它是 @tabs 专属的子节点语法，只能出现在 tabs-content 内，
   详见下方 "Widget-Specific Grammar: @tabs"。
*)

metadata =
    "@meta" , meta-content ;

(* meta-content is lexed the same way as block-content — the "[" / "]" pair
   tokenizes normally, so an unregistered "@word" still falls back to plain
   text per §6 Unknown Command Fallback — but Parser.ts is semantically
   stricter here than for any other block node: it rejects every registered
   node inside @meta, not just structural ones, not even @n or @raw. The
   parser then splits the resulting text on newlines and the first "=" on
   each line into key/value pairs and stores them directly on the AST node
   (MetaNode.meta), rather than leaving that structuring to a later pass.
   See Metadata.md §3/§6 for the full behavior and worked examples. *)
meta-content =
    "[" ,
        { text } ,
    "]" ;

heading =
    ( "@heading" | "@h" ) ,
    [ "(" , level , ")" ] ,
    block-content ;

paragraph =
    ( "@paragraph" | "@p" ) , block-content ;

quote =
    "@quote" , block-content ;

list =
    "@list" ,
    [ "(" , "ordered" , ")" ] ,
    block-content ;

code =
    "@code" ,
    [ language ] ,
    raw-block-content ;

image =
    "@img" ,
    "(" ,
        image-option-list ,
    ")" ,
    [ styles ] ,
    block-content ;

hr =
    "@hr" ;

svg =
    "@svg" ,
    raw-block-content ;

details =
    "@details" ,
    [ title ] ,
    [ styles ] ,
    block-content ;

card =
    "@card" ,
    [ title ] ,
    [ styles ] ,
    block-content ;

note =
    "@note" ,
    [ title ] ,
    [ styles ] ,
    block-content ;

tip =
    "@tip" ,
    [ title ] ,
    [ styles ] ,
    block-content ;

important =
    "@important" ,
    [ title ] ,
    [ styles ] ,
    block-content ;

warning =
    "@warning" ,
    [ title ] ,
    [ styles ] ,
    block-content ;

caution =
    "@caution" ,
    [ title ] ,
    [ styles ] ,
    block-content ;

mermaid =
    "@mermaid" ,
    raw-block-content ;

(* ==========================================================================
   Structural-Specific Grammar: @img

   @img 的括号内容不是单一裸文本，而是以逗号分隔的
   key=value 选项列表（image-option-list），可扩充。
   第一个选项若省略 key，缺省视为 src。

   `image` 产生式（见上方）在 ")" 之后还有一个独立的选填 [styles]——
   Image Style v1，语法层与 image-option-list 完全无关（不能写进括号
   内），语意层见下方「Image Style v1」小节。
   ========================================================================== *)

image-option-list =
    image-option ,
    { "," , image-option } ;

image-option =
      src-option
    | width-option
    | height-option
    | align-option
    | radius-option
    | border-option ;

src-option =
    [ "src=" ] , url ;

width-option =
    "width=" , integer ;

height-option =
    "height=" , integer ;

align-option =
    "align=" , ( "left" | "center" | "right" ) ;

radius-option =
    "radius=" , text ;

border-option =
    "border=" , text ;

url =
    { text-char - "," - ")" } ;

(* ==========================================================================
   Widget-Specific Grammar: @table

   @table 不使用通用的 block-content，
   而是拥有专属的结构化语法（Columns + Rows）。
   ========================================================================== *)

table =
    "@table" , table-content ;

table-content =
    "[" ,
        cols ,
        data ,
    "]" ;

cols =
    "@cols" ,
    "[" ,
        column-list ,
    "]" ;

column-list =
    cell ,
    { "," , cell } ;

data =
    "@data" ,
    "[" ,
        { row } ,
    "]" ;

row =
    "[" ,
        cell ,
        { "," , cell } ,
    "]" ;

(* A cell isn't plain text only — it also allows a curated subset of
   inline-node (cell-inline-node), the same shape @cols columns and @data
   cells share. The authoritative allowlist lives in registry.ts's
   isCellAllowedNode(), not this grammar — a node outside that set (e.g.
   @card, @table, @details) MUST throw rather than being silently dropped,
   per Strict Mode (Inline Syntax Specification §11). *)
cell =
    { cell-inline-node | any-unicode-char - "," - "]" } ;

(* ==========================================================================
   Widget-Specific Grammar: @tabs / @tab

   @tab 仅能出现在 @tabs 的 tabs-content 内，
   不属于通用 block-node 集合，因此无法单独出现在
   document 顶层或其他 block-content 之中。
   ========================================================================== *)

tabs =
    "@tabs" , tabs-content ;

tabs-content =
    "[" ,
        { tab } ,
    "]" ;

tab =
    "@tab" ,
    "(" ,
        text ,
    ")" ,
    block-content ;
```

---

## 4. Shared Components

```ebnf
block-content =
    "[" ,
        { block-element } ,
    "]" ;

block-element =
      block-node
    | inline-stream
    | text ;

raw-block-content =
    "[" ,
        { any-unicode-char } ,
    "]" ;

title =
    "(" ,
        text ,
    ")" ;

language =
    "(" ,
        text ,
    ")" ;

level =
      "1"
    | "2"
    | "3"
    | "4"
    | "5"
    | "6" ;

text =
    { any-unicode-char } ;
```

> `integer`、`text-char` 等终结符定义沿用 Inline Spec 第 4 节
> （完整 EBNF 语法定义）中的 `integer` 与 `text-char` 产生式，
> 两份文档共用同一套字符集定义，此处不重复列出。
>
> `styles` 同样沿用 Inline Spec 第 4 节的 `styles` 产生式（`"{" , { text-char - "}" } , "}"`），
> 语法层仍只定义「花括号包裹的任意字符串行」；Container Blocks（`@details`、`@card`）、
> Callout Blocks（`@note`、`@tip`、`@important`、`@warning`、`@caution`）与 `@img`
> 现在正式将其列入各自的产生式中（见上方第 5–7 节），而不再只是 Parser 端未经 EBNF
> 明文允许的附带行为。
>
> **Token 语意是各节点自己的规则，不是单一共用表。** `@note`／`@tip`／`@important`／
> `@warning`／`@caution`／`@details` 沿用 Inline Spec 第 7 节 `@mark Styles Semantics`
> 的既有 color token 规则（具名 token 对照表 + hex 支持）；`@card` 与 `@img` 则各自是
> 独立的封闭 token 集合——分别是 `Card Style v1`（见下方第 6 节「Card Style v1」小节）
> 与 `Image Style v1`（见下方第 5 节「Image Style v1」小节），共用同一组 `#RRGGBB` /
> `radius-N` token 形状，但语意各自独立（`@card` 的 hex 是背景色，`@img` 的 hex 是外框
> 色）；两者都不沿用 Inline Spec 第 7 节的具名色票。
> Renderer 是否／如何把 Container／Callout／`@img` 的 `styles` 映射成视觉样式由各
> Renderer 自行决定。

---

## 5. Structural Blocks

### Heading

正典语法为 `@heading`；`@h` 是等效的简化别名（Simplified Alias），两者解析为同一个 AST 节点，Renderer 不会区分作者实际输入的是哪一种写法。

```text
@heading(1)[
Introduction
]

@h(1)[
Introduction
]
```

HTML（两种写法输出相同）：

```html
<h1>Introduction</h1>
```

---

### Paragraph

正典语法为 `@paragraph`；`@p` 是等效的简化别名。

```text
@paragraph[
Hello World
]

@p[
Hello World
]
```

HTML（两种写法输出相同）：

```html
<p>Hello World</p>
```

---

### Quote

```text
@quote[
Talk is cheap.
Show me the code.
]
```

HTML:

```html
<blockquote>
Talk is cheap.
Show me the code.
</blockquote>
```

---

### List

任何非空行都是一个项目；行首的 `- ` 为**选填**的向下兼容写法，Parser 会自动去除：

```text
@list[
Apple
Banana
Orange
]
```

等同于：

```text
@list[
- Apple
- Banana
- Orange
]
```

每个项目在 AST 中是一个独立的 `list-item` 节点（`node.items`），内容可包含行内节点（例如 `@bold`），不再只是纯文本：

```text
@list[
@bold[Apple] (今日特价)
Banana
]
```

AST:

```text
List
└── items
    ├── ListItem [ Bold("Apple"), " (今日特价)" ]
    └── ListItem [ "Banana" ]
```

> [!TIP]
> **TIP**：旧版语意要求「必须 `- ` 开头才算项目」，这与「换行即分段」的直觉不一致，
> 也导致每个 Renderer（Route A / Route B / ...）各自用字符串处理重新实作
> 一次列表切分逻辑。新语意由 Parser 统一产生 `ListItem` AST，Renderer 只需渲染
> 既有结构，不需要再自己切字符串。

#### 有序清单

`@list(ordered)[...]` 会渲染成 `<ol>` 而不是缺省的 `<ul>`。跟一般 `@list` 一样，行首的 `- ` 是选填、非必要——纯文本行也算一个项目；额外写 `N. `／`N)` 则是明确指定编号，Parser 会把这个数字存进该 `ListItem` 的 `marker` 字段；Renderer 只在 `ordered` 为真时才会把 `marker` 转成 `<li value="N">`，交给浏览器原生的 `<ol>` 计数器处理「跳号后自动接续」：

```text
@list(ordered)[
- Apple
- Banana
3. Cherry
- Date
]
```

渲染结果为 `1. Apple`、`2. Banana`、`3. Cherry`（明确指定）、`4. Date`（自动接续）。

#### 嵌套清单

没有添加语法——`@list` 的内容本来就是 `block-content`，嵌套 `@list[...]` 已经是合法的子节点。单独占一行的嵌套 `@list[...]`（前后只有空白）会被 Parser 并入**前一个** item 的内容，而不是另开一个新 item：

```text
@list[
- Fruits
  @list[
  - Apple
  - Banana
  ]
- Vegetables
]
```

AST 上，内层 `@list` 节点会出现在 `Fruits` 这个 `ListItem` 的 `content` 数组里；Renderer 不需要任何额外逻辑，递归渲染 `content` 时自然会产生嵌套的 `<ul>`/`<ol>`。
> 旧版文档曾提过用 `(modifier)` 数组（例如 `@list(bullet,number)[...]`）逐层声明清单型态的方案；上面这个 `@list(ordered)` + 嵌套子清单各自声明型态的设计，是实际采用、比该提案更简单的做法。

---

### Code

```text
@code(ts)[
const x = 1;
]
```

HTML:

```html
<pre><code class="language-ts">
const x = 1;
</code></pre>
```

---

### Image

`@img` 的括号内容为以逗号分隔的 key=value 选项列表（`image-option-list`），可扩充。第一个选项若省略 `key=`，缺省视为 `src`：

```text
@img(
https://example.com/logo.png
)[
WEDC Logo
]
```

等同于：

```text
@img(src=https://example.com/logo.png)[
WEDC Logo
]
```

搭配其他选项使用：

```text
@img(
https://example.com/logo.png,width=200,align=center
)[
WEDC Logo
]
```

目前支持的选项：

| 选项          | 说明                                | 范例值                    |
| ------------- | ----------------------------------- | -------------------------- |
| `src`（可省略）| 图片来源 URL                        | `src=https://...`         |
| `width`       | 显示宽度（单位由 Renderer 决定）     | `width=200`                |
| `height`      | 显示高度（单位由 Renderer 决定）     | `height=150`               |
| `align`       | 对齐方式                            | `align=left/center/right`  |
| `radius`      | 圆角（直接透传给 Renderer 的 CSS 值）| `radius=8px`               |
| `border`      | 外框（直接透传给 Renderer 的 CSS 值）| `border=1px solid #ccc`    |

> [!TIP]
> **TIP**：这里的扩充方式与 Inline Spec 第 7 节 `@mark Styles Semantics`
> 是同一套设计哲学——语法层只定义「括号内是逗号分隔的选项列表」，
> 实际的 key 集合属于语意层，未来添加选项（例如 `alt`、`loading`）
> 不需要修改 EBNF 本身。Renderer MUST 忽略无法识别的 key，
> 并 SHOULD 以「仅套用 `src`」作为 fallback，而非抛出错误。

#### Image Style v1

`@img(...)` 后面可以再接一个选填的 `{styles}`（语法定义见第 4 节），与
`@card` 共用同一套 **Card Style v1** token 形状（`#RRGGBB` / `radius-N`），
但语意独立、自成一套封闭 token 集合——**不沿用** Inline Spec 第 7 节的
具名色票，也**不是** `image-option-list` 的一部分（不能写在 `(...)` 括号
内）：

| Token 形状 | 语意 | 范例 |
|---|---|---|
| `#RRGGBB`（16 进位 hex） | 外框色，套用为 1px 实线外框 | `@img(src=...){#3366ff}[...]` → `border: 1px solid #3366ff` |
| `radius-N`（N 为非负整数） | 圆角，`N` 为像素值 | `@img(src=...){radius-12}[...]` → `border-radius: 12px` |

```text
@img(src=https://example.com/photo.jpg){#3366ff,radius-12}[
WEDC Photo
]
```

省略 `{styles}` 时是纯粹的裸 `<img>`，不会有任何缺省圆角或外框——这跟
`@card` 通常有 Renderer 自己的静态默认值可覆盖不同，`{styles}` 对 `@img`
而言是纯粹的「选填」开关，而非「覆盖缺省」。

> [!NOTE]
> **NOTE**：`radius`/`border` 这两个既有的 `(...)` 选项（见上表）仍然有效，
> 是给需要任意 CSS 值（例如 `border=2px dashed red`）的情境用的逃生口；
> `{styles}` 则是跨平台、封闭 token 集合的简化写法。两者同时出现时，
> Renderer SHOULD 让 `{styles}` 覆盖对应的 `(...)` 选项（`{radius-N}` 盖过
> `radius=`、`{#RRGGBB}` 盖过 `border=`），而非两者叠加或抛出错误。

---

### Table

`@table` 内部结构固定为 `@cols` + `@data` 两个专属子节点，**顺序固定，两者皆为必填**：

```text
@table[
    @cols[id,name,price]

    @data[
        [1,早餐,60]
        [2,午餐,80]
        [3,晚餐,90]
    ]
]
```

* `@cols[...]`：以逗号分隔的字段标题列表，定义字段顺序与数量；每个字段跟 `@data` 的保存格一样是 `cell`（见下方），不限于纯文本识别符。
* `@data[...]`：每一列包装在 `[...]` 中，`cell` 数量 SHOULD 与 `@cols` 定义的字段数量一致；Parser MAY 对数量不符的列抛出警告或错误（由 Strict / Editor Mode 决定，参见 Inline Spec 第 11 节 Parser Recovery Strategy）。

> [!TIP]
> **TIP**：`@cols` 与 `@data` 顺序固定且皆为必填，这是刻意的设计取舍——
> 牺牲一点灵活性，换取 Parser 与 AI 生成内容时的高度可预测性。

每个 `cell` 不是单纯的纯文本——除了文本本身，还允许一组经过筛选的行内格式节点（`@bold`、`@italic`、`@underline`、`@del`、`@mark`、`@color`、`@sup`、`@sub`、`@link`、`@fn`，以及会被转成换行的 `@n`），因为这些节点只改变文本的呈现方式，不会影响表格本身「字段对齐数据列」的结构。这份清单由 Renderer 端维护（`registry.ts` 的 `isCellAllowedNode`），语法层本身不限制清单内容，未来可以扩充。不在清单上的节点（例如 `@card`、`@table`、`@details` 这类会带来自己版面结构的区块节点）MUST 抛出语法错误，而不是被静默舍弃——这与 Strict Mode（Inline Syntax Specification 第 11 节）「宁可抛错，也不要吞掉错误内容」的精神一致。

> [!NOTE]
> **例外**：raw 家族节点（`@code`、`@mermaid`、`@raw`、`@kbd`）也不在 `isCellAllowedNode` 的清单上，但它们既不是「会带来自己版面结构的区块节点」，也不适用上面的 MUST 抛错规则——`Parser.ts`（`parseInlineCellList`）刻意把它们的原始内容拉平成保存格里的纯文本，而不是抛错或当成真正的节点解析。这是跟 `@card`/`@table`/`@details` 那类结构节点分开处理的独立行为，细节见 `registry.ts`（`CELL_ALLOWED_INLINE` 上方注解）与 `Parser.ts`（`parseInlineCellList` 上方注解）。

```text
@table[
    @cols[id,name,note]

    @data[
        [1,@bold[Alice],See @link(https://example.com)[profile]@n more info]
    ]
]
```

AST:

```text
Table
├── Columns
│   ├── id
│   ├── name
│   └── price
└── Rows
    ├── Row [1, 早餐, 60]
    ├── Row [2, 午餐, 80]
    └── Row [3, 晚餐, 90]
```

或是带行内格式的保存格：

```text
Table
├── Columns
│   ├── id
│   ├── name
│   └── note
└── Rows
    └── Row [
          "1",
          [ Bold("Alice") ],
          [ "See ", Link("https://example.com", "profile"), "\n", " more info" ]
        ]
```

---

### Horizontal Rule

```text
@hr
```

HTML:

```html
<hr>
```

---

### SVG

`@svg` 与 `@code`／`@mermaid` 同属 `raw-block-content`——内容原样保留，Parser 不解析、不转义：

```text
@svg[
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <circle cx="5" cy="5" r="4" />
</svg>
]
```

> [!TIP]
> **TIP**：`@svg` 的内容是**信任边界**——它会被 Renderer 原样输出成浏览器实际渲染
> 的矢量图，而不是像 `@code` 一样显示成文本。Renderer SHOULD 在输出前过滤掉
> `<script>` 与 `on*=` 事件属性（见 Adapters.ts 的 `sanitizeSvg()`），但这是
> Renderer 职责，不是语法层保证；来源不可信的 `@svg` 内容仍应在更早的阶段
> 做内容审核。

---

## 6. Container Blocks

`@details`／`@card` 现在也接受**选填**的 `{styles}`（语法定义见第 4 节），置于
`(title)` 之后、`block-content` 之前：

```text
@card(API Key){#3366ff,radius-12}[
这里放说明内容。
]
```

省略时维持纯内容形式，两者皆合法。Renderer MAY 忽略无法识别的 token
（与 Inline Spec §6 Unknown Command Fallback 精神一致）。`@card` 的 `{styles}`
token 语意是自己的一套封闭规则（`Card Style v1`），与 Inline Spec 第 7 节的具名
color token 对照表无关——见下方「Card Style v1」小节。

### Details

```text
@details(展开更多信息)[
内容
]
```

HTML:

```html
<details>
    <summary>展开更多信息</summary>
    内容
</details>
```

---

### Card

```text
@card(API Key)[
这里放说明内容。
]
```

#### Card Style v1

`@card` 的 `{styles}` 只允许少量、跨平台且高价值的样式，刻意不做成通用 CSS
逃生口——目前只认以下两种 token 形状，可各自单独出现、两者并用（逗号分隔、
顺序不拘），或整段省略：

| Token 形状 | 语意 | 范例 |
|---|---|---|
| `#RRGGBB`（16 进位 hex） | 背景色，直接采用该色值 | `@card{#3366ff}[...]` → `background-color: #3366ff` |
| `radius-N`（N 为非负整数） | 圆角，`N` 为像素值 | `@card{radius-12}[...]` → `border-radius: 12px` |

```text
@card{#3366ff,radius-12}[
同时设置背景色与圆角。
]
```

不在上表中的 token（例如具名色彩词、Inline Spec 第 7 节的 color token）一律
视为无法识别，Renderer MUST 忽略而非抛错（与 Inline Spec §6 Unknown Command
Fallback 精神一致），并沿用 Renderer 自己的缺省外观。`radius-N` 的 `N` 若不是
纯数字（例如 `radius-lg`）同样视为无法识别。

---

## 7. Callout Blocks

`@note`、`@tip`、`@important`、`@warning`、`@caution` 皆可搭配**选填**的 `(title)`（定义见第 4 节），为内容附加一个独立于本文的标题字段；亦可搭配**选填**的 `{styles}`（见第 4 节、第 6 节 Container Blocks 的同一套说明），置于 `(title)` 之后；两者皆省略时则维持纯内容形式，皆合法：

### Note

```text
@note[
这是一般信息。
]
```

---

### Tip

```text
@tip[
这是一个最佳实践建议。
]
```

---

### Important

```text
@important[
请优先阅读此内容。
]
```

---

### Warning

```text
@warning[
删除后将无法复原。
]
```

搭配标题：

```text
@warning(数据保留政策)[
删除后将无法复原。
]
```

---

### Caution

```text
@caution[
此操作可能造成数据遗失。
]
```

---

## 8. Widget Blocks

### Tabs

`@tabs` 内部**仅能**包含一个或多个 `@tab` 子节点，不接受其他 block-node 或裸文本：

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

* `@tab(标题)[内容]`：`标题` 为分页显示名称，`内容` 为完整 `block-content`（可包含任意 block-node 与 inline-stream）。
* 若 `@tabs[...]` 内出现非 `@tab` 的节点（例如裸文本或其他 block-node），Parser MUST 视为语法错误（Strict Mode）或由 Editor Mode 自动忽略 / 提示修正。

> [!TIP]
> **TIP**：`@tab` 之所以不并入 `block-node`，是为了避免它被误用在
> `@tabs` 以外的地方（例如直接放在文档顶层）。这与 Inline Spec 中
> `@raw` 的 Opaque Domain 设计精神类似：特定语法只在特定上下文中有效。

---

### Mermaid

```text
@mermaid[
graph TD
A --> B
]
```

---

## 9. Metadata

```text
@meta[
title = @Doc
author = WEDC
description = AI Native Document Format
keywords = parser,ast,dsl
]
```

Renderer 可映射至：

* HTML Meta Tags
* OpenGraph
* PDF Metadata
* DOCX Properties
* Search Index
* RAG Metadata

---

## 10. Core Principle

@Doc Block Syntax 的目标并非创建新的 HTML。

而是创建：

> Human Editable
> Machine Deterministic
> AI Friendly
> Cross Platform

的文档 AST。

HTML 是 Renderer。

Markdown 是 Renderer。

React 是 Renderer。

而 @Doc 是：

> Source of Truth.

---

## 11. Simplified Syntax Aliases

部分高频指令额外提供简化别名（Simplified Alias）——纯粹是输入时的简写，Parser 会将其范式为正典名称后才创建 AST 节点（`node.type` 永远是正典名称），Renderer 完全不需要、也不会区分作者实际输入的是哪一种写法。

Block Syntax 涵盖的别名：

| Canonical | Alias |
|---|---|
| `@heading` | `@h` |
| `@paragraph` | `@p` |

（Inline Syntax 的 `@bold`/`@italic`/`@underline` 别名 `@b`/`@i`/`@u` 定义在 Inline Syntax Specification。）