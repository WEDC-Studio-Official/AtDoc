# @Doc — AI-Native Semantic Document Notation

<img src="https://wedc.cc/atd.png" width="64"/>

@Doc is a notation designed for three readers: humans who write content, AI that generates content, and compilers that render content. It is not the next Markdown — it's the missing notation layer between LLM-generated content and render targets.

Start with the [English documentation](docs/en/README.md). Chinese translations and other language editions are also available:

| Language | README | Block Syntax Spec | Inline Syntax Spec |
|:---|:---|:---|:---|
| 🇺🇸 English | [README](docs/en/README.md) | [Block-Syntax-Specification](docs/en/Block-Syntax-Specification.md) | [Inline-Syntax-Specification](docs/en/Inline-Syntax-Specification.md) |
| 🇹🇼 Traditional Chinese | [README](https://github.com/WEDC-Studio-Official/AtDoc/blob/main/docs/zh-tw/README.md) | [Block-Syntax-Specification](https://github.com/WEDC-Studio-Official/AtDoc/blob/main/docs/zh-tw/Block-Syntax-Specification.md) | [Inline-Syntax-Specification](https://github.com/WEDC-Studio-Official/AtDoc/blob/main/docs/zh-tw/Inline-Syntax-Specification.md) |
| 🇨🇳 Simplified Chinese | [README](https://github.com/WEDC-Studio-Official/AtDoc/blob/main/docs/zh-cn/README.md) | [Block-Syntax-Specification](https://github.com/WEDC-Studio-Official/AtDoc/blob/main/docs/zh-cn/Block-Syntax-Specification.md) | [Inline-Syntax-Specification](https://github.com/WEDC-Studio-Official/AtDoc/blob/main/docs/zh-cn/Inline-Syntax-Specification.md) |
| 🇯🇵 Japanese <sub>(AI translation; may contain errors)</sub> | [README](https://github.com/WEDC-Studio-Official/AtDoc/blob/main/docs/ja/README.md) | [Block-Syntax-Specification](https://github.com/WEDC-Studio-Official/AtDoc/blob/main/docs/ja/Block-Syntax-Specification.md) | [Inline-Syntax-Specification](https://github.com/WEDC-Studio-Official/AtDoc/blob/main/docs/ja/Inline-Syntax-Specification.md) |
| 🇰🇷 Korean <sub>(AI translation; may contain errors)</sub> | [README](https://github.com/WEDC-Studio-Official/AtDoc/blob/main/docs/ko/README.md) | [Block-Syntax-Specification](https://github.com/WEDC-Studio-Official/AtDoc/blob/main/docs/ko/Block-Syntax-Specification.md) | [Inline-Syntax-Specification](https://github.com/WEDC-Studio-Official/AtDoc/blob/main/docs/ko/Inline-Syntax-Specification.md) |

English is the primary language for the package and its documentation; Chinese is secondary. The two `*-Specification.md` files in each language folder describe the grammar (EBNF + semantic rules) for that language edition.

---

## What's in here

```
src/            Lexer, Parser, registry (single source of truth for nodes), Adapters (two HTML render routes)
src/editor/     Monarch tokenizer for Monaco-style editors
tests/          Strict Mode test cases for the Lexer/Parser, plus render verification for each node
configs/        Node configuration for editor/tooling
docs/<lang>/    Per-language documentation (README + the two grammar specifications)
```

## License

MIT — see [LICENSE](LICENSE).
