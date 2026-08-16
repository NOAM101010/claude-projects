import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ITEMS } from '@/data/items';
import { usePlayer } from '@/stores/usePlayer';
import { useT } from '@/hooks/useT';
import { useSound } from '@/hooks/useSound';

const QUICK = ['quick.nice', 'quick.noWay', 'quick.easy', 'quick.again', 'quick.gg', 'quick.youreDone'];
const COOLDOWN = 1800;

/** Emotes and quick lines, with a short cooldown so nobody can spam (§46). */
export function EmoteBar({ onSend }: { onSend: (payload: { emote?: string; message?: string }) => void }) {
  const owned = usePlayer((s) => s.owned);
  const { t } = useT();
  const { play } = useSound();
  const [open, setOpen] = useState(false);
  const last = useRef(0);

  const emotes = ITEMS.filter((item) => item.category === 'emotes' && owned.includes(item.id));

  const send = (payload: { emote?: string; message?: string }) => {
    const now = Date.now();
    if (now - last.current < COOLDOWN) return;
    last.current = now;
    play('click');
    onSend(payload);
    setOpen(false);
  };

  return (
    <div className="relative">
      <motion.button
        className="w-11 h-11 rounded-full grid place-items-center text-[19px] border"
        style={{ background: 'var(--metal)', borderColor: 'var(--gold-line)' }}
        whileTap={{ scale: 0.92 }}
        onClick={() => { play('click'); setOpen((value) => !value); }}
        aria-label="emotes"
      >
        😎
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute bottom-14 end-0 p-2.5 rounded-[var(--r-md)] glass flex flex-col gap-2 z-30"
            style={{ width: 232 }}
            initial={{ opacity: 0, y: 12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
          >
            <div className="flex flex-wrap gap-1.5">
              {emotes.map((item) => (
                <button
                  key={item.id}
                  className="w-10 h-10 grid place-items-center text-[22px] rounded-[var(--r-xs)] press"
                  style={{ background: 'rgba(255,255,255,.05)' }}
                  onClick={() => send({ emote: item.payload.emote })}
                >
                  {item.payload.emote}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((key) => (
                <button
                  key={key}
                  className="px-2.5 py-1.5 text-[12px] font-bold rounded-[var(--r-xs)] press"
                  style={{ background: 'rgba(255,255,255,.05)' }}
                  onClick={() => send({ message: t(key) })}
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
