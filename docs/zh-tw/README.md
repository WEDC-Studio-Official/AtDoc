# @Doc — AI 原生語義文件表示法

<img src="https://wedc.cc/atd.png" width="64"/>

> 🌐 其他語言版本：[English](../en/README.md) ・ [简体中文](../zh-cn/README.md) ・ [日本語（AI 翻譯，可能有誤）](../ja/README.md) ・ [한국어（AI 번역，可能有誤）](../ko/README.md)

---

每一代文件格式，都在解決那個時代最核心的問題：

| 格式 | 解決的問題 |
|:---|:---|
| **Word** | 文件編輯 |
| **HTML** | 文件顯示 |
| **Markdown** | 易於人類撰寫 |
| **JSON** | 資料交換 |
| **JSX** | 元件組合 |
| **@Doc** | AI 與人類共同撰寫的語義文件表示 |

但沒有一種格式，是為 AI 生成內容而設計的。

---

**@Doc 為三種讀者設計：**

- 撰寫內容的人類
- 生成內容的 AI
- 渲染它的編譯器

@Doc 不是下一個 Markdown。
它是 LLM 生成內容與渲染器之間缺失的那個 notation 層。

現有主流格式通常只能優化其中一到兩項，很少同時把三者作為一級設計目標：

| 特性 | Markdown | HTML | MDX | @Doc |
|:---|:---:|:---:|:---:|:---:|
| **AI 生成穩定性** | ❌ | ⚠️ | ❌ | ✅ |
| **Token 效率** | ✅ | ❌ | ❌ | ✅ |
| **語義可查** | ❌ | ⚠️ | ⚠️ | ✅ |
| **多目標編譯** | ❌ | ❌ | ⚠️ | ✅ |

---

## 現有方案的根本問題

### Markdown — 為人類書寫設計，不為機器生成設計

LLM 讀 Markdown 沒問題。問題是反過來：讓 LLM **生成** Markdown 並交給下游程式解析，輸出的結構幾乎無法被可靠保證——縮排歧義、巢狀清單漂移、表格損壞、parser 方言差異。

Markdown 沒有語義意圖。它無法表達「這個按鈕是 primary variant」或「這個表格需要斑馬紋」。

---

### HTML — 結構與展示混為一談

HTML 可以表達任何東西，但代價是把展示邏輯寫死在結構裡。同一份內容要渲染到不同平台？重寫。要讓 AI 生成穩定的 HTML？面對幻覺標籤與未閉合元素的風險。HTML 是一個渲染目標，不是一套 notation。

---

### MDX — 為人類開發者設計，代價由 AI 承擔

MDX 將文件與程式碼融合，為人類開發者提供極高的表達能力。但這種自由度對生成式模型而言意味著另一件事：更高的語法不穩定性與更脆弱的結構可預測性。

| 對比維度 | MDX | @Doc |
|:---|:---|:---|
| **本質定位** | 把文件變成程式（Code-driven） | 把文件變成語義資料（Data-driven） |
| **AI 生成穩定性** | 允許任意 JS 邏輯，LLM 容易語法崩潰 | 確定性語法，LLM 輸出可預測 |
| **括號語義** | `{}` `[]` `<>` 語義多重混淆 | `[]` 全域唯一含義就是 **Content（內容）** |
| **Token 成本** | 冗長標籤閉合與 JS 樣板代碼 | 語法極度壓縮（`w-300px` 而非 `w-[300px]`，規劃中，見下方核心語法一節的但書） |
| **錯誤處理** | 渲染時崩潰，錯一個字元白畫面 | 解析時捕捉，AI 可秒級自我修正 |

---

## @Doc 是什麼

同一份 @Doc 原始碼，不修改任何字元，可以乾淨編譯到 Tailwind JIT HTML、Inline Style HTML，或任何未來的渲染目標。

結構與展示徹底分離。語義由格式本身承載，不由渲染器決定。

---

## 核心語法

每個節點的長期目標是同一個四槽結構：

```
@node(modifier){styles}[content]<action>
```

| 槽位 | 角色 | 範例 |
|---|---|---|
| `@node` | 節點類型 | `@heading`（別名 `@h`）, `@paragraph`（別名 `@p`）, `@card` |
| `(modifier)` | 變體或屬性 | `(primary)`, `(ja)` |
| `{styles}` | 樣式或元數據 | `{w-300px bg-fff}` |
| `[content]` | 內容槽位 ── **全域唯一** | `[Submit]` |
| `<action>` | 尾綴動作 | `<submit>`, `<install>` |

> [!NOTE]
> **規劃中，非現行文法**：`<action>` 尾綴槽位目前完全沒有實作——`src/Lexer.ts` 沒有對應的 Token 型別，Block／Inline Syntax Specification 的正式 EBNF 也沒有這個產生式。上表 `{styles}` 的 `{w-300px bg-fff}` 這類 Tailwind class 字串範例同樣是前瞻性示意，不是現行語法：現行 `{styles}` 只接受逗號分隔的顏色 token（具名色或 hex），用於 `@mark`／`@color`／`@bordered`（見 [Inline Syntax Specification 第 7 節](./Inline-Syntax-Specification.md#7-mark--color--bordered-styles-semantics)）。目前唯一可解析、有測試覆蓋的是 `@node(modifier){styles}[content]` 四槽中的前三槽。

`[]` 在 @Doc 中只有一個含義：**內容**。沒有例外，沒有逃逸地獄。

---

## 語法範例

```
@meta[
title = @Doc 2026 Spec
description = AI-native semantic document runtime
]

@heading(1)[@Doc 專案規範]

@paragraph[這是普通段落，其中包含行內語義節點。]

@card(featured)[
  @heading[AI 原生語言]
  @paragraph[具有確定性語法的結構化標記語言，專為雙向 AST 設計]
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
> 以下節點已調整：`@seo`、`@lang` 已併入 `@meta`；`@title` 改用 `@heading`（別名 `@h`）；`@text` 改用 `@paragraph`（別名 `@p`）；`@btn` 暫時棄用。以上為部分範例，實際語法以正式規格文件為準。

---

## 雙線並行編譯

同一份 AST，兩種輸出，原始碼一字不改：

**Route A — Tailwind JIT**
```html
<h1 class="text-lg w-[120px]">@Doc 專案規範</h1>
```

**Route B — Universal Inline Style**
```html
<h1 class="text-lg" style="width: 120px;">@Doc 專案規範</h1>
```

動態值在 AST 中以結構化資料儲存（`{ prop: "w", value: "120px" }`），而非原始字串。由後端適配器決定如何渲染。

---

## 節點分類

### Core Nodes — 結構原件
文件骨架，不可再分割的原子。

`@heading`（別名 `@h`） `@paragraph`（別名 `@p`） `@quote` `@code` `@list` `@img` `@table`

### Semantic Nodes — 語義容器
兩種行為模式：

- **Inline Semantic** — 渲染為帶標籤的行內元素：`@mark[重要]`、`@link(example.com)[連結]`
- **Block Metadata** — 注入 Host 的設定，不渲染任何 HTML：`@meta[key = value]`

---

## 給 AI 開發人員

直接讓 LLM 生成 HTML 很脆弱。@Doc 為模型提供一套受約束的確定性語法——錯誤在解析時暴露，不是渲染時。

因為 `[]` 是唯一具備內容語義的括號，模型不需要推理括號衝突。

Token 成本也更低：`w-300px` 而非 Tailwind 的任意值語法 `w-[300px]`——括號由編譯器補回，不由模型生成（規劃中，目前 `{styles}` 僅支援顏色 token，見上方核心語法一節的但書）。

---

## 給網站開發人員

```ts
import { tokenize } from './Lexer';
import { DocParser } from './Parser';
import { DocTranspiler } from './Adapters';

const tokens = tokenize(source);
const ast = new DocParser(tokens).parse();
const html = ast.map(node => DocTranspiler.toTailwindHTML(node)).join('\n');
```

輸入 @Doc 原始碼，輸出結構化 AST，用符合你技術棧的適配器渲染。Parser 和 Adapters 直接加入你的 pipeline，沒有額外依賴。

---

## 設計邊界

@Doc 刻意不是程式語言。這不是限制，是武器。

- 無變數
- 無條件判斷
- 無迴圈
- 無巨集系統

邏輯由 Host 應用負責。@Doc 只負責結構，不負責行為。這條邊界讓 AI 生成的輸出永遠可預測。這條線是刻意的，不會移動。

---

## 現狀

核心 Parser、Lexer 與雙線適配器已可基礎運作。網頁原生版本的 Lexer 與 Parser 正處於密集開發階段。互動式 Playground 與 CLI 工具已列入近期開發時程表。

@Doc 的存在是為了探索 LLM 輸出與渲染目標之間的設計空間。核心功能已可運作，其餘部分正在公開場合持續構建中。

**目標：2027 年 1 月 1 日，1.0 Production 等級正式發布。**

---

## 這個 Repo 有什麼

```
src/            Lexer、Parser、registry（節點的單一事實來源）、Adapters（HTML 渲染的兩條路線）
src/editor/     Monarch tokenizer，給 Monaco 類編輯器用
tests/          Lexer/Parser 的 Strict Mode 案例集，以及各節點的渲染驗證
configs/        editor/tooling 用的節點設定
*-Specification.md   語言的權威文法定義（EBNF + 語意規則）
```

`Block-Syntax-Specification.md` 與 `Inline-Syntax-Specification.md` 是文法的權威來源。程式碼註解裡偶爾會引用 `Structural-Blocks.md`、`Container-Blocks.md` 這類逐節點的補充說明文件——它們不在 v0.1 這份釋出範圍內，對應內容都能在上面兩份規格書裡找到。

---

## License

MIT — see [LICENSE](../../LICENSE).
