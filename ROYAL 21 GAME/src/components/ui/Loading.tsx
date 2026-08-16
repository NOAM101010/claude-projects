import { motion } from 'framer-motion';

/** Never a blank screen (§105): shuffling cards plus the line for that room. */
export function Loading({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-[400] grid place-items-center" style={{ background: 'rgba(8,9,11,.92)' }}>
      <div className="text-center">
        <div className="flex justify-center gap-1.5 h-16 mb-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.i
              key={i}
              className="block w-8 h-12 rounded-[5px]"
              style={{ background: 'var(--brushed-gold)' }}
              animate={{ y: [0, -14, 0], rotate: [0, 8, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
            />
          ))}
        </div>
        <p style={{ color: 'var(--muted)' }}>{label}</p>
      </div>
    </div>
  );
}
