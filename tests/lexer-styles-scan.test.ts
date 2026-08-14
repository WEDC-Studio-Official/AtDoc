// Regression cover for the "{styles}" scan boundary (Lexer.ts's
// scanStylesEnd). The EBNF's inner set is `text-char - "}"` with
// `text-char = any-unicode-char`, so read literally an unterminated "{"
// swallows the document up to whatever "}" turns up next — typically a brace
// inside an unrelated @code block, which silently deletes every node in
// between from the AST while the author is still mid-typing.

import { tokenize } from '../src/Lexer.ts';
import { DocParser } from '../src/Parser.ts';
import { DocSyntaxError } from '../src/types.ts';

let pass = 0;
let fail = 0;

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`PASS ${name}`);
  } else {
    fail++;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** A half-typed "@h(4){" sitting above a @code block whose Rust body contains "{}". */
const MID_TYPING_DOC = `@quote[
Owner
]
@h(4){[]

@hr

@code[
fn main() {
    println!("{}", s2);
}
]
`;

{
  const tokens = tokenize(MID_TYPING_DOC);
  const styles = tokens.filter(t => t.type === 'STYLES');
  check('unterminated "{" produces exactly one STYLES token', styles.length === 1, JSON.stringify(styles));
  check('unterminated "{" stops before the content slot (empty value)', styles[0]?.value === '', JSON.stringify(styles[0]));

  // The nodes that used to be swallowed whole.
  const nodeNames = tokens.filter(t => t.type === 'NODE').map(t => t.value);
  check('following @hr survives the unterminated "{"', nodeNames.includes('hr'), nodeNames.join(','));
  check('following @code survives the unterminated "{"', nodeNames.includes('code'), nodeNames.join(','));
  const raw = tokens.find(t => t.type === 'RAW');
  check('@code keeps its full body, braces and all', !!raw && raw.value.includes('println!("{}", s2);'), JSON.stringify(raw?.value));
}

// The Parser's own view: @heading has no {styles} slot. Editor Mode doesn't
// throw for this (see run-tests.ts's note on Strict Mode vs Editor Mode) — it
// pushes an error-severity diagnostic instead, pointed at the slot itself,
// not because the rest of the document went missing.
{
  let message = '';
  try {
    const parser = new DocParser(tokenize(MID_TYPING_DOC));
    parser.parse();
    const errorDiagnostic = parser.diagnostics.find(d => d.severity === undefined || d.severity === 'error');
    if (errorDiagnostic) message = errorDiagnostic.message;
  } catch (err) {
    message = err instanceof DocSyntaxError ? err.message : String(err);
  }
  check('Parser flags the slot, not the fallout', message.includes('has no `{styles}` slot'), message);
}

// A "{" left unterminated at end of line stops there rather than running on
// into the next line's content.
{
  const tokens = tokenize('@card{#3366ff\n@hr\n');
  const styles = tokens.find(t => t.type === 'STYLES');
  check('unterminated "{" stops at end of line', styles?.value === '#3366ff', JSON.stringify(styles));
  check('the next line\'s @hr is still its own NODE', tokens.some(t => t.type === 'NODE' && t.value === 'hr'), JSON.stringify(tokens.map(t => t.type)));
}

// Well-formed single-line styles are untouched by the boundary rule.
{
  const ast = new DocParser(tokenize('@card{#3366ff,radius-12}[text]')).parse();
  check('well-formed {styles} still parses both tokens', JSON.stringify(ast[0]?.styles) === JSON.stringify(['#3366ff', 'radius-12']), JSON.stringify(ast[0]));
}

console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} total.`);
process.exitCode = fail > 0 ? 1 : 0;
