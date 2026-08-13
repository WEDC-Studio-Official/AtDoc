// configs/atdoc-setting.json is a declarative mirror of registry.ts for
// external tooling (editor plugins, syntax definitions) — nothing in this repo
// reads it at runtime, which is exactly why it drifts silently. registry.ts's
// header has promised "keep the two in sync by hand" since the beginning; this
// file turns that promise into a failing test.
//
// The keyword lists were in fact still correct when this was written. The parts
// that had gone stale were the newer structural facts — which nodes scan
// opaquely, which of those honour @raw's local escapes, and the strong-quote
// delimiters — none of which the config described at all.

import { readFileSync } from 'fs';
import { getAllNodeDefs, getAllAliasDefs } from '../src/registry.ts';

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

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

interface Config {
  specialRules: {
    voidNodes: string[];
    contextNodes: string[];
    rawNodes: string[];
    escapeSymbols: string[];
    rawEscapeNodes: string[];
    rawEscapeSymbols: string[];
    strongQuote: { open: string; close: string };
  };
  tokenGroups: Record<string, Record<string, string[]>>;
}

const cfg: Config = JSON.parse(readFileSync(new URL('../configs/atdoc-setting.json', import.meta.url), 'utf-8'));
const defs = getAllNodeDefs();
const rules = cfg.specialRules;

// --- Keyword coverage: every registered name and alias is declared, and the
//     config declares nothing that isn't real. ---
const declared: string[] = [];
for (const group of Object.values(cfg.tokenGroups)) {
  for (const names of Object.values(group)) declared.push(...names);
}
const known = [...defs.map(d => d.name), ...getAllAliasDefs().map(a => a.alias)];

const undeclared = known.filter(n => !declared.includes(n));
check('every registry node/alias appears in tokenGroups', undeclared.length === 0, undeclared.join(', '));

const phantom = declared.filter(n => !known.includes(n));
check('tokenGroups declares no keyword the registry lacks', phantom.length === 0, phantom.join(', '));

const dupes = declared.filter((n, i) => declared.indexOf(n) !== i);
check('no keyword is declared in two groups', dupes.length === 0, dupes.join(', '));

// --- specialRules derived directly from ContentMode / restrictedTo. ---
const RAW_MODES = ['raw', 'raw-escaped', 'key', 'integer'];

const regVoid = defs.filter(d => d.content === 'none').map(d => d.name);
check('voidNodes matches content: none', sameSet(rules.voidNodes, regVoid), `config=${rules.voidNodes} registry=${regVoid}`);

const regContext = defs.filter(d => d.restrictedTo).map(d => d.name);
check('contextNodes matches restrictedTo', sameSet(rules.contextNodes, regContext), `config=${rules.contextNodes} registry=${regContext}`);

const regRaw = defs.filter(d => RAW_MODES.includes(d.content)).map(d => d.name);
check('rawNodes matches the raw-family ContentModes', sameSet(rules.rawNodes, regRaw), `config=${rules.rawNodes} registry=${regRaw}`);

const regRawEscaped = defs.filter(d => d.content === 'raw-escaped').map(d => d.name);
check('rawEscapeNodes matches content: raw-escaped', sameSet(rules.rawEscapeNodes, regRawEscaped), `config=${rules.rawEscapeNodes} registry=${regRawEscaped}`);

// rawEscapeNodes must be a subset of rawNodes — an escaping node that isn't
// scanned opaquely would be a contradiction.
check(
  'rawEscapeNodes is a subset of rawNodes',
  rules.rawEscapeNodes.every(n => rules.rawNodes.includes(n)),
  `${rules.rawEscapeNodes} vs ${rules.rawNodes}`,
);

// --- Escape and delimiter literals, checked against the Lexer's behaviour
//     rather than restated as constants. ---
check('escapeSymbols is the global "@@"', sameSet(rules.escapeSymbols, ['@@']), JSON.stringify(rules.escapeSymbols));

check(
  'rawEscapeSymbols are @raw\'s four local exceptions, longest first',
  JSON.stringify(rules.rawEscapeSymbols) === JSON.stringify(['@@]', '@@[', '@]', '@[']),
  JSON.stringify(rules.rawEscapeSymbols),
);

check('strongQuote delimiters are "{[" and "]}"', rules.strongQuote.open === '{[' && rules.strongQuote.close === ']}',
  JSON.stringify(rules.strongQuote));

console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} total.`);
process.exitCode = fail > 0 ? 1 : 0;
