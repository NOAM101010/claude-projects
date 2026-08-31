/**
 * CITY EMPIRE — Procedural facade textures.
 *
 * Generates building-facade textures on a canvas at runtime so we get a
 * believable European streetscape (windows, lit rooms at night) without
 * shipping any external image assets (MASTER §63, and our web-3D decision
 * to build visuals procedurally in code).
 *
 * Textures are cached by signature so we don't rebuild identical facades.
 */

import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

const cache = new Map<string, Texture>();

export interface FacadeOptions {
  wall: string;
  cols: number;
  rows: number;
  /** Fraction of windows that glow (used to imply evening lighting). */
  litRatio?: number;
  windowColor?: string;
  litColor?: string;
}

export function makeFacadeTexture(opts: FacadeOptions): Texture {
  const { wall, cols, rows, litRatio = 0, windowColor = '#20262e', litColor = '#ffd98a' } = opts;
  const key = `${wall}|${cols}|${rows}|${litRatio}|${windowColor}|${litColor}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const cell = 80; // higher res than before → crisper facades up close
  const pad = 24;
  const w = cols * cell + pad;
  const h = rows * cell + pad;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Wall base with a subtle vertical gradient for depth.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, shade(wall, 8));
  grad.addColorStop(1, shade(wall, -10));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  speckle(ctx, w, h, 900, 10);

  // Windows grid.
  const winW = cell * 0.56;
  const winH = cell * 0.66;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = pad / 2 + c * cell + (cell - winW) / 2;
      const y = pad / 2 + r * cell + (cell - winH) / 2;
      const lit = Math.random() < litRatio;
      ctx.fillStyle = lit ? litColor : windowColor;
      ctx.fillRect(x, y, winW, winH);
      // Frame
      ctx.strokeStyle = shade(wall, -22);
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, winW, winH);
      // Mullion
      ctx.beginPath();
      ctx.moveTo(x + winW / 2, y);
      ctx.lineTo(x + winW / 2, y + winH);
      ctx.moveTo(x, y + winH / 2);
      ctx.lineTo(x + winW, y + winH / 2);
      ctx.stroke();
    }
  }

  const tex = finalize(canvas);
  cache.set(key, tex);
  return tex;
}

/** Tileable ground textures, cached by a signature and cloned per use so
 * each placement can set its own repeat count cheaply (shares the image). */

export function makeAsphaltTexture(): Texture {
  return getOrBuild('asphalt', () => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#2a2d31';
    ctx.fillRect(0, 0, 256, 256);
    speckle(ctx, 256, 256, 2600, 10, 0.5);
    return c;
  });
}

export function makeSidewalkTexture(): Texture {
  return getOrBuild('sidewalk', () => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#84878d';
    ctx.fillRect(0, 0, 256, 256);
    speckle(ctx, 256, 256, 1400, 8, 0.35);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 3;
    const tile = 64;
    for (let i = 0; i <= 256; i += tile) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
    return c;
  });
}

export function makeGrassTexture(): Texture {
  return getOrBuild('grass', () => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#3c5a3a';
    ctx.fillRect(0, 0, 256, 256);
    speckle(ctx, 256, 256, 3000, 14, 0.6);
    return c;
  });
}

function getOrBuild(key: string, build: () => HTMLCanvasElement): Texture {
  const cached = cache.get(key);
  if (cached) return cached;
  const tex = finalize(build());
  cache.set(key, tex);
  return tex;
}

/** Wrap a baked canvas as a mip-mapped, anisotropically-filtered texture. */
function finalize(canvas: HTMLCanvasElement): Texture {
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** Scatter faint speckles of random shade over a canvas for a less "flat
 * cartoon" look. Cheap: baked once, not per-frame. */
function speckle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  count: number,
  size: number,
  alpha = 0.12,
) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = Math.random() * size;
    const dark = Math.random() < 0.5;
    ctx.fillStyle = dark ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha * 0.7})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Lighten (+) or darken (−) a hex colour by a percentage-ish amount. */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt);
  const g = clamp(((n >> 8) & 0xff) + amt);
  const b = clamp((n & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function clamp(v: number) {
  return Math.max(0, Math.min(255, Math.round(v)));
}
