"use client";
import { useEffect, useRef, type RefObject } from "react";
import { getScene, type SceneBox } from "./intro-patterns";

/**
 * INTRO — candle field + live pattern detection boxes.
 *
 * ─ single rAF, zero React state inside the loop, full cleanup on stop/unmount.
 * ─ the series is NOT random noise: it's 3 synthetic-but-real setups
 *   (cup & handle → ATH breakout → unfilled gap) fed through the actual
 *   `detect()` functions in `@/lib/setups`. The boxes show what the scanner
 *   really returned: `{boxLabel} · {confidence}`.
 * ─ candles build left→right; a scanning reticle rides the build head and
 *   "lights up" each box as it crosses it.
 * ─ also eases the spotlight CSS vars on the veil element (one loop for all).
 */

const UP = "16,185,129";
const DOWN = "239,68,68";
const AMBER = "245,158,11";

interface Props {
  running: boolean;
  /** cheap drawing path (mobile OR reduced-motion) */
  lite: boolean;
  /** real small screen — picks the single-setup scene */
  compact?: boolean;
  still?: boolean;
  veilRef: RefObject<HTMLDivElement | null>;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export default function CandleField({
  running,
  lite,
  compact = false,
  still = false,
  veilRef,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(running);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const scene = getScene(compact);
    const bars = scene.bars;
    const boxes = scene.boxes;

    const START_MS = still ? 0 : 620; // let the doors part first
    const REVEAL_MS = lite ? 16 : 19; // per candle
    const BOX_MS = 460;
    const AXIS_W = lite ? 44 : 64;
    const PAD_TOP = lite ? 96 : 132;
    const PAD_BOT = lite ? 132 : 168;

    let raf = 0;
    let dpr = 1;
    let w = 0;
    let h = 0;
    let step = 12;
    let body = 7;

    const t0 = performance.now();

    // spotlight easing state
    let mx = -9999;
    let my = -9999;
    let sx = -9999;
    let sy = -9999;

    // EMA(20) over the scene closes — computed once
    const ema: number[] = [];
    {
      const k = 2 / 21;
      let prev = bars[0]?.c ?? 0;
      for (const b of bars) {
        prev = b.c * k + prev * (1 - k);
        ema.push(prev);
      }
    }

    // global price range — fixed, so the chart never jitters
    let lo = Infinity;
    let hi = -Infinity;
    for (const b of bars) {
      if (b.l < lo) lo = b.l;
      if (b.h > hi) hi = b.h;
    }
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;
    const maxVol = Math.max(...bars.map((b) => b.v), 1);

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const usable = Math.max(140, w - AXIS_W - 26);
      step = usable / bars.length;
      body = Math.max(2, Math.min(lite ? 6 : 10, step * 0.62));
    };

    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (sx < -1000) {
        sx = mx;
        sy = my;
      }
    };

    const chip = (
      text: string,
      x: number,
      y: number,
      split: number,
      hot: boolean,
      alpha: number,
    ) => {
      ctx.font = "600 10px ui-monospace, 'SF Mono', Menlo, monospace";
      const tw = ctx.measureText(text).width;
      const pw = tw + 16;
      const ph = 18;
      // keep the chip inside the frame (narrow screens push boxes to the edge)
      x = Math.min(Math.max(x, AXIS_W + 4), w - pw - 6);
      y = Math.max(y, 8);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "rgba(6,8,13,0.9)";
      ctx.beginPath();
      ctx.roundRect(x, y, pw, ph, 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(${AMBER},${hot ? 0.85 : 0.45})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      const tx = x + 8;
      const ty = y + ph / 2 + 0.5;
      if (split > 0.02) {
        // chromatic split while the label snaps in
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "rgba(255,60,60,0.85)";
        ctx.fillText(text, tx - split, ty);
        ctx.fillStyle = "rgba(60,220,255,0.85)";
        ctx.fillText(text, tx + split, ty);
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.fillStyle = hot ? "#ffe6b8" : "rgba(245,225,190,0.82)";
      ctx.fillText(text, tx, ty);
      ctx.restore();
      return pw;
    };

    const drawBox = (
      b: SceneBox,
      p: number,
      hot: boolean,
      xOf: (i: number) => number,
      yOf: (v: number) => number,
    ) => {
      const e = easeOut(p);
      const x0 = xOf(b.from) - step * 0.6;
      const x1 = xOf(b.to) + step * 0.6;
      const yT = yOf(b.top);
      const yB = yOf(b.bottom);
      const cx = (x0 + x1) / 2;
      const cy = (yT + yB) / 2;
      const s = 1 + (1 - e) * 0.07;
      const a = e;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      ctx.translate(-cx, -cy);
      ctx.globalAlpha = a;

      // faint wash so the region reads as "selected"
      ctx.fillStyle = `rgba(${AMBER},${hot ? 0.055 : 0.028})`;
      ctx.fillRect(x0, yT, x1 - x0, yB - yT);

      // dashed frame
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -performance.now() / 90;
      ctx.strokeStyle = `rgba(${AMBER},${hot ? 0.8 : 0.42})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(x0) + 0.5, Math.round(yT) + 0.5, x1 - x0, yB - yT);
      ctx.setLineDash([]);

      // corner ticks
      const t = 9;
      ctx.strokeStyle = `rgba(${AMBER},${hot ? 1 : 0.7})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const [cxp, cyp, dx, dy] of [
        [x0, yT, 1, 1],
        [x1, yT, -1, 1],
        [x0, yB, 1, -1],
        [x1, yB, -1, -1],
      ] as const) {
        ctx.moveTo(cxp + dx * t, cyp);
        ctx.lineTo(cxp, cyp);
        ctx.lineTo(cxp, cyp + dy * t);
      }
      ctx.stroke();

      // key level inside the box
      if (b.level != null && b.level < b.top && b.level > b.bottom) {
        const ly = Math.round(yOf(b.level)) + 0.5;
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = `rgba(${AMBER},0.5)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0, ly);
        ctx.lineTo(x1, ly);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();

      const label = `${b.label} · ${b.confidence.toFixed(2)}`;
      chip(label, x0, yT - 24, (1 - e) * 3.5, hot, a);
    };

    const draw = (now: number) => {
      if (!runningRef.current) return;
      const elapsed = now - t0;

      const revealed = still
        ? bars.length
        : Math.max(0, Math.min(bars.length, Math.floor((elapsed - START_MS) / REVEAL_MS)));

      if (revealed < 1) {
        ctx.clearRect(0, 0, w, h);
        raf = requestAnimationFrame(draw);
        return;
      }

      const top = PAD_TOP;
      const bot = h - PAD_BOT;
      const yOf = (p: number) => bot - ((p - lo) / (hi - lo || 1)) * (bot - top);
      const xOf = (i: number) => AXIS_W + 14 + i * step + step / 2;

      ctx.clearRect(0, 0, w, h);

      // ---- grid + price scale ----
      ctx.save();
      ctx.font = "500 10px ui-monospace, Menlo, monospace";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      const lines = lite ? 4 : 7;
      for (let i = 0; i <= lines; i++) {
        const p = lo + ((hi - lo) * i) / lines;
        const y = Math.round(yOf(p)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(AXIS_W, y);
        ctx.lineTo(w, y);
        ctx.strokeStyle = "rgba(255,255,255,0.032)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillText(p.toFixed(2), 10, y);
      }
      ctx.beginPath();
      ctx.moveTo(AXIS_W - 0.5, 0);
      ctx.lineTo(AXIS_W - 0.5, h);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.stroke();
      ctx.restore();

      // ---- volume ----
      const vTop = bot + 18;
      const vH = lite ? 34 : 56;
      for (let i = 0; i < revealed; i++) {
        const c = bars[i];
        const up = c.c >= c.o;
        const bh = Math.max(1, (c.v / maxVol) * vH);
        ctx.fillStyle = `rgba(${up ? UP : DOWN},0.15)`;
        ctx.fillRect(xOf(i) - body / 2, vTop + (vH - bh), body, bh);
      }

      // ---- EMA(20) ----
      ctx.beginPath();
      for (let i = 0; i < revealed; i++) {
        const y = yOf(ema[i]);
        if (i === 0) ctx.moveTo(xOf(i), y);
        else ctx.lineTo(xOf(i), y);
      }
      ctx.strokeStyle = `rgba(${AMBER},0.32)`;
      ctx.lineWidth = 1.25;
      ctx.stroke();

      // ---- candles ----
      const growN = 8;
      for (let i = 0; i < revealed; i++) {
        const c = bars[i];
        const up = c.c >= c.o;
        const rgb = up ? UP : DOWN;
        const fresh = revealed - i;
        const a = fresh <= growN ? 0.3 + (1 - fresh / growN) * 0.7 : 1;
        const x = xOf(i);

        ctx.strokeStyle = `rgba(${rgb},${0.5 * a})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, yOf(c.h));
        ctx.lineTo(Math.round(x) + 0.5, yOf(c.l));
        ctx.stroke();

        const yO = yOf(c.o);
        const yC = yOf(c.c);
        const bTop = Math.min(yO, yC);
        const bH = Math.max(1.5, Math.abs(yC - yO));
        ctx.fillStyle = `rgba(${rgb},${(up ? 0.6 : 0.48) * a})`;
        ctx.fillRect(x - body / 2, bTop, body, bH);
        ctx.strokeStyle = `rgba(${rgb},${0.88 * a})`;
        ctx.strokeRect(Math.round(x - body / 2) + 0.5, Math.round(bTop) + 0.5, body, bH);
      }

      // ---- last price line + chip ----
      const last = bars[revealed - 1];
      const lastUp = last.c >= last.o;
      const rgb = lastUp ? UP : DOWN;
      const ly = Math.round(yOf(last.c)) + 0.5;
      ctx.save();
      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      ctx.moveTo(AXIS_W, ly);
      ctx.lineTo(w, ly);
      ctx.strokeStyle = `rgba(${rgb},0.4)`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      const priceLabel = last.c.toFixed(2);
      ctx.font = "600 11px ui-monospace, Menlo, monospace";
      const tw = ctx.measureText(priceLabel).width + 14;
      const th = 18;
      const ty = Math.min(Math.max(ly - th / 2, 76), h - th - 96);
      ctx.fillStyle = `rgba(${rgb},0.9)`;
      ctx.beginPath();
      ctx.roundRect(6, ty, tw, th, 3);
      ctx.fill();
      ctx.fillStyle = "#05070c";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(priceLabel, 6 + tw / 2, ty + th / 2 + 0.5);

      // ---- reticle: rides the build head, then parks on the last setup ----
      const headX = xOf(revealed - 1);
      const headY = yOf(last.c);
      const scanning = !still && revealed < bars.length;
      if (!lite) {
        const rs = 26;
        const ra = scanning ? 1 : 0.35 + Math.sin(now / 420) * 0.12;
        ctx.save();
        ctx.globalAlpha = ra;
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(headX - rs) + 0.5, Math.round(headY - rs) + 0.5, rs * 2, rs * 2);
        ctx.strokeStyle = `rgba(${AMBER},0.95)`;
        ctx.lineWidth = 1.5;
        const tk = 8;
        ctx.beginPath();
        for (const [dx, dy] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ] as const) {
          const cx = headX + dx * rs;
          const cy = headY + dy * rs;
          ctx.moveTo(cx - dx * tk, cy);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx, cy - dy * tk);
        }
        ctx.stroke();
        // crosshair with a centre gap
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(headX - rs, headY);
        ctx.lineTo(headX - 6, headY);
        ctx.moveTo(headX + 6, headY);
        ctx.lineTo(headX + rs, headY);
        ctx.moveTo(headX, headY - rs);
        ctx.lineTo(headX, headY - 6);
        ctx.moveTo(headX, headY + 6);
        ctx.lineTo(headX, headY + rs);
        ctx.stroke();
        ctx.restore();
      } else {
        const pulse = 3 + (Math.sin(now / 260) + 1) * 2;
        ctx.beginPath();
        ctx.arc(headX, headY, pulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${rgb},0.5)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // ---- detection boxes ----
      for (const b of boxes) {
        if (revealed <= b.to) continue;
        const since = still ? BOX_MS : elapsed - (START_MS + (b.to + 1) * REVEAL_MS);
        const p = Math.min(1, Math.max(0, since / BOX_MS));
        const hot = headX >= xOf(b.from) - 30 && headX <= xOf(b.to) + 30;
        drawBox(b, p, hot || (!scanning && b === boxes[boxes.length - 1]), xOf, yOf);
      }

      if (still) return;

      // ---- spotlight easing on the veil ----
      if (!lite && veilRef.current) {
        sx += (mx - sx) * 0.12;
        sy += (my - sy) * 0.12;
        if (sx > -1000) {
          veilRef.current.style.setProperty("--mx", `${sx.toFixed(1)}px`);
          veilRef.current.style.setProperty("--my", `${sy.toFixed(1)}px`);
        }
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    if (!lite) window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, [lite, compact, still, veilRef]);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  return <canvas ref={canvasRef} className="intro-canvas" aria-hidden />;
}
