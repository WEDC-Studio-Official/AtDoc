// Lets `node` run the app's TypeScript directly.
//
// Node 24 strips types on its own, but it still resolves ESM specifiers by the
// spec — extension-less relative imports (`from './registry'`) are a bundler
// convenience that Vite provides and Node does not. Rather than rewrite every
// import in src/ to satisfy a test runner, this hook re-adds the extension the
// same way Vite would.
//
// Usage: node --import ./apps/atdoc/tests/ts-resolve-hook.mjs <test file>

import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const EXTENSIONS = ['.ts', '.tsx'];
const HAS_EXTENSION = /\.[a-zA-Z0-9]+$/;

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('.') && !HAS_EXTENSION.test(specifier)) {
            for (const ext of EXTENSIONS) {
                const candidate = new URL(specifier + ext, context.parentURL);
                if (existsSync(fileURLToPath(candidate))) {
                    return nextResolve(specifier + ext, context);
                }
            }
        }
        return nextResolve(specifier, context);
    },
});
