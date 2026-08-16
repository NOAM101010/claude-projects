/** A soft pool of light on the floor or felt. Cheap: one blurred radial. */
export function LightPool({
  x = '50%', y = '50%', size = 420, color = 'rgba(227,178,60,.16)', blur = 40, className = '',
}: { x?: string; y?: string; size?: number; color?: string; blur?: number; className?: string }) {
  return (
    <div
      className={`light-pool ${className}`}
      style={{
        left: x, top: y, width: size, height: size * 0.62,
        transform: 'translate(-50%, -50%)',
        background: `radial-gradient(ellipse, ${color}, transparent 68%)`,
        filter: `blur(${blur}px)`,
      }}
    />
  );
}
