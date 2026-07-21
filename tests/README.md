# @Doc Parser — 錯誤案例測試集

`tests/cases/` 收錄一份正確文件，以及各種常見或刻意刁鑽的錯誤／邊界案例，用來驗證 `src/Lexer.ts` + `src/Parser.ts` 的 Strict Mode 行為（見 Inline Syntax Specification §11 Parser Recovery Strategy）。

## 執行測試

```bash
node tests/run-tests.ts
```

每個案例的預期結果記錄在 `expected.json`（是否應該 throw、錯誤訊息應包含的關鍵字）。Runner 會逐一比對實際行為與預期是否一致，並輸出 `PASS` / `FAIL` 摘要。

## 案例清單

| 檔案 | 測試什麼 | 預期行為 |
|---|---|---|
| `01-valid.atd` | 一份涵蓋 meta／heading／段落／行內節點／table／tabs／footnote 的正常文件 | 正常解析，不拋錯 |
| `02-missing-closing-bracket.atd` | `@p[...` 少了結尾的 `]` | **拋錯**：missing its closing `]` |
| `03-incomplete-node-name-fallback.atd` | `@met[...]`——`@meta` 少打一個 `a` | **不拋錯**：`met` 不是已註冊指令，整段退回純文字（Inline Spec §6 Unknown Command Fallback） |
| `04-bare-at-symbol-fallback.atd` | 信箱 `test@example.com`、單獨的 `@`、`@GitHub` 這類非指令用法 | **不拋錯**：全部退回純文字（Inline Spec §2／§6） |
| `05-stray-closing-bracket-fallback.atd` | 文件頂層出現一個沒有對應開頭的多餘 `]` | **不拋錯**：頂層的隱式段落聚合器對孤立的 `]`採取寬容態度，直接當作字面字元 |
| `06-missing-required-paren-tab.atd` | `@tab[...]` 沒有 `(title)`——`@tab` 的括號是必填，不像 `@details`／`@card` | **拋錯**：requires a parenthesized title |
| `07-missing-required-paren-link.atd` | `@link[...]` 沒有 `(uri)` | **拋錯**：requires a parenthesized uri |
| `08-missing-required-paren-fn.atd` | `@fn[...]` 沒有 `(id)` | **拋錯**：requires a parenthesized id |
| `09-missing-required-paren-img.atd` | `@img[...]` 沒有 `(options)` | **拋錯**：requires a parenthesized options |
| `10-restricted-context-tab-outside-tabs.atd` | `@tab` 出現在 `@card` 內，而不是 `@tabs` 內 | **拋錯**：may only appear directly inside `@tabs` |
| `11-restricted-context-cols-outside-table.atd` | `@cols` 出現在 `@p` 內，而不是 `@table` 內 | **拋錯**：may only appear directly inside `@table` |
| `12-table-missing-data.atd` | `@table` 只有 `@cols`，缺少必填的 `@data` | **拋錯**：requires `@data` |
| `13-table-wrong-child-order.atd` | `@table` 內 `@data` 寫在 `@cols` 前面（順序錯誤） | **拋錯**：requires `@cols` as its first child |
| `14-tabs-invalid-child.atd` | `@tabs` 內放了 `@p` 而不是 `@tab` | **拋錯**：only accepts `@tab` children |
| `15-refn-non-integer.atd` | `@refn[one]`——內容不是數字 | **拋錯**：must contain only digits |
| `16-unclosed-raw-domain-silent-swallow.atd` | `@mermaid[...` 沒有結尾 `]` | **不拋錯，但是已知限制**：見下方說明 |
| `17-unknown-node-in-comma-list.atd` | `@cols[id,@bold[name],price]`——逗號列表裡混入了節點 | **拋錯**：only accepts plain text |

## 已知限制：`16-unclosed-raw-domain-silent-swallow.atd`

這個案例刻意留著、不修——它反映了目前實作一個真實、值得記錄的邊界行為，而不是我沒注意到的疏漏：

`@code`／`@mermaid`／`@raw` 的原始內容掃描（`src/Lexer.ts` 的 `scanDepthRaw`）在找到對應的 `]` 前，只會不斷往前掃描字元，**沒有檢查是否已經到達檔案結尾**。如果原始碼裡的 `@mermaid[...` 一路到檔案結束都沒有出現配對的 `]`，掃描器不會拋出「找不到結尾」的錯誤——它會把檔案剩餘的所有內容（包括後面原本想寫的其他 `@h`、`@p` 等區塊）全部吞成這個 `@mermaid` 節點的原始內容，安靜地結束。

這與 `expectSlotClose()`（第 2 個案例用到的那條路徑）刻意形成不對稱：一般 `generic` 內容槽位在找不到 `]` 時，一定會用 Strict Mode 拋出 `missing its closing ]`；但 raw 家族節點（`raw`／`raw-escaped`／`key`／`integer`）目前完全沒有等價的 EOF 檢查。

如果之後要修，建議在 `scanDepthRaw` 與 `scanFlatRaw`（`src/Lexer.ts`）跑到 `i >= n` 卻仍未把 `depth` 歸零時，拋出 `DocSyntaxError`，訊息可以比照 `expectSlotClose` 的措辭（例如：`` `@mermaid` is missing its closing `]` ``）。目前先保留原樣、如實記錄，而不是動手修掉——因為這正是這個測試集存在的目的：先看清楚實作實際上會怎麼做，再決定要不要改。
