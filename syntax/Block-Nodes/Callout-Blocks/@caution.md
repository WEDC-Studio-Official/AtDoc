# @caution 警告節點 (Caution Block)

`@caution` 是 @Doc Block Syntax 規範中的**最高等級警示節點（Callout Block）**。主要用於標示極具風險、可能導致系統損毀、安全性漏洞、硬體損壞或數據永久遺失的操作。

---

## 💡 使用方式

在 @Doc 文件中，使用 `@caution` 關鍵字，並將需要警示的內容寫在後方的內容槽位（方括號 `[...]`）之內：

```text
@caution[
這裡輸入警告內容。支援行內節點（Inline Nodes），例如 @bold[粗體] 或 @raw[程式碼]。
]

```

### 範例：

```text
@caution[
@bold[請注意：]
在執行此資料庫移轉（Migration）指令前，請務必先進行實體備份。
此操作是@bold[不可逆]的，將會永久清除所有使用者暫存資料。
]

```

> [!CAUTION] 在執行此資料庫移轉（Migration）指令前，請務必先進行實體備份。此操作是不可逆的，將會永久清除所有使用者暫存資料。

>但是這個不支援粗體😅

---




### 渲染器與編譯行為

`@caution` 節點僅描述「**這是一段最高警示等級的語意內容**」（What），而不定義其具體排版樣式（How）。

當編譯器（Compiler）或渲染器（Renderer）解析此節點時，會依據目標平台自由決定呈現方式。例如：

* **Tailwind HTML 輸出：** 渲染為帶有紅色高亮外框、紅色背景與 🚨 警示圖示的彈出字型卡片。
* **Terminal/CLI 輸出：** 以紅色粗體加上 `[CAUTION]` 前綴輸出。
* **Notion / Discord API：** 自動對應至平台原生的紅色 Callout 區塊。

---

## 🛠 語法誕生由來

為了理解 `@caution` 以及 @Doc 提示區塊的誕生，我們必須回到傳統 Markdown 與 HTML 在「AI 協作時代」所面臨的根本性痛點：

### 1. 解決傳統 Markdown 的「語意不明與方言分裂」

在原生 Markdown (GFM) 中，並沒有原生的高亮提示框（Callout）語法。以往開發者必須：

* **使用引用區塊折衷：** 寫成 `> CAUTION: 內容`。
* *痛點：* 對於機器或 AI 解析器（Parser）來說，這只是一個普通的「引用（Quote）」，無法精確抽離出「最高警示」的結構化語意。


* **混雜 HTML 標籤：** 寫成 `<div class="caution">內容</div>`。
* *痛點：* 程式碼變得極度臃腫，且將「展示邏輯」寫死在結構中，違背了 @Doc 「結構與展示徹底分離（Semantic First, Layout Later）」的設計初衷。


* **各平台方言割裂：** 不同的靜態網站生成器有自己的擴充（如 `::: danger`、`[!CAUTION]`）。
* *痛點：* 語法極不統一，容易造成 Parser 解析崩潰。



### 2. 為 AI 共同撰寫與編譯器設計的「確定性語意」

為了解決上述痛點，**@Doc** 引入了以 `@` 符號為核心的「區塊指令（Directive Block）」設計，讓 `@caution` 具備了以下革命性的特性：

* **全域唯一的 `[]` 內容語意：**
在 @Doc 的四槽結構中，`[]` 有且僅有一個含義，就是 **Content（內容）**。當 AI（如 LLM）生成 `@caution[...]` 時，模型不需要去推理或猜測複雜的括號衝突，大幅降低了語法崩潰與標籤未閉合的機率（AI Generation Stability）。
* **極高 Token 效率：**
相比於 MDX 或 HTML 冗長且重複的閉合標籤（例如 `</details>` 或 `</div>`），`@caution[...]` 以最精簡的符號完成了語意包裹。這讓 AI 在生成、讀取文件時能節約大量 Token 成本。
* **機器可查詢的 AST（Queryable Semantics）：**
`@caution` 在經過 `@Doc Parser` 解析後，會直接轉換成 AST（抽象語法樹）中的 `Caution` 節點：
```text
Block Nodes
└── Callout Blocks
    └── @caution

```


這使得下游的 RAG（檢索增強生成）系統、搜尋引擎或 AI 代理人可以「秒級」精確檢索出文件中所有的安全警告，而不需要透過複雜的正規表示式去猜測內文。