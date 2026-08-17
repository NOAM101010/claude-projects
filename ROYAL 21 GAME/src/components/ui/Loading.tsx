import { motion } from 'framer-motion';

/**
 * Never a blank screen (§105). Redesigned to feel cinematic:
 *   - a radial gold pool behind the cards
 *   - five cards riffling with a proper card-flip rotation, not just bounce
 *   - a Royal21 monogram fading with the ambient pulse underneath
 *   - the room label in a soft breathing rhythm
 */
export function Loading({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-[400] grid place-items-center overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 42%, #241a12, #100c14 55%, #06070a 85%)' }}>
      {/* Ambient gold pulse. */}
      <motion.div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 42%, rgba(227,178,60,.20), transparent 55%)' }}
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="text-center relative">
        {/* Faint monogram behind the cards. */}
        <motion.div
          className="absolute inset-x-0"
          style={{
            top: -66, textAlign: 'center', fontSize: 120, fontWeight: 900,
            fontFamily: 'var(--font-display)',
            background: 'linear-gradient(180deg, rgba(255,246,220,.16), rgba(227,178,60,.03))',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            letterSpacing: '.02em', lineHeight: 1,
          }}
          animate={{ opacity: [0.25, 0.55, 0.25] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          R21
        </motion.div>
        <div className="flex justify-center gap-2 mb-5 relative" style={{ perspective: 400, height: 80 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.i
              key={i}
              className="block w-10 h-16 rounded-[6px]"
              style={{
                background: 'linear-gradient(160deg, #fff6dc, var(--gold) 55%, #7a5822)',
                border: '1px solid rgba(255,255,255,.35)',
                boxShadow: '0 8px 18px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.4)',
              }}
              animate={{
                y: [0, -22, 0],
                rotateY: [0, 180, 360],
                rotateZ: [0, 6, 0],
              }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
            />
          ))}
        </div>
        <motion.p
          className="font-black tracking-widest text-[12px]"
          style={{ color: 'var(--gold-hi)', letterSpacing: '.2em', textTransform: 'uppercase' }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          {label}
        </motion.p>
      </div>
    </div>
  );
}
