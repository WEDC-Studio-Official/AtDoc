// Theme registry — how a renderer theme plugs into the pipeline.
//
// A theme is a folder under src/ (src/index, src/cat, src/leaf, ...) whose
// adapter module calls registerTheme() once, at module scope, describing how
// to render a node and the collected footnotes. Nothing else in the core
// (pipeline, mermaid hydration, the PreviewStyle type) names a specific theme:
// they ask this registry. So adding a theme is "add a folder + register it" —
// no core file is edited.
//
// Registration is a side effect of importing the theme's adapter module. The
// public entry (index.ts) imports the `index` theme, so it is always present;
// every other theme is only registered where something imports its adapter
// (for internal themes, the generated src/internal.ts does that for all of
// them). A style id that nothing registered falls back to "index".

import type { DocASTNode } from './types.js';

export interface ThemeDefinition {
  /** Stable id — what a caller passes as `style` (e.g. "index", "leaf"). Also the theme's folder name by convention, and the basename of its stylesheet (<id>.css). */
  id: string;
  /** Human-readable name for a theme picker. Defaults to the id. */
  label?: string;
  /** Renders one top-level node to an HTML string. */
  renderNode(node: DocASTNode): string;
  /** Renders the collected footnotes list for a whole document ('' when there are none). */
  renderFootnotes(ast: DocASTNode[]): string;
  /** Mermaid config for diagrams inside this theme. Omit to use mermaid's own default theme. */
  mermaid?: { theme?: string; themeVariables?: Record<string, string> };
}

const DEFAULT_THEME_ID = 'index';
const themes = new Map<string, ThemeDefinition>();

/** Registers (or replaces) a theme. Re-registering the same id is allowed — the last call wins — so hot-reload and repeated imports are harmless. */
export function registerTheme(def: ThemeDefinition): void {
  themes.set(def.id, def);
}

export function getTheme(id: string): ThemeDefinition | undefined {
  return themes.get(id);
}

export function hasTheme(id: string): boolean {
  return themes.has(id);
}

/** Every registered theme, in registration order. */
export function listThemes(): ThemeDefinition[] {
  return [...themes.values()];
}

/**
 * The theme used when none (or an unregistered one) is asked for: always
 * "index", the neutral public theme. Other themes are internal and never
 * claim the default, so a document rendered with no explicit style comes out
 * the same whether or not any internal theme happens to be loaded. (Only if
 * "index" somehow is not registered does it fall back to the first theme.)
 */
export function getDefaultTheme(): ThemeDefinition {
  const chosen = themes.get(DEFAULT_THEME_ID) ?? listThemes()[0];
  if (!chosen) throw new Error('No renderer theme is registered — import a theme adapter (e.g. the package entry registers "index").');
  return chosen;
}

/** Resolves a style id to a theme, falling back to the default. */
export function resolveTheme(id: string | undefined): ThemeDefinition {
  return (id !== undefined ? themes.get(id) : undefined) ?? getDefaultTheme();
}
