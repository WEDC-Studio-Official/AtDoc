# @Doc Callout Blocks — 語義參考文件

*[English version](./Callout-Blocks.md)*

> 本文件是 [Block Syntax Specification](../../../Block-Syntax-Specification.md) 第 7 節（Callout Blocks）的語義說明文件。語法定義請參閱該節，本文聚焦於 `@note`、`@tip`、`@important`、`@warning`、`@caution` 五個節點的意義、使用時機與設計由來。

## 0. 目錄

* [1. 設計哲學](#1-設計哲學)
* [2. Callout Blocks 的由來](#2-callout-blocks-的由來)
* [3. 語法](#3-語法)
* [4. Callout 分類體系](#4-callout-分類體系)
* [5. 節點說明](#5-節點說明)
  * [Note](#note)
  * [Tip](#tip)
  * [Important](#important)
  * [Warning](#warning)
  * [Caution](#caution)
* [6. 該選哪個節點](#6-該選哪個節點)
* [7. AST 表示](#7-ast-表示)
* [8. Renderer 獨立性](#8-renderer-獨立性)
* [9. AI 生成穩定性](#9-ai-生成穩定性)
* [10. 設計原則](#10-設計原則)

---

## 1. 設計哲學

Callout Blocks 是 @Doc AST 中的語義容器。每一個節點命名的是「內容」與「讀者注意力」之間的一種特定關係——脈絡、建議、優先、風險或危險——而不是顏色、圖示或框線樣式。

```text
@note   @tip   @important   @warning   @caution
```

五個節點都不會寫死固定外觀——那個對應關係由 Renderer 決定（見第 8 節）；但第 3 節會說明作者仍然可以直接要求特定外觀。五個節點都共用同一套語法，且都可搭配選填標題（見第 3 節）：

```text
@<node>[
content
]
```

---

## 2. Callout Blocks 的由來

Markdown 與 HTML 透過「呈現方式」來表達備註與警告：

```markdown
> [!CAUTION]
> Do not delete production data.
```

```html
<div class="caution">Do not delete production data.</div>
```

兩者描述的都是內容「看起來如何」，而不是內容「代表什麼」。Parser 讀到這兩種寫法時，得從 class 名稱或平台專屬的關鍵字慣例反推意圖——而這套慣例在 GitHub、Docusaurus、Obsidian 之間都不一樣。

@Doc 把這個流程反過來：

```text
語意（Meaning）
  ↓
AST Node
  ↓
Renderer Adapter
  ↓
Output Target
```

文件只宣告「這是一個 caution」，由編譯器決定「這個平台該如何呈現 caution」。同一份 `@caution[...]` 原始碼可以編譯成 HTML 的 `<section>`、終端機的警示橫幅，或是 Notion 的 callout 區塊——原始碼本身不需要變動。這與 @Doc 整體的設計理念一致（參見 [README](../../../README.md)）：結構與展示徹底分離，語義由格式本身承載，不由渲染器決定。

---

## 3. 語法

五個 Callout Blocks 共用同一套語法——節點名稱、選填的 `(title)`，加上 `block-content`：

```text
@note[content]
@tip[content]
@important[content]
@warning[content]
@caution[content]
```

```text
@note(title)[content]
@tip(title)[content]
@important(title)[content]
@warning(title)[content]
@caution(title)[content]
```

範例：

```text
@caution(資料遺失風險)[
@bold[警告]

執行此資料庫遷移前，請先建立完整備份。
此操作@bold[不可逆]，可能永久刪除使用者資料。
]
```

內容遵循標準 `block-content` 規則（參見 [Block Syntax Specification 第 4 節](../../../Block-Syntax-Specification.md#4-shared-components)），因此任何行內節點（`@bold`、`@link` 等）或巢狀區塊都可以出現在其中。

與 Container Blocks（`@details`、`@card`，參見 [Container Blocks 參考文件](../Container-Blocks/Container-Blocks.zh-TW.md)）相同，Callout Blocks 也採用同一套 `title` 規則（參見 [Block Syntax Specification 第 4 節](../../../Block-Syntax-Specification.md#4-shared-components)）。`title` 是獨立於 `content` 的 AST 欄位（見下方第 7 節）——像上面 `@bold[警告]` 這樣的強調前導文字仍然只是一般的內容本體，不能取代 `(title)`。

節點是語義性的，不代表外觀永遠無法由作者直接指定。@Doc 的通用節點文法同樣保留了選填的 `{styles}` 欄位，用於逐一實例的外觀覆寫——例如 `{bg-fff text-red}`——與 `@mark` 用於行內標記的欄位相同（參見 [Inline Syntax Specification 第 7 節](../../../Inline-Syntax-Specification.md#7-mark-styles-semantics)）。但與 `title` 不同，`{styles}` 目前**尚未納入任何 Block Node（無論 Callout 或 Container）的正式 EBNF**，僅出現在 [README「核心語法」](../../../README.md) 的示意寫法中。今天寫 `@caution{bg-fff text-red}[...]` 是超前使用尚未定義的文法，而非採用既有功能。

**完全省略 vs. 空括號。** EBNF 將整個 `[ title ]` 標示為可省略，但 `text = { any-unicode-char }` 本身也允許零個字元——因此單就文法而言，`@warning()[content]`（空括號）並未被明確排除。本文件將兩者視為等價：完全省略 `(title)`，與括號內為空白或空字串的 `()`，都應正規化為「沒有標題」。Parser 可以選擇在 Strict Mode 下將 `()` 標示為需要提示的寫法（參見 [Inline Syntax Specification 第 11 節](../../../Inline-Syntax-Specification.md#11-parser-recovery-strategy)），但就語義而言，兩者都不帶標題。

---

## 4. Callout 分類體系

```text
嚴重程度量表（低 → 高）：

  @note  →  @tip  →  @important  →  @warning  →  @caution
```

| 節點 | 用途 | 範例 |
|---|---|---|
| `@note` | 補充脈絡 | 「此選項僅在開發環境中可用。」 |
| `@tip` | 選擇性建議或最佳實踐 | 「啟用快取以加速重複建置。」 |
| `@important` | 讀者必須知道的高優先資訊 | 「API v2 將於 2027-01-01 成為預設端點。」 |
| `@warning` | 潛在的負面後果 | 「此設定可能降低效能。」 |
| `@caution` | 高風險或不可逆的操作 | 「此操作將永久刪除正式環境資料。」 |

`@note`、`@tip`、`@important` 描述的是**資訊重要程度**——這段內容值得讀者投入多少注意力。`@warning` 與 `@caution` 描述的是**風險程度**——忽略它會造成多大傷害。`@caution` 保留給風險量表的最頂端：具破壞性、不可逆，或執行前需要人類明確確認的操作。

---

## 5. 節點說明

### Note

補充性的脈絡、背景或澄清細節，非必讀內容。

```text
@note[
此 API 行為是在 2.0 版本引入的。
]
```

不適用於：沒有文件特定脈絡的一般事實、必讀內容（改用 `@important`）、或風險內容（改用 `@warning` / `@caution`）。

---

### Tip

能提升效率、品質或體驗的選擇性建議，不能用來取代必要指示。

```text
@tip[
開發時使用增量建置以縮短編譯時間。
]
```

錯誤示範：

```text
@tip[
刪除正式環境資料前，務必先建立備份。
]
```

這句話描述的是安全性要求，不是選擇性的改進建議——應該歸屬 `@caution`。

---

### Important

比周圍內容優先層級更高的資訊：關鍵公告、重大變更、預設行為、影響決策的限制條件。

```text
@important[
API 2.0 版本將於 2027 年 1 月 1 日起成為預設端點。
請在遷移日期前更新你的整合。
]
```

不適用於：危險操作（改用 `@caution`）、或例行脈絡（改用 `@note`）。

---

### Warning

若未妥善處理，可能導致問題的條件或操作——但尚未達到破壞性或不可逆的程度。

```text
@warning[
此 API 端點將於 3.0 版本中移除。
]
```

搭配標題：

```text
@warning(資料保留政策)[
此 API 端點將於 3.0 版本中移除。
]
```

`@warning` 回答的是「如果讀者忽略這件事，可能會出什麼問題？」；`@caution` 回答的則是更強烈的問題：「在沒有明確確認前，讀者應該避免做什麼？」

---

### Caution

高嚴重性內容：不可逆操作、破壞性行為、安全敏感的變更，或任何執行前需要人類明確確認的事項。

```text
@caution[
此操作不可逆，可能永久移除使用者資料。
]
```

保留給難以或無法復原的後果——例行風險請改用 `@warning`。

---

## 6. 該選哪個節點

| 情境 | 對應節點 |
|---|---|
| 背景或說明性細節 | `@note` |
| 選擇性建議 | `@tip` |
| 必讀／高優先變更 | `@important` |
| 可能的負面後果 | `@warning` |
| 不可逆或破壞性操作 | `@caution` |

實例對照——同一件事實，依實際後果嚴重程度而選用不同節點：

```text
錯誤：
@warning[
正式環境資料庫將被永久刪除。
]

正確：
@caution[
正式環境資料庫將被永久刪除。
]
```

決定因素是後果的嚴重程度，不是語氣強弱。

---

## 7. AST 表示

每個 Callout Block 在 AST 中都會成為獨立、可查詢的節點——而不是一段套了樣式的段落：

```text
@caution(資料遺失風險)[
@bold[警告]

正式環境資料將被刪除。
]
```

```text
Document
└── BlockNodes
    └── CalloutNodes
        └── CautionNode
            ├── Title
            │   └── "資料遺失風險"
            └── Content
                ├── BoldNode
                │   └── "警告"
                └── TextNode
                    └── "正式環境資料將被刪除。"
```

`Title` 是獨立的 AST 欄位——與 Container Blocks 採用的結構相同（參見 [Container Blocks 第 6 節](../Container-Blocks/Container-Blocks.zh-TW.md#6-ast-表示)）——因此工具可以直接讀取 callout 的標題，不需要依結構推測（例如「第一個 bold 節點」）。當 `(title)` 省略時，`Title` 欄位就完全不存在；`content` 內任何強調前導文字仍然只是一般的內容本體。

因為每種節點類型在 AST 中都是明確的，下游工具可以依照意圖查詢，而不需要掃描原始文字：

```text
Find all CautionNodes
Find all WarningNodes
```

可能的應用：AI 安全審查、發布說明產生、遷移分析、文件稽核、RAG 索引。

---

## 8. Renderer 獨立性

Callout Blocks 只承載語義。同一份原始碼會依照目標 Renderer 的不同而編譯出不同結果。

原始碼：

```text
@warning[
此功能需要額外權限。
]
```

Web：

```html
<aside class="warning">此功能需要額外權限。</aside>
```

Terminal：

```text
[警告]

此功能需要額外權限。
```

文件平台：由 Renderer 選擇對應的原生 callout 元件——而不是由 @Doc 原始碼決定。

---

## 9. AI 生成穩定性

若沒有專屬節點，模型通常會用不穩定、平台專屬的方式表達備註、建議與警告：

```markdown
> Tip:
> Try using ...
```

```html
<div class="hint">...</div>
```

@Doc 讓模型在每個嚴重程度層級都有一個確定的輸出目標：

```text
Node Type = Caution
Content   = ...
```

因為 `[]` 在 @Doc 中只有一種含義——內容——模型永遠不需要判斷某個括號究竟是連結、屬性，還是元件邊界。呈現方式交給編譯器與 Renderer 負責，模型只需要負責表達意圖。

---

## 10. 設計原則

Callout Blocks 遵循與 @Doc 其餘部分相同的原則：

```text
Semantic First, Layout Later
```

caution 不是一個紅色框；tip 不是一顆燈泡圖示。每個節點是由它的意義定義的，而不是由某個 Renderer 今天剛好怎麼畫它來定義。
