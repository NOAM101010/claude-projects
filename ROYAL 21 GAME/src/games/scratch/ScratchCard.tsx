import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { audio } from '@/audio/AudioManager';
import { haptic } from '@/lib/haptics';
import { useT } from '@/hooks/useT';

interface Props {
  symbols: string[];
  accent: string;
  onComplete: () => void;
}

/** Enough of the foil gone to call it revealed. */
const REVEAL_AT = 0.45;
/** Below this the "reveal the rest" shortcut stays hidden. */
const SHORTCUT_AT = 0.12;
const BRUSH = 24;

/**
 * A real scratch layer: a canvas of silver you rub away with a finger or the
 * mouse. It finishes itself once enough of the surface is gone (§76).
 *
 * The canvas is sized from `offsetWidth`/`offsetHeight` via a ResizeObserver
 * rather than `getBoundingClientRect()`. The card mounts inside a framer-motion
 * `scale(0.9)` entrance, and a rect measured mid-animation reports the visually
 * scaled box — which used to size the backing store ~10% small, offset every
 * brush stroke from the cursor, and leave a rim that could never be cleared. The
 * card then sat below its own reveal threshold forever: scratched blank, no prize.
 */
export function ScratchCard({ symbols, accent, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const done = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const lastSound = useRef(0);
  const pending = useRef(false);
  const [cleared, setCleared] = useState(0);
  const { t } = useT();

  /** Paints the silver coating over the whole backing store. */
  const coat = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#b9bec9');
    gradient.addColorStop(0.45, '#8f94a0');
    gradient.addColorStop(0.55, '#c7ccd6');
    gradient.addColorStop(1, '#8f94a0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255,255,255,.16)';
    for (let i = 0; i < 90; i++) {
      ctx.fillRect(Math.random() * width, Math.random() * height, 14 * (height / 240), 1);
    }

    const scale = Math.max(1, height / 240);
    ctx.font = `bold ${13 * scale}px sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('scratch.here'), width / 2, height / 2);
  }, [t]);

  /* Size the backing store to the real layout box and re-coat whenever it
     changes. offsetWidth ignores CSS transforms, so the entrance animation
     cannot corrupt the measurement. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sync = () => {
      if (done.current) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.round(canvas.offsetWidth * dpr);
      const height = Math.round(canvas.offsetHeight * dpr);
      if (width < 2 || height < 2) return;
      if (canvas.width === width && canvas.height === height) return;
      canvas.width = width;
      canvas.height = height;
      coat(canvas);
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [coat]);

  /** Fraction of the coating already rubbed away. */
  const measure = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || done.current || canvas.width < 2) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let data: Uint8ClampedArray;
    try {
      ({ data } = ctx.getImageData(0, 0, canvas.width, canvas.height));
    } catch {
      return; // tainted or zero-sized; nothing to measure
    }

    const step = 4 * 64;
    let clear = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += step) {
      total++;
      if (data[i] < 40) clear++;
    }
    const ratio = total ? clear / total : 0;
    setCleared(ratio);

    if (ratio >= REVEAL_AT) {
      done.current = true;
      haptic('win');
      onComplete();
    }
  }, [onComplete]);

  /** Coalesce measurement into one read per frame — getImageData is expensive. */
  const scheduleMeasure = useCallback(() => {
    if (pending.current || done.current) return;
    pending.current = true;
    requestAnimationFrame(() => {
      pending.current = false;
      measure();
    });
  }, [measure]);

  /** Erases along the segment so a fast drag leaves no gaps. */
  const scratchAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || done.current || canvas.width < 2) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // Map CSS pixels to backing-store pixels using the live box, so the brush
    // tracks the cursor even mid-animation or after a resize.
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    const radius = BRUSH * (canvas.width / rect.width);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';

    const previous = lastPoint.current;
    if (previous) {
      ctx.lineWidth = radius * 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(previous.x, previous.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    lastPoint.current = { x, y };

    const now = performance.now();
    if (now - lastSound.current > 90) {
      lastSound.current = now;
      audio.play('scratch');
    }
    scheduleMeasure();
  };

  /** Wipes the rest of the foil — used by the shortcut and by keyboard users. */
  const revealAll = () => {
    const canvas = canvasRef.current;
    if (!canvas || done.current) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    setCleared(1);
    done.current = true;
    haptic('win');
    onComplete();
  };

  const stop = () => {
    drawing.current = false;
    lastPoint.current = null;
    scheduleMeasure();
  };

  return (
    <div
      className="relative w-full select-none"
      style={{ aspectRatio: '1.6', borderRadius: 'var(--r-md)', overflow: 'hidden', border: `1px solid ${accent}55`, boxShadow: 'var(--shadow-deep)' }}
    >
      <div
        className="absolute inset-0 grid place-items-center px-4"
        style={{ background: 'linear-gradient(160deg,#1c1f27,#0e1014)', gridTemplateColumns: 'repeat(3,1fr)' }}
      >
        {symbols.map((symbol, index) => (
          <motion.span
            key={index}
            className="text-center"
            style={{ fontSize: 'clamp(30px,9vw,46px)', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.55))' }}
            animate={cleared > 0.5 ? { scale: [1, 1.18, 1] } : {}}
            transition={{ duration: 0.9, repeat: cleared > 0.5 ? Infinity : 0, repeatType: 'reverse', delay: index * 0.1 }}
          >
            {symbol}
          </motion.span>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: 'crosshair', touchAction: 'none' }}
        onPointerDown={(event) => {
          drawing.current = true;
          lastPoint.current = null;
          event.currentTarget.setPointerCapture(event.pointerId);
          scratchAt(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => { if (drawing.current) scratchAt(event.clientX, event.clientY); }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={stop}
      />

      {/* Escape hatch: once the card is clearly being worked, let it be finished
          in one tap. Nobody should have to polish a card to see if they won. */}
      {cleared > SHORTCUT_AT && cleared < REVEAL_AT && (
        <motion.button
          type="button"
          className="absolute bottom-2 start-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-[11.5px] font-bold glass press"
          style={{ borderColor: 'var(--gold-line)', color: 'var(--gold-hi)' }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={revealAll}
        >
          {t('scratch.revealRest')}
        </motion.button>
      )}
    </div>
  );
}
