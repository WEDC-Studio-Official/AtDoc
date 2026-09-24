// The publishable build: public themes only.
//
//   1. builds the CSS of the public themes
//   2. compiles src/ minus every internal theme folder and every file listed in
//      package.json's "atdoc.internalFiles" (generated tsconfig.public.json)
//   3. runs the publish guard
//
// Internal themes are discovered, not listed — a new src/<name>/ theme is kept
// out of the published build automatically until it is added to
// "atdoc.publicThemes".

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { discoverThemes, readAtdocConfig, root } from './themes.mjs';

const t = discoverThemes();
const { internalFiles } = readAtdocConfig();

const exclude = [...t.internalThemes.map((n) => `src/${n}`), ...internalFiles];
writeFileSync(join(root, 'tsconfig.public.json'), JSON.stringify({ extends: './tsconfig.json', include: ['src'], exclude }, null, 2) + '\n');

const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
run('node scripts/build-css.mjs --public');
run('npx tsc -p tsconfig.public.json');
run('node scripts/check-publish.mjs');
