> - [English Benchmark](./docs/benchmark.md)

# AtDoc Benchmark

AtDoc Benchmark 是一套五階段驗證計畫，用來評估 AtDoc 在不同環境、
模型與執行平台下的準確性、效率、可重現性與實際應用價值。

本 Benchmark 將在相同測試條件下，比較 Markdown、JSON、HTML 與 AtDoc。

> **狀態：** 即將開始

---

## Benchmark 目標

本 Benchmark 主要驗證：

- AtDoc Parser 與 Renderer 的正確性
- 語意與結構準確度
- Parser 與 Renderer 執行效率
- 輸出大小與 Token 使用量
- 整體執行延遲
- 不同模型規模下的表現
- 公開環境中的可重現性
- 與商用 LLM API 的相容性
- AtDoc 的實際優勢與限制

---

## 評估格式

本 Benchmark 將比較：

- Markdown
- JSON
- HTML
- AtDoc

在可能的情況下，各格式會使用相同內容與等價要求進行測試。

---

## 評估指標

### 1. 準確性

評估輸出結果是否正確表達原始內容。

包含：

- 語意準確度
- 結構準確度
- 節點階層準確度
- 屬性準確度
- 內容保存率
- 語法有效率
- Parser 成功率
- Renderer 成功率

### 2. 效能

評估處理相同輸入所需的時間。

包含：

- Parser 延遲
- Renderer 延遲
- 端到端延遲
- 平均執行時間
- 最短執行時間
- 最長執行時間
- 吞吐量
- Tokens per second

### 3. Token 使用量

評估輸入與輸出所使用的 Token 數量。

包含：

- Input Tokens
- Output Tokens
- Total Tokens
- Token 減少比例
- 每份文件平均 Token 數
- 長上下文下的 Token 使用量

### 4. 穩定性

評估系統是否能穩定處理不同測試案例。

包含：

- 成功案例數
- 失敗案例數
- 錯誤率
- 無效語法比例
- 錯誤恢復能力
- 重複執行的一致性

### 5. 可重現性

評估相同 Benchmark 是否能在不同環境重新執行。

包含：

- 環境設定
- 套件版本
- 模型版本
- 硬體配置
- Random Seed
- 測試資料
- 結果一致性

---

# 五階段 Benchmark 計畫

## 1. Local Environment

### 目標

建立可靠的本機基準，並在進行其他平台測試前確認 Benchmark 工具正確。

### 測試內容

- AtDoc Lexer
- AtDoc Parser
- Semantic AST
- AtDoc Renderer
- Markdown 轉換
- JSON 轉換
- HTML 輸出
- 錯誤處理
- Benchmark Runner

### 測試案例

- 標題與段落
- 有序與無序列表
- 巢狀內容
- 程式碼區塊
- 連結與圖片
- 表格
- Callout
- Button
- Card
- Tabs
- 複雜文件結構
- 無效語法
- 大型文件

### 測量項目

- Parser 成功率
- Renderer 成功率
- Parser 延遲
- Renderer 延遲
- 端到端延遲
- 記憶體使用量
- 輸出正確性
- 錯誤率

### 預期結果

- 穩定的 Benchmark Runner
- 經過驗證的測試資料集
- 可重現的本機基準
- 正確性報告
- 效能報告
- 已知限制清單

---

## 2. Cloudflare

### 目標

評估 AtDoc 在 Cloudflare Edge 環境中的執行效能。

此階段主要測試 AtDoc Runtime，不直接混合模型生成速度。

### 測試內容

- 在 Worker 中解析 AtDoc
- 在 Worker 中渲染 AtDoc
- 回傳 HTML
- 測量請求處理時間
- 比較本機與 Edge 執行結果
- 測試小型與大型文件

### 測量項目

應分開記錄：

1. 模型生成時間
2. 網路傳輸時間
3. AtDoc Parser 時間
4. AtDoc Renderer 時間
5. 總請求時間

其他指標：

- Requests per second
- 平均延遲
- P50 延遲
- P95 延遲
- P99 延遲
- 錯誤率
- Response Size

### 預期結果

確認 AtDoc 是否適合用於 Edge-based 文件處理與渲染。

---

## 3. Google Colab

### 目標

提供公開且可重現的 Benchmark 環境。

Google Colab 讓其他開發者不需要相同的本機硬體，也能重新執行測試。

### 建議 Notebook

```text
AtDoc Benchmark.ipynb
```

### 測試內容

- 安裝必要依賴
- 安裝 AtDoc 套件
- 載入測試資料
- 執行 Parser 測試
- 執行 Renderer 測試
- 比較不同輸出格式
- 匯出 Benchmark 結果
- 產生圖表與報告

### 必須記錄

- Python 版本
- Node.js 版本
- 套件版本
- AtDoc 版本
- 模型版本
- Runtime 設定
- 執行日期
- 硬體資訊

### 預期結果

- 公開 Notebook
- 可重現的測試步驟
- 可匯出的結果檔案
- 統一報告格式
- 讓貢獻者能自行驗證結果

---

## 4. GPUTW

### 目標

評估 AtDoc 搭配不同本地語言模型與硬體配置時的表現。

此階段主要測試模型輸出、Token 使用量、延遲與語意準確度。

### 測試環境

測試將在租用的 GPU 環境執行。

每次測試都必須記錄：

- GPU 型號
- GPU 記憶體
- 系統記憶體
- CPU
- 作業系統
- Runtime
- Quantization 格式
- Context Length
- Temperature
- 模型版本

### 模型分組

可依模型規模分為：

- 小型模型
- 中型模型
- 大型模型
- Mixture-of-Experts 模型
- Reasoning 模型
- Vision-Language 模型

### 測試內容

- Markdown 生成
- JSON 生成
- HTML 生成
- AtDoc 生成
- 結構轉換
- 巢狀語意結構
- 元件生成
- 長上下文文件
- 模糊或無效指令

### 控制參數

同一測試組內應固定：

- Prompt
- 測試案例
- Temperature
- Context Length
- System Instruction
- Output Format
- 模型版本
- Quantization 格式
- 硬體配置

Thinking 與 Non-thinking 模式必須分開統計。

### 測量項目

- 語意準確度
- 結構準確度
- 語法有效率
- Parser 成功率
- Renderer 成功率
- Input Tokens
- Output Tokens
- Total Tokens
- 首 Token 時間
- 總生成時間
- Tokens per second
- 平均延遲
- 錯誤率

### 預期結果

確認：

- 不同模型生成 AtDoc 的能力
- 哪種模型規模表現較佳
- Token 使用量差異
- 延遲差異
- 準確度差異
- Context Length 的影響
- Reasoning Mode 的影響
- 實際硬體需求

不同硬體、模型版本與量化格式不可直接混合成沒有條件的總排名。

---

## 5. ChatGPT API

### 目標

評估 AtDoc 與商用大型語言模型 API 的相容性。

### 測試內容

- 由自然語言生成 AtDoc
- Markdown 轉換為 AtDoc
- 生成結構化文件
- 生成 UI 元件
- 生成巢狀內容
- 處理無效指令
- 處理長文件
- 驗證 AtDoc
- 渲染生成結果

### 測量項目

- 語意準確度
- 結構準確度
- 語法有效率
- Parser 成功率
- Renderer 成功率
- Input Tokens
- Output Tokens
- Total Tokens
- API 延遲
- 生成延遲
- 錯誤率
- Retry 次數
- 預估 API 成本

### 預期結果

確認：

- 商用模型是否能穩定生成 AtDoc
- AtDoc 是否能降低輸出 Token
- AtDoc 是否能提升結構一致性
- AtDoc 是否適合 AI-native 文件生成
- 實際 API 使用上的限制

---

# 測試資料集

測試資料集應包含不同複雜度的案例。

## 基礎案例

- 純文字
- 標題
- 段落
- 列表
- 連結
- 圖片
- 程式碼區塊

## 中階案例

- 巢狀列表
- 表格
- Callout
- Card
- Button
- Tabs
- 多段落文件
- 混合內容

## 進階案例

- 複雜文件樹
- 深層巢狀結構
- README
- API 文件
- 技術規格
- 長上下文文件
- 模糊指令
- 無效語法
- 混合語意元件

每個測試案例應包含：

- 唯一 ID
- 說明
- 原始輸入
- 預期結構
- 預期輸出
- 驗證規則
- 難度等級

---

# 結果格式

每次 Benchmark 執行後都應輸出結構化結果。

```json
{
  "benchmark": "AtDoc Benchmark",
  "stage": "local",
  "format": "atdoc",
  "model": null,
  "hardware": {
    "gpu": null,
    "memory": null,
    "cpu": null
  },
  "configuration": {
    "temperature": null,
    "context_length": null,
    "thinking": null
  },
  "metrics": {
    "input_tokens": null,
    "output_tokens": null,
    "total_tokens": null,
    "latency_ms": null,
    "tokens_per_second": null,
    "parse_success": null,
    "render_success": null,
    "semantic_accuracy": null,
    "structural_accuracy": null
  }
}
```

---

# 報告內容

最終報告應包含：

- 環境資訊
- 測試資料集
- 測試設定
- 原始結果
- 彙整結果
- 準確度比較
- Token 比較
- 延遲比較
- 錯誤分析
- 已知限制
- 重現方式

---

# 限制

Benchmark 結果可能受到以下因素影響：

- 模型版本
- Quantization 格式
- Context Length
- Prompt 設計
- 硬體配置
- Runtime 實作
- 網路狀況
- API Rate Limit
- 隨機性
- 測試資料集設計

因此，結果應搭配當時記錄的測試配置解讀，不應直接視為所有環境下都成立的絕對排名。

---

# 結論

AtDoc Benchmark 旨在透明且可重現地評估 AtDoc 在本機 Runtime、Edge 環境、公開 Notebook、開源模型與商用 API 中的表現。

隨著 AtDoc Parser、Renderer、套件與 AI 整合能力持續發展，Benchmark 也會持續更新。
