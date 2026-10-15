// Unit coverage for panZoom.ts's numeric core (clampScale/zoomAt/panBy/
// fitState) — the pure functions attachPanZoom() wires DOM events to.
// Deliberately does not touch attachPanZoom() itself: that function's only
// job is forwarding event coordinates into these functions and writing the
// result to `canvas.style.transform`, and this repo's Node test runner has
// no DOM to attach real wheel/mouse events to anyway (see this package's
// `test` script — nothing in it needs jsdom). Kept as a standalone script
// per this repo's existing test convention (card-render.test.ts et al.).

import {
  PAN_ZOOM_MIN_SCALE,
  PAN_ZOOM_MAX_SCALE,
  clampScale,
  zoomAt,
  wheelZoomFactor,
  panBy,
  fitState,
  toCssTransform,
  type PanZoomState,
} from '../src/panZoom.ts';

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

function approx(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) < eps;
}

// --- clampScale ---
check('clampScale: within range is unchanged', clampScale(2) === 2);
check('clampScale: below min clamps to PAN_ZOOM_MIN_SCALE', clampScale(0.001) === PAN_ZOOM_MIN_SCALE);
check('clampScale: above max clamps to PAN_ZOOM_MAX_SCALE', clampScale(1000) === PAN_ZOOM_MAX_SCALE);

// --- wheelZoomFactor ---
check('wheelZoomFactor: negative deltaY (zoom in) gives a factor > 1', wheelZoomFactor(-100) > 1);
check('wheelZoomFactor: positive deltaY (zoom out) gives a factor < 1', wheelZoomFactor(100) < 1);
check('wheelZoomFactor: zero deltaY is a no-op factor of 1', wheelZoomFactor(0) === 1);

// --- panBy ---
{
  const state: PanZoomState = { scale: 2, tx: 10, ty: -5 };
  const next = panBy(state, 3, 4);
  check('panBy: scale is untouched', next.scale === 2, JSON.stringify(next));
  check('panBy: tx/ty shift by the given delta', next.tx === 13 && next.ty === -1, JSON.stringify(next));
}

// --- zoomAt ---
{
  // Identity: zooming "at" the point that's already at the origin of the
  // transform (i.e. cursor sits exactly at (tx, ty)) never needs to move
  // translate — that point's canvas-local coordinate is (0,0), which maps
  // back to itself at any scale.
  const state: PanZoomState = { scale: 1, tx: 20, ty: 20 };
  const next = zoomAt(state, { x: 20, y: 20 }, 2);
  check('zoomAt: zooming at the transform origin leaves translate unchanged', approx(next.tx, 20) && approx(next.ty, 20), JSON.stringify(next));
  check('zoomAt: scale is updated', next.scale === 2);
}
{
  // The point under the cursor must resolve to the same canvas-local
  // coordinate before and after — i.e. (cursor - translate) / scale is
  // invariant across the call.
  const state: PanZoomState = { scale: 1, tx: 0, ty: 0 };
  const cursor = { x: 100, y: 50 };
  const before = { x: (cursor.x - state.tx) / state.scale, y: (cursor.y - state.ty) / state.scale };
  const next = zoomAt(state, cursor, 3);
  const after = { x: (cursor.x - next.tx) / next.scale, y: (cursor.y - next.ty) / next.scale };
  check('zoomAt: the point under the cursor stays fixed', approx(before.x, after.x) && approx(before.y, after.y), `${JSON.stringify(before)} vs ${JSON.stringify(after)}`);
}
{
  // Requesting a scale outside the clamped range clamps it, same as
  // clampScale() alone — zoomAt() must apply the same bound, not just
  // whatever raw factor a wheel event happened to compute.
  const state: PanZoomState = { scale: 1, tx: 0, ty: 0 };
  const next = zoomAt(state, { x: 0, y: 0 }, 999);
  check('zoomAt: clamps an out-of-range target scale', next.scale === PAN_ZOOM_MAX_SCALE, JSON.stringify(next));
}
{
  // Requesting the same (already-clamped) scale again is a no-op — this is
  // what keeps repeated wheel events at the scale ceiling/floor from
  // continuing to recompute (and potentially drift) translate for no
  // visible change.
  const state: PanZoomState = { scale: PAN_ZOOM_MAX_SCALE, tx: 5, ty: 7 };
  const next = zoomAt(state, { x: 0, y: 0 }, 999);
  check('zoomAt: requesting the same clamped scale again returns the same state', next === state);
}

// --- fitState ---
{
  // Content smaller than the viewport on both axes: scale never exceeds 1x
  // (a tiny diagram shouldn't open pre-zoomed-in), and is centered.
  const state = fitState(100, 50, 400, 300);
  check('fitState: never scales up past 1x for content smaller than the viewport', state.scale === 1, JSON.stringify(state));
  check('fitState: centers horizontally', approx(state.tx, (400 - 100) / 2), JSON.stringify(state));
  check('fitState: centers vertically', approx(state.ty, (300 - 50) / 2), JSON.stringify(state));
}
{
  // Content wider than the viewport: shrinks to fit the limiting axis.
  const state = fitState(800, 200, 400, 300);
  check('fitState: shrinks to fit the width-limited axis', approx(state.scale, 400 / 800), JSON.stringify(state));
}
{
  // Content taller than the viewport: shrinks to fit the limiting axis.
  const state = fitState(200, 900, 400, 300);
  check('fitState: shrinks to fit the height-limited axis', approx(state.scale, 300 / 900), JSON.stringify(state));
}
{
  // A viewport that hasn't been laid out yet (zero size, e.g. measured
  // before the browser has painted it) has no meaningful fit to compute —
  // falls back to the identity transform rather than dividing by zero.
  const state = fitState(100, 100, 0, 0);
  check('fitState: degenerate viewport size falls back to identity', state.scale === 1 && state.tx === 0 && state.ty === 0, JSON.stringify(state));
}

// --- toCssTransform ---
check(
  'toCssTransform: renders translate-then-scale in px/unitless CSS syntax',
  toCssTransform({ scale: 1.5, tx: 10, ty: -3 }) === 'translate(10px, -3px) scale(1.5)',
  toCssTransform({ scale: 1.5, tx: 10, ty: -3 }),
);

console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} total.`);
process.exitCode = fail > 0 ? 1 : 0;
