"use client";
import { useRef, useEffect, HTMLAttributes } from "react";

/**
 * Trading-terminal cursor FX — canvas overlay, single rAF loop.
 *  · thin TradingView-style crosshair that eases toward the pointer
 *  · floating price tag at the (RTL) right end of the horizontal line
 *  · short fading light-trail behind the pointer (no round halo)
 *  · trade-ping ring on click — green = buy (left) / red = sell (right)
 *
 * Fully disabled on coarse pointers and prefers-reduced-motion.
 */

interface TradingCursorConfig {
  /** kept for backwards-compat with layout.tsx — no longer draws a halo */
  crosshair?: boolean;
  /** fire a trade-ping ring on click (default true) */
  pulseOnClick?: boolean;
  /** disable on touch / coarse-pointer devices (default true) */
  disableOnTouch?: boolean;
}

const UP = "16,185,129";
const DOWN = "239,68,68";
const BASE_PRICE = 428.5;
const PRICE_SPREAD = 0.06; // ±6% top-to-bottom

type Ping = { x: number; y: number; r: number; alpha: number; color: string };
type TrailPoint = { x: number; y: number };

function useTradingCursor(config: Required<TradingCursorConfig>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if ((config.disableOnTouch && coarse) || reduced) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let targetX = -9999;
    let targetY = -9999;
    let curX = -9999;
    let curY = -9999;
    let active = false;
    const trail: TrailPoint[] = [];
    const pings: Ping[] = [];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!active) {
        curX = targetX;
        curY = targetY;
      }
      active = true;
    };
    const onLeave = () => {
      active = false;
      targetX = targetY = -9999;
      trail.length = 0;
    };
    const onDown = (e: MouseEvent) => {
      if (!config.pulseOnClick) return;
      const sell = e.button === 2;
      pings.push({
        x: e.clientX,
        y: e.clientY,
        r: 5,
        alpha: 0.6,
        color: sell ? DOWN : UP,
      });
    };
    const onCtx = (e: MouseEvent) => {
      if (config.pulseOnClick) e.preventDefault();
    };

    const priceAt = (y: number, h: number) => {
      const t = 0.5 - (y / h - 0.5); // top of screen → higher price
      return BASE_PRICE * (1 + t * PRICE_SPREAD * 2);
    };

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      curX += (targetX - curX) * 0.15;
      curY += (targetY - curY) * 0.15;

      if (active) {
        // ---- trail ----
        trail.push({ x: curX, y: curY });
        if (trail.length > 9) trail.shift();
        for (let i = 1; i < trail.length; i++) {
          const a = trail[i - 1];
          const b = trail[i];
          const p = i / trail.length;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${UP},${0.28 * p})`;
          ctx.lineWidth = 2 * p + 0.4;
          ctx.lineCap = "round";
          ctx.stroke();
        }

        // ---- crosshair ----
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(0, curY + 0.5);
        ctx.lineTo(w, curY + 0.5);
        ctx.moveTo(curX + 0.5, 0);
        ctx.lineTo(curX + 0.5, h);
        ctx.stroke();
        ctx.restore();

        // ---- focus dot ----
        ctx.beginPath();
        ctx.arc(curX, curY, 3, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // ---- price tag (RTL → right edge of the horizontal line) ----
        const bullish = curY < h / 2;
        const rgb = bullish ? UP : DOWN;
        const label = priceAt(curY, h).toFixed(2);
        ctx.font =
          "600 11px ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace";
        const padX = 7;
        const tw = ctx.measureText(label).width + padX * 2;
        const th = 18;
        const tx = w - tw - 6;
        const ty = Math.min(Math.max(curY - th / 2, 4), h - th - 4);
        ctx.fillStyle = `rgba(${rgb},0.16)`;
        ctx.strokeStyle = `rgba(${rgb},0.5)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tx, ty, tw, th, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = `rgb(${rgb})`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(label, tx + padX, ty + th / 2 + 0.5);
      }

      // ---- trade pings ----
      for (let i = pings.length - 1; i >= 0; i--) {
        const p = pings[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${p.color},${p.alpha})`;
        ctx.lineWidth = 1.75;
        ctx.stroke();
        p.r += 2.4;
        p.alpha *= 0.94;
        if (p.alpha < 0.02) pings.splice(i, 1);
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("contextmenu", onCtx);
    raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("contextmenu", onCtx);
      cancelAnimationFrame(raf);
    };
  }, [config.pulseOnClick, config.disableOnTouch]);

  return canvasRef;
}

interface SpotlightCursorProps extends HTMLAttributes<HTMLCanvasElement> {
  config?: TradingCursorConfig;
}

export const Component = ({ config = {}, className, ...rest }: SpotlightCursorProps) => {
  const resolved: Required<TradingCursorConfig> = {
    crosshair: true,
    pulseOnClick: true,
    disableOnTouch: true,
    ...config,
  };

  const canvasRef = useTradingCursor(resolved);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`fixed top-0 left-0 pointer-events-none z-[9999] w-full h-full ${className ?? ""}`}
      {...rest}
    />
  );
};
