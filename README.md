# @Doc — AI-Native Semantic Document Notation

<img src="https://wedc.cc/atd.png" width="64"/>

@Doc is a notation designed for three readers: humans who write content, AI that generates content, and compilers that render content. It is not the next Markdown — it's the missing notation layer between LLM-generated content and render targets.

This documentation is split by language. Pick one:

| Language | README | Block Syntax Spec | Inline Syntax Spec |
|:---|:---|:---|:---|
| 🇹🇼 繁體中文 | [README](docs/zh-tw/README.md) | [Block-Syntax-Specification](docs/zh-tw/Block-Syntax-Specification.md) | [Inline-Syntax-Specification](docs/zh-tw/Inline-Syntax-Specification.md) |
| 🇺🇸 English | [README](docs/en/README.md) | [Block-Syntax-Specification](docs/en/Block-Syntax-Specification.md) | [Inline-Syntax-Specification](docs/en/Inline-Syntax-Specification.md) |
| 🇨🇳 简体中文 | [README](docs/zh-cn/README.md) | [Block-Syntax-Specification](docs/zh-cn/Block-Syntax-Specification.md) | [Inline-Syntax-Specification](docs/zh-cn/Inline-Syntax-Specification.md) |
| 🇯🇵 日本語 <sub>(AI 翻訳、誤りがある可能性があります)</sub> | [README](docs/ja/README.md) | [Block-Syntax-Specification](docs/ja/Block-Syntax-Specification.md) | [Inline-Syntax-Specification](docs/ja/Inline-Syntax-Specification.md) |
| 🇰🇷 한국어 <sub>(AI 번역, 부정확할 수 있습니다)</sub> | [README](docs/ko/README.md) | [Block-Syntax-Specification](docs/ko/Block-Syntax-Specification.md) | [Inline-Syntax-Specification](docs/ko/Inline-Syntax-Specification.md) |

`docs/zh-tw/` is the authoritative source language; the other versions are translated from it. The two `*-Specification.md` files in each language folder are the authoritative grammar (EBNF + semantic rules) for that language edition.

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
