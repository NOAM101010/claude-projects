"use client";
import { useEffect, useRef, type RefObject } from "react";

/**
 * Procedural candlestick field for the intro overlay.
 * ─ single rAF, no React state inside the loop, full cleanup on unmount/stop.
 * ─ candles build left→right, then the series goes "live" (new candle every ~700ms).
 * ─ also eases the spotlight CSS vars on the veil element (so we keep ONE loop).
 */

type Candle = { o: number; h: number; l: number; c: number; v: number };

const UP = "16,185,129";
const DOWN = "239,68,68";

interface Props {
  /** while false the loop is stopped (exit / reduced-motion) */
  running: boolean;
  /** mobile / coarse pointer → cheaper drawing, no spotlight */
  lite: boolean;
  /** prefers-reduced-motion → draw a single static frame, then stop */
  still?: boolean;
  /** the dark veil element whose --mx/--my we ease toward the pointer */
  veilRef: RefObject<HTMLDivElement | null>;
}

export default function CandleField({ running, lite, still = false, veilRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(running);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const STEP = lite ? 9 : 14; // candle pitch
    const BODY = lite ? 5 : 8;
    const REVEAL_MS = lite ? 22 : 26; // per candle
    const LIVE_MS = 720; // new candle cadence once revealed
    const AXIS_W = lite ? 44 : 62;
    const PAD_TOP = lite ? 90 : 120;
    const PAD_BOT = lite ? 120 : 150;

    let raf = 0;
    let dpr = 1;
    let w = 0;
    let h = 0;
    let cols = 0;
    let series: Candle[] = [];
    let ema: number[] = [];
    let lo = 0;
    let hi = 1;
    let loS = 0;
    let hiS = 1;
    let seeded = false;
    const t0 = performance.now();
    let lastTick = t0;
    let prevNow = t0;

    // spotlight easing state
    let mx = -9999;
    let my = -9999;
    let sx = -9999;
    let sy = -9999;

    const rand = () => Math.random() - 0.5;

    const makeSeries = (n: number) => {
      const out: Candle[] = [];
      let price = 180 + Math.random() * 90;
      let drift = 0.14;
      for (let i = 0; i < n; i++) {
        if (i % 26 === 0) drift = 0.05 + Math.random() * 0.3;
        const o = price;
        const move = rand() * price * 0.018 + drift * price * 0.0016;
        const c = Math.max(4, o + move);
        const wick = price * 0.006 * (0.4 + Math.random());
        out.push({
          o,
          c,
          h: Math.max(o, c) + wick * Math.random(),
          l: Math.min(o, c) - wick * Math.random(),
          v: 0.25 + Math.random() * 0.75 + (Math.abs(move) / (price * 0.018)) * 0.4,
        });
        price = c;
      }
      return out;
    };

    const calcEma = () => {
      const k = 2 / (20 + 1);
      ema = [];
      let prev = series[0]?.c ?? 0;
      for (let i = 0; i < series.length; i++) {
        prev = series[i].c * k + prev * (1 - k);
        ema.push(prev);
      }
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const usable = Math.max(120, w - AXIS_W - 20);
      const next = Math.max(12, Math.floor(usable / STEP));
      if (!seeded) {
        cols = next;
        series = makeSeries(cols);
        calcEma();
        seeded = true;
      } else if (next > cols) {
        series = makeSeries(next);
        calcEma();
        cols = next;
      } else {
        cols = next;
      }
    };

    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (sx < -1000) {
        sx = mx;
        sy = my;
      }
    };

    const drawGrid = (yOf: (p: number) => number, skipY: number) => {
      ctx.save();
      ctx.font = "500 10px ui-monospace, 'SF Mono', Menlo, monospace";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      const lines = lite ? 4 : 6;
      for (let i = 0; i <= lines; i++) {
        const p = loS + ((hiS - loS) * i) / lines;
        const y = Math.round(yOf(p)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(AXIS_W, y);
        ctx.lineTo(w, y);
        ctx.strokeStyle = "rgba(255,255,255,0.038)";
        ctx.lineWidth = 1;
        ctx.stroke();
        if (Math.abs(y - skipY) > 15) {
          ctx.fillStyle = "rgba(255,255,255,0.22)";
          ctx.fillText(p.toFixed(2), 10, y);
        }
      }
      // axis rule
      ctx.beginPath();
      ctx.moveTo(AXIS_W - 0.5, 0);
      ctx.lineTo(AXIS_W - 0.5, h);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.stroke();
      ctx.restore();
    };

    const draw = (now: number) => {
      if (!runningRef.current) return;
      const elapsed = now - t0;

      // ---- reveal / live progression ----
      const revealed = still ? cols : Math.min(cols, Math.floor(elapsed / REVEAL_MS) + 1);
      const isLive = !still && revealed >= cols;
      if (isLive) {
        const last = series[series.length - 1];
        // intrabar tick on the newest candle
        // random walk with a light pull back to the open — keeps the bar sane
        const tick = rand() * last.c * 0.0035 - (last.c - last.o) * 0.02;
        last.c = Math.max(1, last.c + tick);
        last.h = Math.max(last.h, last.c);
        last.l = Math.min(last.l, last.c);
        if (now - lastTick > LIVE_MS) {
          lastTick = now;
          const o = last.c;
          const c = Math.max(1, o + rand() * o * 0.016 + o * 0.0004);
          series.push({ o, c, h: Math.max(o, c), l: Math.min(o, c), v: 0.3 + Math.random() * 0.8 });
          series.shift();
          calcEma();
        }
      }

      const view = series.slice(0, revealed);
      if (!view.length) {
        raf = requestAnimationFrame(draw);
        return;
      }

      // ---- range (eased) ----
      lo = Infinity;
      hi = -Infinity;
      for (const c of view) {
        if (c.l < lo) lo = c.l;
        if (c.h > hi) hi = c.h;
      }
      const pad = (hi - lo) * 0.12 || 1;
      lo -= pad;
      hi += pad;
      // frame-rate independent easing; hard snap if the series left the frame
      const dt = Math.min(120, Math.max(1, now - prevNow));
      prevNow = now;
      const k = 1 - Math.pow(1 - 0.09, dt / 16.7);
      const offscreen = hi < loS || lo > hiS || hi - lo > (hiS - loS) * 2.5;
      if (still || offscreen || (loS === 0 && hiS === 1)) {
        loS = lo;
        hiS = hi;
      } else {
        loS += (lo - loS) * k;
        hiS += (hi - hiS) * k;
      }

      const top = PAD_TOP;
      const bot = h - PAD_BOT;
      const yOf = (p: number) => bot - ((p - loS) / (hiS - loS || 1)) * (bot - top);
      const xOf = (i: number) => AXIS_W + 12 + i * STEP + STEP / 2;

      const lastClose = view[view.length - 1].c;
      const chipY = Math.min(Math.max(yOf(lastClose), 72), h - 96);
      ctx.clearRect(0, 0, w, h);
      drawGrid(yOf, chipY);

      // ---- volume ----
      if (!lite) {
        const vTop = bot + 16;
        const vH = 54;
        for (let i = 0; i < view.length; i++) {
          const c = view[i];
          const up = c.c >= c.o;
          const bh = Math.max(1, Math.min(1, c.v) * vH);
          ctx.fillStyle = `rgba(${up ? UP : DOWN},0.16)`;
          ctx.fillRect(xOf(i) - BODY / 2, vTop + (vH - bh), BODY, bh);
        }
      }

      // ---- EMA ----
      ctx.beginPath();
      for (let i = 0; i < view.length; i++) {
        const y = yOf(ema[i] ?? view[i].c);
        if (i === 0) ctx.moveTo(xOf(i), y);
        else ctx.lineTo(xOf(i), y);
      }
      ctx.strokeStyle = "rgba(245,158,11,0.35)";
      ctx.lineWidth = 1.25;
      ctx.stroke();

      // ---- candles ----
      const growN = 6; // last N candles fade/grow in
      for (let i = 0; i < view.length; i++) {
        const c = view[i];
        const up = c.c >= c.o;
        const rgb = up ? UP : DOWN;
        const fresh = view.length - i;
        const a = fresh <= growN ? 0.35 + (1 - fresh / growN) * 0.65 : 1;
        const x = xOf(i);
        const yH = yOf(c.h);
        const yL = yOf(c.l);
        const yO = yOf(c.o);
        const yC = yOf(c.c);

        ctx.strokeStyle = `rgba(${rgb},${0.55 * a})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, yH);
        ctx.lineTo(Math.round(x) + 0.5, yL);
        ctx.stroke();

        const bTop = Math.min(yO, yC);
        const bH = Math.max(1.5, Math.abs(yC - yO));
        ctx.fillStyle = `rgba(${rgb},${(up ? 0.62 : 0.5) * a})`;
        ctx.fillRect(x - BODY / 2, bTop, BODY, bH);
        ctx.strokeStyle = `rgba(${rgb},${0.9 * a})`;
        ctx.strokeRect(Math.round(x - BODY / 2) + 0.5, Math.round(bTop) + 0.5, BODY, bH);
      }

      // ---- last price line + chip ----
      const last = view[view.length - 1];
      const lastUp = last.c >= last.o;
      const rgb = lastUp ? UP : DOWN;
      const y = Math.round(yOf(last.c)) + 0.5;
      ctx.save();
      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      ctx.moveTo(AXIS_W, y);
      ctx.lineTo(w, y);
      ctx.strokeStyle = `rgba(${rgb},0.45)`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      const label = last.c.toFixed(2);
      ctx.font = "600 11px ui-monospace, 'SF Mono', Menlo, monospace";
      const tw = ctx.measureText(label).width + 14;
      const th = 18;
      const tx = 6;
      const ty = Math.min(Math.max(y - th / 2, 72), h - th - 96);
      ctx.fillStyle = `rgba(${rgb},0.9)`;
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw, th, 3);
      ctx.fill();
      ctx.fillStyle = "#05070c";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(label, tx + tw / 2, ty + th / 2 + 0.5);

      // pulsing marker on the newest close
      const px = xOf(view.length - 1);
      const pulse = 3 + (Math.sin(now / 260) + 1) * 2.4;
      ctx.beginPath();
      ctx.arc(px, yOf(last.c), pulse, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${rgb},0.5)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // ---- static (reduced motion): one frame and out ----
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
  }, [lite, still, veilRef]);

  // stop instantly when the overlay starts closing
  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  return <canvas ref={canvasRef} className="intro-canvas" aria-hidden />;
}
