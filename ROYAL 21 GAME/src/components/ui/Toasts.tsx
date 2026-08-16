import { AnimatePresence, motion } from 'framer-motion';
import { useUI } from '@/stores/useUI';

const accents = {
  neutral: 'var(--gold)',
  good: 'var(--jade)',
  bad: 'var(--crimson)',
};

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className="fixed top-3 z-[700] flex flex-col gap-2 pointer-events-none"
      style={{ insetInlineEnd: 12, maxWidth: 'min(360px, 86vw)' }}>
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            className="glass px-3.5 py-2.5 text-[13.5px] flex items-center gap-2.5"
            style={{ borderInlineStartWidth: 3, borderInlineStartColor: accents[toast.tone], borderRadius: 'var(--r-sm)' }}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 30, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          >
            {toast.icon && <span className="text-[17px]">{toast.icon}</span>}
            <span>{toast.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
