import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { GlassPanel } from './GlassPanel';
import { fade } from '@/lib/motion';
import { useT } from '@/hooks/useT';
import { useSound } from '@/hooks/useSound';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  width?: number;
  /** Hero moments and confirmations that must be answered. */
  sticky?: boolean;
}

export function Modal({ open, onClose, title, subtitle, children, width = 520, sticky }: Props) {
  const { t } = useT();
  const { play } = useSound();
  if (!open) return null;
  return (
        <motion.div
          className="fixed inset-0 z-[500] grid place-items-center p-4"
          style={{ background: 'rgba(4,5,7,.72)', backdropFilter: 'blur(8px)' }}
          variants={fade}
          initial="hidden"
          animate="show"
          onClick={() => {
            if (sticky) return;
            play('back');
            onClose();
          }}
        >
          <GlassPanel
            gold
            className="w-full p-6 max-h-[88dvh] overflow-auto"
            style={{ maxWidth: width }}
            onClick={(event) => event.stopPropagation()}
          >
            {(title || !sticky) && (
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  {title && <h2>{title}</h2>}
                  {subtitle && <p className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>{subtitle}</p>}
                </div>
                {!sticky && (
                  <button
                    className="w-9 h-9 grid place-items-center rounded-[var(--r-xs)] border border-white/10"
                    style={{ color: 'var(--muted)' }}
                    aria-label={t('common.close')}
                    onClick={() => { play('back'); onClose(); }}
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
            {children}
          </GlassPanel>
        </motion.div>
  );
}
