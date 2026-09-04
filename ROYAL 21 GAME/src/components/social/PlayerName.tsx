import { titleItemByTag } from '@/data/items';
import { useT } from '@/hooks/useT';

interface Props {
  username: string;
  /** Equipped title tag (e.g. "ttl-shark") or null. */
  title?: string | null;
  /** Equipped name colour from the fixed palette (e.g. "#f8e3a8") or null. */
  nameColor?: string | null;
  /** Font size for the name in px. The title sits ~3px smaller beneath it. */
  size?: number;
  /** Lay the title inline after the name instead of on its own line. */
  inline?: boolean;
  className?: string;
}

/**
 * One player's name, dressed the same way everywhere: an optional palette colour
 * on the name itself and an optional unlocked "title" badge under (or beside) it.
 * Every seat / row / chat line that shows a name goes through this so the two
 * cosmetics never drift between screens.
 */
export function PlayerName({ username, title, nameColor, size = 13, inline = false, className }: Props) {
  const { lang } = useT();
  const titleItem = titleItemByTag(title);
  const label = titleItem?.name[lang];

  const name = (
    <b
      className="truncate"
      style={{ fontFamily: 'var(--font-display)', fontSize: size, color: nameColor ?? undefined }}
    >
      {username}
    </b>
  );

  if (!label) return inline ? name : <span className={className}>{name}</span>;

  const badge = (
    <span
      className="truncate"
      style={{
        fontSize: Math.max(8.5, size - 3),
        color: 'var(--gold-hi)',
        letterSpacing: '.02em',
        opacity: 0.9,
      }}
    >
      {titleItem?.icon} {label}
    </span>
  );

  return (
    <span
      className={`min-w-0 ${inline ? 'inline-flex items-baseline gap-1.5' : 'flex flex-col leading-tight'} ${className ?? ''}`}
    >
      {name}
      {badge}
    </span>
  );
}
