# @Doc — AI 原生语义文档表示法

<img src="https://wedc.cc/atd.png" width="64"/>

> 🌐 其他语言版本：[English](../en/README.md) ・ [繁體中文](../zh-tw/README.md) ・ [日本語（AI 翻译，可能有误）](../ja/README.md) ・ [한국어（AI 번역，可能有误）](../ko/README.md)

---

每一代文档格式，都在解决那个时代最核心的问题：

| 格式 | 解决的问题 |
|:---|:---|
| **Word** | 文档编辑 |
| **HTML** | 文档显示 |
| **Markdown** | 易于人类撰写 |
| **JSON** | 数据交换 |
| **JSX** | 组件组合 |
| **@Doc** | AI 与人类共同撰写的语义文档表示 |

但没有一种格式，是为 AI 生成内容而设计的。

---

**@Doc 为三种读者设计：**

- 撰写内容的人类
- 生成内容的 AI
- 渲染它的编译器

@Doc 不是下一个 Markdown。
它是 LLM 生成内容与渲染器之间缺失的那个 notation 层。

现有主流格式通常只能优化其中一到两项，很少同时把三者作为一级设计目标：

| 特性 | Markdown | HTML | MDX | @Doc |
|:---|:---:|:---:|:---:|:---:|
| **AI 生成稳定性** | ❌ | ⚠️ | ❌ | ✅ |
| **Token 效率** | ✅ | ❌ | ❌ | ✅ |
| **语义可查** | ❌ | ⚠️ | ⚠️ | ✅ |
| **多目标编译** | ❌ | ❌ | ⚠️ | ✅ |

---

## 现有方案的根本问题

### Markdown — 为人类书写设计，不为机器生成设计

LLM 读 Markdown 没问题。问题是反过来：让 LLM **生成** Markdown 并交给下游程序解析，输出的结构几乎无法被可靠保证——缩进歧义、嵌套清单漂移、表格损坏、parser 方言差异。

Markdown 没有语义意图。它无法表达「这个按钮是 primary variant」或「这个表格需要斑马纹」。

---

### HTML — 结构与展示混为一谈

HTML 可以表达任何东西，但代价是把展示逻辑写死在结构里。同一份内容要渲染到不同平台？重写。要让 AI 生成稳定的 HTML？面对幻觉标签与未闭合元素的风险。HTML 是一个渲染目标，不是一套 notation。

---

### MDX — 为人类开发者设计，代价由 AI 承担

MDX 将文档与代码融合，为人类开发者提供极高的表达能力。但这种自由度对生成式模型而言意味着另一件事：更高的语法不稳定性与更脆弱的结构可预测性。

| 对比维度 | MDX | @Doc |
|:---|:---|:---|
| **本质定位** | 把文档变成程序（Code-driven） | 把文档变成语义数据（Data-driven） |
| **AI 生成稳定性** | 允许任意 JS 逻辑，LLM 容易语法崩溃 | 确定性语法，LLM 输出可预测 |
| **括号语义** | `{}` `[]` `<>` 语义多重混淆 | `[]` 全域唯一含义就是 **Content（内容）** |
| **Token 成本** | 冗长标签闭合与 JS 样板代码 | 语法极度压缩（`w-300px` 而非 `w-[300px]`，规划中，见下方核心语法一节的但书） |
| **错误处理** | 渲染时崩溃，错一个字符白画面 | 解析时捕捉，AI 可秒级自我修正 |

---

## @Doc 是什么

同一份 @Doc 原代码，不修改任何字符，可以干净编译到 Tailwind JIT HTML、Inline Style HTML，或任何未来的渲染目标。

结构与展示彻底分离。语义由格式本身承载，不由渲染器决定。

---

## 核心语法

每个节点的长期目标是同一个四槽结构：

```
@node(modifier){styles}[content]<action>
```

| 槽位 | 角色 | 范例 |
|---|---|---|
| `@node` | 节点类型 | `@heading`（别名 `@h`）, `@paragraph`（别名 `@p`）, `@card` |
| `(modifier)` | 变体或属性 | `(primary)`, `(ja)` |
| `{styles}` | 样式或元数据 | `{w-300px bg-fff}` |
| `[content]` | 内容槽位 ── **全域唯一** | `[Submit]` |
| `<action>` | 尾缀动作 | `<submit>`, `<install>` |

> [!NOTE]
> **规划中，非现行文法**：`<action>` 尾缀槽位目前完全没有实作——`src/Lexer.ts` 没有对应的 Token 类型，Block／Inline Syntax Specification 的正式 EBNF 也没有这个产生式。上表 `{styles}` 的 `{w-300px bg-fff}` 这类 Tailwind class 字符串范例同样是前瞻性示意，不是现行语法：现行 `{styles}` 只接受逗号分隔的颜色 token（具名色或 hex），用于 `@mark`／`@color`／`@bordered`（见 [Inline Syntax Specification 第 7 节](./Inline-Syntax-Specification.md#7-mark--color--bordered-styles-semantics)）。目前唯一可解析、有测试覆盖的是 `@node(modifier){styles}[content]` 四槽中的前三槽。

`[]` 在 @Doc 中只有一个含义：**内容**。没有例外，没有逃逸地狱。

---

## 语法范例

```
@meta[
title = @Doc 2026 Spec
description = AI-native semantic document runtime
]

@heading(1)[@Doc 项目规范]

@paragraph[这是普通段落，其中包含行内语义节点。]

@card(featured)[
  @heading[AI 原生语言]
  @paragraph[具有确定性语法的结构化标记语言，专为双向 AST 设计]
]

@table[
  @cols[id,name,price]
  @data[
    [1,早餐,60]
    [2,午餐,80]
    [3,晚餐,90]
  ]
]
```

> [!NOTE]
> 以下节点已调整：`@seo`、`@lang` 已并入 `@meta`；`@title` 改用 `@heading`（别名 `@h`）；`@text` 改用 `@paragraph`（别名 `@p`）；`@btn` 暂时弃用。以上为部分范例，实际语法以正式规格文档为准。

---

## 双线并行编译

同一份 AST，两种输出，原代码一字不改：

**Route A — Tailwind JIT**
```html
<h1 class="text-lg w-[120px]">@Doc 项目规范</h1>
```

**Route B — Universal Inline Style**
```html
<h1 class="text-lg" style="width: 120px;">@Doc 项目规范</h1>
```

动态值在 AST 中以结构化数据保存（`{ prop: "w", value: "120px" }`），而非原始字符串。由后端适配器决定如何渲染。

---

## 节点分类

### Core Nodes — 结构原件
文档骨架，不可再分割的原子。

`@heading`（别名 `@h`） `@paragraph`（别名 `@p`） `@quote` `@code` `@list` `@img` `@table`

### Semantic Nodes — 语义容器
两种行为模式：

- **Inline Semantic** — 渲染为带标签的行内元素：`@mark[重要]`、`@link(example.com)[链接]`
- **Block Metadata** — 注入 Host 的设置，不渲染任何 HTML：`@meta[key = value]`

---

## 给 AI 开发人员

直接让 LLM 生成 HTML 很脆弱。@Doc 为模型提供一套受约束的确定性语法——错误在解析时暴露，不是渲染时。

因为 `[]` 是唯一具备内容语义的括号，模型不需要推理括号冲突。

Token 成本也更低：`w-300px` 而非 Tailwind 的任意值语法 `w-[300px]`——括号由编译器补回，不由模型生成（规划中，目前 `{styles}` 仅支持颜色 token，见上方核心语法一节的但书）。

---

## 给网站开发人员

```ts
import { tokenize } from './Lexer';
import { DocParser } from './Parser';
import { DocTranspiler } from './Adapters';

const tokens = tokenize(source);
const ast = new DocParser(tokens).parse();
const html = ast.map(node => DocTranspiler.toTailwindHTML(node)).join('\n');
```

输入 @Doc 原代码，输出结构化 AST，用符合你技术栈的适配器渲染。Parser 和 Adapters 直接加入你的 pipeline，没有额外依赖。

---

## 设计边界

@Doc 刻意不是编程语言。这不是限制，是武器。

- 无变量
- 无条件判断
- 无循环
- 无宏系统

逻辑由 Host 应用负责。@Doc 只负责结构，不负责行为。这条边界让 AI 生成的输出永远可预测。这条线是刻意的，不会移动。

---

## 现状

核心 Parser、Lexer 与双线适配器已可基础运作。网页原生版本的 Lexer 与 Parser 正处于密集开发阶段。交互式 Playground 与 CLI 工具已列入近期开发时程表。

@Doc 的存在是为了探索 LLM 输出与渲染目标之间的设计空间。核心功能已可运作，其余部分正在公开场合持续构建中。

**目标：2027 年 1 月 1 日，1.0 Production 等级正式发布。**

---

## 这个 Repo 有什么

```
src/            Lexer、Parser、registry（节点的单一事实来源）、Adapters（HTML 渲染的两条路线）
src/editor/     Monarch tokenizer，给 Monaco 类编辑器用
tests/          Lexer/Parser 的 Strict Mode 案例集，以及各节点的渲染验证
configs/        editor/tooling 用的节点设置
*-Specification.md   语言的权威文法定义（EBNF + 语意规则）
```

`Block-Syntax-Specification.md` 与 `Inline-Syntax-Specification.md` 是文法的权威来源。代码注解里偶尔会引用 `Structural-Blocks.md`、`Container-Blocks.md` 这类逐节点的补充说明文档——它们不在 v0.1 这份发布范围内，对应内容都能在上面两份规格书里找到。

---

## License

MIT — see [LICENSE](../../LICENSE).
