import { AnimatePresence, motion } from 'framer-motion';
import { GameButton } from '@/components/ui/GameButton';
import { useUI } from '@/stores/useUI';
import { useRoom } from '@/stores/useRoom';
import { usePlayer } from '@/stores/usePlayer';
import { useT } from '@/hooks/useT';

/** Losing the table is part of the design too (§106): the room dims, not breaks. */
export function ConnectionBanner() {
  const lost = useUI((s) => s.connectionLost);
  const setLost = useUI((s) => s.setConnectionLost);
  const room = useRoom((s) => s.room);
  const connect = useRoom((s) => s.connect);
  const profile = usePlayer((s) => s.profile);
  const { t } = useT();

  return (
    <AnimatePresence>
      {lost && (
        <motion.div
          className="fixed inset-0 z-[560] grid place-items-center px-5"
          style={{ background: 'rgba(4,5,7,.78)', backdropFilter: 'blur(8px)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="glass glass-gold p-6 text-center max-w-[400px] w-full">
            <div className="text-[38px] mb-2">🔌</div>
            <h2>{t('errors.connectionLost')}</h2>
            <p className="mt-2 mb-5 text-[13.5px]" style={{ color: 'var(--muted)' }}>{t('errors.reconnecting')}</p>
            <GameButton
              tone="gold"
              block
              onClick={async () => {
                if (room) await connect(room, profile.id);
                setLost(false);
              }}
            >
              {t('errors.reconnect')}
            </GameButton>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
