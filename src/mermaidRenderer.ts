// Turns each already-rendered `<pre class="mermaid">` placeholder — both
// Adapters.ts's and KamiAdapter.ts's 'mermaid' case emit that shape, see
// those files — into a live diagram: dynamically imports the `mermaid`
// package (kept out of the main JS bundle via `import()`, and out of the
// Node test suite entirely, which has no DOM for it to run against — see
// package.json's `test` script; nothing in it touches this file) and asks
// it to render the block's raw source to an SVG string, then swaps the
// `<pre>` for a pan/zoom-able wrapper around that SVG (panZoom.ts).
//
// Browser-only by construction. Every caller (AtDocPreview.tsx's Playground
// preview, DocPage.tsx's docs viewer) invokes it from a `useEffect` after
// content is already in the live DOM — never during apps/atdoc's SSR
// prerender pass (`scripts/prerender.mjs` has no `document`/browser Mermaid
// to render into), matching the client/server split renderAtDoc.ts's own
// doc-comment already describes for its post-render string fixups.

import type { PreviewStyle } from "./types.js";
import { resolveTheme } from "./themeRegistry.js";
import { attachPanZoom, fitState, type PanZoomHandle } from "./panZoom.js";

// mermaid's own type declarations assume a bundler resolves the package
// synchronously; the dynamic import()'s awaited result has the same shape.
type MermaidModule = typeof import("mermaid");
type MermaidTheme = NonNullable<Parameters<MermaidModule["default"]["initialize"]>[0]>["theme"];

let mermaidModulePromise: Promise<MermaidModule> | null = null;
function loadMermaid(): Promise<MermaidModule> {
  mermaidModulePromise ??= import("mermaid");
  return mermaidModulePromise;
}

// mermaid.initialize() is process-wide (there's no per-render theme param),
// so re-running it on every hydration pass would be wasted work at best and
// a mid-render theme swap at worst if two hydration passes for different
// Routes ever raced. Guarded by which style it was last set up for, not a
// plain boolean — switching the Playground's preview style toggle from
// index to kami (or back) does need a re-init, just not a same-style repeat.
let initializedFor: string | null = null;
async function ensureInitialized(style: PreviewStyle): Promise<MermaidModule> {
  const mod = await loadMermaid();
  // @Doc has no per-diagram theme picker — a diagram inherits whichever theme
  // rendered the document around it, via that theme's own `mermaid` config
  // (registered in themeRegistry.ts). A theme with none gets mermaid's default.
  const theme = resolveTheme(style);
  if (initializedFor === theme.id) return mod;
  mod.default.initialize({
    startOnLoad: false,
    theme: (theme.mermaid?.theme ?? (theme.mermaid?.themeVariables ? "base" : "default")) as MermaidTheme,
    themeVariables: theme.mermaid?.themeVariables,
  });
  initializedFor = theme.id;
  return mod;
}

let renderCounter = 0;
function nextMermaidId(): string {
  renderCounter += 1;
  return `mermaid-diagram-${renderCounter}`;
}

/** Reads the SVG's own declared size (mermaid always writes explicit `width`/`height` attributes on its root `<svg>`) rather than measuring the live element — the canvas hasn't been placed/scaled yet at the point this is called, so a layout measurement here would just read back whatever CSS already constrains it to, not the diagram's actual size. Falls back to `viewBox` for a theoretical `<svg>` that only sets that. */
function svgNaturalSize(svg: SVGSVGElement): { width: number; height: number } {
  const attrWidth = parseFloat(svg.getAttribute("width") ?? "");
  const attrHeight = parseFloat(svg.getAttribute("height") ?? "");
  if (Number.isFinite(attrWidth) && Number.isFinite(attrHeight) && attrWidth > 0 && attrHeight > 0) {
    return { width: attrWidth, height: attrHeight };
  }
  const viewBox = svg.viewBox?.baseVal;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }
  return { width: 0, height: 0 };
}

const panZoomHandles = new WeakMap<Element, PanZoomHandle>();

const MERMAID_ICON_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="8.5" y="14" width="7" height="7" rx="1"></rect><path d="M6.5 10v2a2 2 0 0 0 2 2h1"></path><path d="M17.5 10v2a2 2 0 0 0-2 2h-1"></path></svg>';
const COPY_ICON_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

/**
 * Wraps an already-hydrated `viewport` (untouched — still the exact same
 * pan/zoom target `attachPanZoom` below is given, same box it always was) in
 * one more outer div carrying the same header markup/classes
 * Adapters.ts/KamiAdapter.ts/KimiAdapter.ts's `'code'` case uses for
 * @code's language/copy header — see structural-blocks.css's
 * `[data-kami="code-header"]` / index.css's `.code-header` for the shared
 * styling both this and those key off. Only called after a diagram actually
 * renders (never for the pre-hydration `<pre>` placeholder or a render
 * error) per the user's request that the header only appear once the
 * diagram is real. `kamiAttr` mirrors the same "copy `data-kami` from the
 * placeholder, if present" convention `viewport` itself already follows —
 * `null` under the Index route, which has no `data-kami` vocabulary at all
 * and relies on the plain classes alone (see index.css).
 */
function wrapWithHeader(doc: Document, viewport: HTMLElement, source: string, kamiAttr: string | null): HTMLElement {
  const block = doc.createElement("div");
  block.className = "mermaid-block";
  if (kamiAttr) block.setAttribute("data-kami", "mermaid-block");

  const header = doc.createElement("div");
  header.className = "code-header";
  if (kamiAttr) header.setAttribute("data-kami", "code-header");

  const label = doc.createElement("span");
  label.className = "code-lang";
  if (kamiAttr) label.setAttribute("data-kami", "code-lang");
  label.innerHTML = MERMAID_ICON_SVG;
  label.append("mermaid");

  const copyButton = doc.createElement("button");
  copyButton.type = "button";
  copyButton.className = "copy-button";
  if (kamiAttr) copyButton.setAttribute("data-kami", "copy-button");
  copyButton.setAttribute("data-kami-copy", source);
  copyButton.innerHTML = COPY_ICON_SVG;

  header.append(label, copyButton);
  block.append(header, viewport);
  return block;
}

/**
 * Finds every `pre.mermaid` under `root`, renders its raw diagram source
 * through Mermaid, and replaces it with a pan/zoom-able `<svg>` wrapper.
 * Safe to call repeatedly on the same `root` — AtDocPreview.tsx replaces
 * `root`'s entire `innerHTML` on every content change, so each call only
 * ever sees fresh, not-yet-hydrated placeholders; there is no "already
 * hydrated" state to track across calls.
 *
 * Each block is rendered independently and errors are caught per-block
 * (most commonly: the Playground user is mid-typing an unfinished diagram)
 * so one bad diagram doesn't take the rest of the document down with it —
 * it's left as the original `<pre>` placeholder instead of a diagram.
 */
export async function hydrateMermaidDiagrams(root: ParentNode, style: PreviewStyle): Promise<void> {
  const blocks = Array.from(root.querySelectorAll<HTMLPreElement>("pre.mermaid"));
  if (blocks.length === 0) return;

  const { default: mermaid } = await ensureInitialized(style);

  for (const pre of blocks) {
    const source = pre.textContent ?? "";
    const doc = pre.ownerDocument;

    let rendered: { svg: string; bindFunctions?: (el: Element) => void };
    try {
      rendered = await mermaid.render(nextMermaidId(), source);
    } catch (err) {
      // Leave the placeholder in place — a visible raw-text fallback beats
      // silently dropping the block, and this is the expected state while
      // a diagram is still being typed.
      pre.setAttribute("title", err instanceof Error ? err.message : String(err));
      continue;
    }

    const viewport = doc.createElement("div");
    viewport.className = "mermaid-viewport";
    const kamiAttr = pre.getAttribute("data-kami");
    if (kamiAttr) viewport.setAttribute("data-kami", kamiAttr);

    const canvas = doc.createElement("div");
    canvas.className = "mermaid-canvas";
    canvas.innerHTML = rendered.svg;
    rendered.bindFunctions?.(canvas);
    viewport.appendChild(canvas);

    const block = wrapWithHeader(doc, viewport, source, kamiAttr);
    pre.replaceWith(block);

    const svgEl = canvas.querySelector("svg");
    const { width, height } = svgEl ? svgNaturalSize(svgEl) : { width: 0, height: 0 };
    const viewportRect = viewport.getBoundingClientRect();
    const initial = fitState(width, height, viewportRect.width, viewportRect.height);

    panZoomHandles.get(viewport)?.destroy();
    panZoomHandles.set(viewport, attachPanZoom(viewport, canvas, initial));
  }
}
