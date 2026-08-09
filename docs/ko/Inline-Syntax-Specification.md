# @Doc Inline Syntax Specification v1.4

> 🌐 다른 언어 버전: [English](../en/Inline-Syntax-Specification.md) ・ [繁體中文](../zh-tw/Inline-Syntax-Specification.md) ・ [简体中文](../zh-cn/Inline-Syntax-Specification.md) ・ [日本語（AI 翻訳、誤りがある可能性があります）](../ja/Inline-Syntax-Specification.md)
>
> ⚠️ **이 문서는 AI가 번역했습니다. 부정확한 내용이 포함될 수 있습니다.** 정확한 내용을 확인하려면 [繁體中文版](../zh-tw/Inline-Syntax-Specification.md) 또는 [English 버전](../en/Inline-Syntax-Specification.md)을 참고하세요.

## 0. 목차

* [1. 설계 철학](#1-설계-철학)
* [2. Lexer 동작 정의](#2-lexer-동작-정의)
* [3. 모호성 해결 규칙](#3-모호성-해결-규칙)
* [4. 완전한 EBNF 문법 정의](#4-완전한-ebnf-문법-정의)
* [5. 이스케이프 규칙](#5-이스케이프-규칙)
* [6. 알 수 없는 명령어 폴백](#6-알-수-없는-명령어-폴백)
* [7. @mark / @color / @bordered 스타일 시맨틱스](#7-mark--color--bordered-스타일-시맨틱스)
* [8. @link URI 시맨틱스](#8-link-uri-시맨틱스)
* [9. @raw 불투명 영역](#9-raw-불투명-영역)
* [10. 중첩 파싱](#10-중첩-파싱)
* [11. 파서 복구 전략](#11-파서-복구-전략)
* [12. 아키텍처](#12-아키텍처)
* [13. 핵심 원칙](#13-핵심-원칙)
* [14. 간소화 문법 별칭](#14-간소화-문법-별칭)

---


## 1. 설계 철학

@Doc는 다음을 채택한다:

> **Only Known Commands Trigger Parsing**

오직 이미 알려진 명령어만 문법적 의미를 가진다.

알 수 없는 명령어는 항상 일반 텍스트로 간주된다.

이 설계의 목표는 다음과 같다:

* 학습 비용 절감
* Email, Mention 시스템과의 충돌 회피
* AI 파싱 안정성 향상
* 에디터의 오류 허용 능력 향상
* DSL의 확장 가능성 유지
* 안정적이고 예측 가능한 AST 구축

---

## 2. Lexer 동작 정의

### 명령어 파싱 규칙

Lexer가 `@`를 스캔하면 다음 우선순위에 따라 처리해야 한다:

1. 다음이 `@@`인 경우

   * 단일 순수 텍스트 `@`로 파싱한다

2. 다음이 이미 등록된 명령어 이름과 일치하는 경우

   * 해당 문법 파싱 흐름으로 진입한다

3. 어떤 알려진 명령어와도 일치하지 않는 경우

   * 전체를 일반 텍스트로 출력한다

---

### 예시

| 입력                 | 결과            |
| ------------------ | ------------- |
| `@mark[hello]`     | `mark` 노드로 파싱됨 |
| `@@mark`           | `@mark` 출력    |
| `test@example.com` | 순수 텍스트           |
| `@GitHub`          | 순수 텍스트           |
| `@unknown`         | 순수 텍스트           |

---

## 3. 모호성 해결 규칙

@Doc는 다음을 채택하고 있으므로:

> Known Command Recognition

Lexer는 먼저 알려진 명령어를 인식하려 시도한 뒤에야 일반 텍스트 모드로 되돌아가야 한다.

다시 말해:

> `inline-node`의 우선순위가 `plain-text-char`보다 높다.

Lexer는 다음을 따라야 한다:

```text
@ 로 시작
↓
@@ 인가?
↓
Command Registry에 존재하는가?
↓
예 → Inline Node
아니오 → Plain Text
```

따라서:

```text
@mark[hello]
```

는 반드시 다음과 같이 파싱되어야 하며:

```text
InlineNode(mark)
```

다음과 같이 되어서는 안 된다:

```text
Text('@')
Text('m')
Text('a')
Text('r')
Text('k')
...
```

---

## 4. 완전한 EBNF 문법 정의

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
(* @bordered는 @color와 정확히 동일한 {styles} 슬롯과 색상 팔레트를 공유하며(§7 참고),
   전경색 대신 텍스트 테두리에 적용된다. *)
bordered  = "@bordered" , [ styles ] , content ;
bold      = ( "@bold" | "@b" ) , content ;
italic    = ( "@italic" | "@i" ) , content ;
underline = ( "@underline" | "@u" ) , content ;
del       = "@del" , content ;

raw       = "@raw" , raw-content ;

sup       = "@sup" , content ;
sub       = "@sub" , content ;

(* Footnotes:
   fn   = 본문에서의 참조 지점(위 첨자), 번호만 가진다
   defn = 각주 정의 본체, 번호와 실제 내용을 가진다
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

(* raw-content의 실제 종료 규칙은 "대괄호 깊이 카운트"이며, "이스케이프되지
   않은 첫 번째 ]를 만났을 때"가 아니다 — balanced-bracket-group은 재귀
   산출식으로 "내부에서 좌우 대괄호가 짝을 이루기만 하면 얼마든지 중첩할 수
   있고 이스케이프가 전혀 필요 없다"는 것을 표현한다. 진짜로 짝을 이루지
   못한 대괄호만 이스케이프가 필요하다.
   자세한 내용은 9. @raw 불투명 영역 참고. *)
raw-content =
    "[" , { raw-unit } , "]" ;

raw-unit =
      escaped-at-close-bracket   (* "@@]" → 리터럴 "@]" *)
    | escaped-at-open-bracket    (* "@@[" → 리터럴 "@[" *)
    | escaped-close-bracket      (* "@]"  → 리터럴 "]"(짝이 없는 ]에만 사용) *)
    | escaped-open-bracket       (* "@["  → 리터럴 "["(짝이 없는 [에만 사용) *)
    | balanced-bracket-group     (* 짝을 이루고 중첩 가능한 리터럴 대괄호, 내용 제한 없음 *)
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

(* Lexer의 추가적인 수렴 규칙: `text-char` 자체가 줄바꿈을 포함하므로, 문자
   그대로 해석하면 "닫히지 않은 "{"가 문서 뒤쪽 어느 "}"까지도 계속 삼킬 수
   있다"는 뜻이 된다 — 작성자가 아직 입력 중인 "{"가 그 사이의 모든 노드
   (예를 들어 아래 @code 블록 안의 중괄호 이전의 모든 내용)를 통째로 styles로
   삼켜버려 AST에서 조용히 사라지게 만든다. styles의 실제 의미는 쉼표로
   구분된 짧은 token 목록이며, 여러 줄에 걸치는 예시는 하나도 없다. 에디터의
   Monarch 규칙(/\{[^}]*\}/, 줄 단위 비교) 역시 원래 여러 줄을 지원하지
   않으므로, Lexer는 "}", 줄 끝, "["(콘텐츠 슬롯 시작) 세 가지 중 가장
   먼저 나타나는 위치에서 스캔을 멈추며, 줄 끝과 "[" 두 경우는 닫히지 않은
   것으로 간주한다. src/Lexer.ts의 scanStylesEnd()를 참고. *)
styles =
    "{" ,
        { text-char - "}" - newline - "[" } ,
    "}" ;

key =
    { text-char - "]" } ;

(* @color의 {styles} 내용에 대한 시맨틱 제약 — 전체 검증 규칙(
   /^#[0-9a-fA-F]{6}$/과 일치해야 함)은 §7을 참고. 이 종결기호 자체는
   문법 레벨일 뿐이며, 정확한 자릿수/대소문자 검증은 시맨틱 레벨에 속한다.
   아래 `styles`와 동일한 구분이다. *)
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
   plain-text-char는 inline-node보다 우선순위가 낮다.

   Lexer는 일반 텍스트로 폴백하기 전에 반드시(MUST) 항상
   알려진 명령어 인식을 먼저 시도해야 한다.
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

## 5. 이스케이프 규칙

### 문법

```text
@@
```

### 출력

```text
@
```

### 용도

사용자가 문법 키워드 자체를 출력하고 싶을 때 사용한다.

> 이는 **전역 이스케이프 규칙**이며, 일반적인 inline-stream 컨텍스트에 적용된다.
> `@raw` 내부에는 독립적인 이스케이프 규칙이 있다. [9. @raw 불투명 영역](#9-raw-불투명-영역)을 참고.

---

### 예시

입력:

```text
@@mark
```

출력:

```text
@mark
```

---

입력:

```text
@@bold[hello]
```

출력:

```text
@bold[hello]
```

---

입력:

```text
Email: test@@example.com
```

출력:

```text
Email: test@example.com
```

이 표기법은 유효하지만, 다음이:

```text
example
```

알려진 명령어가 아니므로, 실제로는 다음과 같이 바로 쓸 수 있다:

```text
Email: test@example.com
```

이스케이프가 필요 없다.

---

## 6. 알 수 없는 명령어 폴백

`@` 뒤에 합법적인 명령어 이름이 오지 않으면, 파서는 반드시 순수 텍스트 모드로 되돌아가야 한다.

예시:

```text
@github
```

출력:

```text
@github
```

---

```text
test@example.com
```

출력:

```text
test@example.com
```

---

```text
@my_custom_tag
```

출력:

```text
@my_custom_tag
```

---

이 규칙은 다음과의 충돌을 효과적으로 방지한다:

* Email
* 소셜 계정
* Discord Mention
* GitHub Username
* Chat Mention System

---

## 7. @mark / @color / @bordered 스타일 시맨틱스

`@mark`는 선택적인 `styles` 수식 문법을 지원한다:

```text
@mark{style}[content]
```

여기서:

* `style`은 쉼표로 구분된 스타일 토큰 문자열(style token list)이다.
* `content`는 마크가 적용될 텍스트 내용이다.
* `styles`는 **선택적(optional)** 문법이며, 생략하면 순수한 하이라이트 마크와 동일하다:

```text
@mark[중요한 내용]
```

---

### Style Token 시맨틱

`style` 내용은 쉼표로 구분된 **색상 Token(Color Token)** 문자열이며, 하이라이트 색상을 나타낸다. Renderer는 그 시맨틱에 따라 실제 색상 값에 대응시킨다. 두 가지 표기법 중 하나를 선택해 사용할 수 있다:

* **구체적 이름 Token**(실제 색상 값은 Renderer가 자체적으로 정의):

  ```text
  yellow / red / green / blue / orange / purple / gray
  ```

* **16진수 Hex Token**(`#`으로 시작하고 16진수 6자리, 대소문자 모두 허용, Renderer는 지정된 값을 반드시(MUST) 그대로 사용해야 하며 재매핑해서는 안 된다):

  ```text
  #ff0000 / #3366FF / #00c896
  ```

  `/^#[0-9a-fA-F]{6}$/` 형식에 맞지 않는 token(예: `#f00`, `#gggggg`)은 합법적인 hex token으로
  간주하지 않으며, 일반적인 Unknown Command Fallback의 오류 허용 정신을 따른다(아래 Renderer
  동작 참고).

> **변경 이력**: 이전 버전에서는 `underline`/`strikethrough`/`bordered`라는 세 가지 수식 Token이 별도로 정의되어 있었으나 제거되었다. `underline`은 `@underline` 노드와 시맨틱이 중복되고, `strikethrough`는 `@del` 노드와 시맨틱이 중복되며, `bordered`는 독립 노드 `@bordered`로 승격되었다(아래 참고). `style`은 이제 색상 시맨틱만 담당하며, 더 이상 수식 시맨틱과 혼용되지 않는다.

---

### 예시

```text
@mark[기본 하이라이트]
@mark{yellow}[노란색 하이라이트]
@mark{red}[빨간색 하이라이트]
@mark{#3366ff}[16진수 배경색]
```

---

### @color — 텍스트 색상 변경

`@mark`가 바꾸는 것은 **배경**(하이라이트)이며, 텍스트 자체의 색상은 바꿀 수 없다. `@color`는 이 기능을 보완한다:

```text
@color{#ff0000}[이 텍스트는 빨간색이다]
```

`@color`는 `@mark`와 동일한 `{styles}` 필드를 공유하며(위 EBNF 참고), 그 자체는 **선택적**이다 ——
생략하면 Renderer는 기본 색상으로 되돌아가며, 이는 `@mark[content]`에서 `{styles}`를 생략했을 때와
동일한 동작이다.

```text
@color{blue}[이 텍스트는 짙은 파란색이다]
```

`@color`는 `@mark`와 동일한 일곱 개의 구체적 이름 color token(`yellow`/`red`/`green`/`blue`/
`orange`/`purple`/`gray`)을 받아들이며, 단일 16진수 hex token(`/^#[0-9a-fA-F]{6}$/`)도 받아들인다.
둘은 문법적으로 동일한 token 이름 집합을 공유하지만, **대응하는 실제 색상 값은 서로 독립적**이다:
`@mark`의 색조는 연한 하이라이트 배경에 맞춰 조정된 것이라 텍스트 전경색으로 그대로 쓰면
대비가 부족해 읽기 어렵다. 따라서 Renderer는 보통(`@mark`의 대응표를 재사용하지 않고)
`@color` 전용의 더 짙은 톤의 대응표를 별도로 유지한다.
Renderer는 형식이 맞지 않거나 인식할 수 없는 값을 반드시(MUST) 무시하고 오류를 던지는 대신
어떤 기본값을 fallback으로 사용해야 한다:

```text
@color{not-a-color}[이 텍스트는 색이 지정되지 않아 기본 색상으로 돌아간다]
```

> [!IMPORTANT]
> **이전 문법은 폐지되었다**: `@color`의 초기 버전은 필수 `(hex-color)` 괄호
> (`@color(#ff0000)[...]`)를 사용했다. 그 문법은 제거되었으며, "무시하고 기본값으로
> 돌아가는" 방식이 아니라 Parser가 반드시(MUST) 직접 문법 오류를 던지거나(Strict Mode)
> 진단으로 표시해야 한다(Editor Mode) —— 괄호 표기법은 작성자가 색상이 실제로 적용되었다고
> 오해하게 만들 수 있는데, 실제로는 조용히 기본 색상이 적용되기 때문이다. 이런 "설정에
> 성공한 것처럼 보이지만 실제로는 아닌" 괴리는 즉시 오류를 표시하는 것보다 더 위험하므로,
> [6. 알 수 없는 명령어 폴백](#6-알-수-없는-명령어-폴백)의 오류 허용 정신이 적용되지 않는다.

---

### @bordered — 텍스트 테두리

`@bordered`는 텍스트에 테두리를 추가하며, `@color`와 완전히 동일한 `{styles}` 필드를 공유한다 —— 같은 괄호, 같은 선택성, 같은 일곱 개의 구체적 이름 token과 hex, 그리고 동일한 색상표(구현상 `@color`의 resolver를 그대로 재사용할 수 있다)를 공유하지만, **텍스트 색상**이 아니라 **테두리**에 적용된다는 점만 다르다:

```text
@bordered[기본 테두리]
@bordered{blue}[파란색 테두리]
@bordered{#3366ff}[16진수 테두리 색상]
```

`{styles}`를 생략하거나 인식할 수 없는 값을 지정하면, Renderer는 오류를 던지는 대신 기본 테두리 스타일을 fallback으로 사용하며, 이는 §6 알 수 없는 명령어 폴백의 오류 허용 정신과 일치한다. 이 노드는 이전에 `@mark`의 `{styles}`에 있던 `bordered` 수식 token을 대체하여 독립적인 1급 노드가 되었으며, `underline`(이미 `@underline`이 존재)과 `strikethrough`(이미 `@del`이 존재)와 동일한 역할을 한다.

---

### Renderer 동작

* Renderer는 최소한 `styles`가 생략되었을 때의 기본 하이라이트 스타일(`@mark`)/기본 테두리 스타일(`@bordered`)을 반드시(MUST) 지원해야 한다.
* Renderer는 각 구체적 이름 color token이 대응하는 실제 색상 값을 자체적으로 결정할 수 있다(MAY)(예를 들어 다크 모드와 라이트 모드에서 `yellow`가 다를 수 있으며, `@mark`와 `@color`/`@bordered`도 각자 다른 대응표를 유지할 수 있고 보통 그래야 한다. 이유는 위에서 설명한 바와 같다). 반면 16진수 hex token은 반드시(MUST) 지정된 값을 그대로 사용해야 하며 재매핑해서는 안 된다.
* Renderer는 인식할 수 없는 token(형식이 맞지 않는 hex token 포함)을 반드시(MUST) 무시해야 하며, 오류를 던지는 대신 어떤 기본값을 fallback으로 사용해야(SHOULD) 한다 —— 이 동작은 [6. 알 수 없는 명령어 폴백](#6-알-수-없는-명령어-폴백)에서 말하는 "알 수 없는 명령어는 순수 텍스트로 되돌아간다"는 오류 허용 정신과 일치하지만, 그 적용 범위는 `styles` 내부로 한정된다. `@mark[content]`/`@color[content]`/`@bordered[content]` 자체는 여전히 정상적으로 해당 노드로 파싱된다. fallback의 구체적인 형태는 Renderer가 자체적으로 결정한다: "추가 색상 없음"(기본 텍스트 색상/테두리 색상 유지)일 수도 있고, `@mark`가 `styles`를 생략했을 때의 기본 하이라이트 색상을 그대로 재사용하는 방식일 수도 있다(세 노드가 동일한 필드 형태를 공유하므로, 이렇게 하는 것이 시각적으로 자연스럽다).
* Token 간의 구분자는 반각 쉼표 `,`로 고정되며, 앞뒤로 임의 개수의 공백을 허용한다(Parser가 자동으로 trim해야 한다). 이 규칙은 `@mark`의 `styles`에 적용된다. `@color`/`@bordered`의 `{}` 안에는 단일 token(color token 또는 hex 값)만 허용되며, 쉼표 구분을 사용하지 않는다.

---

### EBNF 보충 설명

[4. 완전한 EBNF 문법 정의](#4-완전한-ebnf-문법-정의) 중 다음에 대응한다:

```ebnf
(* Lexer의 추가적인 수렴 규칙: `text-char` 자체가 줄바꿈을 포함하므로, 문자
   그대로 해석하면 "닫히지 않은 "{"가 문서 뒤쪽 어느 "}"까지도 계속 삼킬 수
   있다"는 뜻이 된다 — 작성자가 아직 입력 중인 "{"가 그 사이의 모든 노드
   (예를 들어 아래 @code 블록 안의 중괄호 이전의 모든 내용)를 통째로 styles로
   삼켜버려 AST에서 조용히 사라지게 만든다. styles의 실제 의미는 쉼표로
   구분된 짧은 token 목록이며, 여러 줄에 걸치는 예시는 하나도 없다. 에디터의
   Monarch 규칙(/\{[^}]*\}/, 줄 단위 비교) 역시 원래 여러 줄을 지원하지
   않으므로, Lexer는 "}", 줄 끝, "["(콘텐츠 슬롯 시작) 세 가지 중 가장
   먼저 나타나는 위치에서 스캔을 멈추며, 줄 끝과 "[" 두 경우는 닫히지 않은
   것으로 간주한다. src/Lexer.ts의 scanStylesEnd()를 참고. *)
styles =
    "{" ,
        { text-char - "}" - newline - "[" } ,
    "}" ;
```

`styles` 자체는 어휘 레벨에서 "중괄호로 감싼 임의의 문자 시퀀스"로만 정의되며, 실제 token 분리(쉼표로 구분하고 color token과 modifier token을 식별하는 것)는 **시맨틱 레벨(semantic level)**의 처리에 속한다. 이는 Lexer/Parser의 문법 레벨 책임이 아니라 Renderer나 이후의 시맨틱 분석 단계에 맡겨진다. 이렇게 설계하면 다음을 보장할 수 있다:

* 새로운 style token(예를 들어 앞으로 `italic`, `bold` 등을 추가)을 추가하더라도 EBNF 문법 정의 자체를 수정할 필요가 없다.
* 서로 다른 Renderer가 지원하는 token 집합을 자체적으로 확장하거나 축소할 수 있으며, 이는 [1. 설계 철학](#1-설계-철학)의 "DSL의 확장 가능성 유지"라는 목표와 부합한다.

---

## 8. @link URI 시맨틱스

`@link`는 합법적인 URI 또는 URI와 유사한 식별자(URI-like Identifier)를 모두 받아들인다.

```text
@link(uri)[content]
```

여기서:

* `uri`는 대상 리소스 식별자다.
* `content`는 표시되는 텍스트다.

---

### Renderer URI 추론

Renderer는 `uri`의 내용에 따라 URI Scheme을 자동으로 추론할 수 있다(MAY).

예를 들어:

| 입력                             | Renderer가 실제로 사용하는 URI           |
| ------------------------------ | ------------------------- |
| `@link(example.com)[공식 웹사이트]`     | `https://example.com`     |
| `@link(test@example.com)[문의하기]` | `mailto:test@example.com` |
| `@link(+886912345678)[고객센터 전화]`   | `tel:+886912345678`       |

---

`uri`에 이미 Scheme이 명시된 경우:

```text
@link(https://example.com)[공식 웹사이트]
@link(mailto:test@example.com)[문의하기]
@link(tel:+886912345678)[고객센터 전화]
```

Renderer는 반드시(MUST) 지정된 값을 그대로 사용해야 하며, 추론하거나 수정해서는 안 된다.

---

### 지원되는 URI 예시

다음은 모두 합법적인 `uri`다:

```text
https://example.com
mailto:test@example.com
tel:+886912345678
ftp://example.com/file.zip
discord://channel/123
vscode://file/path
file:///tmp/test.txt
```

@Doc 자체는 URI 유형을 제한하지 않는다.

URI의 실제 지원 여부는 Renderer가 결정한다.

---

## 9. @raw 불투명 영역

`@raw`는 다음에 속한다:

> Opaque Domain

파서가 다음에 진입하면:

```text
@raw[
```

이후:

* 내부의 어떤 문법도 파싱하지 않는다.
* `@mark`, `@bold`, `@link` 등 모든 키워드는 순수 텍스트로 간주된다.
* 전역 `@@` 이스케이프 규칙([5. 이스케이프 규칙](#5-이스케이프-규칙))은 더 이상 적용되지 않으며, raw 영역 안에는 독립적인 별도의 로컬 규칙이 있다(아래 참고).

### 종료 규칙: 대괄호 깊이 카운트이지 "첫 번째 `]`를 만났을 때"가 아니다

`@raw[...]`의 구현 모델은 **대괄호 깊이 카운트**이며, 이는 먼저 명확히 짚고 넘어가야 한다. 이스케이프 규칙을 언제 써야 하고 언제 쓰지 말아야 하는지가 여기서 직접 결정되기 때문이다:

* `[`는 깊이를 +1 시키고, `]`는 깊이를 -1 시킨다. 깊이가 0으로 돌아가는 그 `]`가 진짜 끝이다.
* 다시 말해, **대괄호가 짝만 맞으면 그대로 옮겨 적으면 되며, 이스케이프가 전혀 필요 없다** —— `@raw[@mark[hello]]` 안의 `@mark[hello]`는 그 자체로 좌우 괄호가 짝을 이루므로, Parser는 가장 바깥쪽 `]`에서 올바르게 종료하며 `@mark[hello]`를 원문 그대로 출력한다.
* 이스케이프 규칙이 존재하는 이유는 오로지 **짝이 맞지 않는** 대괄호를 위해서다 —— 예를 들어 단독으로 리터럴 `]`를 하나 쓰고 싶거나, 그 자체로 괄호가 불균형한 내용 조각을 인용하고 싶을 때다. 이미 짝이 맞는 대괄호에 불필요하게 이스케이프를 추가하면(예를 들어 `@mark[hello]`의 끝을 `@mark[hello@]`로 쓰면), 이스케이프가 소모한 그 `]`는 깊이 카운트를 0으로 되돌리지 **못하며**, 그러면 앞의 `@mark[`이 만든 깊이 +1은 대응되는 `]`를 영원히 찾지 못하고, Parser는 바깥쪽의 더 많은 내용(심지어 문서 전체)을 삼킬 때까지 계속 뒤로 찾다가 결국 오류를 낸다. **균형 잡힌 괄호는 그대로 쓰고, 균형이 맞지 않는 괄호는 반드시 이스케이프하며, 이스케이프 문자는 깊이 카운트에 참여하지 않는다.**

이스케이프 규칙은 대칭적이다 —— `]`와 `[` 각각에 "단일 문자 이스케이프"와 "'@' 자체를 이스케이프한 뒤 해당 문자가 따라오는" 두 가지가 있어 총 네 가지이며, 스캔 시 다음 우선순위로 비교한다(더 길고 더 명확한 시퀀스가 우선):

| 우선순위 | 입력   | 출력   | 설명                          |
| ------ | ------ | ------ | ----------------------------- |
| 1      | `@@]`  | `@]`   | 리터럴 `@]` 두 글자를 출력         |
| 2      | `@@[`  | `@[`   | 리터럴 `@[` 두 글자를 출력         |
| 3      | `@]`   | `]`    | **짝이 없는** 리터럴 `]`를 출력(깊이 카운트에 영향 없음) |
| 4      | `@[`   | `[`    | **짝이 없는** 리터럴 `[`를 출력(깊이 카운트에 영향 없음) |

---

### 예시

입력:

```text
@raw[@mark[hello]]
```

출력:

```text
@mark[hello]
```

> 설명: `@mark[hello]` 자체는 괄호가 짝을 이루므로 깊이 카운트가 1→2→1로 움직이며, 가장 바깥쪽 `]`에서야 깊이가 0이 되어 `@raw`가 종료된다. **어떠한 이스케이프도 필요 없다** —— 이는 가장 흔한 사용법이다(raw 내용 안에서 괄호가 완전히 균형 잡힌 @Doc 문법 한 조각을 그대로 보여주는 경우).

---

입력:

```text
@raw[@@]
```

출력:

```text
@@
```

> 설명: 여기서 `@@` 바로 뒤에 이어지는 것은 raw-content의 끝을 나타내는 `]`이므로,
> `@@]` 특수 케이스(연속된 세 글자여야 함)는 발동되지 않는다.
> 따라서 일반 문자 `@@`(전역 이스케이프가 비활성화되어 있으므로 그대로 출력) + 끝을 나타내는 `]`로 분해된다.

---

입력:

```text
@raw[오늘은 내가@]들킬까 봐 무섭다]
```

출력:

```text
오늘은 내가]들킬까 봐 무섭다
```

> 설명: 여기서 `@]`는 **짝이 없는** 리터럴 `]`(앞에 대응하는 `[`가 없음)이므로 반드시 이스케이프해야 한다. 그렇지 않으면 이것이 `@raw` 자신의 끝으로 처리되어, 뒤에 있는 "들킬까 봐 무섭다" 부분이 raw 내용 밖으로 새어나가게 된다.

---

입력:

```text
@raw[오늘은 내가@@]들킬까 봐 무섭다]
```

출력:

```text
오늘은 내가@]들킬까 봐 무섭다
```

> [!TIP]
> **TIP**: 만약 사용자가 raw 내용 안에서 `@]`라는 2글자를 그대로 출력하고 싶다면,
> 앞에 `@`를 하나 더 붙이기만 하면 된다(즉 `@@]`). 이는 raw 영역 안의 로컬 이스케이프 특례이며,
> 5절의 전역 `@@` 이스케이프 규칙과는 서로 독립적이고 영향을 주지 않는다. `@[`/`@@[`는
> 완전히 대칭적인 또 다른 짝으로, 규칙은 동일하지만 방향만 반대다(짝이 없는 리터럴 `[`를 처리).

---

입력(이스케이프를 쓰지 말아야 할 곳에 쓴 경우 —— **잘못된 예**):

```text
@raw[여기 있는 @mark[hello@]는 그대로 유지됩니다]
```

> [!WARNING]
> **이렇게 쓰지 마세요**: `@mark[hello`의 `[`가 이미 깊이를 +1 시켰으므로, 작성자의 원래 의도는 `@mark[hello]`를 그대로 출력하는 것뿐이었다(위 첫 번째 예시와 마찬가지로 괄호가 원래부터 짝이 맞아 이스케이프가 전혀 필요 없다). 그런데 끝에 이스케이프 기호 `@]`를 하나 더 입력했다. 이스케이프가 그 `]`를 소모하면서도 깊이 카운트에는 참여하지 않으므로, `@mark[`이 만든 깊이 +1은 영원히 대응되는 `]`를 찾지 못한다 —— Parser는 바깥쪽의 더 많은 내용, 심지어 문서 전체를 삼킬 때까지 계속 뒤로 찾다가 오류를 낸다. 올바른 작성법은 불필요한 `@`를 제거하고 `@raw[여기 있는 @mark[hello]는 그대로 유지됩니다]`라고 바로 쓰는 것이다 —— 괄호가 짝을 이루므로 Parser가 스스로 올바르게 짝을 맞출 수 있으며, 사람이 개입할 필요가 없다.

---

## 10. 중첩 파싱

다음과 같으므로:

```ebnf
content-element =
      inline-node
    | plain-text-char ;
```

@Doc는 완전한 재귀적 중첩을 지원한다.

예를 들어:

```text
@bold[
    이것은 굵은 글씨이며,
    그 안에는
    @mark{yellow}[중요한 하이라이트]
    와
    @underline[밑줄]
    이 있습니다
]
```

그 AST 구조는 다음과 같다:

```text
Bold
├── Text
├── Mark
└── Underline
```

---

## 11. 파서 복구 전략

Parser가 닫히지 않은 구조를 만났을 때:

```text
@bold[hello
```

또는:

```text
@mark{red}[hello
```

다음 두 가지 모드를 제공하는 것을 권장한다:

### Strict Mode

바로 문법 오류를 던진다:

```text
Unexpected EOF while parsing @bold
```

> [!TIP]
> **TIP**: AtDoc는 바로 문법 오류를 던지는 방식을 선택했으며, 비동기 오류 브레이크포인트 복구 메커니즘을 사용한다

---

### Editor Mode

에디터가 누락된 닫는 기호를 자동으로 채워 넣을 수 있도록 허용한다:

```text
]
```

이를 통해 실시간 편집 경험을 향상시킨다.

---

## 12. 아키텍처

권장하는 파싱 흐름:

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

Renderer는 자유롭게 다음을 출력할 수 있다:

* HTML
* React
* PDF
* DOCX
* Markdown
* Discord
* Terminal
* Custom UI

---

## 13. 핵심 원칙

@Doc의 핵심 목표는 Markdown을 대체하는 것이 아니다.

목표는 다음과 같은:

> Human Editable
> Machine Deterministic
> AI Friendly
> Cross Platform

차세대 문서 중간 포맷을 만드는 것이다.

---

## 14. 간소화 문법 별칭

`@bold`/`@italic`/`@underline`은 간소화 별칭 `@b`/`@i`/`@u`를 제공한다 —— 이는 순전히 입력 시의 축약형이며, Parser는 이를 정식 이름으로 정규화한 뒤에야 AST 노드를 생성한다(`node.type`은 항상 정식 이름이다). Renderer는 작성자가 실제로 어느 표기를 입력했는지 전혀 구분할 필요가 없고, 구분하지도 않는다.

| Canonical | Alias |
|---|---|
| `@bold` | `@b` |
| `@italic` | `@i` |
| `@underline` | `@u` |

(Block Syntax의 `@heading`/`@paragraph` 별칭 `@h`/`@p`는 Block Syntax Specification §11에 정의되어 있다.)
