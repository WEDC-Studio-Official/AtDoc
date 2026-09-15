// Standalone verification for src/editor/monarch.ts's push/pop rule table.
//
// This does NOT run against the real monaco-editor engine (AtDoc has no
// dependency on that package, deliberately — see monarch.ts's module
// comment). Instead it's a small, faithful re-implementation of Monarch's
// documented per-line execution model (rules tried in order at the current
// scan position; a match's `next` can push a named state, push the current
// state again via '@push', or pop via '@pop'), run against *our own* rule
// table. It exists to catch regressions in the state machine's push/pop
// balance and keyword coverage — not to certify pixel-perfect Monaco fidelity,
// which should still be spot-checked in a real editor before shipping.

import { atDocMonarchLanguage, type MonarchRule } from '../src/editor/monarch.ts';

interface Tok {
  token: string;
  text: string;
  state: string;
}

function tokenizeAll(source: string): { tokens: Tok[]; finalStack: string[] } {
  const { tokenizer } = atDocMonarchLanguage;
  let stack = ['root'];
  const tokens: Tok[] = [];

  for (const line of source.split('\n')) {
    let pos = 0;
    while (pos < line.length) {
      const state = stack[stack.length - 1];
      const rules: MonarchRule[] = tokenizer[state];
      if (!rules) throw new Error(`Unknown state "${state}"`);

      let matched = false;
      for (const [regex, action] of rules) {
        const anchored = new RegExp(regex.source, regex.flags.includes('y') ? regex.flags : regex.flags + 'y');
        anchored.lastIndex = pos;
        const m = anchored.exec(line);
        if (!m || m[0] === '') continue;

        const text = m[0];
        const tokenName = typeof action === 'string' ? action : action.token;
        tokens.push({ token: tokenName, text, state });
        pos += text.length;

        const next = typeof action === 'string' ? undefined : action.next;
        if (next === '@pop') {
          if (stack.length > 1) stack.pop();
        } else if (next === '@push') {
          stack.push(state);
        } else if (next?.startsWith('@')) {
          stack.push(next.slice(1));
        }
        matched = true;
        break;
      }

      if (!matched) {
        throw new Error(`No rule matched at state "${state}" position ${pos} in line: ${JSON.stringify(line)}`);
      }
    }
  }

  return { tokens, finalStack: stack };
}

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

// 1. Nested @table[@cols[...]@data[...]] — every level must get its own
//    keyword token, and the stack must fully unwind (item 1 & 2 regression).
{
  const src = '@table[\n    @cols[id,name,price]\n    @data[\n        [1,早餐,60]\n    ]\n]';
  const { tokens, finalStack } = tokenizeAll(src);
  const keywords = tokens.filter(t => t.token === 'keyword.control.doc').map(t => t.text);
  check('table/cols/data all tokenized as keywords', keywords.includes('@table') && keywords.includes('@cols') && keywords.includes('@data'), keywords.join(','));
  check('stack fully unwinds after @table[...]', finalStack.length === 1 && finalStack[0] === 'root', finalStack.join('>'));
}

// 2. Restricted-context nodes (@cols/@data/@tab) are real keywords, not
//    silently missing from the keyword set (item 3 regression).
{
  const src = '@tabs[\n  @tab(JS)[hi]\n]';
  const { tokens } = tokenizeAll(src);
  const keywords = tokens.filter(t => t.token === 'keyword.control.doc').map(t => t.text);
  check('@tabs and @tab both tokenized as keywords', keywords.includes('@tabs') && keywords.includes('@tab'), keywords.join(','));
}

// 3. @code's raw content must NOT recognize @-node syntax inside it — a
//    literal "@mark[x]" in a code sample must stay unparsed.
{
  const src = '@code(ts)[\nconst s = "@mark[not parsed]";\n]';
  const { tokens, finalStack } = tokenizeAll(src);
  const insideCodeKeywords = tokens.filter(t => t.state === 'rawPlain' && t.token === 'keyword.control.doc');
  check('@code content has zero keyword tokens (stays opaque)', insideCodeKeywords.length === 0, JSON.stringify(insideCodeKeywords));
  check('stack fully unwinds after @code[...]', finalStack.length === 1 && finalStack[0] === 'root', finalStack.join('>'));
}

// 4. @raw's local escape exceptions tokenize as escapes, and the domain
//    still closes on its real matching "]".
{
  const src = '@raw[today I fear@] being detected]';
  const { tokens, finalStack } = tokenizeAll(src);
  const escapes = tokens.filter(t => t.token === 'constant.character.escape.doc' && t.state === 'rawEscaped');
  check('@raw local "@]" escape recognized', escapes.some(t => t.text === '@]'), JSON.stringify(escapes));
  check('stack fully unwinds after @raw[...]', finalStack.length === 1 && finalStack[0] === 'root', finalStack.join('>'));
}

// 5. Multi-line "(paren)" (e.g. @img's URL-on-its-own-line style from test.atd)
//    doesn't break bracket balance.
{
  const src = '@img(\nhttps://example.com/logo.png,width=200\n)[\nWEDC Logo\n]';
  const { tokens, finalStack } = tokenizeAll(src);
  const parenText = tokens.filter(t => t.token === 'variable.parameter.modifier.doc').map(t => t.text).join('');
  check('multi-line paren content captured', parenText.includes('https://example.com/logo.png') && parenText.includes('width=200'), parenText);
  check('stack fully unwinds after multi-line @img(...)[...]', finalStack.length === 1 && finalStack[0] === 'root', finalStack.join('>'));
}

// 6. Unknown commands fall back to plain text, never a keyword token
//    (Inline Syntax Specification §6).
{
  const src = 'test@example.com and @unknown here';
  const { tokens } = tokenizeAll(src);
  const keywordHits = tokens.filter(t => t.token === 'keyword.control.doc');
  check('unknown/non-command "@word" never tokenized as keyword', keywordHits.length === 0, JSON.stringify(keywordHits));
}

// 7. The full test.atd fixture tokenizes without throwing and ends balanced.
{
  const { readFileSync } = await import('fs');
  const src = readFileSync(new URL('../test.atd', import.meta.url), 'utf-8');
  const { finalStack } = tokenizeAll(src);
  check('full test.atd fixture tokenizes and unwinds cleanly', finalStack.length === 1 && finalStack[0] === 'root', finalStack.join('>'));
}

console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} total.`);
process.exitCode = fail > 0 ? 1 : 0;
