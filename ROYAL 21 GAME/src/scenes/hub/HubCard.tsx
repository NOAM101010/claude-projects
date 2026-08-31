import { useState, type ReactNode, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { useSound } from '@/hooks/useSound';
import { useIsCompact } from '@/hooks/useMediaQuery';

interface Props {
  label: string;
  action: string;
  /** One line explaining what happens if you go in. Shown on hover and under the title. */
  blurb?: string;
  onEnter: () => void;
  children: (focused: boolean) => ReactNode;
  hoverSound?: 'card' | 'chip' | 'coin' | 'vault' | 'notify' | 'scratch';
  glow?: string;
  /** Full-width hero row (used outside the §01 floor). */
  span?: 1 | 2;
  /** Named cell in a `grid-template-areas` layout (the §01 casino floor). */
  area?: string;
  /** The centre of the floor: a round card (roulette). */
  round?: boolean;
  /** A slightly taller art window — for art that needs vertical headroom (the
   *  Blackjack dealer stands above the table). */
  artTall?: boolean;
  badge?: string;
  disabled?: boolean;
}

/**
 * One object on the casino floor, in a card that fully contains its art.
 *
 * The art window is a fixed box with `overflow: hidden`; game.css scales every
 * SVG/really wide art down to fit inside it (`object-fit: contain` in spirit),
 * so nothing ever bleeds out of the card or gets cropped by it.
 */
export function HubCard({
  label, action, blurb, onEnter, children, hoverSound = 'card',
  glow = 'rgba(227,178,60,.28)', span = 1, area, round, artTall, badge, disabled,
}: Props) {
  const [focused, setFocused] = useState(false);
  const { play } = useSound();
  const compact = useIsCompact();

  const focus = () => {
    if (focused || disabled) return;
    setFocused(true);
    play(hoverSound);
  };

  const enter = () => {
    if (disabled) return;
    play('click', 'tap');
    onEnter();
  };

  return (
    <motion.button
      type="button"
      className={`hub-cell${round ? ' hub-cell--round' : ''} relative flex flex-col items-center text-center glass press overflow-hidden`}
      style={{
        gridColumn: area ? undefined : span === 2 ? 'span 2' : undefined,
        gridArea: area,
        borderColor: round ? 'transparent' : focused ? 'var(--gold-line)' : 'var(--glass-line)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ['--art-h' as string]: artTall ? (compact ? '134px' : '156px') : (compact ? '112px' : '128px'),
      } as CSSProperties}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: disabled ? 0.5 : 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ type: 'spring', stiffness: 210, damping: 26 }}
      whileHover={disabled ? undefined : { y: -4 }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      onHoverStart={() => !compact && focus()}
      onHoverEnd={() => !compact && setFocused(false)}
      onFocus={focus}
      onBlur={() => setFocused(false)}
      onClick={enter}
      aria-label={`${label} — ${action}`}
      disabled={disabled}
    >
      {/* light pool behind the object, stronger when focused */}
      <motion.span
        className="absolute pointer-events-none"
        style={{
          insetInlineStart: '50%', top: '46%', width: '150%', height: '78%',
          transform: 'translate(-50%,-50%)', borderRadius: '50%',
          background: `radial-gradient(ellipse, ${glow}, transparent 68%)`,
          filter: 'blur(30px)',
        }}
        animate={{ opacity: focused ? 1 : 0.4, scale: focused ? 1.1 : 1 }}
        transition={{ duration: 0.35 }}
      />

      {badge && (
        <span
          className="absolute top-2.5 end-2.5 px-2 py-0.5 rounded-full text-[9.5px] font-black z-10"
          style={{ background: 'var(--brushed-gold)', color: '#3a2c0c', letterSpacing: '.08em' }}
        >
          {badge}
        </span>
      )}

      <span className="hub-card-artbox">
        {children(focused)}
      </span>

      <span className="relative mt-3 w-full">
        <span className="eyebrow block" style={{ fontSize: 9.5 }}>{label}</span>
        <b
          className="block mt-1 text-[14px]"
          style={{ fontFamily: 'var(--font-display)', color: focused ? 'var(--gold-hi)' : 'var(--text)' }}
        >
          {action}
        </b>
        {blurb && (
          <span className="block mt-1 text-[11.5px] leading-snug" style={{ color: 'var(--dim)' }}>
            {blurb}
          </span>
        )}
      </span>
    </motion.button>
  );
}
