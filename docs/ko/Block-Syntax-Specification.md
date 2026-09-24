# @Doc Block Syntax Specification v1.5

> 🌐 다른 언어 버전: [English](../en/Block-Syntax-Specification.md) ・ [繁體中文](../zh-tw/Block-Syntax-Specification.md) ・ [简体中文](../zh-cn/Block-Syntax-Specification.md) ・ [日本語（AI 翻訳、誤りがある可能性があります）](../ja/Block-Syntax-Specification.md)
>
> ⚠️ **이 문서는 AI가 번역했습니다. 부정확한 내용이 포함될 수 있습니다.** 정확한 내용을 확인하려면 [繁體中文版](../zh-tw/Block-Syntax-Specification.md) 또는 [English 버전](../en/Block-Syntax-Specification.md)을 참고하세요.

> [!NOTE]
> **변경 이력(문법 v0.1.2, 명세 v1.5)** — `@img`에 `float-left`/`float-right` 정렬과 `align`의 키 생략형(단독 키워드)이 추가되었다(5절 Image). `@table`의 셀을 `|`로 구분할 수 있게 되었고, `@span(n)[...]`으로 하나의 셀이 여러 칼럼에 걸칠 수 있다(5절 Table). 행의 너비가 `@cols`의 칼럼 수와 다르면 이제 diagnostic이 발생한다. 인식할 수 없는 `{styles}` token과 숫자가 아닌 `@defn` id도 이제 diagnostic이 된다(4절, Inline Spec 11절). `@tabs`의 panel id는 이제 문서 전체에서 고유하다(8절 Tabs). 인라인 노드 `@spoiler`와 `@hex`도 새로 추가되었다 — Inline Spec 15절을 참고.

## 0. 목차

* [1. 설계 철학](#1-설계-철학)
* [2. 문서 AST 구조](#2-문서-ast-구조)
* [3. EBNF](#3-ebnf)
* [4. 공유 컴포넌트](#4-공유-컴포넌트)
* [5. 구조 블록](#5-구조-블록)
* [6. 컨테이너 블록](#6-컨테이너-블록)
* [7. 콜아웃 블록](#7-콜아웃-블록)
* [8. 위젯 블록](#8-위젯-블록)
* [9. 메타데이터](#9-메타데이터)
* [10. 핵심 원칙](#10-핵심-원칙)
* [11. 간소화 문법 별칭](#11-간소화-문법-별칭)

---

## 1. 설계 철학

@Doc Block Syntax는 다음을 채택합니다:

> **Semantic First, Layout Later**

블록 노드가 기술하는 것은:

> 문서의 의미(What)

이지, 다음이 아닙니다:

> 표현 방식(How)

따라서 @Doc는 다음을 제공하지 않습니다:

* `@div`
* `@span`(범용 레이아웃 래퍼로서)
* `@flex`
* `@grid`
* `@row`
* `@col`
* `@class`
* `@style`

> [!NOTE]
> **NOTE**: `@span(n)[...]`은 v0.1.2부터 **실제로 존재**하지만, HTML의 `<span>`/`<div>` 같은 범용 레이아웃 래퍼가 아니다. 이것은 **표 구조 마커**로서, `@data` 셀의 유일한 내용으로만 유효하며 "이 셀은 n개 칼럼에 걸친다"는 뜻만 나타낸다. 스타일이나 표현에 관한 정보는 전혀 담지 않는다 — 5절 Table을 참고.

Renderer는 플랫폼에 따라 자유롭게 결정할 수 있습니다:

* HTML
* React
* PDF
* DOCX
* Discord
* Terminal
* Notion
* AI UI

---

## 2. 문서 AST 구조

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
   `tab`은 block-node에 속하지 않는다.
   이는 @tabs 전용 자식 노드 문법으로, tabs-content 안에서만 나타날 수 있으며,
   자세한 내용은 아래 "Widget-Specific Grammar: @tabs"를 참고.
*)

metadata =
    "@meta" , meta-content ;

(* meta-content는 block-content와 동일한 방식으로 렉싱된다 — "[" / "]" 쌍은
   평소처럼 토큰화되므로, 등록되지 않은 "@word"는 §6 Unknown Command Fallback에
   따라 여전히 일반 텍스트로 폴백된다 — 하지만 Parser.ts는 다른 어떤 block
   노드보다 여기서 의미적으로 더 엄격하다: 구조적 노드뿐 아니라 등록된 모든
   노드를(심지어 @n이나 @raw조차) @meta 내부에서 거부한다. 이후 parser는 결과
   텍스트를 줄바꿈으로 나누고, 각 줄의 첫 번째 "="를 기준으로 key/value 쌍으로
   분리해 AST 노드(MetaNode.meta)에 직접 저장한다. 이 구조화 작업을 이후
   단계로 미루지 않는다. 전체 동작과 예제는 Metadata.md §3/§6을 참고. *)
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

   @img의 괄호 안 내용은 단일 순수 텍스트가 아니라, 쉼표로 구분된
   key=value 옵션 목록(image-option-list)이며 확장 가능하다.
   첫 번째 옵션에서 key를 생략하면 기본적으로 src로 간주한다.

   `image` 산출식(위 참고)은 ")" 뒤에 별도로 선택적인 [styles]를 하나 더
   가진다 — Image Style v1이며, 문법 레벨에서는 image-option-list와 완전히
   무관하다(괄호 안에 쓸 수 없다). 시맨틱 레벨은 아래 "Image Style v1"
   소절을 참고.
   ========================================================================== *)

image-option-list =
    image-option ,
    { "," , image-option } ;

image-option =
      src-option
    | width-option
    | height-option
    | align-option
    | bare-align-option
    | radius-option
    | border-option ;

src-option =
    [ "src=" ] , url ;

width-option =
    "width=" , integer ;

height-option =
    "height=" , integer ;

align-option =
    "align=" , align-value ;

align-value =
      "left"
    | "center"
    | "right"
    | "float-left"
    | "float-right" ;

(* Because align-value is a closed set, a bare item that is exactly one of
   its five values is also accepted as an align-option with no "align="
   key (e.g. @img(src=a.png,float-left)[...]). This is checked BEFORE the
   "first bare item is src" rule, so @img(float-left)[...] reads as align,
   never as a URL that happens to spell "float-left". *)
bare-align-option =
    align-value ;

radius-option =
    "radius=" , text ;

border-option =
    "border=" , text ;

url =
    { text-char - "," - ")" } ;

(* ==========================================================================
   Widget-Specific Grammar: @table

   @table는 범용 block-content를 사용하지 않고,
   전용 구조화 문법(Columns + Rows)을 가진다.
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

(* Cell delimiter (v0.1.2): "|" if the row uses "|" anywhere at its own
   top level, otherwise the legacy ",". Decided independently for @cols and
   for each @data row. See §5 Table. *)
cell-delimiter =
    "|" | "," ;

column-list =
    [ "|" ] , cell , { cell-delimiter , cell } , [ "|" ] ;

data =
    "@data" ,
    "[" ,
        { row } ,
    "]" ;

row =
    "[" ,
        [ "|" ] , row-cell , { cell-delimiter , row-cell } , [ "|" ] ,
    "]" ;

(* A cell that is exactly one span-cell counts as n toward the row's width
   instead of 1. A leading and/or trailing "|" is decoration and is
   stripped, each edge independently. *)
row-cell =
      span-cell
    | cell ;

span-cell =
    "@span" , "(" , integer , ")" , "[" , cell , "]" ;

(* cell은 순수 텍스트만 허용하는 것이 아니라, 엄선된 inline-node 부분집합
   (cell-inline-node)도 허용한다. 이 형태는 @cols의 columns와 @data의
   cells가 공유한다. 이 목록의 권위 있는 기준은 이 문법이 아니라
   registry.ts의 isCellAllowedNode()에 있다 — 이 집합에 속하지 않는 노드
   (예: @card, @table, @details)는 Strict Mode(Inline Syntax Specification
   §11)에 따라 조용히 버려지는 대신 반드시(MUST) 예외를 던져야 한다. *)
cell =
    { cell-inline-node | any-unicode-char - cell-delimiter - "]" } ;

(* ==========================================================================
   Widget-Specific Grammar: @tabs / @tab

   @tab는 @tabs의 tabs-content 안에서만 나타날 수 있으며,
   범용 block-node 집합에 속하지 않는다. 따라서 document 최상위나
   다른 block-content 안에 단독으로 나타날 수 없다.
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

## 4. 공유 컴포넌트

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

> `integer`, `text-char` 등의 종결기호 정의는 Inline Spec 4절
> (완전한 EBNF 문법 정의)의 `integer`, `text-char` 산출식을 그대로 따르며,
> 두 문서가 동일한 문자 집합 정의를 공유하므로 여기서는 다시 나열하지 않는다.
>
> `styles`도 마찬가지로 Inline Spec 4절의 `styles` 산출식
> (`"{" , { text-char - "}" } , "}"`)을 그대로 따르며, 문법 레벨에서는 여전히
> "중괄호로 감싼 임의의 문자 시퀀스"로만 정의된다. Container Blocks
> (`@details`, `@card`), Callout Blocks(`@note`, `@tip`, `@important`,
> `@warning`, `@caution`)와 `@img`는 이제 이를 각자의 산출식에 정식으로
> 포함시켰으며(위 5~7절 참고), 더 이상 EBNF에 명시되지 않은 채 Parser 쪽에서만
> 처리되는 부수 동작이 아니다.
>
> **토큰 시맨틱은 각 노드마다 별도의 규칙이며, 하나의 공용 표가 아니다.**
> `@note`/`@tip`/`@important`/`@warning`/`@caution`/`@details`는 Inline Spec
> 7절 `@mark 스타일 시맨틱스`의 기존 color token 규칙(구체적 이름 토큰 대응표
> + hex 지원)을 그대로 따른다. 반면 `@card`와 `@img`는 각각 독립적인 폐쇄형
> token 집합을 가진다 — 각각 `Card Style v1`(아래 6절 "Card Style v1" 소절
> 참고)과 `Image Style v1`(아래 5절 "Image Style v1" 소절 참고)이며, 동일한
> `#RRGGBB` / `radius-N` token 형태를 공유하지만 시맨틱은 서로 독립적이다
> (`@card`의 hex는 배경색, `@img`의 hex는 테두리 색이다). 둘 다 Inline Spec
> 7절의 구체적 이름 색상표를 따르지 않는다.
> Container/Callout/`@img`의 `styles`를 시각적 스타일로 매핑할지, 어떻게
> 매핑할지는 각 Renderer가 자체적으로 결정한다.
>
> **인식할 수 없는 token은 표시된다(v0.1.2).** 해당 노드 자체의 어휘에 속하지 않는 token — 예를 들어
> `@card{blue}`(`@card`는 `#RRGGBB`/`radius-N`만 받으며 이름 있는 색은 받지 않는다)나
> `@mark{bluee}` — 은 예전에는 조용히 버려져서 노드가 스타일 없이 남았지만 어디에도 알림이 없었다.
> Parser는 이제 해당 token에 대해 diagnostic을 보고한다(Inline Spec 11절 Diagnostics 참고).
> 문서는 여전히 파싱·렌더링되며, 그 token은 계속 무시된다.

---

## 5. 구조 블록

### Heading

정식 문법은 `@heading`이며, `@h`는 이와 동등한 간소화 별칭(Simplified Alias)이다. 둘 다 동일한 AST 노드로 파싱되며, Renderer는 작성자가 실제로 어느 표기를 입력했는지 구분하지 않는다.

```text
@heading(1)[
Introduction
]

@h(1)[
Introduction
]
```

HTML(두 표기 모두 동일한 출력):

```html
<h1>Introduction</h1>
```

---

### Paragraph

정식 문법은 `@paragraph`이며, `@p`는 이와 동등한 간소화 별칭이다.

```text
@paragraph[
Hello World
]

@p[
Hello World
]
```

HTML(두 표기 모두 동일한 출력):

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

비어 있지 않은 모든 줄은 하나의 항목이다. 줄 앞의 `- `는 **선택적인(optional)** 하위 호환 표기이며, Parser가 자동으로 제거한다:

```text
@list[
Apple
Banana
Orange
]
```

다음과 동일하다:

```text
@list[
- Apple
- Banana
- Orange
]
```

각 항목은 AST에서 독립적인 `list-item` 노드(`node.items`)이며, 내용에는 인라인 노드(예: `@bold`)를 포함할 수 있어 더 이상 순수 텍스트만이 아니다:

```text
@list[
@bold[Apple] (오늘의 특가)
Banana
]
```

AST:

```text
List
└── items
    ├── ListItem [ Bold("Apple"), " (오늘의 특가)" ]
    └── ListItem [ "Banana" ]
```

> [!TIP]
> **TIP**: 이전 버전의 시맨틱은 "반드시 `- `로 시작해야 항목으로 인정된다"는 규칙이었는데, 이는 "줄바꿈이 곧 항목 구분"이라는 직관과 어긋났고,
> 각 Renderer(Route A / Route B / ...)가 저마다 문자열 처리로 리스트 분리 로직을 다시 구현하게
> 만들었다. 새로운 시맨틱에서는 Parser가 통일된 방식으로 `ListItem` AST를 생성하므로, Renderer는
> 기존 구조를 렌더링하기만 하면 되고 더 이상 스스로 문자열을 자를 필요가 없다.

#### 순서 있는 목록

`@list(ordered)[...]`는 기본값인 `<ul>` 대신 `<ol>`로 렌더링된다. 일반 `@list`와 마찬가지로 줄 앞의 `- `는 선택적이며 필수가 아니다 — 순수 텍스트 줄도 하나의 항목으로 인정된다. 추가로 `N. `/`N)` 형태로 쓰면 번호를 명시적으로 지정하는 것이며, Parser는 이 숫자를 해당 `ListItem`의 `marker` 필드에 저장한다. Renderer는 `ordered`가 참일 때만 `marker`를 `<li value="N">`으로 변환하며, "번호를 건너뛴 뒤 자동으로 이어지는" 처리는 브라우저 네이티브 `<ol>` 카운터에 맡긴다:

```text
@list(ordered)[
- Apple
- Banana
3. Cherry
- Date
]
```

렌더링 결과는 `1. Apple`, `2. Banana`, `3. Cherry`(명시적으로 지정), `4. Date`(자동으로 이어짐)이다.

#### 중첩 목록

새로운 문법이 추가된 것은 아니다 — `@list`의 내용은 원래부터 `block-content`이므로, 중첩된 `@list[...]`는 이미 합법적인 자식 노드다. 한 줄을 단독으로 차지하는 중첩 `@list[...]`(앞뒤에 공백만 있는 경우)는 Parser에 의해 새 item을 여는 대신 **바로 앞** item의 내용에 합쳐진다:

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

AST상에서 내부 `@list` 노드는 `Fruits`라는 `ListItem`의 `content` 배열 안에 나타난다. Renderer는 별도의 추가 로직 없이 `content`를 재귀적으로 렌더링하기만 하면 자연스럽게 중첩된 `<ul>`/`<ol>`이 만들어진다.
> 이전 버전 문서에서는 `(modifier)` 배열(예: `@list(bullet,number)[...]`)로 각 계층의 목록 유형을 선언하는 방식이 언급된 적이 있다. 위에서 설명한 `@list(ordered)` + 중첩 하위 목록이 각자 유형을 선언하는 설계가 실제로 채택된, 그 제안보다 더 단순한 방식이다.

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

`@img`의 괄호 안 내용은 쉼표로 구분된 key=value 옵션 목록(`image-option-list`)이며 확장 가능하다. 첫 번째 옵션에서 `key=`를 생략하면 기본적으로 `src`로 간주한다:

```text
@img(
https://example.com/logo.png
)[
WEDC Logo
]
```

다음과 동일하다:

```text
@img(src=https://example.com/logo.png)[
WEDC Logo
]
```

다른 옵션과 함께 사용:

```text
@img(
https://example.com/logo.png,width=200,align=center
)[
WEDC Logo
]
```

현재 지원되는 옵션:

| 옵션          | 설명                                | 예시 값                    |
| ------------- | ----------------------------------- | -------------------------- |
| `src`(생략 가능)| 이미지 소스 URL                        | `src=https://...`         |
| `width`       | 표시 너비(단위는 Renderer가 결정)     | `width=200`                |
| `height`      | 표시 높이(단위는 Renderer가 결정)     | `height=150`               |
| `align`       | 정렬 방식                            | `align=left/center/right/float-left/float-right`  |
| `radius`      | 모서리 둥글기(Renderer로 그대로 전달되는 CSS 값)| `radius=8px`               |
| `border`      | 테두리(Renderer로 그대로 전달되는 CSS 값)| `border=1px solid #ccc`    |

#### Image `align` 값(v0.1.2)

`align`의 값 집합은 닫혀 있다:

| 값 | 효과 |
|---|---|
| `left` | 이미지를 왼쪽에 정렬. 이어지는 내용은 이미지 **아래**에 이어진다 |
| `center` | 이미지를 가운데 정렬(이전 동작) |
| `right` | 이미지를 오른쪽에 정렬. 이어지는 내용은 이미지 **아래**에 이어진다 |
| `float-left` | 이미지를 왼쪽에 정렬. 이어지는 텍스트가 **오른쪽으로 감싼다** |
| `float-right` | 이미지를 오른쪽에 정렬. 이어지는 텍스트가 **왼쪽으로 감싼다** |

```text
@img(./a.png,align=float-left)[대체 텍스트]
```

* **키 생략형.** 값 집합이 닫혀 있으므로, 쉼표로 구분된 항목이 이 다섯 값 중 하나와 정확히 같으면 `align=`이라는 key가 없어도 `align`으로 인식된다: `@img(./a.png,float-left)[...]`은 `@img(./a.png,align=float-left)[...]`과 동일하다. 이 검사는 "키 없는 첫 항목은 `src`"라는 규칙보다 **먼저** 수행되므로, `@img(float-left)[...]`(`src`가 전혀 없음)는 우연히 "float-left"라고 쓰인 URL이 아니라 정렬로 읽힌다.
* **조합이 아닌 단일 옵션 값.** `align=left,float=true` 같은 조합은 의도적으로 두지 않았다 — 잘못된 상태는 아예 쓸 수 없고, 작성자(또는 모델)는 두 번이 아니라 한 번만 선택하면 된다.
* **`center` + 감싸기는 없다.** 가운데 정렬된 이미지의 양쪽에 텍스트를 감싸는 것은 CSS `float`로 표현할 수 없고 대부분의 renderer도 구현할 수 없다. 남겨 두면 renderer마다 조용히 서로 다른 동작으로 대체될 뿐이다.
* **감싸기의 끝.** 감싸기는 renderer 수준의 관례이며 AST에는 기록되지 않는다: 다음 제목, 다음 `@hr`, 또는 둘러싼 컨테이너의 끝에서 끝나야 한다(SHOULD).
* **좁은 화면과 흐름 배치를 할 수 없는 출력 대상**(휴대폰, terminal, 일부 PDF): renderer는 정렬과 감싸기를 무시하고 이미지를 가운데 또는 전체 너비로 표시해도 된다(MAY). 정렬은 **위치 의미론**이며, 픽셀 단위 레이아웃을 약속하지 않는다.
* **인식할 수 없는 값**(예: `align=middle`, 오타): renderer는 그 값을 무시하고 기본값(정렬 없음)을 사용한다. Parser는 추가로 **warning** diagnostic을 보고한다 — 문서는 여전히 렌더링되므로 error는 아니지만, 더 이상 조용히 넘어가지 않는다.

> [!TIP]
> **TIP**: 여기서의 확장 방식은 Inline Spec 7절 `@mark 스타일 시맨틱스`와
> 동일한 설계 철학을 따른다 — 문법 레벨에서는 "괄호 안은 쉼표로 구분된
> 옵션 목록"이라는 것만 정의하며, 실제 key 집합은 시맨틱 레벨에 속한다.
> 앞으로 새 옵션(예: `alt`, `loading`)을 추가하더라도 EBNF 자체를 수정할
> 필요가 없다. Renderer는 인식할 수 없는 key를 반드시(MUST) 무시해야 하며,
> 오류를 던지는 대신 "`src`만 적용"하는 것을 폴백으로 사용해야(SHOULD) 한다.

#### Image Style v1

`@img(...)` 뒤에는 선택적인 `{styles}`(문법 정의는 4절 참고)를 하나 더
붙일 수 있으며, `@card`와 동일한 **Card Style v1** token 형태(`#RRGGBB` /
`radius-N`)를 공유한다. 다만 시맨틱은 독립적이며 그 자체로 폐쇄형 token
집합을 이룬다 — Inline Spec 7절의 구체적 이름 색상표를 **따르지 않으며**,
`image-option-list`의 일부도 **아니다**(`(...)` 괄호 안에는 쓸 수 없다):

| Token 형태 | 시맨틱 | 예시 |
|---|---|---|
| `#RRGGBB`(16진수 hex) | 테두리 색상, 1px 실선 테두리로 적용 | `@img(src=...){#3366ff}[...]` → `border: 1px solid #3366ff` |
| `radius-N`(N은 0 이상의 정수) | 모서리 둥글기, `N`은 픽셀 값 | `@img(src=...){radius-12}[...]` → `border-radius: 12px` |

```text
@img(src=https://example.com/photo.jpg){#3366ff,radius-12}[
WEDC Photo
]
```

`{styles}`를 생략하면 순수한 날것의 `<img>`가 되며, 기본 모서리 둥글기나
테두리는 전혀 적용되지 않는다 — 이는 보통 Renderer 자체의 정적 기본값을
덮어쓸 수 있는 `@card`와는 다른 점으로, `{styles}`는 `@img`에 있어
"덮어쓰기"가 아니라 순수한 "선택적" 스위치다.

> [!NOTE]
> **NOTE**: `radius`/`border`라는 기존 `(...)` 옵션 두 가지(위 표 참고)는
> 여전히 유효하며, 임의의 CSS 값(예: `border=2px dashed red`)이 필요한
> 상황을 위한 탈출구다. `{styles}`는 플랫폼 간 호환되는, 폐쇄형 token
> 집합을 사용하는 간소화된 표기법이다. 둘 다 동시에 나타나는 경우
> Renderer는 `{styles}`가 대응하는 `(...)` 옵션을 덮어쓰도록(SHOULD)
> 해야 한다(`{radius-N}`이 `radius=`를 덮어쓰고, `{#RRGGBB}`가 `border=`를
> 덮어씀). 둘을 중첩 적용하거나 오류를 던져서는 안 된다.

---

### Table

`@table`의 내부 구조는 `@cols` + `@data`라는 두 개의 전용 자식 노드로 고정되어 있으며, **순서가 고정되어 있고 둘 다 필수**다:

```text
@table[
    @cols[id,name,price]

    @data[
        [1,아침,60]
        [2,점심,80]
        [3,저녁,90]
    ]
]
```

* `@cols[...]`: 구분자로 구분된 칼럼 제목 목록으로, 칼럼의 순서와 개수를 정의한다. 각 칼럼은 `@data`의 셀과 마찬가지로 `cell`(아래 참고)이며, 순수 텍스트 식별자로 한정되지 않는다.
* `@data[...]`: 각 행은 `[...]` 안에 감싸여 있으며, 그 행의 **너비**는 `@cols`에서 정의한 칼럼 수와 같아야(MUST) 한다(`@span(n)` 셀은 `n`, 나머지 셀은 각각 1로 센다). 너비가 다른 행은 diagnostic으로 보고된다 — 아래 "행 너비"를 참고.

#### 셀 구분자: `|` 또는 `,`(v0.1.2)

`@cols`와 각 `@data` 행은 원래 `,`로만 셀을 나누었기 때문에, 그 자체에 쉼표가 들어 있는 셀(`$1,500`, `Web, iOS, Android`, `DECIMAL(10,2)`)을 쓸 방법이 없었고, 조용히 칼럼이 하나 더 생겼다. v0.1.2부터 구분자는 **행마다** 다음의 기계적인 규칙 하나로 결정된다:

```text
어떤 행의 최상위 수준에 "|"가 나타나면 그 행은 "|"로 나눈다.
그렇지 않으면 기존처럼 ","로 나눈다.
```

```text
@table[
    @cols[시간|강연|연사]

    @data[
        [09:00 - 10:30|개막 강연|왕샤오밍]
        [10:30 - 11:00|@span(2)[휴식]]
        [11:00 - 12:00||데이터 엔지니어링 분과]
        [13:30 - 15:00|표 문법 설계|천다원, 린메이화]
    ]
]
```

* **`|` 모드에서 `,`는 일반 텍스트다** — 이스케이프도 제한도 필요 없다(위 마지막 행의 연사 셀 참고).
* **`,` 모드는 변경 없음.** `|`가 없는 행은 이전과 완전히 똑같이 파싱되므로 기존 문서는 마이그레이션이 필요 없다. 쉼표 형식은 구식으로 간주되며, Editor Mode 구현은 이를 더 이상 권장하지 않음으로 표시해도 된다(MAY).
* **최상위 구분자만 나눈다.** 중첩된 노드 자신의 대괄호 안에 있는 `|`나 `,`(`@bold[a,b]`, `@raw[a|b]`)는 리터럴로 남는다 — 셀 분할은 대괄호 깊이를 따르며 registry를 조회하지 않는다. 셀에 리터럴 `|`가 필요하면 `@raw[...]`로 감싼다. `|`가 필요한 내용은 대개 코드이며, 의미상으로도 그것이 올바른 노드다.
* **빈 셀은 반드시 써야 한다.** `[11:00 - 12:00||데이터 엔지니어링 분과]`의 가운데 셀은 의도적으로 비워 둔 것이다.
* **앞뒤에 붙은 `|` 하나는 장식으로 간주되어 제거되며, 양쪽 끝은 각각 독립적으로 판단한다.** `[|a|b|c|]`(Markdown 표의 습관), `[|a|b|c]`, `[a|b|c|]`, `[a|b|c]`는 모두 똑같이 파싱된다. 대가: 가장자리의 `|`로는 "정말로 비어 있는 첫 번째/마지막 셀"을 표현할 수 없다 — 자리 표시 내용을 넣거나 칼럼을 조정할 것. 행 중간의 빈 셀은 영향을 받지 않는다.
* 셀을 `<...>`로 감싸는 것은 피할 것 — 그 형태는 `<action>` 슬롯을 위해 예약되어 있다.

#### 칼럼에 걸치는 셀: `@span(n)[...]`(v0.1.2)

```text
[10:30 - 11:00|@span(2)[휴식]]
```

내용이 **정확히 하나**의 `@span(n)[...]` 노드(`n`은 양의 정수)인 셀은 `n`개 칼럼에 걸치며, 행의 너비를 셀 때 1이 아니라 `n`으로 계산되므로 "모든 행의 너비가 칼럼 수와 같다"는 규칙에 예외가 없다. 위 예에서 그 행은 실제 셀이 2개이지만 너비는 1 + 2 = 3으로, `@cols`의 세 칼럼과 일치한다. Renderer는 이를 자체의 colspan 개념에 대응시킨다(HTML: `<td colspan="n">`).

* `@span`은 **`@data` 셀의 유일한 내용**일 때만 유효하다. `@cols` 안, 표 바깥, 또는 셀 안에서 다른 내용과 섞여 있으면 위치가 잘못된 노드이며, `@tabs` 바깥의 `@tab`과 같은 방식으로 표시된다.
* `n`은 단순한 양의 정수여야 한다(MUST). `@span(two)`, `@span(0)`, `@span(2.5)`는 각각 별도의 diagnostic으로 보고된다. 행 너비 검사에서 그런 셀은 너비 1로 계산되므로, 같은 근본 원인이 두 번 보고되지는 않는다.
* `@hex`와 `@span`은 셀 허용 목록에 들어 있다(색상 견본 표가 `@hex`의 가장 흔한 용도이고, `@span`은 여기서만 의미가 있다). `@spoiler`는 의도적으로 목록에 **포함되지 않는다** — 클릭해서 여는 스팬을 표 셀에 두는 것은 어울리지 않기 때문이다.
* `@span` 자체에는 스타일이나 레이아웃상의 의미가 없다 — 1절의 참고를 볼 것.

#### 행 너비

행의 너비(`@span` 포함)가 `@cols`의 칼럼 수와 같지 않으면, 그 행이 **어떤 구분자를 쓰든** diagnostic으로 보고된다. Parser는 자동으로 채우거나 잘라내지 않는다: 조용히 불일치로 두면 칼럼이 제목과 어긋난 표가 렌더링된다. 이 diagnostic은 Strict Mode에서는 error이고, Editor Mode에서는 보고되지만 차단하지 않는 diagnostic이며, 문제가 있는 행을 가리킨다.

> [!TIP]
> **TIP**: `@cols`와 `@data`의 순서가 고정되어 있고 둘 다 필수인 것은
> 의도적인 설계 상의 트레이드오프다 — 약간의 유연성을 희생하는 대신
> Parser와 AI가 콘텐츠를 생성할 때의 높은 예측 가능성을 얻는다.

각 `cell`은 단순한 순수 텍스트가 아니다 — 텍스트 자체 외에도, 엄선된 인라인 서식 노드 집합(`@bold`, `@italic`, `@underline`, `@del`, `@mark`, `@color`, `@sup`, `@sub`, `@link`, `@fn`, `@hex`, `@span`, 그리고 줄바꿈으로 변환되는 `@n`)을 허용한다. 이 노드들은 텍스트의 표현 방식만 바꿀 뿐, 표 자체의 "칼럼이 데이터 행과 정렬된다"는 구조에는 영향을 주지 않기 때문이다. 이 목록은 Renderer 쪽(`registry.ts`의 `isCellAllowedNode`)에서 관리되며, 문법 레벨 자체는 목록 내용을 제한하지 않으므로 앞으로 확장될 수 있다. 목록에 없는 노드(예: 자체 레이아웃 구조를 가져오는 `@card`, `@table`, `@details` 같은 블록 노드)는 조용히 버려지는 대신 반드시(MUST) 문법 오류를 던져야 한다 — 이는 Strict Mode(Inline Syntax Specification 11절)의 "오류를 삼키기보다는 차라리 오류를 던진다"는 정신과 일치한다.

> [!NOTE]
> **예외**: raw 계열 노드(`@code`, `@mermaid`, `@raw`, `@kbd`)도 `isCellAllowedNode` 목록에는 없지만, 이들은 "자체 레이아웃 구조를 가져오는 블록 노드"도 아니고, 위의 MUST 오류 규칙도 적용되지 않는다 — `Parser.ts`(`parseInlineCellList`)는 이들의 원본 내용을 오류를 던지거나 실제 노드로 파싱하는 대신, 의도적으로 셀 안의 순수 텍스트로 평탄화(flatten)한다. 이는 `@card`/`@table`/`@details` 같은 구조 노드와는 별개로 처리되는 독립적인 동작이며, 자세한 내용은 `registry.ts`(`CELL_ALLOWED_INLINE` 위쪽 주석)와 `Parser.ts`(`parseInlineCellList` 위쪽 주석)를 참고.

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
    ├── Row [1, 아침, 60]
    ├── Row [2, 점심, 80]
    └── Row [3, 저녁, 90]
```

혹은 인라인 서식이 있는 셀의 경우:

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

`@svg`는 `@code`/`@mermaid`와 마찬가지로 `raw-block-content`에 속한다 — 내용은 그대로 보존되며, Parser는 파싱하거나 이스케이프 처리하지 않는다:

```text
@svg[
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <circle cx="5" cy="5" r="4" />
</svg>
]
```

> [!TIP]
> **TIP**: `@svg`의 내용은 **신뢰 경계(trust boundary)**다 — `@code`처럼 텍스트로
> 표시되는 것이 아니라, Renderer에 의해 그대로 출력되어 브라우저가 실제로
> 렌더링하는 벡터 이미지가 된다. Renderer는 출력 전에 `<script>`와 `on*=`
> 이벤트 속성을 걸러내야(SHOULD) 한다(Adapters.ts의 `sanitizeSvg()` 참고).
> 다만 이는 Renderer의 책임이지 문법 레벨에서 보장하는 것이 아니므로, 신뢰할
> 수 없는 출처의 `@svg` 내용은 더 이른 단계에서 콘텐츠 검수를 거쳐야 한다.

---

## 6. 컨테이너 블록

`@details`/`@card`는 이제 **선택적인** `{styles}`(문법 정의는 4절 참고)도
받을 수 있으며, `(title)` 뒤, `block-content` 앞에 위치한다:

```text
@card(API Key){#3366ff,radius-12}[
설명 내용을 여기에 넣으세요.
]
```

생략하면 순수 콘텐츠 형태를 유지하며, 둘 다 합법적이다. Renderer는
인식할 수 없는 token을 무시할 수 있다(MAY)(Inline Spec §6 Unknown Command
Fallback의 정신과 일치). `@card`의 `{styles}` token 시맨틱은 자체적인 폐쇄형
규칙(`Card Style v1`)이며, Inline Spec 7절의 구체적 이름 color token 대응표와는
무관하다 — 아래 "Card Style v1" 소절 참고.

### Details

```text
@details(추가 정보 펼치기)[
내용
]
```

HTML:

```html
<details>
    <summary>추가 정보 펼치기</summary>
    내용
</details>
```

---

### Card

```text
@card(API Key)[
설명 내용을 여기에 넣으세요.
]
```

#### Card Style v1

`@card`의 `{styles}`는 소수의, 플랫폼 간 호환되고 가치가 높은 스타일만
허용하며, 의도적으로 범용 CSS 탈출구로 만들지 않았다 — 현재는 다음 두 가지
token 형태만 인식하며, 각각 단독으로 나타나거나 둘을 함께 사용하거나(쉼표로
구분, 순서 무관), 아예 생략할 수 있다:

| Token 형태 | 시맨틱 | 예시 |
|---|---|---|
| `#RRGGBB`(16진수 hex) | 배경색, 해당 색상 값을 그대로 사용 | `@card{#3366ff}[...]` → `background-color: #3366ff` |
| `radius-N`(N은 0 이상의 정수) | 모서리 둥글기, `N`은 픽셀 값 | `@card{radius-12}[...]` → `border-radius: 12px` |

```text
@card{#3366ff,radius-12}[
배경색과 모서리 둥글기를 동시에 설정합니다.
]
```

위 표에 없는 token(예: 구체적 이름의 색상 단어, Inline Spec 7절의 color
token)은 모두 인식할 수 없는 것으로 간주하며, Renderer는 오류를 던지는 대신
반드시(MUST) 무시하고(Inline Spec §6 Unknown Command Fallback의 정신과 일치)
자체 기본 외관을 유지해야 한다. `radius-N`의 `N`이 순수한 숫자가 아닌 경우
(예: `radius-lg`)도 마찬가지로 인식할 수 없는 것으로 간주한다.

---

## 7. 콜아웃 블록

`@note`, `@tip`, `@important`, `@warning`, `@caution`은 모두 **선택적인**
`(title)`(정의는 4절 참고)을 함께 사용할 수 있으며, 이는 본문과 독립된
제목 필드를 콘텐츠에 추가한다. 또한 **선택적인** `{styles}`(4절과 6절
Container Blocks의 동일한 설명 참고)도 `(title)` 뒤에 함께 사용할 수 있다.
둘 다 생략하면 순수 콘텐츠 형태를 유지하며, 어느 쪽이든 합법이다:

### Note

```text
@note[
이것은 일반 정보입니다.
]
```

---

### Tip

```text
@tip[
이것은 모범 사례 제안입니다.
]
```

---

### Important

```text
@important[
이 내용을 먼저 읽어주세요.
]
```

---

### Warning

```text
@warning[
삭제하면 복구할 수 없습니다.
]
```

제목과 함께 사용:

```text
@warning(데이터 보관 정책)[
삭제하면 복구할 수 없습니다.
]
```

---

### Caution

```text
@caution[
이 작업은 데이터 손실을 초래할 수 있습니다.
]
```

---

## 8. 위젯 블록

### Tabs

`@tabs` 내부는 **오직** 하나 이상의 `@tab` 자식 노드만 포함할 수 있으며, 다른 block-node나 순수 텍스트는 허용하지 않는다:

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

* `@tab(제목)[내용]`: `제목`은 탭에 표시되는 이름이며, `내용`은 완전한 `block-content`(임의의 block-node와 inline-stream을 포함할 수 있다)이다.
* 만약 `@tabs[...]` 내부에 `@tab`이 아닌 노드(예: 순수 텍스트나 다른 block-node)가 나타나면, Parser는 반드시(MUST) 이를 문법 오류(Strict Mode)로 처리하거나, Editor Mode가 자동으로 무시/수정을 제안해야 한다.

* **고유 id(v0.1.2).** 탭 위젯용 DOM id를 출력하는 renderer는 그 id가 *문서 전체*에서 고유하도록 해야 한다(MUST). 각 `@tabs` 블록 안에서 panel에 0부터 번호를 매기면, 한 문서의 두 `@tabs`가 모두 `tab-panel-0`, `tab-panel-1`, …을 출력하여 트리거의 `aria-controls`가 정확히 하나의 panel로 해석되지 않는다. 참조 구현은 문서마다 하나씩 증가하는 widget 카운터를 붙인다(`tab-panel-<widget>-<index>`).
* **초기 상태.** 참조 구현은 첫 번째 탭을 선택된 것으로 표시한다(트리거에 `aria-selected="true"`, panel에 `data-active="true"`). 이로써 스크립트가 실행되기 전에도 위젯이 올바른 초기 상태를 가진다.

> [!TIP]
> **TIP**: `@tab`을 `block-node`에 포함시키지 않은 이유는, `@tabs` 이외의
> 곳(예: 문서 최상위에 직접 배치)에서 잘못 사용되는 것을 막기 위해서다.
> 이는 Inline Spec의 `@raw` Opaque Domain 설계 정신과 유사하다 — 특정
> 문법은 특정 컨텍스트 안에서만 유효하다.

---

### Mermaid

```text
@mermaid[
graph TD
A --> B
]
```

---

## 9. 메타데이터

```text
@meta[
title = @Doc
author = WEDC
description = AI Native Document Format
keywords = parser,ast,dsl
]
```

Renderer는 다음으로 매핑될 수 있다:

* HTML Meta Tags
* OpenGraph
* PDF Metadata
* DOCX Properties
* Search Index
* RAG Metadata

---

## 10. 핵심 원칙

@Doc Block Syntax의 목표는 새로운 HTML을 만드는 것이 아니다.

목표는 다음을 만드는 것이다:

> Human Editable
> Machine Deterministic
> AI Friendly
> Cross Platform

형태의 문서 AST다.

HTML은 Renderer다.

Markdown은 Renderer다.

React는 Renderer다.

반면 @Doc는:

> Source of Truth.

---

## 11. 간소화 문법 별칭

일부 사용 빈도가 높은 명령어는 추가로 간소화 별칭(Simplified Alias)을 제공한다 — 이는 순전히 입력 시의 축약형이며, Parser는 이를 정식 이름으로 정규화한 뒤에야 AST 노드를 생성한다(`node.type`은 항상 정식 이름이다). Renderer는 작성자가 실제로 어느 표기를 입력했는지 전혀 구분할 필요가 없고, 구분하지도 않는다.

Block Syntax가 포함하는 별칭:

| Canonical | Alias |
|---|---|
| `@heading` | `@h` |
| `@paragraph` | `@p` |

(Inline Syntax의 `@bold`/`@italic`/`@underline` 별칭 `@b`/`@i`/`@u`는 Inline Syntax Specification에 정의되어 있다.)
