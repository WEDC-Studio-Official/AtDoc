# @Doc Inline Syntax Specification v1.4

> 🌐 Other languages: [繁體中文](../zh-tw/Inline-Syntax-Specification.md) ・ [简体中文](../zh-cn/Inline-Syntax-Specification.md) ・ [日本語（AI 翻訳、誤りがある可能性があります）](../ja/Inline-Syntax-Specification.md) ・ [한국어（AI 번역, 부정확할 수 있습니다）](../ko/Inline-Syntax-Specification.md)

## 0. Table of Contents

* [1. Design Philosophy](#1-design-philosophy)
* [2. Lexer Behavior Definition](#2-lexer-behavior-definition)
* [3. Ambiguity Resolution Rule](#3-ambiguity-resolution-rule)
* [4. Complete EBNF Grammar Definition](#4-complete-ebnf-grammar-definition)
* [5. Escape Rule](#5-escape-rule)
* [6. Unknown Command Fallback](#6-unknown-command-fallback)
* [7. @mark / @color / @bordered Styles Semantics](#7-mark--color--bordered-styles-semantics)
* [8. @link URI Semantics](#8-link-uri-semantics)
* [9. @raw Opaque Domain](#9-raw-opaque-domain)
* [10. Nested Parsing](#10-nested-parsing)
* [11. Parser Recovery Strategy](#11-parser-recovery-strategy)
* [12. Architecture](#12-architecture)
* [13. Core Principle](#13-core-principle)
* [14. Simplified Syntax Aliases](#14-simplified-syntax-aliases)

---


## 1. Design Philosophy

@Doc adopts:

> **Only Known Commands Trigger Parsing**

Only known commands carry grammatical meaning.

Unknown commands are always treated as plain text.

The goals of this design:

* Lower the learning cost
* Avoid conflicts with email and mention systems
* Improve AI parsing stability
* Improve editor fault tolerance
* Preserve the DSL's extensibility
* Establish a stable and predictable AST

---

## 2. Lexer Behavior Definition

### Command Parsing Rules

When the Lexer scans an `@`, it should process it in the following priority order:

1. If followed by `@@`

   * Parse it as a single literal `@` character

2. If what follows matches a registered command name

   * Enter the corresponding grammar-parsing flow

3. If it matches no known command

   * Output the entire span as plain text

---

### Examples

| Input               | Result            |
| ------------------ | ------------- |
| `@mark[hello]`     | Parsed as a `mark` node |
| `@@mark`           | Outputs `@mark`    |
| `test@example.com` | Plain text           |
| `@GitHub`          | Plain text           |
| `@unknown`         | Plain text           |

---

## 3. Ambiguity Resolution Rule

Since @Doc adopts:

> Known Command Recognition

the Lexer must first attempt to recognize known commands before falling back to plain-text mode.

In other words:

> `inline-node` takes precedence over `plain-text-char`.

The Lexer must follow:

```text
Starts with @
↓
Is it @@ ?
↓
Does it exist in the Command Registry ?
↓
Yes → Inline Node
No → Plain Text
```

Therefore:

```text
@mark[hello]
```

must be parsed as:

```text
InlineNode(mark)
```

rather than:

```text
Text('@')
Text('m')
Text('a')
Text('r')
Text('k')
...
```

---

## 4. Complete EBNF Grammar Definition

```ebnf
(* ==========================================================================
   Entry Point
   ========================================================================== *)

inline-stream =
    { inline-node | plain-text-char } ;

inline-node =
      mark
    | color
    | bordered
    | bold
    | italic
    | underline
    | del
    | raw
    | sup
    | sub
    | fn
    | defn
    | kbd
    | link
    | br
    | escape ;

(* ==========================================================================
   Inline Nodes
   ========================================================================== *)

mark      = "@mark" , [ styles ] , content ;
color     = "@color" , [ styles ] , content ;
(* @bordered shares @color's exact {styles} slot and swatch (see §7),
   applied as a text border instead of a foreground color. *)
bordered  = "@bordered" , [ styles ] , content ;
bold      = ( "@bold" | "@b" ) , content ;
italic    = ( "@italic" | "@i" ) , content ;
underline = ( "@underline" | "@u" ) , content ;
del       = "@del" , content ;

raw       = "@raw" , raw-content ;

sup       = "@sup" , content ;
sub       = "@sub" , content ;

(* Footnotes:
   fn   = the in-text reference marker (superscript), carries only the number
   defn = the footnote definition body, carries the number and the actual content
*)
fn        = "@fn" , "[" , integer , "]" ;
defn      = "@defn" , modifier , content ;

kbd       = "@kbd" , "[" , key , "]" ;

link      = "@link" , uri , content ;

br        = "@n" ;

escape    = "@@" ;

(* ==========================================================================
   Shared Components
   ========================================================================== *)

content =
    "[" ,
        { content-element } ,
    "]" ;

content-element =
      inline-node
    | plain-text-char ;

(* The actual termination rule for raw-content is "bracket-depth counting,"
   not "reaching the first unescaped ]" — balanced-bracket-group uses a
   recursive production to express "as long as brackets are paired inside,
   they can nest freely with no escaping needed at all"; only truly
   unpaired brackets need to be escaped. See 9. @raw Opaque Domain for
   details. *)
raw-content =
    "[" , { raw-unit } , "]" ;

raw-unit =
      escaped-at-close-bracket   (* "@@]" → literal "@]" *)
    | escaped-at-open-bracket    (* "@@[" → literal "@[" *)
    | escaped-close-bracket      (* "@]"  → literal "]" (only used for an unpaired ]) *)
    | escaped-open-bracket       (* "@["  → literal "[" (only used for an unpaired [) *)
    | balanced-bracket-group     (* paired, nestable literal brackets, content unrestricted *)
    | raw-char ;

balanced-bracket-group =
    "[" , { raw-unit } , "]" ;

escaped-at-close-bracket = "@@]" ;
escaped-at-open-bracket  = "@@[" ;
escaped-close-bracket    = "@]" ;
escaped-open-bracket     = "@[" ;

raw-char =
    any-unicode-char - "]" - "[" ;

uri =
    "(" ,
        { text-char - ")" } ,
    ")" ;

modifier =
    "(" ,
        { text-char - ")" } ,
    ")" ;

(* Additional Lexer restriction: `text-char` itself includes newlines, so a
   literal reading would mean "an unclosed "{" can swallow everything all
   the way to any "}" later in the document" — a "{" the author is still
   typing would swallow every node in between (e.g. everything before the
   curly brace in the @code block below) whole into styles, silently
   vanishing from the AST. The actual semantics of styles are a short,
   comma-separated list of tokens with no example ever spanning multiple
   lines, and the editor's Monarch rule (/\{[^}]*\}/, matched line by line)
   doesn't support spanning lines either — so the Lexer stops scanning at
   whichever of "}", end of line, or "[" (start of a content slot) comes
   first; both end-of-line and "[" are treated as unclosed. See
   scanStylesEnd() in src/Lexer.ts. *)
styles =
    "{" ,
        { text-char - "}" - newline - "[" } ,
    "}" ;

key =
    { text-char - "]" } ;

(* @color's semantic constraint on its {styles} content — see §7 for the
   full validation rule (must match /^#[0-9a-fA-F]{6}$/); the terminal itself
   is grammar-level only, exact digit-count/case validation is semantic-level,
   same split as `styles` below. *)
hex-color =
    "#" , hex-digit , hex-digit , hex-digit , hex-digit , hex-digit , hex-digit ;

hex-digit =
      digit
    | "a" | "b" | "c" | "d" | "e" | "f"
    | "A" | "B" | "C" | "D" | "E" | "F" ;

integer =
    digit ,
    { digit } ;

digit =
      "0" | "1" | "2" | "3" | "4"
    | "5" | "6" | "7" | "8" | "9" ;

(* ==========================================================================
   Character Sets
   ========================================================================== *)

(* Note:
   plain-text-char has lower precedence than inline-node.

   The lexer MUST always attempt known command recognition
   before falling back to plain text.
*)

plain-text-char =
    any-unicode-char ;

text-char =
    any-unicode-char ;

letter =
    Unicode Letter ;

symbol =
    Unicode Symbol ;
```

---

## 5. Escape Rule

### Syntax

```text
@@
```

### Output

```text
@
```

### Purpose

Used when the user needs to output a syntax keyword itself.

> This is a **global escape rule**, applicable in the general inline-stream context.
> `@raw` has its own independent escaping rules internally; see [9. @raw Opaque Domain](#9-raw-opaque-domain).

---

### Examples

Input:

```text
@@mark
```

Output:

```text
@mark
```

---

Input:

```text
@@bold[hello]
```

Output:

```text
@bold[hello]
```

---

Input:

```text
Email: test@@example.com
```

Output:

```text
Email: test@example.com
```

Although this form is valid, since:

```text
example
```

is not a known command, in practice you can simply write:

```text
Email: test@example.com
```

without needing to escape it.

---

## 6. Unknown Command Fallback

If what follows `@` is not a valid command name, the parser must fall back to plain-text mode.

Example:

```text
@github
```

Output:

```text
@github
```

---

```text
test@example.com
```

Output:

```text
test@example.com
```

---

```text
@my_custom_tag
```

Output:

```text
@my_custom_tag
```

---

This rule effectively prevents conflicts with:

* Email
* Social media handles
* Discord Mention
* GitHub Username
* Chat Mention System

from occurring.

---

## 7. @mark / @color / @bordered Styles Semantics

`@mark` supports an optional `styles` modifier syntax:

```text
@mark{style}[content]
```

where:

* `style` is a comma-separated style token string (style token list).
* `content` is the text content being marked.
* `styles` is **optional** syntax; when omitted, it is equivalent to a plain highlight mark:

```text
@mark[important content]
```

---

### Style Token Semantics

The content of `style` is a comma-separated **Color Token** string, representing the highlight color; the renderer maps it semantically to an actual color value. Two forms are supported, either of which may be used:

* **Named tokens** (the renderer defines the actual color values):

  ```text
  yellow / red / green / blue / orange / purple / gray
  ```

* **Hexadecimal tokens** (starting with `#`, followed by 6 hex digits, case-insensitive; the renderer MUST use the specified value directly and MUST NOT remap it):

  ```text
  #ff0000 / #3366FF / #00c896
  ```

  A token that does not match `/^#[0-9a-fA-F]{6}$/` (e.g. `#f00`, `#gggggg`) is not considered a valid hex token,
  and follows the general fault-tolerant spirit of Unknown Command Fallback (see Renderer Behavior below).

> **Changelog**: An earlier version separately defined three modifier tokens, `underline`/`strikethrough`/`bordered`, which have been removed. `underline` duplicated the semantics of the `@underline` node; `strikethrough` duplicated the semantics of the `@del` node; `bordered` has been promoted to its own independent node, `@bordered` (see below). `style` now only carries color semantics, and no longer mixes in modifier semantics.

---

### Examples

```text
@mark[default highlight]
@mark{yellow}[yellow highlight]
@mark{red}[red highlight]
@mark{#3366ff}[hex background color]
```

---

### @color — Changing Text Color

`@mark` changes the **background** (highlight) and cannot change the color of the text itself. `@color` fills this gap:

```text
@color{#ff0000}[This text is red]
```

`@color` shares the same `{styles}` field as `@mark` (see the EBNF above), and is itself **optional** —
when omitted, the renderer falls back to a default color, behaving the same way `@mark[content]` does when `{styles}` is omitted.

```text
@color{blue}[This text is dark blue]
```

`@color` accepts the same seven named color tokens as `@mark` (`yellow`/`red`/`green`/`blue`/
`orange`/`purple`/`gray`), and also accepts a single hexadecimal token (`/^#[0-9a-fA-F]{6}$/`).
Both share the same set of token names syntactically, but **the actual color values they map to
are independent**: `@mark`'s color scale is tuned for light highlight backgrounds, and using it
directly as a text foreground color would have insufficient contrast and be hard to read, so
renderers typically maintain a separate, darker-toned lookup table specifically for `@color`
(rather than reusing `@mark`'s). The renderer MUST ignore malformed or unrecognized values and
fall back to some default value, rather than throwing an error:

```text
@color{not-a-color}[This text has no color specified, and gracefully falls back to the default color]
```

> [!IMPORTANT]
> **The old syntax has been deprecated**: an earlier version of `@color` used a required
> `(hex-color)` parenthesized form (`@color(#ff0000)[...]`). That syntax has been removed —
> and not in the sense of "ignore and fall back to the default"; instead, the Parser MUST throw
> a syntax error directly (Strict Mode) or flag it as a diagnostic (Editor Mode) — because the
> parenthesized form would make the author believe the color had taken effect, when it had
> actually silently applied the default color. This "looks like it succeeded but actually
> didn't" gap is more dangerous than failing loudly, so it does not fall under the
> fault-tolerant spirit of [6. Unknown Command Fallback](#6-unknown-command-fallback).

---

### @bordered — Text Border

`@bordered` adds a border around text, sharing exactly the same `{styles}` field as `@color` —
the same braces, equally optional, the same seven named tokens plus hex, and the same
color-swatch lookup table (in implementation, `@color`'s resolver can be reused directly) — the
only difference is that it's applied to the **border** rather than the text color:

```text
@bordered[default border]
@bordered{blue}[blue border]
@bordered{#3366ff}[hex border color]
```

When `{styles}` is omitted or given an unrecognized value, the renderer falls back to its
default border style rather than throwing an error, echoing the fault-tolerant spirit of §6
Unknown Command Fallback. This node replaces the `bordered` modifier token that previously
lived in `@mark`'s `{styles}`, becoming its own independent first-class node, playing the same
role as `underline` (now `@underline`) and `strikethrough` (now `@del`).

---

### Renderer Behavior

* The renderer MUST at least support the default highlight style (`@mark`) / default border style (`@bordered`) when `styles` is omitted.
* The renderer MAY decide for itself the actual color value each named color token maps to (e.g. `yellow` may differ between dark mode and light mode; `@mark` and `@color`/`@bordered` may, and usually should, each maintain their own separate lookup tables, for the reasons given above); a hexadecimal token, however, MUST be used directly as specified and MUST NOT be remapped.
* The renderer MUST ignore unrecognized tokens (including malformed hex tokens), and SHOULD fall back to some default value rather than throwing an error — this behavior is consistent with the fault-tolerant spirit of "unknown commands fall back to plain text" in [6. Unknown Command Fallback](#6-unknown-command-fallback), but its scope is limited to inside `styles`; `@mark[content]`/`@color[content]`/`@bordered[content]` themselves are still parsed normally as their corresponding nodes. The exact shape of the fallback is up to the renderer to decide: it could be "no extra color" (falling back to the default text color/border color), or it could reuse `@mark`'s default highlight color when `styles` is omitted (since all three share the same field shape, this is visually natural).
* The delimiter between tokens is a fixed half-width comma `,`, with any amount of whitespace allowed before and after (the Parser should auto-trim). This rule applies to `@mark`'s `styles`; the `{}` of `@color`/`@bordered` only allows a single token (a color token or a hex value) and does not use comma-separation.

---

### EBNF Supplementary Notes

Corresponding to the following in [4. Complete EBNF Grammar Definition](#4-complete-ebnf-grammar-definition):

```ebnf
(* Additional Lexer restriction: `text-char` itself includes newlines, so a
   literal reading would mean "an unclosed "{" can swallow everything all
   the way to any "}" later in the document" — a "{" the author is still
   typing would swallow every node in between (e.g. everything before the
   curly brace in the @code block below) whole into styles, silently
   vanishing from the AST. The actual semantics of styles are a short,
   comma-separated list of tokens with no example ever spanning multiple
   lines, and the editor's Monarch rule (/\{[^}]*\}/, matched line by line)
   doesn't support spanning lines either — so the Lexer stops scanning at
   whichever of "}", end of line, or "[" (start of a content slot) comes
   first; both end-of-line and "[" are treated as unclosed. See
   scanStylesEnd() in src/Lexer.ts. *)
styles =
    "{" ,
        { text-char - "}" - newline - "[" } ,
    "}" ;
```

At the lexical level, `styles` itself is only defined as "an arbitrary character sequence wrapped in curly braces"; the actual token splitting (comma-separated, recognizing color tokens and modifier tokens) belongs to **semantic-level** processing — it is not the grammar-level responsibility of the Lexer/Parser, but is left to the renderer or a later semantic analysis stage. This design ensures that:

* Adding new style tokens (e.g. `italic`, `bold` in the future) does not require modifying the EBNF grammar definition itself.
* Different renderers can extend or trim their supported token set on their own, consistent with the "preserve the DSL's extensibility" goal in [1. Design Philosophy](#1-design-philosophy).

---

## 8. @link URI Semantics

`@link` accepts any valid URI or URI-like identifier.

```text
@link(uri)[content]
```

where:

* `uri` is the identifier of the target resource.
* `content` is the display text.

---

### Renderer URI Inference

The renderer MAY automatically infer the URI scheme based on the content of `uri`.

For example:

| Input                             | Actual renderer URI           |
| ------------------------------ | ------------------------- |
| `@link(example.com)[Official Website]`     | `https://example.com`     |
| `@link(test@example.com)[Contact me]` | `mailto:test@example.com` |
| `@link(+886912345678)[Customer Service Phone]`   | `tel:+886912345678`       |

---

If `uri` already explicitly specifies a scheme:

```text
@link(https://example.com)[Official Website]
@link(mailto:test@example.com)[Contact me]
@link(tel:+886912345678)[Customer Service Phone]
```

The renderer MUST use the specified value directly, and MUST NOT infer or modify it.

---

### Supported URI Examples

The following are all valid `uri` values:

```text
https://example.com
mailto:test@example.com
tel:+886912345678
ftp://example.com/file.zip
discord://channel/123
vscode://file/path
file:///tmp/test.txt
```

@Doc itself does not restrict the type of URI.

The actual support for a given URI is determined by the renderer.

---

## 9. @raw Opaque Domain

`@raw` belongs to:

> Opaque Domain

Once the parser enters:

```text
@raw[
```

afterward:

* No internal syntax is parsed.
* All keywords such as `@mark`, `@bold`, `@link`, etc. are treated as plain text.
* The global `@@` escape rule ([5. Escape Rule](#5-escape-rule)) no longer applies; the raw domain has its own independent, local set of rules (see below).

### Termination Rule: Bracket-Depth Counting, Not "Reaching the First `]`"

The implementation model for `@raw[...]` is **bracket-depth counting**, and this must be made clear up front, because it directly determines when the escaping rules should and should not be used:

* `[` increases the depth by +1, `]` decreases it by -1; the `]` that brings the depth back to zero is the true end.
* In other words, **as long as the brackets are paired, you can copy them verbatim, with no escaping needed at all** — the `@mark[hello]` inside `@raw[@mark[hello]]` itself has paired left and right brackets, so the Parser correctly ends at the outermost `]`, outputting `@mark[hello]` as literal text.
* The escaping rules exist specifically for **unpaired** brackets — for example, when you just want to write a single, standalone literal `]`, or quote a content fragment whose own brackets are unbalanced. If you add unnecessary escaping to a bracket pair that is already balanced (e.g. writing the end of `@mark[hello]` as `@mark[hello@]`), the `]` consumed by the escape **does not** bring the depth count back to zero, so the +1 depth caused by the earlier `[` in `@mark[` can never find a matching `]` to cancel it out — the Parser can only keep searching forward, swallowing more and more of the outer content (potentially the entire document) before it finally errors out. **Write balanced brackets as-is; always escape unbalanced brackets; escape characters do not participate in depth counting.**

The escaping rules are symmetric — both `]` and `[` each have a "single-character escape" and an "escape the `@` itself followed by that character" form, four rules in total; when scanning, they are matched in the following priority order (longer, more specific sequences first):

| Priority | Input   | Output   | Description                          |
| ------ | ------ | ------ | ----------------------------- |
| 1      | `@@]`  | `@]`   | Outputs the two literal characters `@]`         |
| 2      | `@@[`  | `@[`   | Outputs the two literal characters `@[`         |
| 3      | `@]`   | `]`    | Outputs an **unpaired** literal `]` (does not affect depth counting) |
| 4      | `@[`   | `[`    | Outputs an **unpaired** literal `[` (does not affect depth counting) |

---

### Examples

Input:

```text
@raw[@mark[hello]]
```

Output:

```text
@mark[hello]
```

> Explanation: `@mark[hello]` itself has paired brackets, so the depth count goes 1→2→1, and only the outermost `]` brings the depth back to zero and ends `@raw`. **No escaping is needed at all** — this is the most common usage (demonstrating a complete, bracket-balanced piece of @Doc syntax inside raw content).

---

Input:

```text
@raw[@@]
```

Output:

```text
@@
```

> Explanation: here the `]` immediately following `@@` is the closing bracket of raw-content itself, so the `@@]` special case is not triggered (`@@]` must be three consecutive characters); it should be parsed as: the literal characters `@@` (output as-is, since the global escape rule is disabled) + the closing `]`.

---

Input:

```text
@raw[Today I'm afraid the @] will be detected]
```

Output:

```text
Today I'm afraid the ] will be detected
```

> Explanation: here `@]` is an **unpaired** literal `]` (there is no matching `[` before it), so it must be escaped — otherwise it would be treated as the end of `@raw` itself, causing the following "will be detected" to fall outside the raw content.

---

Input:

```text
@raw[Today I'm afraid the @@] will be detected]
```

Output:

```text
Today I'm afraid the @] will be detected
```

> [!TIP]
> **TIP**: If the user wants to output the two characters `@]` inside raw content, simply add one more `@` in front (i.e. `@@]`) — this is a local escaping special case within the raw domain, independent of and unaffected by the global `@@` escape rule in §5. `@[`/`@@[` form a completely symmetric counterpart, with the same rules but the opposite direction (handling an unpaired literal `[`).

---

Input (escaping used where it shouldn't be — **counter-example**):

```text
@raw[Here, @mark[hello@] stays as-is]
```

> [!WARNING]
> **Don't write it this way**: the `[` in `@mark[hello` has already increased the depth by +1; the author's original intent was simply to have `@mark[hello]` output as-is (just like the first example above, where the brackets are already paired and no escaping is needed at all), but an extra escape character `@]` was typed at the end. The escape consumes that `]` without participating in depth counting, so the +1 depth caused by `@mark[` can never find a matching `]` to cancel it out — the Parser keeps searching forward, swallowing more and more of the outer content (potentially the entire document) before it finally errors out. The correct way to write it is to remove the extra `@` and simply write `@raw[Here, @mark[hello] stays as-is]` — the brackets are paired, and the Parser can match them correctly on its own, with no manual intervention needed.

---

## 10. Nested Parsing

Because:

```ebnf
content-element =
      inline-node
    | plain-text-char ;
```

@Doc supports full recursive nesting.

For example:

```text
@bold[
    This is bold text,
    inside there is
    @mark{yellow}[an important highlight]
    and
    @underline[an underline]
]
```

Its AST structure is:

```text
Bold
├── Text
├── Mark
└── Underline
```

---

## 11. Parser Recovery Strategy

When the Parser encounters an unclosed structure:

```text
@bold[hello
```

or:

```text
@mark{red}[hello
```

Two suggested modes are provided:

### Strict Mode

Throws a syntax error directly:

```text
Unexpected EOF while parsing @bold
```

> [!TIP]
> **TIP**: AtDoc chose to throw a syntax error directly, and uses an asynchronous error-breakpoint recovery mechanism

---

### Editor Mode

Allows the editor to automatically complete missing closing symbols:

```text
]
```

to improve the real-time editing experience.

---

## 12. Architecture

Recommended parsing pipeline:

```text
Source Text
    ↓
Lexer
    ↓
Token Stream
    ↓
Parser
    ↓
AST
    ↓
Renderer
```

The renderer can freely output:

* HTML
* React
* PDF
* DOCX
* Markdown
* Discord
* Terminal
* Custom UI

---

## 13. Core Principle

The core goal of @Doc is not to replace Markdown.

but rather to establish:

> Human Editable
> Machine Deterministic
> AI Friendly
> Cross Platform

a next-generation document interchange format.

---

## 14. Simplified Syntax Aliases

`@bold`/`@italic`/`@underline` provide the simplified aliases `@b`/`@i`/`@u` — purely a shorthand at input time. The Parser normalizes it to the canonical name before creating the AST node (`node.type` is always the canonical name); the renderer never needs to, and never does, distinguish which form the author actually typed.

| Canonical | Alias |
|---|---|
| `@bold` | `@b` |
| `@italic` | `@i` |
| `@underline` | `@u` |

(The Block Syntax aliases `@h`/`@p` for `@heading`/`@paragraph` are defined in Block Syntax Specification §11.)
