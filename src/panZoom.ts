// Generic scroll-wheel-zoom / drag-to-pan for a "canvas" element inside a
// "viewport" element. Written framework- and DOM-context-agnostic
// on purpose: mermaidRenderer.ts uses this on both AtDocPreview.tsx's
// Playground preview (elements living inside a sandboxed iframe's
// contentDocument) and DocPage.tsx's docs viewer (elements living in the
// main document) — every listener below is attached to the elements
// themselves or their own `ownerDocument`, never to the global `window`/
// `document`, so it works identically in either host without needing to
// know which one it's in.
//
// The numeric core (PanZoomState + the pure functions below) has no DOM
// dependency at all and is exercised directly by tests/pan-zoom.test.ts —
// attachPanZoom() is the only DOM-touching part, and is intentionally thin:
// it just wires events to those pure functions and writes the result to
// `canvas.style.transform`.

export interface PanZoomState {
  scale: number;
  tx: number;
  ty: number;
}

export const PAN_ZOOM_MIN_SCALE = 0.2;
export const PAN_ZOOM_MAX_SCALE = 6;

export function clampScale(scale: number): number {
  return Math.min(PAN_ZOOM_MAX_SCALE, Math.max(PAN_ZOOM_MIN_SCALE, scale));
}

/**
 * "Zoom toward cursor": returns the state that keeps `cursor` (in
 * viewport-local pixels) pinned to the same point on the canvas while the
 * scale changes from `state.scale` to `nextScaleRaw` (clamped). Since a
 * screen position is `translate + scale * canvasLocalPos`, canvasLocalPos is
 * solved for at the current scale, then used to re-derive translate at the
 * new one.
 */
export function zoomAt(state: PanZoomState, cursor: { x: number; y: number }, nextScaleRaw: number): PanZoomState {
  const nextScale = clampScale(nextScaleRaw);
  if (nextScale === state.scale) return state;
  const canvasX = (cursor.x - state.tx) / state.scale;
  const canvasY = (cursor.y - state.ty) / state.scale;
  return {
    scale: nextScale,
    tx: cursor.x - nextScale * canvasX,
    ty: cursor.y - nextScale * canvasY,
  };
}

/** Wheel `deltaY` → a multiplicative zoom factor. Exponential rather than linear so repeated small notches (trackpad) and occasional large ones (mouse wheel) both feel proportionate, and the factor is always positive regardless of `deltaY`'s sign. */
export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * 0.001);
}

export function panBy(state: PanZoomState, dx: number, dy: number): PanZoomState {
  return { ...state, tx: state.tx + dx, ty: state.ty + dy };
}

/**
 * The initial placement for a freshly-hydrated diagram: centers a
 * `contentWidth`x`contentHeight` box inside a `viewportWidth`x`viewportHeight`
 * one, shrinking to fit when the content is larger (never enlarging past 1:1
 * — a tiny diagram shouldn't open pre-zoomed-in). Falls back to the identity
 * state for a degenerate (zero/negative) size on either side, which only
 * happens if the viewport hasn't been laid out yet.
 */
export function fitState(contentWidth: number, contentHeight: number, viewportWidth: number, viewportHeight: number): PanZoomState {
  if (contentWidth <= 0 || contentHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return { scale: 1, tx: 0, ty: 0 };
  }
  const scale = clampScale(Math.min(1, viewportWidth / contentWidth, viewportHeight / contentHeight));
  return {
    scale,
    tx: (viewportWidth - contentWidth * scale) / 2,
    ty: (viewportHeight - contentHeight * scale) / 2,
  };
}

export function toCssTransform(state: PanZoomState): string {
  return `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
}

export interface PanZoomHandle {
  /** Restores the placement `attachPanZoom` was called with. */
  reset(): void;
  /** Detaches every listener this call added — call once the wrapped elements are discarded (e.g. the next hydration pass replaces them). */
  destroy(): void;
}

/**
 * Wires drag-to-pan and wheel-to-zoom onto `viewport`, applying the result to
 * `canvas`'s CSS transform. `canvas` must be `viewport`'s child that actually
 * holds the content (mermaidRenderer.ts's `.mermaid-canvas` wrapping the
 * rendered `<svg>`) — `viewport` itself stays untransformed so its
 * `overflow: hidden` keeps clipping at a fixed box regardless of zoom.
 *
 * Panning is left-click-drag, gated by a small movement threshold rather
 * than tied to a separate mouse button (an earlier version used right-click-
 * drag): a touchpad's two-finger tap synthesizes a right click as one
 * discrete event (mousedown immediately followed by mouseup), not a button
 * state you can hold down and drag — so right-click-drag panning was simply
 * unreachable on trackpad-only laptops. The threshold is what keeps a plain
 * click on diagram content (e.g. a clickable mermaid node, wired up via
 * `bindFunctions`) working: a mousedown that never moves past
 * DRAG_THRESHOLD_PX before mouseup never sets `dragging`, so the click event
 * mouseup naturally produces reaches its target untouched. One that does
 * cross the threshold is a pan instead, and the click mouseup would
 * otherwise still fire is swallowed (`suppressNextClick`) so ending a drag
 * doesn't also register as a spurious click on whatever the cursor happens
 * to be over at that point.
 *
 * Once a drag is confirmed, it also requests Pointer Lock on `viewport`: the
 * real OS cursor disappears and stops moving on screen for the rest of the
 * drag — the only web-platform mechanism that keeps the actual cursor (not
 * a stand-in) from visibly leaving the diagram — with position reports
 * coming from `movementX`/`movementY` deltas instead of `clientX`/`clientY`
 * (which the spec freezes at their pre-lock value while locked). Divided by
 * `devicePixelRatio` before use: Chromium on Windows has a long-standing bug
 * where locked movementX/movementY report in physical/device pixels instead
 * of CSS pixels, so at 125%/150% scaling (the Windows default on most
 * laptops) a drag would otherwise pan by far more than the actual cursor
 * movement — this divides back down to CSS-pixel scale to compensate. That
 * bug's presence is inconsistent across Chromium versions/platforms, so
 * treat this as a best-effort correction, not a verified fix — if panning
 * ever feels off by a consistent multiplier again in one direction or the
 * other, that scaling is the first thing to suspect.
 *
 * The request is best-effort in another sense too: it needs the containing
 * document to allow it (an iframe needs `sandbox="allow-pointer-lock"`; see
 * AtDocPreview.tsx) and can be refused for reasons outside this module's
 * control. `cursor: none` on every `dragDocs` root element is the fallback
 * for that case — it can't stop the real cursor from moving, but at least
 * keeps it invisible once it strays outside `viewport`'s own more specific
 * `cursor: grab`/`grabbing` (kami.css/index.css), which still wins while the
 * pointer is actually over it.
 */
export function attachPanZoom(viewport: HTMLElement, canvas: HTMLElement, initial: PanZoomState): PanZoomHandle {
  const ownerDoc = viewport.ownerDocument;
  // A drag that carries the cursor past `viewport`'s edge can go one step
  // further and leave `ownerDoc` entirely — e.g. mermaidRenderer.ts calls
  // this on elements living inside AtDocPreview.tsx's sandboxed preview
  // iframe, and once the cursor crosses out of that iframe's rendered
  // rectangle into the rest of the Playground page, the browser routes
  // mousemove/mouseup/click to *that* document, which `ownerDoc` alone
  // would never see (per-frame event routing, not something a same-origin
  // listener can widen). The bare `document` global here always resolves to
  // the top-level page regardless: this whole module runs as parent-context
  // JS either way (the iframe has no allow-scripts — see AtDocPreview.tsx —
  // so nothing of this file's code is ever actually executing *inside* it,
  // only manipulating its DOM from outside), so listening on both covers
  // every case — for DocPage.tsx's non-iframe usage `ownerDoc` already *is*
  // `document`, and re-registering the same function on the same target is
  // a harmless no-op, not a double-fire.
  const dragDocs = ownerDoc === document ? [ownerDoc] : [ownerDoc, document];
  let state = initial;

  const apply = () => {
    canvas.style.transform = toCssTransform(state);
  };
  apply();

  // Chromium logs a benign "Blocked script execution in 'about:srcdoc'..."
  // console warning the moment a non-passive wheel listener anywhere in a
  // sandboxed same-origin (no allow-scripts) iframe calls preventDefault()
  // on it — confirmed by bisection: an otherwise-empty handler that does
  // nothing but preventDefault() still logs it, with no functional effect
  // (this handler's own logic still runs normally right after, and the
  // resulting transform is correct — verified against exact pixel deltas).
  // It's Chromium probing for an internal per-frame wheel-physics script
  // that the sandbox correctly refuses to run; AtDocPreview.tsx's iframe
  // has never had allow-scripts (see that file's own sandbox rationale) so
  // this isn't new exposure, just newly-visible console noise from being
  // the first feature here to preventDefault() a wheel event.
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    state = zoomAt(state, cursor, state.scale * wheelZoomFactor(e.deltaY));
    apply();
  };

  // Pixels of movement before a mousedown resolves into a drag rather than a
  // click — small enough to feel immediate, large enough to absorb the few
  // px of jitter a touchpad or a not-quite-steady mouse hand produces on
  // what's meant to be a stationary click.
  const DRAG_THRESHOLD_PX = 4;

  let armed = false;    // mousedown seen; not yet resolved into drag-or-click
  let dragging = false; // resolved as a drag — threshold crossed
  let downX = 0;
  let downY = 0;
  let lastX = 0;
  let lastY = 0;
  let suppressNextClick = false;

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    // Stops the browser's own drag-to-select-text (and, on an <img>/<a>
    // inside the diagram, its native drag-image ghost) from starting before
    // the movement threshold below has even had a chance to decide this is
    // a pan and not a click — without it, a pan that happens to start on
    // one of the SVG's <text> nodes drags out a text selection alongside
    // the diagram itself. kami.css/index.css's `user-select: none` on the
    // viewport is the same fix's CSS half, for input paths (touch) that
    // don't fully respect this preventDefault().
    e.preventDefault();
    armed = true;
    dragging = false;
    downX = lastX = e.clientX;
    downY = lastY = e.clientY;
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!armed) return;
    if (!dragging) {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) < DRAG_THRESHOLD_PX) return;
      dragging = true;
      viewport.setAttribute("data-dragging", "true");
      for (const doc of dragDocs) doc.documentElement.style.cursor = "none";
      // Best-effort — see this function's own doc comment. Ignoring a
      // rejection here (rather than awaiting it) is deliberate: the drag is
      // already under way and must keep tracking the still-visible cursor
      // via clientX/clientY on every mousemove in the meantime, lock or no
      // lock — `pointerlockchange` below is what actually switches the delta
      // source over once (if) the lock is granted.
      viewport.requestPointerLock?.()?.catch(() => {});
    }
    // While locked, clientX/clientY are frozen at their pre-lock value (spec
    // behavior) — movementX/movementY carry the real per-event delta
    // instead, corrected for the devicePixelRatio bug described above.
    // Unlocked (lock never granted, or not yet granted this event), fall
    // back to diffing clientX/clientY against the last event as before.
    const locked = ownerDoc.pointerLockElement === viewport;
    const dx = locked ? e.movementX / window.devicePixelRatio : e.clientX - lastX;
    const dy = locked ? e.movementY / window.devicePixelRatio : e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    state = panBy(state, dx, dy);
    apply();
  };
  const endDrag = () => {
    if (!armed) return;
    if (dragging) suppressNextClick = true;
    armed = false;
    dragging = false;
    viewport.removeAttribute("data-dragging");
    for (const doc of dragDocs) doc.documentElement.style.cursor = "";
    if (ownerDoc.pointerLockElement === viewport) ownerDoc.exitPointerLock();
  };
  // Esc (or anything else that drops the lock outside of endDrag's own
  // exitPointerLock() call) leaves `dragging` with no further movementX/Y
  // deltas to consume — end the drag cleanly rather than leaving it stuck
  // open with a cursor that's stopped reporting.
  const onPointerLockChange = () => {
    if (dragging && ownerDoc.pointerLockElement !== viewport) endDrag();
  };
  // Eats the click a real drag would otherwise still fire on mouseup —
  // capture-phase and scoped to `dragDocs` (not just `viewport`) for the
  // same reason mousemove/mouseup are: a drag can end past `viewport`'s
  // edge, and the resulting click lands on whatever element the browser
  // finds under the cursor there, not necessarily a descendant of
  // `viewport`. Consumed once per drag, so it never eats a real click
  // elsewhere that didn't go through this drag.
  const onClickCapture = (e: MouseEvent) => {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    e.preventDefault();
    e.stopPropagation();
  };
  const onDoubleClick = () => {
    state = initial;
    apply();
  };

  viewport.addEventListener("wheel", onWheel, { passive: false });
  viewport.addEventListener("mousedown", onMouseDown);
  viewport.addEventListener("dblclick", onDoubleClick);
  // mousemove/mouseup/click are bound to every document in `dragDocs` (see
  // its own comment above), not just `viewport`: a drag can outrun the
  // cursor past the viewport's edge — and past its owner document's own
  // bounds — and if the button comes up out there, a listener scoped to
  // `viewport`/`ownerDoc` alone would never see the mouseup (leaving
  // `dragging` stuck true) or the click that follows it (leaving it
  // unsuppressed).
  for (const doc of dragDocs) {
    doc.addEventListener("mousemove", onMouseMove);
    doc.addEventListener("mouseup", endDrag);
    doc.addEventListener("click", onClickCapture, true);
  }
  // pointerlockchange only ever fires on `ownerDoc` (the document `viewport`
  // itself belongs to) — that's the document Pointer Lock state lives on,
  // regardless of which document(s) mousemove/mouseup are also bound to.
  ownerDoc.addEventListener("pointerlockchange", onPointerLockChange);

  return {
    reset: () => {
      state = initial;
      apply();
    },
    destroy: () => {
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("mousedown", onMouseDown);
      viewport.removeEventListener("dblclick", onDoubleClick);
      for (const doc of dragDocs) {
        doc.removeEventListener("mousemove", onMouseMove);
        doc.removeEventListener("mouseup", endDrag);
        doc.removeEventListener("click", onClickCapture, true);
      }
      ownerDoc.removeEventListener("pointerlockchange", onPointerLockChange);
      // Defensive: mermaidRenderer.ts can destroy() a mid-drag widget (the
      // user keeps typing in the Playground while dragging — unlikely, but
      // possible), which would otherwise leave the cursor permanently
      // hidden with no mouseup left to reach endDrag()'s own cleanup.
      if (dragging) for (const doc of dragDocs) doc.documentElement.style.cursor = "";
      if (ownerDoc.pointerLockElement === viewport) ownerDoc.exitPointerLock();
    },
  };
}
