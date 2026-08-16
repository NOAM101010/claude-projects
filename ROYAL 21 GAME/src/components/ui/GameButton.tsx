import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useSound } from '@/hooks/useSound';

type Tone = 'gold' | 'metal' | 'jade' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag'> {
  tone?: Tone;
  size?: Size;
  icon?: ReactNode;
  block?: boolean;
  children?: ReactNode;
}

const tones: Record<Tone, string> = {
  gold: 'text-[#1a1206] border-white/25',
  metal: 'text-[color:var(--text)] border-white/10',
  jade: 'text-[#04150d] border-white/20',
  ghost: 'text-[color:var(--text)] border-[color:var(--gold-line)]',
  danger: 'text-white border-white/20',
};

const backgrounds: Record<Tone, string> = {
  gold: 'var(--brushed-gold)',
  metal: 'var(--metal)',
  jade: 'linear-gradient(150deg, var(--jade-hi), var(--jade))',
  ghost: 'transparent',
  danger: 'linear-gradient(150deg, var(--crimson-hi), var(--crimson))',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[12.5px] rounded-[var(--r-xs)]',
  md: 'px-5 py-2.5 text-[14.5px] rounded-[var(--r-sm)]',
  lg: 'px-7 py-3.5 text-[16px] rounded-[var(--r-sm)]',
};

/**
 * Buttons read as objects on the table: brushed metal or gold, a real press,
 * a click you can hear. Never a flat web button.
 *
 * Forwards its ref so wrappers like Tooltip can measure the real button.
 */
export const GameButton = forwardRef<HTMLButtonElement, Props>(function GameButton({
  tone = 'metal', size = 'md', icon, block, children, className = '', onClick, onMouseEnter, disabled, ...rest
}, ref) {
  const { play } = useSound();
  return (
    <motion.button
      ref={ref}
      className={`relative inline-flex items-center justify-center gap-2 font-bold border
        ${tones[tone]} ${sizes[size]} ${block ? 'w-full' : ''} ${className}
        disabled:opacity-35 disabled:pointer-events-none select-none`}
      style={{
        background: backgrounds[tone],
        boxShadow: tone === 'gold'
          ? '0 10px 26px rgba(227,178,60,.26), inset 0 1px 0 rgba(255,255,255,.35)'
          : tone === 'ghost'
            ? 'none'
            : 'var(--shadow-soft), inset 0 1px 0 rgba(255,255,255,.08)',
      }}
      whileHover={disabled ? undefined : { y: -1.5, filter: 'brightness(1.08)' }}
      whileTap={disabled ? undefined : { scale: 0.96, y: 1 }}
      transition={{ duration: 0.14 }}
      disabled={disabled}
      onMouseEnter={(event) => {
        if (!disabled) play('hover');
        onMouseEnter?.(event);
      }}
      onClick={(event) => {
        if (disabled) return;
        play('click', 'tap');
        onClick?.(event);
      }}
      {...rest}
    >
      {icon}
      {children}
    </motion.button>
  );
});
