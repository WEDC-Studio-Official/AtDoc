# @Doc — AI-Native Semantic Document Notation

<img src="https://wedc.cc/atd.png" width="64"/>

---

Every generation of document notation solved the dominant problem of its era:

| Format | Solved |
|:---|:---|
| **Word** | Editing |
| **HTML** | Rendering |
| **Markdown** | Human-friendly authoring |
| **JSON** | Interchange |
| **JSX** | Composition |
| **@Doc** | Semantic co-authoring between humans and AI |

None of them were designed for AI-generated content.

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

**@Doc is a notation designed for three readers:**

- Humans who write content.
- AI that generates content.
- Compilers that render content.

@Doc is not the next Markdown.  
It is the missing notation layer between LLM-generated content and render targets.

Three properties that most existing formats optimize for one or two of, but very few treat all three as first-class design goals:

| Property | Markdown | HTML | MDX | @Doc |
|:---|:---:|:---:|:---:|:---:|
| **AI Generation Stability** | ❌ | ⚠️ | ❌ | ✅ |
| **Token Efficiency** | ⚠️ | ❌ | ❌ | ✅ |
| **Queryable Semantics** | ❌ | ⚠️ | ⚠️ | ✅ |
| **Multi-target Compilation** | ❌ | ❌ | ⚠️ | ✅ |

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
| **Token 效率** | ⚠️ | ❌ | ❌ | ✅ |
| **語義可查** | ❌ | ⚠️ | ⚠️ | ✅ |
| **多目標編譯** | ❌ | ❌ | ⚠️ | ✅ |

---

## 現有方案的根本問題 / Why Everything Else Falls Short

### Markdown — 為人類書寫設計，不為機器生成設計

LLM 讀 Markdown 沒問題。問題是反過來：讓 LLM **生成** Markdown 並交給下游程式解析，輸出的結構幾乎無法被可靠保證——縮排歧義、巢狀清單漂移、表格損壞、parser 方言差異。

Markdown 沒有語義意圖。它無法表達「這個按鈕是 primary variant」或「這個表格需要斑馬紋」。

LLMs read Markdown fine. The problem is the reverse: ask an LLM to **generate** Markdown for downstream parsing, and the output structure is nearly impossible to guarantee — indentation ambiguity, nested list drift, broken tables, parser dialect gaps.

Markdown has no semantic intent. It cannot express "this button is primary" or "this table needs alternating rows."

---

### HTML — 結構與展示混為一談

HTML 可以表達任何東西，但代價是把展示邏輯寫死在結構裡。同一份內容要渲染到不同平台？重寫。要讓 AI 生成穩定的 HTML？面對幻覺標籤與未閉合元素的風險。

HTML can express anything, at the cost of collapsing structure and presentation into one. It is a render target, not a notation.

---

### MDX — 為人類開發者設計，代價由 AI 承擔

MDX 將文件與程式碼融合，為人類開發者提供極高的表達能力。但這種自由度對生成式模型而言意味著另一件事：更高的語法不穩定性與更脆弱的結構可預測性。

MDX fuses documents with code, giving human developers maximum expressiveness. For generative models, that freedom translates into something else: higher structural unpredictability and more brittle output.

| 對比維度 | MDX | @Doc |
|:---|:---|:---|
| **本質定位** | 把文件變成程式（Code-driven） | 把文件變成語義資料（Data-driven） |
| **AI 生成穩定性** | 允許任意 JS 邏輯，LLM 容易語法崩潰 | 確定性語法，LLM 輸出可預測 |
| **括號語義** | `{}` `[]` `<>` 語義多重混淆 | `[]` 全域唯一含義就是 **Content（內容）** |
| **Token 成本** | 冗長標籤閉合與 JS 樣板代碼 | 語法極度壓縮（`w-300px` 而非 `w-[300px]`） |
| **錯誤處理** | 渲染時崩潰，錯一個字元白畫面 | 解析時捕捉，AI 可秒級自我修正 |

---

## @Doc 是什麼 / What @Doc Is

同一份 @Doc 原始碼，不修改任何字元，可以乾淨編譯到 Tailwind JIT HTML、Inline Style HTML，或任何未來的渲染目標。

結構與展示徹底分離。語義由格式本身承載，不由渲染器決定。

The same @Doc source compiles cleanly to Tailwind JIT HTML, inline-style HTML, or any future render target — without changing a single character of the source.

Structure and presentation are fully separated. Semantics live in the notation, not the renderer.

---

## 核心語法 / Core Syntax

每個節點遵循相同的四槽結構：

```
@node(modifier){styles}[content]<action>
```

| 槽位 | 角色 | 範例 |
|---|---|---|
| `@node` | 節點類型 | `@btn`, `@h1`, `@card` |
| `(modifier)` | 變體或屬性 | `(primary)`, `(ja)` |
| `{styles}` | 樣式或元數據 | `{w-300px bg-fff}` |
| `[content]` | 內容槽位 ── **全域唯一** | `[Submit]` |
| `<action>` | 尾綴動作 | `<submit>`, `<install>` |

`[]` 在 @Doc 中只有一個含義：**內容**。沒有例外，沒有逃逸地獄。

`[]` has exactly one meaning everywhere in @Doc: **content**. The model never has to guess.

---

## 語法範例 / Example

```
@seo {
  "title": "@Doc 2026 Spec",
  "description": "AI-native semantic document runtime"
}

@h1[@Doc 專案規範]

這是普通段落，其中包含行內語義節點：這是 @lang(ja)[日本語] 的展現

@card(featured){w-300px bg-f8f9fa text-sm}[
  @title[AI 原生語言]
  @text[具有確定性語法的結構化標記語言，專為雙向 AST 設計]
  @btn(primary)[立即開始]<install>
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
> `@btn`在`v1.3`暫時棄用。

> [!TIP]
> 以上為部分範例，實際內容應按照現有新版本為準。
---

## 雙線並行編譯 / Dual-Track Compilation

同一份 AST，兩種輸出，原始碼一字不改：

**Route A — Tailwind JIT**
```html
<button class="text-lg w-[120px] bg-[#fff]">Submit</button>
```

**Route B — Universal Inline Style**
```html
<button class="text-lg" style="width: 120px; background-color: #fff;">Submit</button>
```

動態值在 AST 中以結構化資料儲存（`{ prop: "w", value: "120px" }`），而非原始字串。由後端適配器決定如何渲染。

Dynamic values live in the AST as structured data, not raw strings. The adapter decides the output. The source never changes.

---

## 節點分類 / Node Taxonomy

### Core Nodes — 結構原件
文件骨架，不可再分割的原子。

`@h1` `@h2` `@h3` `@p` `@quote` `@code` `@list` `@img` `@link` `@table`

### Semantic Nodes — 語義容器
兩種行為模式：

- **Inline Semantic** — 渲染為帶標籤的行內元素：`@lang(ja)[日本語]`
- **Block Metadata** — 注入 Host 的設定，不渲染任何 HTML：`@seo{...}`

---

## 給 AI 開發人員 / For AI Developers

直接讓 LLM 生成 HTML 很脆弱。@Doc 為模型提供一套受約束的確定性語法——錯誤在解析時暴露，不是渲染時。

因為 `[]` 是唯一具備內容語義的括號，模型不需要推理括號衝突。

Token 成本也更低：`w-300px` 而非 Tailwind 的任意值語法 `w-[300px]`——括號由編譯器補回，不由模型生成。

@Doc gives the model a constrained, deterministic grammar. Errors surface at parse time, not render time. And because `[]` is the only content bracket, the model has nothing to collide with.

Token cost is also lower: `w-300px` instead of `w-[300px]` — the bracket is restored by the compiler, not burned on generation.

---

## 給網站開發人員 / For Web Developers

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

## 設計邊界 / Design Boundaries

@Doc 刻意不是程式語言。這不是限制，是武器。

- 無變數 / No variables
- 無條件判斷 / No conditionals
- 無迴圈 / No loops
- 無巨集系統 / No macros

邏輯由 Host 應用負責。@Doc 只負責結構，不負責行為。這條邊界讓 AI 生成的輸出永遠可預測。這條線是刻意的，不會移動。

@Doc is intentionally not a programming language. That boundary is what makes AI-generated output deterministic. Logic lives in the host. @Doc owns structure. The line is intentional and will not move.

---

## 現狀 / Status

核心 Parser、Lexer 與雙線適配器已可基礎運作。網頁原生版本的 Lexer 與 Parser 正處於密集開發階段。互動式 Playground 與 CLI 工具已列入近期開發時程表。

@Doc exists to explore the design space between LLM output and render targets. The core is functional. The rest is being built in the open.

**目標：2027 年 1 月 1 日，1.0 Production 等級正式發布。**  
**Target: 1.0 Production release on January 1, 2027.**

---

## License

Authorization not yet granted.

~~MIT~~
