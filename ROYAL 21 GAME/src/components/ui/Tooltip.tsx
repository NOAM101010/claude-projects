import { cloneElement, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useIsCompact } from '@/hooks/useMediaQuery';

type Side = 'top' | 'bottom' | 'start' | 'end';

interface Props {
  /** Short line explaining what the control does. */
  label: ReactNode;
  /** Optional second line: the detail, the cost, the shortcut. */
  hint?: ReactNode;
  side?: Side;
  /** Single focusable child the tip is attached to. */
  children: ReactElement;
  disabled?: boolean;
}

const OFFSET = 10;

/**
 * A hover/focus tip for any control in the game, not just the hub objects.
 *
 * Rendered in a fixed layer measured from the trigger's viewport box, so it is
 * never clipped by a panel's `overflow: hidden` and never inherits a parent's
 * transform. Touch devices skip it entirely — there is no hover there, and a
 * tip that opens on tap would eat the tap.
 */
export function Tooltip({ label, hint, side = 'top', children, disabled }: Props) {
  const [box, setBox] = useState<DOMRect | null>(null);
  const holder = useRef<HTMLElement | null>(null);
  const compact = useIsCompact();
  const id = useId();

  const show = () => {
    if (disabled || compact) return;
    const node = holder.current;
    if (node) setBox(node.getBoundingClientRect());
  };
  const hide = () => setBox(null);

  const trigger = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      holder.current = node;
      // Preserve whatever ref the child already carried.
      const original = (children as unknown as { ref?: unknown }).ref;
      if (typeof original === 'function') original(node);
      else if (original && typeof original === 'object') (original as { current: unknown }).current = node;
    },
    'aria-describedby': box ? id : undefined,
    onMouseEnter: (event: MouseEvent) => { show(); children.props.onMouseEnter?.(event); },
    onMouseLeave: (event: MouseEvent) => { hide(); children.props.onMouseLeave?.(event); },
    onFocus: (event: FocusEvent) => { show(); children.props.onFocus?.(event); },
    onBlur: (event: FocusEvent) => { hide(); children.props.onBlur?.(event); },
  } as never);

  const place = (rect: DOMRect) => {
    const midX = rect.left + rect.width / 2;
    const midY = rect.top + rect.height / 2;
    if (side === 'top') return { left: midX, top: rect.top - OFFSET, translate: '-50% -100%' };
    if (side === 'bottom') return { left: midX, top: rect.bottom + OFFSET, translate: '-50% 0' };
    if (side === 'start') return { left: rect.left - OFFSET, top: midY, translate: '-100% -50%' };
    return { left: rect.right + OFFSET, top: midY, translate: '0 -50%' };
  };

  return (
    <>
      {trigger}
      <AnimatePresence>
        {box && (
          <motion.div
            id={id}
            role="tooltip"
            className="fixed z-[90] pointer-events-none glass px-3 py-2"
            style={{
              ...(() => { const p = place(box); return { left: p.left, top: p.top, translate: p.translate }; })(),
              borderColor: 'var(--gold-line)',
              borderRadius: 'var(--r-sm)',
              maxWidth: 240,
            }}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.14, ease: [0.2, 0.8, 0.25, 1] }}
          >
            <div className="text-[12.5px] font-bold leading-snug" style={{ color: 'var(--gold-hi)' }}>{label}</div>
            {hint && (
              <div className="text-[11.5px] leading-snug mt-0.5" style={{ color: 'var(--muted)' }}>{hint}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
