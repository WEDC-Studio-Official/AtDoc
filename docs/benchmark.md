> - [繁體中文 Benchmark](./docs/benchmark-tw.md)

# AtDoc Benchmark

AtDoc Benchmark is a five-stage validation process designed to evaluate
the accuracy, efficiency, reproducibility, and practical value of AtDoc
across different environments, models, and execution platforms.

The benchmark will compare traditional Markdown, JSON, HTML, and AtDoc
under the same test conditions.

> **Status:** Stage 1 (Local Environment) not yet started as a formal AtDoc
> parser/renderer benchmark. A companion project has already run
> environment-equivalents of Stage 4 (GPUTW) and Stage 5 (ChatGPT API) —
> local LM Studio hardware standing in for rented GPUTW infrastructure, and
> the Gemini API standing in for ChatGPT — see the progress notes under
> each stage below. Stages 2 (Cloudflare) and 3 (Google Colab) not started.

---

## Benchmark Goals

The benchmark focuses on the following goals:

- Validate the correctness of the AtDoc parser and renderer.
- Measure parsing and rendering performance.
- Evaluate semantic and structural accuracy.
- Compare output size and token usage.
- Measure execution latency.
- Evaluate AtDoc across different model sizes.
- Verify reproducibility in public environments.
- Evaluate compatibility with commercial LLM APIs.
- Identify the practical advantages and limitations of AtDoc.

---

## Evaluation Formats

The benchmark will compare the following formats:

- Markdown
- JSON
- HTML
- AtDoc

Each format will be tested with the same content and equivalent
requirements whenever possible.

---

## Evaluation Metrics

### 1. Accuracy

Measure whether the generated or converted result correctly represents
the original content.

Evaluation items include:

- Semantic accuracy
- Structural accuracy
- Node hierarchy accuracy
- Attribute accuracy
- Content preservation
- Syntax validity
- Parser success rate
- Renderer success rate

### 2. Performance

Measure the time required to process the same input.

Evaluation items include:

- Parser latency
- Renderer latency
- End-to-end latency
- Average execution time
- Minimum execution time
- Maximum execution time
- Throughput
- Tokens per second, when applicable

### 3. Token Usage

Measure the amount of input and output tokens.

Evaluation items include:

- Input tokens
- Output tokens
- Total tokens
- Token reduction rate
- Average tokens per document
- Token usage under long-context conditions

### 4. Reliability

Measure whether the system can consistently process different cases.

Evaluation items include:

- Successful test cases
- Failed test cases
- Error rate
- Invalid syntax rate
- Recovery behavior
- Repeated execution consistency

### 5. Reproducibility

Measure whether the same benchmark can be executed again under
different environments.

Evaluation items include:

- Environment configuration
- Dependency versions
- Model versions
- Hardware configuration
- Random seed, when supported
- Test data availability
- Result consistency

---

# Five-Stage Benchmark Plan

## 1. Local Environment

### Objective

Establish a reliable local baseline and verify the correctness of the
benchmark tools before testing other platforms.

### Environment

The local benchmark will run on a personal development computer.

The exact hardware and software configuration will be recorded before
testing.

### Test Scope

- AtDoc lexer
- AtDoc parser
- Semantic AST generation
- AtDoc renderer
- Markdown conversion
- JSON conversion
- HTML output
- Error handling
- Benchmark runner

### Test Cases

The local benchmark will include:

- Headings and paragraphs
- Ordered and unordered lists
- Nested content
- Code blocks
- Links and images
- Tables
- Callouts
- Buttons
- Cards
- Tabs
- Complex document structures
- Invalid syntax
- Large documents

### Measurements

- Parse success rate
- Render success rate
- Parser latency
- Renderer latency
- End-to-end latency
- Memory usage
- Output correctness
- Error rate

### Expected Result

The local stage should provide:

- A stable benchmark runner
- A verified test dataset
- A reproducible baseline
- Correctness reports
- Performance reports
- A list of known limitations

---

## 2. Cloudflare

### Objective

Evaluate AtDoc runtime performance in a deployed edge environment.

This stage focuses on AtDoc execution rather than model generation speed.

### Environment

The benchmark will be deployed to Cloudflare Workers or another
appropriate Cloudflare runtime.

The following components may be evaluated:

- AtDoc parser
- AtDoc renderer
- Worker request handling
- Network transfer
- Cold-start behavior
- Warm execution behavior

### Test Scope

- Parse AtDoc documents inside a Worker
- Render AtDoc documents inside a Worker
- Return HTML responses
- Measure request processing time
- Compare local and edge execution
- Evaluate small and large documents

### Measurements

The benchmark should separate the following timings:

1. Model generation time, when applicable
2. Network transfer time
3. AtDoc parser time
4. AtDoc renderer time
5. Total request time

Additional measurements include:

- Requests per second
- Average latency
- P50 latency
- P95 latency
- P99 latency
- Error rate
- Response size

### Expected Result

The Cloudflare stage should determine whether AtDoc provides practical
advantages for edge-based document processing and rendering.

---

## 3. Google Colab

### Objective

Provide a public and reproducible benchmark environment.

Google Colab will be used to allow other developers and researchers to
execute the benchmark without requiring the same local hardware.

### Environment

The benchmark will be provided as a Google Colab notebook.

Suggested notebook:

```text
AtDoc Benchmark.ipynb
```

### Test Scope

- Install the required dependencies
- Install the AtDoc package
- Load the benchmark dataset
- Run parser tests
- Run renderer tests
- Compare output formats
- Export benchmark results
- Generate charts and reports

### Reproducibility Requirements

The notebook should record:

- Python version
- Node.js version, when applicable
- Package versions
- AtDoc version
- Model version, when applicable
- Runtime configuration
- Execution date
- Hardware information

### Expected Result

The Colab stage should provide:

- A publicly accessible notebook
- Reproducible test instructions
- Exportable result files
- A standard report format
- A way for contributors to verify the results

---

## 4. GPUTW

### Objective

Evaluate AtDoc with different local language models and hardware configurations.

This stage focuses on model-generated output, token usage, latency, and semantic accuracy.

### Environment

The benchmark will run on rented GPU infrastructure.

The hardware and model configuration must be recorded for every test.

Example configuration fields:

- GPU model
- GPU memory
- System memory
- CPU
- Operating system
- Runtime
- Quantization format
- Context length
- Temperature
- Model version

### Model Groups

The benchmark may include models from different size groups:

- Small models
- Medium models
- Large models
- Mixture-of-Experts models
- Reasoning models
- Vision-language models, when applicable

Example models may include:

- Qwen models
- GPT-OSS models
- Other compatible open-weight models

The exact model list will be finalized before execution.

### Test Scope

- Markdown generation
- JSON generation
- HTML generation
- AtDoc generation
- Structure conversion
- Nested semantic structures
- Component generation
- Long-context documents
- Invalid or ambiguous instructions

### Controlled Parameters

The following parameters should remain consistent within each test group:

- Prompt
- Test case
- Temperature
- Context length
- System instruction
- Output format
- Model version
- Quantization format
- Hardware configuration

Thinking and non-thinking modes must be evaluated separately.

### Measurements

- Semantic accuracy
- Structural accuracy
- Syntax validity
- Parser success rate
- Renderer success rate
- Input tokens
- Output tokens
- Total tokens
- Time to first token
- Total generation time
- Tokens per second
- Average latency
- Error rate

### Expected Result

The GPUTW stage should show:

- How different models generate AtDoc
- Which model sizes perform best
- Token usage differences
- Latency differences
- Accuracy differences
- The effect of context length
- The effect of reasoning mode
- The practical hardware requirements

Different hardware, model versions, and quantization formats must not be combined into one unqualified ranking.

### Progress Notes (2026-09-18)

A companion project (`benchmark/model-format` in the app repo that depends
on `atdoc-core`) has run this stage's test design — Markdown/HTML/MDX/JSON/
AtDoc generation across content briefs of three difficulty tiers, in both
Chinese and English — on **local hardware instead of rented GPUTW
infrastructure**: two personal machines (8GB VRAM laptop, 16GB VRAM
desktop) running quantized models through LM Studio, not the rented
GPU environment this stage specifies. Treat the following as an early
signal for the stage's methodology, not a substitute for the real
GPUTW run:

- Models covered: GPT-OSS 20B, Qwen3.5 9B, Gemma 4 E4B (both machines);
  Qwen3.8 27B and Gemma 4 26B A4B (16GB machine only).
- AtDoc is the only format where syntax-valid rate drops meaningfully
  below ~100% — local models ranged roughly 50%-94% depending on model
  and hardware, versus near-100% for Markdown/HTML/JSON on the same
  models. Markdown/JSON/HTML syntax validity was consistently high
  across every model tested.
- Thinking/non-thinking modes could not always be evaluated separately
  as this stage specifies: Qwen3.5 9B's reasoning mode could not be
  disabled via any documented parameter (`enable_thinking: false`,
  `/no_think`, `chat_template_kwargs`), and it silently consumed the
  entire output token budget on hidden reasoning at the model's default
  token ceiling — required raising `max_tokens` substantially higher
  than the non-reasoning models needed to get any visible output at
  all. Qwen3.8 27B, by contrast, does expose a working `reasoning_effort`
  parameter.
- Same-model tok/s varied by up to ~19x between the two machines
  (a 20B-class model was VRAM-bound on the 8GB machine and far less so
  on the 16GB one) — a concrete illustration of why this stage's own
  guidance against combining different hardware into one ranking matters
  in practice, not just in principle.

---

## 5. ChatGPT API

### Objective

Evaluate AtDoc compatibility with commercial large language model APIs.

This stage focuses on whether AtDoc can be reliably generated and used through an external API.

### Environment

The benchmark will use the ChatGPT API with a fixed API configuration.

The following information should be recorded:

- API model
- API version, when available
- Temperature
- Maximum output tokens
- Context configuration
- System prompt
- Request parameters
- Response format

### Test Scope

- Generate AtDoc from natural language
- Convert Markdown to AtDoc
- Generate structured documents
- Generate UI components
- Generate nested content
- Handle invalid instructions
- Handle long documents
- Validate generated AtDoc
- Render the generated result

### Measurements

- Semantic accuracy
- Structural accuracy
- Syntax validity
- Parser success rate
- Renderer success rate
- Input tokens
- Output tokens
- Total tokens
- Request latency
- Generation latency
- Error rate
- Retry rate
- Estimated API cost

### Expected Result

The ChatGPT API stage should determine:

- Whether AtDoc can be generated reliably by commercial models
- Whether AtDoc reduces output token usage
- Whether AtDoc improves structural consistency
- Whether AtDoc is suitable for AI-native document generation
- What limitations remain in real API usage

### Progress Notes (2026-09-18)

The same companion project ran this stage's test design against the
**Gemini API instead of ChatGPT** (via Google's OpenAI-compatible
endpoint), using the same content briefs and metrics as the GPUTW-stage
notes above. Treat this as an early signal for a commercial-API-class
model, not a ChatGPT result specifically:

- Gemini 2.5 Flash reached 100% syntax-valid AtDoc across every content
  brief tested, with a perfect structural-accuracy score on nearly every
  case — the strongest AtDoc generation result observed in this project
  so far, well above any locally-hosted model.
- Generation speed was consistently 120-190 tokens/second, roughly
  3-30x the local models' throughput (as expected — this stage measures
  a hosted API, not comparable hardware).
- Reasoning mode had to be explicitly disabled (`reasoning_effort: "none"`
  in the request body): the model's default "thinking" mode otherwise
  consumed the entire output token budget on hidden reasoning and
  returned empty content, the same failure class as the GPUTW-stage notes
  above — except here every wasted call also has a real API cost, making
  it worth calling out explicitly for this stage's "Estimated API cost"
  metric.
- One transient `503 Service Unavailable` occurred during testing and
  needed a retry — worth tracking under this stage's "Retry rate" metric
  for any real API integration, not just an AtDoc-specific concern.
- JSON output consistently arrived wrapped in an unrequested ` ```json `
  code fence, unlike every other format tested — a minor but consistent
  parsing gotcha worth a "strip code fence before validating" step in any
  real integration.

---

# Test Dataset

The benchmark dataset should contain test cases with different levels of complexity.

## Basic Cases

- Plain text
- Headings
- Paragraphs
- Lists
- Links
- Images
- Code blocks

## Intermediate Cases

- Nested lists
- Tables
- Callouts
- Cards
- Buttons
- Tabs
- Multiple sections
- Mixed content

## Advanced Cases

- Complex document trees
- Deeply nested structures
- README documents
- API documentation
- Technical specifications
- Long-context documents
- Ambiguous instructions
- Invalid syntax
- Mixed semantic components

Each test case should have:

- A unique ID
- A description
- The original input
- The expected structure
- The expected output
- Validation rules
- Difficulty level

---

# Result Format

Each benchmark execution should export structured results.

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

# Reporting

The final report should include:

- Environment information
- Test dataset
- Test configuration
- Raw results
- Aggregated results
- Accuracy comparison
- Token comparison
- Latency comparison
- Error analysis
- Known limitations
- Reproduction instructions

Results should be published together with the benchmark version and the AtDoc version used during testing.

---

# Limitations

The benchmark results may be affected by:

- Model version
- Quantization format
- Context length
- Prompt design
- Hardware configuration
- Runtime implementation
- Network conditions
- API rate limits
- Randomness
- Test dataset design

Therefore, benchmark results should be interpreted within their recorded configuration rather than treated as universal rankings.

---

# Conclusion

The AtDoc Benchmark is intended to provide a transparent and reproducible evaluation of AtDoc across local runtimes, edge environments, public notebooks, open-weight models, and commercial APIs.

The benchmark will be updated as the AtDoc parser, renderer, package, and AI integration capabilities evolve.
