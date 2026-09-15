// Ported from AtDoc-Internal's Strict Mode Parser test set (now archived).
// That Parser threw DocSyntaxError on every case below; this package's
// Parser is Editor Mode — it recovers and pushes a non-fatal diagnostic
// instead of throwing, so an interactive editor doesn't lose the whole
// document over one syntax error. `expected.json`'s `shouldThrow` therefore
// now means "produces an error-severity diagnostic" rather than "throws" —
// checked against both, since a genuinely unrecoverable case (Parser.ts's
// "Internal error: ..." path) still throws.
import { readFileSync, readdirSync } from 'fs';
import { tokenize } from '../src/Lexer.ts';
import { DocParser } from '../src/Parser.ts';
import { DocSyntaxError } from '../src/types.ts';

interface Expectation {
  shouldThrow: boolean;
  messageContains?: string;
  note?: string;
}

const casesDir = new URL('./cases/', import.meta.url);
const expected: Record<string, Expectation> = JSON.parse(
  readFileSync(new URL('./expected.json', import.meta.url), 'utf-8')
);

const files = readdirSync(casesDir)
  .filter(f => f.endsWith('.atd'))
  .sort();

let pass = 0;
let fail = 0;

for (const file of files) {
  const source = readFileSync(new URL(file, casesDir), 'utf-8');
  const exp = expected[file];

  if (!exp) {
    console.log(`?    ${file} — no expectation registered in expected.json`);
    continue;
  }

  let flagged = false;
  let message = '';
  try {
    const parser = new DocParser(tokenize(source));
    parser.parse();
    const errorDiagnostic = parser.diagnostics.find(d => d.severity === undefined || d.severity === 'error');
    if (errorDiagnostic) {
      flagged = true;
      message = errorDiagnostic.message;
    }
  } catch (err) {
    if (err instanceof DocSyntaxError) {
      flagged = true;
      message = err.message;
    } else {
      // Anything else is always a real bug — let it crash the run.
      throw err;
    }
  }

  const ok = flagged === exp.shouldThrow && (!exp.messageContains || message.includes(exp.messageContains));

  if (ok) {
    pass++;
    console.log(`PASS ${file}${flagged ? ` — flagged: ${message}` : ' — parsed clean'}`);
  } else {
    fail++;
    console.log(`FAIL ${file}`);
    console.log(`     expected: shouldThrow=${exp.shouldThrow}${exp.messageContains ? `, messageContains="${exp.messageContains}"` : ''}`);
    console.log(`     actual:   flagged=${flagged}${message ? `, message="${message}"` : ''}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed, ${files.length} total.`);
process.exitCode = fail > 0 ? 1 : 0;
