# @Doc Block Syntax Specification v1.4

> 🌐 他の言語版: [English](../en/Block-Syntax-Specification.md) ・ [繁體中文](../zh-tw/Block-Syntax-Specification.md) ・ [简体中文](../zh-cn/Block-Syntax-Specification.md) ・ [한국어（AI 번역, 부정확할 수 있습니다）](../ko/Block-Syntax-Specification.md)
>
> ⚠️ **この文書は AI による翻訳です。誤りが含まれる可能性があります。** 正確な内容を確認したい場合は、[繁體中文版](../zh-tw/Block-Syntax-Specification.md) または [English 版](../en/Block-Syntax-Specification.md) をご参照ください。

## 0. 目次

* [1. 設計思想](#1-設計思想)
* [2. ドキュメント AST 構造](#2-ドキュメント-ast-構造)
* [3. EBNF](#3-ebnf)
* [4. 共有コンポーネント](#4-共有コンポーネント)
* [5. 構造ブロック](#5-構造ブロック)
* [6. コンテナブロック](#6-コンテナブロック)
* [7. コールアウトブロック](#7-コールアウトブロック)
* [8. ウィジェットブロック](#8-ウィジェットブロック)
* [9. メタデータ](#9-メタデータ)
* [10. コア原則](#10-コア原則)
* [11. 簡易構文エイリアス](#11-簡易構文エイリアス)

---

## 1. 設計思想

@Doc Block Syntax が採用しているのは：

> **Semantic First, Layout Later**

ブロックノードが記述するのは：

> 文書の意味（What）

であり、次のものではない：

> 表現方法（How）

そのため @Doc は次のものを提供しない：

* `@div`
* `@span`
* `@flex`
* `@grid`
* `@row`
* `@col`
* `@class`
* `@style`

Renderer はプラットフォームに応じて自由に決定できる：

* HTML
* React
* PDF
* DOCX
* Discord
* Terminal
* Notion
* AI UI

---

## 2. ドキュメント AST 構造

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
   `tab` は block-node に属さない。
   これは @tabs 専用の子ノード構文であり、tabs-content の中にしか出現できない。
   詳細は下記 "Widget-Specific Grammar: @tabs" を参照。
*)

metadata =
    "@meta" , meta-content ;

(* meta-content は block-content と同じ方法でレキシングされる —— "[" / "]" のペアは
   通常どおりトークン化されるため、未登録の "@word" は §6 Unknown Command
   Fallback の規則に従って通常のテキストにフォールバックする —— しかし
   Parser.ts はここで、他のどの block ノードよりも意味論的に厳格になる：
   構造系のノードに限らず、@n や @raw すら含め、@meta 内部に現れる登録済み
   ノードをすべて拒否する。その後 Parser は得られたテキストを改行で分割し、
   各行の最初の "=" でキーと値に分割して、その構造化を後段のパスに任せる
   のではなく、直接 AST ノード（MetaNode.meta）に格納する。完全な挙動と
   具体例は Metadata.md §3/§6 を参照。 *)
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

   @img の括弧の中身は単一の裸テキストではなく、カンマ区切りの
   key=value オプションリスト（image-option-list）であり、拡張可能である。
   最初のオプションで key が省略された場合、デフォルトで src とみなされる。

   `image` 生成規則（上記参照）には ")" の後にもう一つ、独立した選択可能な
   [styles] がある —— Image Style v1 であり、構文レベルでは image-option-list
   とは完全に無関係（括弧の中には書けない）。意味論レベルの詳細は下記
   「Image Style v1」小節を参照。
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

   @table は汎用の block-content を使わず、
   専用の構造化構文（Columns + Rows）を持つ。
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

(* cell は単純なプレーンテキストだけではない —— 厳選された inline-node の
   サブセット（cell-inline-node）も許可されており、これは @cols のカラムと
   @data のセルが共有する形と同じである。権威あるホワイトリストは、この
   文法ではなく registry.ts の isCellAllowedNode() にある —— その集合に
   含まれないノード（例：@card、@table、@details）は、Strict Mode
   （Inline Syntax Specification §11）に従い、黙って捨てられるのではなく
   MUST throw（必ず例外を投げる）でなければならない。 *)
cell =
    { cell-inline-node | any-unicode-char - "," - "]" } ;

(* ==========================================================================
   Widget-Specific Grammar: @tabs / @tab

   @tab は @tabs の tabs-content の中にしか出現できない。
   汎用の block-node 集合には属さないため、
   document のトップレベルや他の block-content の中に
   単独で出現することはできない。
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

## 4. 共有コンポーネント

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

> `integer`、`text-char` 等終結符定義沿用 Inline Spec 第 4 節
> （完全な EBNF 文法定義）中の `integer` 與 `text-char` 産生式を
> そのまま踏襲しており、両文書は同じ文字集合の定義を共有しているため、
> ここでは重複して掲載しない。
>
> `styles` も同様に Inline Spec 第 4 節の `styles` 生成規則
> （`"{" , { text-char - "}" } , "}"`）をそのまま踏襲しており、構文レベルでは
> 依然として「波括弧で囲まれた任意の文字列」としか定義していない。
> Container Blocks（`@details`、`@card`）、Callout Blocks（`@note`、`@tip`、
> `@important`、`@warning`、`@caution`）と `@img` は、いまではそれぞれの
> 生成規則の中に正式に組み込まれており（上記第 5〜7 節を参照）、もはや
> EBNF に明記されていない Parser 側の付随的な振る舞いではなくなっている。
>
> **トークンの意味論は各ノード自身の規則であり、単一の共有テーブルではない。**
> `@note`／`@tip`／`@important`／`@warning`／`@caution`／`@details` は、
> Inline Spec 第 7 節 `@mark スタイル意味論` にある既存の color token 規則
> （named token 対照表 + hex サポート）をそのまま踏襲する。一方 `@card` と
> `@img` はそれぞれ独立した閉じた token 集合を持つ —— それぞれ
> `Card Style v1`（下記第 6 節「Card Style v1」小節を参照）と
> `Image Style v1`（下記第 5 節「Image Style v1」小節を参照）であり、
> 同じ `#RRGGBB` / `radius-N` という token の形は共有しつつも、意味論は
> それぞれ独立している（`@card` の hex は背景色、`@img` の hex は外枠の色）。
> どちらも Inline Spec 第 7 節の named color 対照表は踏襲しない。
> Container／Callout／`@img` の `styles` を実際に視覚スタイルへどう
> マッピングするか（あるいはするかどうか）は、各 Renderer が自由に決定する。

---

## 5. 構造ブロック

### 見出し（Heading）

正典の構文は `@heading` であり、`@h` はそれと同等の簡略化されたエイリアス（Simplified Alias）である。両者は同じ AST ノードとしてパースされ、Renderer は作者が実際にどちらの書き方を入力したかを区別しない。

```text
@heading(1)[
Introduction
]

@h(1)[
Introduction
]
```

HTML（どちらの書き方でも出力は同じ）：

```html
<h1>Introduction</h1>
```

---

### 段落（Paragraph）

正典の構文は `@paragraph` であり、`@p` はそれと同等の簡略化されたエイリアスである。

```text
@paragraph[
Hello World
]

@p[
Hello World
]
```

HTML（どちらの書き方でも出力は同じ）：

```html
<p>Hello World</p>
```

---

### 引用（Quote）

```text
@quote[
言葉は安い。
コードを見せろ。
]
```

HTML:

```html
<blockquote>
言葉は安い。
コードを見せろ。
</blockquote>
```

---

### リスト（List）

空でない行はすべて 1 つの項目である。行頭の `- ` は**任意**の後方互換用の書き方であり、Parser が自動的に取り除く：

```text
@list[
Apple
Banana
Orange
]
```

これは以下と同等である：

```text
@list[
- Apple
- Banana
- Orange
]
```

各項目は AST の中で独立した `list-item` ノード（`node.items`）であり、その内容にはインラインノード（例えば `@bold`）を含めることができ、単なるプレーンテキストにとどまらない：

```text
@list[
@bold[Apple] (本日特価)
Banana
]
```

AST:

```text
List
└── items
    ├── ListItem [ Bold("Apple"), " (本日特価)" ]
    └── ListItem [ "Banana" ]
```

> [!TIP]
> **TIP**：旧バージョンの仕様では「`- ` で始まらなければ項目とみなさない」と
> 定められていたが、これは「改行すればそのまま段落になる」という直感と
> 一致しておらず、各 Renderer（Route A / Route B / ...）がそれぞれ文字列処理で
> リストの分割ロジックを個別に再実装する原因にもなっていた。新しい仕様では
> Parser が統一的に `ListItem` AST を生成するため、Renderer は既存の構造を
> レンダリングするだけでよく、自分で文字列を分割する必要はない。

#### 順序付きリスト

`@list(ordered)[...]` はデフォルトの `<ul>` ではなく `<ol>` としてレンダリングされる。通常の `@list` と同様、行頭の `- ` は任意であり必須ではない——プレーンテキストの行もそれだけで 1 項目とみなされる。追加で `N. `／`N)` と書けば番号を明示的に指定したことになり、Parser はその数値を該当 `ListItem` の `marker` フィールドに保存する。Renderer は `ordered` が真のときにのみ `marker` を `<li value="N">` に変換し、「番号が飛んだ後に自動的に連番を続ける」処理はブラウザ標準の `<ol>` カウンターに任せる：

```text
@list(ordered)[
- Apple
- Banana
3. Cherry
- Date
]
```

レンダリング結果は `1. Apple`、`2. Banana`、`3. Cherry`（明示的に指定）、`4. Date`（自動的に連番）となる。

#### ネストしたリスト

新しい構文の追加はない——`@list` の内容はもともと `block-content` であり、ネストした `@list[...]` はすでに正当な子ノードである。1 行を単独で占めるネストした `@list[...]`（前後に空白しかない場合）は、Parser によって**直前**の item の内容に統合され、新しい item として別に作られることはない：

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

AST 上では、内側の `@list` ノードは `Fruits` という `ListItem` の `content` 配列の中に現れる。Renderer 側で追加のロジックは一切不要で、`content` を再帰的にレンダリングすれば自然にネストした `<ul>`/`<ol>` が生成される。

> 旧バージョンのドキュメントでは、`(modifier)` の配列（例えば `@list(bullet,number)[...]`）で階層ごとにリストの種類を宣言する案が触れられていたことがあるが、上記の `@list(ordered)` とネストした子リストがそれぞれ自分の種類を宣言するという設計が、実際に採用された、その案よりもシンプルな方式である。

---

### コード（Code）

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

### 画像（Image）

`@img` の括弧の中身はカンマ区切りの key=value オプションリスト（`image-option-list`）であり、拡張可能である。最初のオプションで `key=` が省略された場合、デフォルトで `src` とみなされる：

```text
@img(
https://example.com/logo.png
)[
WEDC Logo
]
```

これは以下と同等である：

```text
@img(src=https://example.com/logo.png)[
WEDC Logo
]
```

他のオプションと組み合わせて使う：

```text
@img(
https://example.com/logo.png,width=200,align=center
)[
WEDC Logo
]
```

現在サポートされているオプション：

| オプション      | 説明                                    | 例                          |
| --------------- | --------------------------------------- | ---------------------------- |
| `src`（省略可） | 画像の取得元 URL                        | `src=https://...`           |
| `width`         | 表示幅（単位は Renderer が決定）         | `width=200`                  |
| `height`        | 表示高さ（単位は Renderer が決定）       | `height=150`                 |
| `align`         | 配置方法                                | `align=left/center/right`    |
| `radius`        | 角丸（Renderer にそのまま渡す CSS 値）   | `radius=8px`                 |
| `border`        | 外枠（Renderer にそのまま渡す CSS 値）   | `border=1px solid #ccc`      |

> [!TIP]
> **TIP**：ここでの拡張方式は、Inline Spec 第 7 節 `@mark スタイル意味論`
> と同じ設計哲学に基づいている——構文レベルでは「括弧の中はカンマ区切りの
> オプションリストである」ことしか定義せず、実際の key の集合は意味論
> レベルに属する。将来オプション（例えば `alt`、`loading`）を追加しても
> EBNF 自体を変更する必要はない。Renderer は認識できない key を
> MUST 無視しなければならず、エラーを投げるのではなく「`src` のみを
> 適用する」ことを fallback として SHOULD 採用すべきである。

#### Image Style v1

`@img(...)` の後ろには、任意で `{styles}`（構文定義は第 4 節を参照）を
続けて書くことができ、`@card` と同じ **Card Style v1** の token の形
（`#RRGGBB` / `radius-N`）を共有する。ただし意味論は独立しており、
それ自体が閉じた token 集合を構成する——Inline Spec 第 7 節の named
color 対照表は**踏襲せず**、`image-option-list` の一部でも**ない**
（`(...)` 括弧の中には書けない）：

| Token の形 | 意味 | 例 |
|---|---|---|
| `#RRGGBB`（16 進数 hex） | 外枠の色。1px の実線の外枠として適用される | `@img(src=...){#3366ff}[...]` → `border: 1px solid #3366ff` |
| `radius-N`（N は非負整数） | 角丸。`N` はピクセル値 | `@img(src=...){radius-12}[...]` → `border-radius: 12px` |

```text
@img(src=https://example.com/photo.jpg){#3366ff,radius-12}[
WEDC Photo
]
```

`{styles}` を省略した場合は、純粋な裸の `<img>` となり、デフォルトの角丸や
外枠は一切付与されない——これは `@card` に通常 Renderer 独自の静的な
デフォルト値があり、それを上書きできるのとは異なる。`@img` にとって
`{styles}` は純粋な「任意」のオン・オフスイッチであり、「デフォルトの
上書き」ではない。

> [!NOTE]
> **NOTE**：既存の `(...)` オプションである `radius`/`border`（上表参照）は
> 引き続き有効であり、任意の CSS 値（例えば `border=2px dashed red`）が
> 必要な場面向けの逃げ道である。`{styles}` はクロスプラットフォームかつ
> 閉じた token 集合による簡略記法である。両方が同時に現れた場合、
> Renderer は `{styles}` を対応する `(...)` オプションより優先すべき
> （SHOULD）である（`{radius-N}` が `radius=` を、`{#RRGGBB}` が `border=`
> を上書きする）。両者を重ね合わせたり、エラーを投げたりしてはならない。

---

### テーブル（Table）

`@table` の内部構造は `@cols` + `@data` という 2 つの専用子ノードで固定されており、**順序は固定で、両方とも必須**である：

```text
@table[
    @cols[id,name,price]

    @data[
        [1,朝食,60]
        [2,昼食,80]
        [3,晩餐,90]
    ]
]
```

* `@cols[...]`：カンマ区切りの列見出しリストであり、列の順序と数を定義する。各列は `@data` のセルと同じく `cell`（下記参照）であり、プレーンテキストの識別子に限定されない。
* `@data[...]`：各行は `[...]` の中に包まれ、`cell` の数は `@cols` で定義された列数と一致すべき（SHOULD）である。数が一致しない行に対して、Parser は警告またはエラーを出してもよい（MAY）（Strict / Editor Mode のどちらかによって決まる。Inline Spec 第 11 節 Parser Recovery Strategy を参照）。

> [!TIP]
> **TIP**：`@cols` と `@data` の順序が固定され、両方とも必須であるのは、
> 意図的な設計上のトレードオフである——若干の柔軟性を犠牲にすることで、
> Parser および AI がコンテンツを生成する際の高い予測可能性を得ている。

各 `cell` は単純なプレーンテキストではない——テキスト本体に加えて、厳選された行内書式ノード（`@bold`、`@italic`、`@underline`、`@del`、`@mark`、`@color`、`@sup`、`@sub`、`@link`、`@fn`、そして改行に変換される `@n`）が許可されている。これらのノードはテキストの見た目だけを変え、テーブル本来の「列とデータ行を揃える」という構造には影響しないためである。この一覧は Renderer 側（`registry.ts` の `isCellAllowedNode`）で管理されており、構文レベル自体はその内容を制限しないため、将来的に拡張可能である。一覧に無いノード（例えば `@card`、`@table`、`@details` のような、自分自身のレイアウト構造を持ち込むブロックノード）は、黙って捨てられるのではなく、MUST throw（必ず構文エラーを投げる）でなければならない——これは Strict Mode（Inline Syntax Specification 第 11 節）の「エラーを投げることを厭わず、誤った内容を飲み込まない」という精神と一致する。

> [!NOTE]
> **例外**：raw ファミリーのノード（`@code`、`@mermaid`、`@raw`、`@kbd`）も `isCellAllowedNode` の一覧には含まれていないが、これらは「自分自身のレイアウト構造を持ち込むブロックノード」でもなければ、上記の MUST throw 規則の対象でもない——`Parser.ts`（`parseInlineCellList`）は意図的にこれらの生の内容をセル内のプレーンテキストへとフラット化しており、エラーを投げたり、本物のノードとしてパースしたりはしない。これは `@card`/`@table`/`@details` のような構造ノードとは別に扱われる独立した挙動であり、詳細は `registry.ts`（`CELL_ALLOWED_INLINE` 直前のコメント）と `Parser.ts`（`parseInlineCellList` 直前のコメント）を参照。

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
    ├── Row [1, 朝食, 60]
    ├── Row [2, 昼食, 80]
    └── Row [3, 晩餐, 90]
```

あるいはインライン書式付きのセルの場合：

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

### 水平線（Horizontal Rule）

```text
@hr
```

HTML:

```html
<hr>
```

---

### SVG

`@svg` は `@code`／`@mermaid` と同じく `raw-block-content` に属する——内容はそのまま保持され、Parser は解析も escape もしない：

```text
@svg[
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <circle cx="5" cy="5" r="4" />
</svg>
]
```

> [!TIP]
> **TIP**：`@svg` の内容は**信頼境界（trust boundary）**である——`@code` のように
> テキストとして表示されるのではなく、Renderer によってそのままブラウザが
> 実際にレンダリングするベクター画像として出力される。Renderer は出力前に
> `<script>` や `on*=` イベント属性をフィルタリングすべき（SHOULD）である
> （Adapters.ts の `sanitizeSvg()` を参照）が、これは Renderer の責務であり、
> 構文レベルで保証されるものではない。信頼できない出所の `@svg` 内容は、
> それでもより早い段階でコンテンツ審査を行うべきである。

---

## 6. コンテナブロック

`@details`／`@card` は現在、**任意**の `{styles}`（構文定義は第 4 節を参照）も
受け付けるようになっており、`(title)` の後、`block-content` の前に置かれる：

```text
@card(API Key){#3366ff,radius-12}[
ここに説明の内容を書く。
]
```

省略した場合は純粋な内容だけの形式のままとなり、どちらも正当である。
Renderer は認識できない token を無視してもよい（MAY）（Inline Spec §6
Unknown Command Fallback の精神と一致する）。`@card` の `{styles}` の
token 意味論は、それ自体が独自の閉じた規則（`Card Style v1`）であり、
Inline Spec 第 7 節の named color token 対照表とは無関係である——下記
「Card Style v1」小節を参照。

### 詳細（Details）

```text
@details(詳細情報を見る)[
内容
]
```

HTML:

```html
<details>
    <summary>詳細情報を見る</summary>
    内容
</details>
```

---

### カード（Card）

```text
@card(API Key)[
ここに説明の内容を書く。
]
```

#### Card Style v1

`@card` の `{styles}` が許すのは、少数の、クロスプラットフォームかつ価値の
高いスタイルだけであり、汎用的な CSS の逃げ道にはあえてしていない——現在
認識されるのは以下 2 種類の token の形のみで、それぞれ単独で使う、両方を
併用する（カンマ区切り、順序は問わない）、あるいは全体を省略する、のいずれ
も可能である：

| Token の形 | 意味 | 例 |
|---|---|---|
| `#RRGGBB`（16 進数 hex） | 背景色。その色値をそのまま採用する | `@card{#3366ff}[...]` → `background-color: #3366ff` |
| `radius-N`（N は非負整数） | 角丸。`N` はピクセル値 | `@card{radius-12}[...]` → `border-radius: 12px` |

```text
@card{#3366ff,radius-12}[
背景色と角丸を同時に設定する。
]
```

上表に無い token（例えば named color の語、Inline Spec 第 7 節の color
token）は一律に認識不能とみなされ、Renderer はエラーを投げるのではなく
無視しなければならない（MUST）（Inline Spec §6 Unknown Command Fallback
の精神と一致する）。そのうえで Renderer 自身のデフォルトの見た目を維持
する。`radius-N` の `N` が純粋な数字でない場合（例えば `radius-lg`）も
同様に認識不能とみなされる。

---

## 7. コールアウトブロック

`@note`、`@tip`、`@important`、`@warning`、`@caution` はいずれも**任意**の
`(title)`（定義は第 4 節を参照）と組み合わせることができ、本文とは独立した
見出しフィールドを内容に付加できる。また**任意**の `{styles}`（第 4 節、
および第 6 節 Container Blocks の同じ説明を参照）を `(title)` の後に置いて
組み合わせることもできる。両方を省略した場合は純粋な内容だけの形式のまま
となり、いずれも正当である：

### ノート（Note）

```text
@note[
これは一般的な情報です。
]
```

---

### ヒント（Tip）

```text
@tip[
これはベストプラクティスの提案です。
]
```

---

### 重要（Important）

```text
@important[
この内容を優先して読んでください。
]
```

---

### 警告（Warning）

```text
@warning[
削除すると元に戻せません。
]
```

タイトルと組み合わせる：

```text
@warning(データ保持ポリシー)[
削除すると元に戻せません。
]
```

---

### 注意（Caution）

```text
@caution[
この操作はデータ損失を引き起こす可能性があります。
]
```

---

## 8. ウィジェットブロック

### タブ（Tabs）

`@tabs` の内部には**1 つ以上の** `@tab` 子ノードしか含めることができず、他の block-node や裸のテキストは受け付けない：

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

* `@tab(タイトル)[内容]`：`タイトル` はタブの表示名であり、`内容` は完全な `block-content`（任意の block-node と inline-stream を含められる）である。
* もし `@tabs[...]` の中に `@tab` 以外のノード（例えば裸のテキストや他の block-node）が現れた場合、Parser は MUST でこれを構文エラーとみなす（Strict Mode）か、Editor Mode によって自動的に無視 / 修正を提案する。

> [!TIP]
> **TIP**：`@tab` が `block-node` に統合されていないのは、`@tabs` 以外の
> 場所（例えば文書のトップレベルに直接置かれるなど）で誤用されるのを
> 避けるためである。これは Inline Spec における `@raw` の Opaque Domain
> の設計思想に似ている：特定の構文は特定の文脈の中でのみ有効である。

---

### Mermaid

```text
@mermaid[
graph TD
A --> B
]
```

---

## 9. メタデータ

```text
@meta[
title = @Doc
author = WEDC
description = AI Native Document Format
keywords = parser,ast,dsl
]
```

Renderer は以下にマッピングできる：

* HTML Meta Tags
* OpenGraph
* PDF Metadata
* DOCX Properties
* Search Index
* RAG Metadata

---

## 10. コア原則

@Doc Block Syntax の目標は、新しい HTML を作ることではない。

そうではなく、次のような文書 AST を作ることである：

> Human Editable
> Machine Deterministic
> AI Friendly
> Cross Platform

HTML は Renderer である。

Markdown は Renderer である。

React は Renderer である。

そして @Doc は：

> Source of Truth.

---

## 11. 簡易構文エイリアス

一部の高頻度で使われる命令には、簡略化されたエイリアス（Simplified Alias）が追加で用意されている——これは純粋に入力時の省略表記であり、Parser はそれを正典の名前に正規化してから AST ノードを作成する（`node.type` は常に正典の名前になる）。Renderer は作者が実際にどちらの書き方を入力したかを区別する必要がなく、実際に区別することもない。

Block Syntax がカバーするエイリアス：

| Canonical | Alias |
|---|---|
| `@heading` | `@h` |
| `@paragraph` | `@p` |

（Inline Syntax の `@bold`/`@italic`/`@underline` のエイリアス `@b`/`@i`/`@u` は Inline Syntax Specification で定義されている。）
