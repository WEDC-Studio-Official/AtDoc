// Monarch tokenizer for @Doc syntax highlighting (Monaco/VS Code-family editors).
//
// Fixes three problems in the previous ad-hoc TextMate grammar (note/TextMate.md):
//
//   1. The old grammar captured an entire "[...]" slot with one
//      `\[[^\]]+\]` regex, so everything inside became a single opaque
//      "string" scope — nested nodes never got their own colors.
//   2. That same regex couldn't match nested or cross-line brackets at all —
//      `@table[@cols[...]@data[...]]` failed to match past the first "]".
//   3. The keyword list was hand-copied and didn't include restricted-context
//      nodes (@cols, @data, @tab), so they were never highlighted and would
//      silently go stale as registry.ts evolved.
//
// This tokenizer fixes all three by:
//   - using a real push/pop state machine so "[" opens a *nested* scanning
//     state and only its own matching "]" pops back out (item 1 & 2), and
//   - deriving every keyword list from registry.ts's getAllNodeDefs() instead
//     of a hand-maintained array (item 3) — new registry entries flow in
//     automatically as long as their `content`/`paren` fields are accurate.
//
// Raw-family nodes (@code, @mermaid, @svg, @kbd, @fn, @raw) push an opaque
// scanning state that never recognizes "@node" syntax inside it, matching
// Lexer.ts's `isRawFamily` / `scanRawContent` behavior — this is what makes
// `@code[@mark[not parsed]]` render its contents as inert code, not markup.
//
// This module has no runtime dependency on the `monaco-editor` package: it
// exports plain data shaped like Monaco's `languages.IMonarchLanguage`, so
// any Monaco-based consumer (e.g. the wedc web editor) can hand it straight
// to `monaco.languages.setMonarchTokensProvider('atdoc', atDocMonarchLanguage)`
// without AtDoc itself depending on monaco-editor.
//
// Known simplifications (documented rather than silently wrong):
//   - Void nodes (@hr, @n) never take a "(paren)"/"{styles}" slot here, even
//     though the real Lexer would technically tokenize one if present — void
//     nodes never use this in practice.
//   - Raw-family nodes support at most a single-line "(paren)" immediately
//     before "[" (this is what @code's language tag needs) and no "{styles}"
//     slot — matching registry.ts, where no raw-family node declares
//     `styles: true` and only @code declares a non-'none' `paren`.
//   - Bracket-family nodes (generic/comma-list/rows/table/tabs/meta content)
//     get full, multi-line-safe "(paren)" and "{styles}" handling, since
//     Monarch tokenizes one editor line at a time and @img's paren is
//     allowed to span lines (see test.atd).

import { getAllNodeDefs } from '../registry.ts';
import type { ContentMode, ParenMode } from '../registry.ts';

const IDENT_BOUNDARY = '(?![a-zA-Z0-9_-])';

function alternation(names: string[]): string {
  return names.join('|');
}

function namesWhere(predicate: (content: ContentMode, paren: ParenMode) => boolean): string[] {
  return getAllNodeDefs()
    .filter(d => predicate(d.content, d.paren))
    .map(d => d.name);
}

const voidNames = namesWhere(content => content === 'none');
const rawEscapedNames = namesWhere(content => content === 'raw-escaped');
const rawPlainAllNames = namesWhere(content => content === 'raw' || content === 'key' || content === 'integer');
const rawPlainWithParenNames = namesWhere(
  (content, paren) => (content === 'raw' || content === 'key' || content === 'integer') && paren !== 'none',
);
const rawPlainNoParenNames = rawPlainAllNames.filter(n => !rawPlainWithParenNames.includes(n));
const bracketNames = namesWhere(
  content => content !== 'none' && content !== 'raw-escaped' && content !== 'raw' && content !== 'key' && content !== 'integer',
);

// registry.ts assumption this tokenizer relies on for its raw-escaped
// combined regex (see module comment "Known simplifications"). If this ever
// fires, the raw-escaped bucket has grown a member with a real paren slot
// and rawEscapedRegex below needs the same with-paren/no-paren split as
// rawPlain gets.
for (const d of getAllNodeDefs()) {
  if (d.content === 'raw-escaped' && d.paren !== 'none') {
    throw new Error(`editor/monarch.ts: "${d.name}" is raw-escaped but declares a paren slot — tokenizer needs updating.`);
  }
}

function re(pattern: string): RegExp {
  return new RegExp(pattern);
}

const voidRegex = voidNames.length ? re(`@(?:${alternation(voidNames)})${IDENT_BOUNDARY}`) : null;
const rawEscapedRegex = rawEscapedNames.length ? re(`@(?:${alternation(rawEscapedNames)})\\[`) : null;
const rawPlainWithParenRegex = rawPlainWithParenNames.length
  ? re(`@(?:${alternation(rawPlainWithParenNames)})(?:\\([^)]*\\))?\\[`)
  : null;
const rawPlainNoParenRegex = rawPlainNoParenNames.length ? re(`@(?:${alternation(rawPlainNoParenNames)})\\[`) : null;
const bracketRegex = bracketNames.length ? re(`@(?:${alternation(bracketNames)})${IDENT_BOUNDARY}`) : null;

// Minimal local shape of Monaco's `languages.IMonarchLanguage` — declared by
// hand so this file has zero dependency on the `monaco-editor` package.
export interface MonarchAction {
  token: string;
  next?: string;
}
export type MonarchRule = [RegExp, string | MonarchAction];
export interface MonarchLanguage {
  defaultToken: string;
  tokenizer: Record<string, MonarchRule[]>;
}

const rules: MonarchRule[] = [];

rules.push([/@@/, 'constant.character.escape.doc']);
if (voidRegex) rules.push([voidRegex, 'keyword.control.doc']);
if (rawEscapedRegex) rules.push([rawEscapedRegex, { token: 'keyword.control.doc', next: '@rawEscaped' }]);
if (rawPlainWithParenRegex) rules.push([rawPlainWithParenRegex, { token: 'keyword.control.doc', next: '@rawPlain' }]);
if (rawPlainNoParenRegex) rules.push([rawPlainNoParenRegex, { token: 'keyword.control.doc', next: '@rawPlain' }]);
if (bracketRegex) rules.push([bracketRegex, 'keyword.control.doc']);
// Unknown command fallback (Inline Syntax Specification §6) — always plain text.
rules.push([/@[a-zA-Z0-9_-]*/, '']);
// "(paren)" / "{styles}" are self-contained push/pop pairs independent of
// bracket depth, so they can follow any node name above without an
// intermediate state — see module comment.
rules.push([/\(/, { token: 'punctuation.definition.doc', next: '@paren' }]);
rules.push([/\{/, { token: 'punctuation.definition.doc', next: '@styles' }]);
// A bare "[" always opens nested content — whether or not a node name
// preceded it (e.g. plain text like "array[0]") — matching Parser.ts's
// depth-aware parseSlotContent(), which is equally agnostic about that.
rules.push([/\[/, { token: 'punctuation.definition.doc', next: '@push' }]);
rules.push([/\]/, { token: 'punctuation.definition.doc', next: '@pop' }]);
rules.push([/[^@[\](){}]+/, '']);
rules.push([/[(){}]/, '']);

const paren: MonarchRule[] = [
  [/[^)]+/, 'variable.parameter.modifier.doc'],
  [/\)/, { token: 'punctuation.definition.doc', next: '@pop' }],
];

const styles: MonarchRule[] = [
  [/[^}]+/, 'support.type.property-value.styles.doc'],
  [/\}/, { token: 'punctuation.definition.doc', next: '@pop' }],
];

// Opaque scan for @code / @mermaid / @svg / @kbd / @fn content — never
// recognizes "@node" syntax inside, matching Lexer.ts's scanRawContent()
// depth tracking for nested literal brackets (e.g. inside code samples).
const rawPlain: MonarchRule[] = [
  [/\[/, { token: 'string.unparsed.doc', next: '@push' }],
  [/\]/, { token: 'string.unparsed.doc', next: '@pop' }],
  [/[^[\]]+/, 'string.unparsed.doc'],
];

// Same opaque scan, plus @raw's two local escape exceptions (Inline Syntax
// Specification §9): "@]" -> literal "]", "@@]" -> literal "@]".
const rawEscaped: MonarchRule[] = [
  [/@@\]/, 'constant.character.escape.doc'],
  [/@\]/, 'constant.character.escape.doc'],
  [/\[/, { token: 'string.unparsed.doc', next: '@push' }],
  [/\]/, { token: 'string.unparsed.doc', next: '@pop' }],
  [/[^@[\]]+/, 'string.unparsed.doc'],
  [/@/, 'string.unparsed.doc'],
];

export const atDocMonarchLanguage: MonarchLanguage = {
  defaultToken: '',
  tokenizer: {
    root: rules,
    paren,
    styles,
    rawPlain,
    rawEscaped,
  },
};

/** A minimal default theme mapping this tokenizer's scopes to colors, for `monaco.editor.defineTheme`. */
export const atDocThemeRules: { token: string; foreground: string; fontStyle?: string }[] = [
  { token: 'keyword.control.doc', foreground: 'C586C0', fontStyle: 'bold' },
  { token: 'punctuation.definition.doc', foreground: '808080' },
  { token: 'variable.parameter.modifier.doc', foreground: 'CE9178' },
  { token: 'support.type.property-value.styles.doc', foreground: '9CDCFE' },
  { token: 'string.unparsed.doc', foreground: '6A9955' },
  { token: 'constant.character.escape.doc', foreground: 'D7BA7D' },
];
