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

  let threw = false;
  let message = '';
  try {
    new DocParser(tokenize(source)).parse();
  } catch (err) {
    if (err instanceof DocSyntaxError) {
      threw = true;
      message = err.message;
    } else {
      // A non-DocSyntaxError is always a real bug — let it crash the run.
      throw err;
    }
  }

  const ok = threw === exp.shouldThrow && (!exp.messageContains || message.includes(exp.messageContains));

  if (ok) {
    pass++;
    console.log(`PASS ${file}${threw ? ` — threw: ${message}` : ' — parsed OK'}`);
  } else {
    fail++;
    console.log(`FAIL ${file}`);
    console.log(`     expected: shouldThrow=${exp.shouldThrow}${exp.messageContains ? `, messageContains="${exp.messageContains}"` : ''}`);
    console.log(`     actual:   threw=${threw}${message ? `, message="${message}"` : ''}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed, ${files.length} total.`);
process.exitCode = fail > 0 ? 1 : 0;
