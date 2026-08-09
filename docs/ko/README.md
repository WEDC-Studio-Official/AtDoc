# @Doc — AI 네이티브 시맨틱 문서 표기법

<img src="https://wedc.cc/atd.png" width="64"/>

> 🌐 다른 언어 버전: [English](../en/README.md) ・ [繁體中文](../zh-tw/README.md) ・ [简体中文](../zh-cn/README.md) ・ [日本語（AI 翻訳、誤りがある可能性があります）](../ja/README.md)
>
> ⚠️ **이 문서는 AI가 번역했습니다. 부정확한 내용이 포함될 수 있습니다.** 정확한 내용을 확인하려면 [繁體中文版](../zh-tw/README.md) 또는 [English 버전](../en/README.md)을 참고하세요.

---

모든 세대의 문서 포맷은 그 시대의 가장 핵심적인 문제를 해결해 왔습니다:

| 포맷 | 해결한 문제 |
|:---|:---|
| **Word** | 문서 편집 |
| **HTML** | 문서 표시 |
| **Markdown** | 사람이 쓰기 쉬운 작성 |
| **JSON** | 데이터 교환 |
| **JSX** | 컴포넌트 조합 |
| **@Doc** | AI와 인간이 함께 작성하는 시맨틱 문서 표현 |

하지만 어떤 포맷도 AI가 생성하는 콘텐츠를 위해 설계되지 않았습니다.

---

**@Doc는 세 종류의 독자를 위해 설계되었습니다:**

- 콘텐츠를 작성하는 인간
- 콘텐츠를 생성하는 AI
- 콘텐츠를 렌더링하는 컴파일러

@Doc는 차세대 Markdown이 아닙니다.
LLM이 생성한 콘텐츠와 렌더러 사이에 빠져 있던 notation 계층입니다.

기존 주류 포맷은 대개 이 중 한두 가지만 최적화할 수 있을 뿐, 세 가지 모두를 1급 설계 목표로 삼는 경우는 드뭅니다:

| 특성 | Markdown | HTML | MDX | @Doc |
|:---|:---:|:---:|:---:|:---:|
| **AI 생성 안정성** | ❌ | ⚠️ | ❌ | ✅ |
| **토큰 효율** | ✅ | ❌ | ❌ | ✅ |
| **시맨틱 조회 가능성** | ❌ | ⚠️ | ⚠️ | ✅ |
| **다중 타깃 컴파일** | ❌ | ❌ | ⚠️ | ✅ |

---

## 기존 방식의 근본적인 문제

### Markdown — 인간의 작성을 위해 설계되었을 뿐, 기계 생성을 위한 것이 아니다

LLM이 Markdown을 읽는 것은 문제없습니다. 문제는 그 반대입니다. LLM에게 Markdown을 **생성**하게 하고 이를 다운스트림 프로그램이 파싱하도록 하면, 출력 구조를 신뢰성 있게 보장하는 것이 거의 불가능합니다 — 들여쓰기 모호성, 중첩 리스트 흐트러짐, 테이블 손상, 파서 방언 차이 등.

Markdown에는 시맨틱 의도가 없습니다. "이 버튼은 primary variant다"라거나 "이 테이블에는 얼룩말 무늬가 필요하다"와 같은 것을 표현할 수 없습니다.

---

### HTML — 구조와 표현이 뒤섞여 있다

HTML은 무엇이든 표현할 수 있지만, 그 대가로 표현 로직이 구조 안에 고정되어 버립니다. 같은 콘텐츠를 다른 플랫폼에 렌더링해야 한다면? 다시 써야 합니다. AI가 안정적인 HTML을 생성하도록 해야 한다면? 환각 태그와 닫히지 않은 요소의 위험을 마주하게 됩니다. HTML은 렌더링 타깃이지, notation이 아닙니다.

---

### MDX — 인간 개발자를 위해 설계되었고, 그 대가는 AI가 치른다

MDX는 문서와 코드를 융합해 인간 개발자에게 매우 높은 표현력을 제공합니다. 하지만 생성형 모델 입장에서 이 자유도는 다른 것을 의미합니다: 더 높은 문법 불안정성과 더 취약한 구조 예측 가능성입니다.

| 비교 축 | MDX | @Doc |
|:---|:---|:---|
| **본질적 위치** | 문서를 프로그램으로 만든다 (Code-driven) | 문서를 시맨틱 데이터로 만든다 (Data-driven) |
| **AI 생성 안정성** | 임의의 JS 로직을 허용해 LLM이 쉽게 문법 붕괴를 일으킨다 | 결정론적 문법으로 LLM 출력이 예측 가능하다 |
| **괄호 시맨틱** | `{}` `[]` `<>`의 의미가 다중으로 혼재한다 | `[]`의 전역적 의미는 오직 **Content(콘텐츠)** 뿐이다 |
| **토큰 비용** | 장황한 태그 닫기와 JS 보일러플레이트 | 문법이 극도로 압축되어 있다 (`w-[300px]`가 아닌 `w-300px`, 계획 중 — 아래 핵심 문법 절의 단서 참고) |
| **오류 처리** | 렌더링 시점에 붕괴하며, 한 글자만 틀려도 화면이 하얗게 된다 | 파싱 시점에 포착되어 AI가 몇 초 안에 스스로 수정할 수 있다 |

---

## @Doc란 무엇인가

동일한 @Doc 소스 코드는 한 글자도 수정하지 않고 Tailwind JIT HTML, Inline Style HTML, 또는 향후 어떤 렌더링 타깃으로도 깔끔하게 컴파일될 수 있습니다.

구조와 표현이 완전히 분리되어 있습니다. 시맨틱은 포맷 자체가 담당하며, 렌더러가 결정하지 않습니다.

---

## 핵심 문법

모든 노드의 장기적인 목표는 동일한 4-슬롯 구조입니다:

```
@node(modifier){styles}[content]<action>
```

| 슬롯 | 역할 | 예시 |
|---|---|---|
| `@node` | 노드 타입 | `@heading`(별칭 `@h`), `@paragraph`(별칭 `@p`), `@card` |
| `(modifier)` | 변형 또는 속성 | `(primary)`, `(ja)` |
| `{styles}` | 스타일 또는 메타데이터 | `{w-300px bg-fff}` |
| `[content]` | 콘텐츠 슬롯 ── **전역 유일** | `[Submit]` |
| `<action>` | 후행 액션 | `<submit>`, `<install>` |

> [!NOTE]
> **계획 중이며, 현재 문법이 아닙니다**: `<action>` 후행 슬롯은 현재 전혀 구현되어 있지 않습니다 — `src/Lexer.ts`에는 대응하는 Token 타입이 없고, Block/Inline Syntax Specification의 정식 EBNF에도 이 산출식은 없습니다. 위 표의 `{styles}`에 나온 `{w-300px bg-fff}` 같은 Tailwind class 문자열 예시 또한 미래를 내다본 예시일 뿐, 현재 문법이 아닙니다. 현재 `{styles}`는 쉼표로 구분된 색상 토큰(구체적 이름 또는 hex)만 허용하며, `@mark`/`@color`/`@bordered`에서 사용됩니다(자세히는 [Inline Syntax Specification 7절](./Inline-Syntax-Specification.md#7-mark--color--bordered-스타일-시맨틱스) 참고). 현재 파싱 가능하고 테스트로 커버되는 것은 `@node(modifier){styles}[content]` 4개 슬롯 중 앞의 세 슬롯뿐입니다.

`[]`는 @Doc에서 오직 하나의 의미만 가집니다: **콘텐츠**. 예외 없고, 탈출 지옥도 없습니다.

---

## 문법 예시

```
@meta[
title = @Doc 2026 Spec
description = AI-native semantic document runtime
]

@heading(1)[@Doc 프로젝트 규격]

@paragraph[이것은 일반 단락이며, 그 안에 인라인 시맨틱 노드를 포함하고 있습니다.]

@card(featured)[
  @heading[AI 네이티브 언어]
  @paragraph[결정론적 문법을 가진 구조화된 마크업 언어이며, 양방향 AST를 위해 설계되었습니다]
]

@table[
  @cols[id,name,price]
  @data[
    [1,아침,60]
    [2,점심,80]
    [3,저녁,90]
  ]
]
```

> [!NOTE]
> 다음 노드는 조정되었습니다: `@seo`, `@lang`은 `@meta`에 통합되었습니다. `@title`은 `@heading`(별칭 `@h`)으로 바뀌었습니다. `@text`는 `@paragraph`(별칭 `@p`)로 바뀌었습니다. `@btn`은 잠정적으로 폐기되었습니다. 위는 일부 예시이며, 실제 문법은 정식 규격 문서를 기준으로 합니다.

---

## 이중 트랙 컴파일

동일한 AST, 두 가지 출력, 소스 코드는 한 글자도 바뀌지 않습니다:

**경로 A — Tailwind JIT**
```html
<h1 class="text-lg w-[120px]">@Doc 프로젝트 규격</h1>
```

**경로 B — Universal Inline Style**
```html
<h1 class="text-lg" style="width: 120px;">@Doc 프로젝트 규격</h1>
```

동적 값은 AST 안에 원시 문자열이 아닌 구조화된 데이터(`{ prop: "w", value: "120px" }`)로 저장됩니다. 어떻게 렌더링할지는 백엔드 어댑터가 결정합니다.

---

## 노드 분류

### Core Nodes — 구조적 원소
문서의 골격이자 더 이상 쪼갤 수 없는 원자 단위입니다.

`@heading`(별칭 `@h`) `@paragraph`(별칭 `@p`) `@quote` `@code` `@list` `@img` `@table`

### Semantic Nodes — 시맨틱 컨테이너
두 가지 동작 방식이 있습니다:

- **Inline Semantic** — 태그가 붙은 인라인 요소로 렌더링됩니다: `@mark[중요]`, `@link(example.com)[링크]`
- **Block Metadata** — Host에 설정을 주입할 뿐 어떠한 HTML도 렌더링하지 않습니다: `@meta[key = value]`

---

## AI 개발자를 위한 안내

LLM이 직접 HTML을 생성하도록 하는 것은 취약합니다. @Doc는 모델에게 제약된 결정론적 문법을 제공합니다 — 오류는 렌더링 시점이 아니라 파싱 시점에 드러납니다.

`[]`가 콘텐츠 의미를 가진 유일한 괄호이기 때문에, 모델은 괄호 충돌을 추론할 필요가 없습니다.

토큰 비용도 더 낮습니다: Tailwind의 임의값 문법 `w-[300px]` 대신 `w-300px`를 씁니다 — 괄호는 컴파일러가 복원하며, 모델이 생성하지 않습니다(계획 중이며, 현재 `{styles}`는 색상 토큰만 지원합니다. 위 핵심 문법 절의 단서 참고).

---

## 웹 개발자를 위한 안내

```ts
import { tokenize } from './Lexer';
import { DocParser } from './Parser';
import { DocTranspiler } from './Adapters';

const tokens = tokenize(source);
const ast = new DocParser(tokens).parse();
const html = ast.map(node => DocTranspiler.toTailwindHTML(node)).join('\n');
```

@Doc 소스 코드를 입력하면 구조화된 AST가 출력되며, 이를 여러분의 기술 스택에 맞는 어댑터로 렌더링하면 됩니다. Parser와 Adapters는 추가 의존성 없이 그대로 여러분의 파이프라인에 넣을 수 있습니다.

---

## 설계 경계

@Doc는 의도적으로 프로그래밍 언어가 아닙니다. 이는 제약이 아니라 무기입니다.

- 변수 없음
- 조건문 없음
- 반복문 없음
- 매크로 시스템 없음

로직은 Host 애플리케이션이 책임집니다. @Doc는 구조만 책임지며, 동작은 책임지지 않습니다. 이 경계 덕분에 AI가 생성한 출력은 언제나 예측 가능합니다. 이 선은 의도적인 것이며 움직이지 않습니다.

---

## 현재 상태

핵심 Parser, Lexer, 그리고 이중 트랙 어댑터는 기본적으로 동작 가능한 상태입니다. 웹 네이티브 버전의 Lexer와 Parser는 활발히 개발 중입니다. 인터랙티브 Playground와 CLI 도구는 단기 개발 로드맵에 포함되어 있습니다.

@Doc는 LLM 출력과 렌더링 타깃 사이의 설계 공간을 탐구하기 위해 존재합니다. 핵심 기능은 이미 동작하며, 나머지 부분은 공개적으로 계속 구축되고 있습니다.

**목표: 2027년 1월 1일, 1.0 Production 등급 정식 출시.**

---

## 이 Repo에는 무엇이 있는가

```
src/            Lexer, Parser, registry(노드의 단일 진실 공급원), Adapters(HTML 렌더링의 두 경로)
src/editor/     Monaco류 에디터를 위한 Monarch tokenizer
tests/          Lexer/Parser용 Strict Mode 테스트 케이스와 각 노드의 렌더링 검증
configs/        editor/tooling용 노드 설정
*-Specification.md   언어의 권위 있는 문법 정의(EBNF + 시맨틱 규칙)
```

`Block-Syntax-Specification.md`와 `Inline-Syntax-Specification.md`는 문법의 권위 있는 출처입니다. 코드 주석에는 가끔 `Structural-Blocks.md`, `Container-Blocks.md`와 같은 노드별 보충 설명 문서가 인용되어 있는데, 이들은 v0.1 릴리스 범위에 포함되어 있지 않으며 해당 내용은 모두 위 두 규격 문서에서 찾을 수 있습니다.

---

## License

MIT — see [LICENSE](../../LICENSE).
