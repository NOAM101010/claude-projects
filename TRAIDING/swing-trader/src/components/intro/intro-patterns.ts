/**
 * INTRO — synthetic pattern scene.
 *
 * Builds 3 deterministic candle series that actually CONTAIN the setups the
 * scanner looks for, then runs the REAL `detect()` functions from `@/lib/setups`
 * on them. The intro's bounding boxes therefore show genuine labels + genuine
 * confidence numbers — not decoration.
 *
 * Everything here is pure + deterministic (seeded PRNG) so the scene is
 * identical on every mount, and cheap enough to build once at module scope.
 */

import { SETUPS, buildSetupContext, type SetupId } from "@/lib/setups";

export type Bar = { o: number; h: number; l: number; c: number; v: number };

export type SceneBox = {
  /** inclusive display-bar indices the box spans */
  from: number;
  to: number;
  /** price band of the box (already in scene price space) */
  top: number;
  bottom: number;
  /** the key level line inside the box (scene price space) */
  level: number | null;
  label: string;
  confidence: number;
};

export type Scene = { bars: Bar[]; boxes: SceneBox[] };

// ---------- deterministic prng ----------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** piecewise-linear price path through [index, price] anchors + light noise */
function path(anchors: Array<[number, number]>, n: number, noise: number, rand: () => number) {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let seg = 0;
    while (seg < anchors.length - 2 && anchors[seg + 1][0] < i) seg++;
    const [i0, p0] = anchors[seg];
    const [i1, p1] = anchors[seg + 1];
    const t = i1 === i0 ? 1 : Math.min(1, Math.max(0, (i - i0) / (i1 - i0)));
    // smoothstep — organic curvature instead of hard corners
    const s = t * t * (3 - 2 * t);
    const base = p0 + (p1 - p0) * s;
    out.push(base * (1 + (rand() - 0.5) * noise));
  }
  return out;
}

/** closes → OHLCV, open glued to the previous close (no gaps unless injected) */
function toBars(closes: number[], wick: number, rand: () => number, vol: (i: number) => number): Bar[] {
  const bars: Bar[] = [];
  for (let i = 0; i < closes.length; i++) {
    const c = closes[i];
    const o = i === 0 ? c * 0.996 : closes[i - 1] * (1 + (rand() - 0.5) * 0.002);
    const hi = Math.max(o, c) * (1 + rand() * wick);
    const lo = Math.min(o, c) * (1 - rand() * wick);
    bars.push({ o, c, h: hi, l: lo, v: vol(i) });
  }
  return bars;
}

function sma(values: number[], len: number): number | null {
  if (values.length < len) return null;
  let s = 0;
  for (let i = values.length - len; i < values.length; i++) s += values[i];
  return s / len;
}

function detectOn(id: SetupId, bars: Bar[], volumeRatio: number) {
  const closes = bars.map((b) => b.c);
  const ctx = buildSetupContext({
    symbol: "SWING",
    price: closes[closes.length - 1],
    closes,
    opens: bars.map((b) => b.o),
    highs: bars.map((b) => b.h),
    lows: bars.map((b) => b.l),
    volumes: bars.map((b) => b.v),
    ath: Math.max(...bars.map((b) => b.h)),
    high52w: Math.max(...bars.map((b) => b.h)),
    low52w: Math.min(...bars.map((b) => b.l)),
    ma20: sma(closes, 20),
    ma50: sma(closes, 50),
    ma150: sma(closes, Math.min(150, closes.length)),
    ma200: null,
    rsi: 62,
    volumeRatio,
  });
  return SETUPS[id].detect(ctx);
}

// ---------- the three series ----------

type Piece = {
  id: SetupId;
  /** full-resolution bars — what detect() sees */
  full: Bar[];
  volumeRatio: number;
  /** display window: every `stride`-th bar starting at `from` */
  from: number;
  stride: number;
  /** display-window fractions (0-1) the box hugs */
  boxFrom: number;
  boxTo: number;
  /** vertical padding of the box, as a fraction of its price span */
  padTop: number;
  padBottom: number;
};

/** ATH breakout: long advance → base → 3-bar break to new highs on volume. */
function athPiece(): Piece {
  const rand = mulberry32(0x5eed01);
  const n = 140;
  const closes = path(
    [
      [0, 61],
      [54, 99.2],
      [72, 86.5],
      [96, 90],
      [130, 98.4],
      [136, 99.6],
      [139, 101.9],
    ],
    n,
    0.012,
    rand,
  );
  // hard-set the breakout tail so the prior ATH is cleanly taken out
  closes[n - 3] = 100.7;
  closes[n - 2] = 101.3;
  closes[n - 1] = 102.0;
  const bars = toBars(closes, 0.006, rand, (i) => (i >= n - 4 ? 2.4 + rand() * 0.5 : 0.7 + rand() * 0.6));
  // flatten wicks in the base so the previous ATH stays the phase-1 peak
  for (let i = 60; i < n - 3; i++) bars[i].h = Math.min(bars[i].h, 99.2);
  return {
    id: "ath_breakout",
    full: bars,
    volumeRatio: 2.3,
    from: n - 38,
    stride: 1,
    boxFrom: 0.53,
    boxTo: 1,
    padTop: 0.16,
    padBottom: 0.1,
  };
}

/** Cup & handle: 26% cup over ~5 months, then a tight low-volume handle. */
function cupPiece(): Piece {
  const rand = mulberry32(0x5eed02);
  const n = 164;
  const closes = path(
    [
      [0, 82],
      [22, 100],
      [58, 76],
      [86, 78],
      [132, 96],
      [143, 92.6],
      [163, 92.2],
    ],
    n,
    0.008,
    rand,
  );
  // handle: tight drift, must stay under the lip and inside 2-10% depth
  for (let i = n - 20; i < n; i++) {
    const t = (i - (n - 20)) / 19;
    closes[i] = 93.6 - 2.2 * t + (rand() - 0.5) * 0.7;
  }
  const bars = toBars(closes, 0.005, rand, (i) => (i >= n - 20 ? 0.34 + rand() * 0.16 : 0.9 + rand() * 0.7));
  return {
    id: "cup_and_handle",
    full: bars,
    volumeRatio: 0.6,
    from: 8,
    stride: 4,
    boxFrom: 0,
    boxTo: 0.97,
    padTop: 0.1,
    padBottom: 0.08,
  };
}

/** Gap entry: a 4% gap up that never fills; price sits inside the gap. */
function gapPiece(): Piece {
  const rand = mulberry32(0x5eed03);
  const n = 64;
  const closes = path(
    [
      [0, 88],
      [30, 97],
      [43, 99.8],
      [50, 106.4],
      [63, 102.2],
    ],
    n,
    0.006,
    rand,
  );
  closes[43] = 100.0;
  const bars = toBars(closes, 0.005, rand, (i) => (i === 44 ? 3.1 : 0.7 + rand() * 0.6));
  // inject the gap on bar 44 and keep every later low above the gap bottom
  bars[44].o = 104.0;
  bars[44].c = 106.2;
  bars[44].l = 103.6;
  bars[44].h = 107.1;
  for (let i = 45; i < n; i++) {
    bars[i].l = Math.max(bars[i].l, 100.9);
    bars[i].o = Math.max(bars[i].o, 101.2);
    bars[i].c = Math.max(bars[i].c, 101.2);
    bars[i].h = Math.max(bars[i].h, bars[i].o, bars[i].c);
  }
  bars[n - 1].c = 102.1;
  bars[n - 1].h = Math.max(bars[n - 1].h, 102.6);
  return {
    id: "gap_entry",
    full: bars,
    volumeRatio: 2.0,
    from: n - 30,
    stride: 1,
    boxFrom: 0.27,
    boxTo: 0.72,
    padTop: 0.14,
    padBottom: 0.14,
  };
}

// ---------- scene assembly ----------

function buildScene(lite: boolean): Scene {
  // mobile keeps ONE clean setup — decimating the 160-bar cup at phone width
  // turns it into noise, and two boxes on 390px collide.
  const pieces = lite
    ? [{ ...athPiece(), from: 94, stride: 1, boxFrom: 0.42, boxTo: 1 }]
    : [cupPiece(), athPiece(), gapPiece()];
  const bars: Bar[] = [];
  const boxes: SceneBox[] = [];
  let scale = 1;

  for (const p of pieces) {
    const stride = p.stride;
    const window: Bar[] = [];
    for (let i = p.from; i < p.full.length; i += stride) window.push(p.full[i]);
    // always keep the very last bar — it carries the setup
    const tail = p.full[p.full.length - 1];
    if (window[window.length - 1] !== tail) window.push(tail);

    // chain: rescale so this piece continues from the previous piece's close
    const prevClose = bars.length ? bars[bars.length - 1].c : window[0].o;
    scale = prevClose / window[0].o;

    const offset = bars.length;
    for (const b of window) {
      bars.push({ o: b.o * scale, h: b.h * scale, l: b.l * scale, c: b.c * scale, v: b.v });
    }

    const det = detectOn(p.id, p.full, p.volumeRatio);
    const last = window.length - 1;
    const bf = Math.round(p.boxFrom * last);
    const from = offset + bf;
    const to = offset + Math.max(Math.round(p.boxTo * last), bf + 1);
    let top = -Infinity;
    let bottom = Infinity;
    for (let i = from; i <= to; i++) {
      if (bars[i].h > top) top = bars[i].h;
      if (bars[i].l < bottom) bottom = bars[i].l;
    }
    const span = Math.max(0.01, top - bottom);
    boxes.push({
      from,
      to,
      top: top + span * p.padTop,
      bottom: bottom - span * p.padBottom,
      level: det.keyLevel != null ? det.keyLevel * scale : null,
      label: det.boxLabel,
      confidence: det.present ? det.confidence : 0,
    });
  }

  return { bars, boxes };
}

let cacheFull: Scene | null = null;
let cacheLite: Scene | null = null;

export function getScene(lite: boolean): Scene {
  if (lite) return (cacheLite ??= buildScene(true));
  return (cacheFull ??= buildScene(false));
}
