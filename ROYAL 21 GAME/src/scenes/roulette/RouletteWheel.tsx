import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { WHEEL_ORDER, isRed } from '@/games/roulette/engine';

const POCKETS = WHEEL_ORDER.length;
const STEP = 360 / POCKETS;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function wedgePath(cx: number, cy: number, rInner: number, rOuter: number, startDeg: number, endDeg: number) {
  const a = polar(cx, cy, rOuter, startDeg);
  const b = polar(cx, cy, rOuter, endDeg);
  const c = polar(cx, cy, rInner, endDeg);
  const d = polar(cx, cy, rInner, startDeg);
  return `M${a.x} ${a.y} A${rOuter} ${rOuter} 0 0 1 ${b.x} ${b.y} L${c.x} ${c.y} A${rInner} ${rInner} 0 0 0 ${d.x} ${d.y} Z`;
}

interface Props {
  spinning: boolean;
  winningNumber: number | null;
  onSettled?: () => void;
  size?: number;
}

/** A professional-looking wheel: 37 pockets, a decelerating spin, a ball that drops onto the winner. */
export function RouletteWheel({ spinning, winningNumber, onSettled, size = 300 }: Props) {
  const [rotation, setRotation] = useState(0);
  const [ballSpins, setBallSpins] = useState(0);
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 6;
  const rInner = rOuter * 0.58;
  const rBall = rOuter * 0.86;

  const wedges = useMemo(
    () =>
      WHEEL_ORDER.map((n, i) => {
        const start = i * STEP;
        const end = start + STEP;
        const fill = n === 0 ? '#1c7a4a' : isRed(n) ? '#a8413e' : '#15161a';
        const mid = start + STEP / 2;
        const label = polar(cx, cy, (rInner + rOuter) / 2, mid);
        return { n, path: wedgePath(cx, cy, rInner, rOuter, start, end), fill, label, mid };
      }),
    [cx, cy, rInner, rOuter],
  );

  useEffect(() => {
    if (!spinning || winningNumber === null) return;
    const index = WHEEL_ORDER.indexOf(winningNumber);
    const settleAngle = -(index * STEP + STEP / 2);
    const extraTurns = 5 + Math.floor(Math.random() * 2);
    setRotation((prev) => prev - (prev % 360) + settleAngle - extraTurns * 360);
    setBallSpins((prev) => prev + (extraTurns + 3) * 360 * -1);
    const timer = setTimeout(() => onSettled?.(), 4200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, winningNumber]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* pointer */}
      <div
        className="absolute z-10"
        style={{ top: -2, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '14px solid var(--gold-hi)', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.5))' }}
      />
      <motion.svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        animate={{ rotate: rotation }}
        transition={{ duration: spinning ? 4 : 0, ease: [0.15, 0.65, 0.2, 1] }}
        style={{ display: 'block', filter: 'drop-shadow(var(--shadow-deep))' }}
      >
        <circle cx={cx} cy={cy} r={rOuter + 4} fill="#0e1014" stroke="rgba(227,178,60,.4)" strokeWidth="2" />
        {wedges.map((w) => (
          <g key={w.n}>
            <path d={w.path} fill={w.fill} stroke="rgba(0,0,0,.5)" strokeWidth="0.6" />
            <text
              x={w.label.x} y={w.label.y}
              fill="#f3efe6" fontSize={size * 0.032} fontWeight={700}
              textAnchor="middle" dominantBaseline="middle"
              transform={`rotate(${w.mid}, ${w.label.x}, ${w.label.y})`}
            >
              {w.n}
            </text>
          </g>
        ))}
        <circle cx={cx} cy={cy} r={rInner} fill="url(#hubCap)" stroke="rgba(227,178,60,.5)" strokeWidth="2" />
        <defs>
          <radialGradient id="hubCap" cx="50%" cy="35%" r="70%">
            <stop offset="0" stopColor="#2a2d35" />
            <stop offset="1" stopColor="#0e1014" />
          </radialGradient>
        </defs>
      </motion.svg>
      {/* the ball, orbiting the rim independently of the wheel's own spin */}
      <motion.div
        className="absolute"
        style={{ width: size, height: size, top: 0, left: 0 }}
        animate={{ rotate: spinning ? ballSpins : 0 }}
        transition={{ duration: spinning ? 4 : 0, ease: [0.1, 0.4, 0.25, 1] }}
      >
        <div
          className="absolute rounded-full"
          style={{
            width: size * 0.045, height: size * 0.045,
            top: cy - rBall - (size * 0.045) / 2, left: cx - (size * 0.045) / 2,
            background: 'radial-gradient(circle at 35% 30%, #fff, #cfd2d8 60%, #8b8f98)',
            boxShadow: '0 2px 5px rgba(0,0,0,.6)',
          }}
        />
      </motion.div>
    </div>
  );
}
