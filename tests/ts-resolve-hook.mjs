// Lets `node` run the app's TypeScript directly.
//
// Node 24 strips types on its own, but it still resolves ESM specifiers by the
// spec. Two gaps between what src/ writes and what plain Node resolves:
//
//   1. Extension-less relative imports (`from './registry'`) are a bundler
//      convenience Vite provides and Node does not.
//   2. src/'s own relative imports write an explicit `.js` extension (e.g.
//      `from './registry.js'`) even though only `registry.ts` exists on
//      disk — the standard TypeScript NodeNext authoring pattern, where the
//      source names the *compiled* file it'll become, and `tsc` leaves that
//      specifier untouched in dist/ (see tsconfig.json's
//      module/moduleResolution: "NodeNext"). A real Node ESM loader run
//      against dist/ (i.e. the published package) resolves that `.js`
//      straight to the sibling `dist/registry.js` tsc actually emitted —
//      nothing special needed there. It's only *this* hook, resolving
//      directly against src/'s uncompiled `.ts` files, that has to know a
//      relative `.js` specifier really means the `.ts` file of the same name.
//
// Rather than rewrite every import in src/ to satisfy a test runner, this
// hook resolves both gaps the same way Vite/tsc would.
//
// Usage: node --import ./apps/atdoc/tests/ts-resolve-hook.mjs <test file>

import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const EXTENSIONS = ['.ts', '.tsx'];
const HAS_EXTENSION = /\.[a-zA-Z0-9]+$/;

function tsCandidateFor(specifier) {
    // A relative specifier ending in .js/.jsx names the file NodeNext-style —
    // strip that extension before trying the real (.ts/.tsx) source names.
    const base = specifier.replace(/\.jsx?$/, '');
    return base;
}

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (!specifier.startsWith('.')) return nextResolve(specifier, context);

        const base = HAS_EXTENSION.test(specifier) ? tsCandidateFor(specifier) : specifier;
        for (const ext of EXTENSIONS) {
            const candidate = new URL(base + ext, context.parentURL);
            if (existsSync(fileURLToPath(candidate))) {
                return nextResolve(base + ext, context);
            }
        }
        return nextResolve(specifier, context);
    },
});
