import { motion } from 'framer-motion';
import { Chip } from './Chip';
import { useT } from '@/hooks/useT';
import { audio } from '@/audio/AudioManager';

interface Props {
  stakes: readonly number[];
  value: number;
  onChange: (value: number) => void;
  chipSkin?: string;
  disabled?: boolean;
  /** Player's current balance — sizes the All-In action. */
  chips: number;
  /** VIP high-stakes chips — rendered in a marked section below the base row. */
  vipStakes?: readonly number[];
}

/**
 * The chip-row stake picker shared by every quick game, plus an All-In chip
 * that pushes the whole balance onto the table. Extracted so the three games
 * (slots, coin flip, high card) can't drift out of sync with each other.
 */
export function BetSelector({ stakes, value, onChange, chipSkin, disabled, chips, vipStakes }: Props) {
  const { t } = useT();
  const canAllIn = chips > 0;
  const isAllIn = canAllIn && value === chips && !stakes.includes(chips);

  return (
    <>
      <div className="eyebrow mb-2">{t('games.chooseStake')}</div>
      <div className="flex flex-wrap gap-2 justify-center mb-4">
        {stakes.map((stake) => (
          <button
            key={stake}
            onClick={() => { audio.play('chip'); onChange(stake); }}
            disabled={disabled}
            aria-pressed={value === stake}
            style={{ opacity: value === stake && !isAllIn ? 1 : 0.4, transform: value === stake && !isAllIn ? 'translateY(-5px)' : 'none', transition: '.2s' }}
          >
            <Chip value={stake} size={44} skin={chipSkin} interactive />
          </button>
        ))}
        <button
          onClick={() => { if (canAllIn) { audio.play('chip'); onChange(chips); } }}
          disabled={disabled || !canAllIn}
          aria-pressed={isAllIn}
          aria-label={t('games.allIn')}
          style={{ opacity: isAllIn ? 1 : 0.55, transform: isAllIn ? 'translateY(-5px)' : 'none', transition: '.2s' }}
        >
          <motion.div
            className="all-in-chip"
            style={{ width: 44, height: 44 }}
            whileHover={!disabled && canAllIn ? { y: -7, scale: 1.06 } : undefined}
            whileTap={!disabled && canAllIn ? { y: -1, scale: 0.96 } : undefined}
          >
            {t('games.allIn')}
          </motion.div>
        </button>
      </div>

      {vipStakes && vipStakes.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-4 pt-2"
          style={{ borderTop: '1px dashed var(--gold-line)' }}>
          <span className="w-full text-center text-[10.5px] font-black tracking-widest"
            style={{ color: 'var(--gold-hi)', letterSpacing: '0.15em' }}>
            💎 VIP HIGH STAKES
          </span>
          {vipStakes.map((stake) => (
            <button
              key={stake}
              onClick={() => { audio.play('chip'); onChange(stake); }}
              disabled={disabled}
              aria-pressed={value === stake}
              style={{ opacity: value === stake ? 1 : 0.4, transform: value === stake ? 'translateY(-5px)' : 'none', transition: '.2s' }}
            >
              <Chip value={stake} size={44} skin={chipSkin} interactive />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
