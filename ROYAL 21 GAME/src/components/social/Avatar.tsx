import { rankOf } from '@/services/profileService';
import type { AvatarConfig, Presence } from '@/types';

/** Every skin tone / hair colour the bust can render — the avatar editor
 *  (Stage H) walks these same arrays so the indices stay in sync. */
export const AVATAR_SKINS = ['#f0c9a6', '#e0ab7f', '#c78d5e', '#8d5a35', '#5f3a20'];
export const AVATAR_HAIRS = ['#241a12', '#4a3423', '#8c5a2b', '#c8a15a', '#1b1b1f', '#7a2b2b'];
const SKIN = AVATAR_SKINS;
const HAIR = AVATAR_HAIRS;
const SHIRT: Record<string, string> = {
  base: '#2c3140', gold: '#a5842f', royal: '#4a2f78',
  neon: '#12706a', crimson: '#7d2c2c', white: '#d8d4c9',
};

const dot: Record<Presence, string> = {
  online: '#3ddc84', hub: '#3ddc84', blackjack: '#e3b23c',
  duel: '#7b5bd6', roulette: '#a8413e', away: '#c8a15a', offline: '#5c6068',
};

interface Props {
  config: AvatarConfig;
  size?: number;
  level?: number;
  frame?: string | null;
  presence?: Presence;
  id?: string;
}

/**
 * Layered SVG bust. Every cosmetic sits in its own layer and in its own place,
 * so a hat never eats the glasses and the watch is always on the wrist side.
 */
export function Avatar({ config, size = 48, level = 1, frame, presence, id = 'a' }: Props) {
  const skin = SKIN[config.skin % SKIN.length];
  const hair = HAIR[config.hair % HAIR.length];
  const shirt = SHIRT[config.shirt] ?? SHIRT.base;

  // Metal tone per accessory variant — keeps the SVG branches to one lookup.
  const METAL: Record<string, { dark: string; light: string }> = {
    gold: { dark: '#e3b23c', light: '#f8e3a8' },
    silver: { dark: '#cfd6e0', light: '#eef3f8' },
    steel: { dark: '#b9c0cb', light: '#eef3f8' },
    rose: { dark: '#e6a6b0', light: '#f6d8de' },
    jade: { dark: '#4fd39a', light: '#bff0da' },
    onyx: { dark: '#4a4f5a', light: '#8b909c' },
    diamond: { dark: '#8fd8ec', light: '#d8f4fb' },
  };
  const watchMetal = METAL[config.watch ?? 'steel'] ?? METAL.steel;
  const chainMetal = METAL[config.chain ?? 'silver'] ?? METAL.silver;
  const tintedLens = config.glasses === 'clear' || config.glasses === 'rimless';
  const lensFill = tintedLens ? 'rgba(200,230,255,.28)' : config.glasses === 'led' ? '#0d1626' : '#15171d';
  const lensStroke = config.glasses === 'led' ? '#5ef2d6' : tintedLens ? '#e3b23c' : config.glasses === 'visor' ? '#2a2f3a' : '#3a3f4a';
  const ring = frame ?? `rk-${rankOf(level).key}`;
  const clip = `clip-${id}`;

  return (
    <span
      className={`relative inline-grid place-items-center rounded-full ${ring}`}
      style={{ width: size, height: size, flex: '0 0 auto' }}
    >
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" style={{ display: 'block', borderRadius: '50%' }}>
        <defs>
          <clipPath id={clip}><circle cx="32" cy="32" r="32" /></clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect width="64" height="64" fill="#1a1d24" />
          <circle cx="32" cy="24" r="30" fill="rgba(255,255,255,.05)" />
          <path d="M4 64c0-14 12-21 28-21s28 7 28 21z" fill={shirt} />
          <path d="M24 44l8 9 8-9-8-4z" fill="rgba(255,255,255,.12)" />
          {config.chain && (
            <>
              <path d="M25 44q7 11 14 0" stroke={chainMetal.dark} strokeWidth="2.4" fill="none" />
              <circle cx="32" cy="50.5" r="2.6" fill={chainMetal.light} />
            </>
          )}
          <ellipse cx="32" cy="26" rx="15" ry="16" fill={skin} />
          <path d="M17 24c0-11 30-11 30 0 0-4-3-13-15-13S17 20 17 24z" fill={hair} />
          <ellipse cx="26" cy="26" rx="1.9" ry="2.3" fill="#20232b" />
          <ellipse cx="38" cy="26" rx="1.9" ry="2.3" fill="#20232b" />
          <path d="M27 34q5 4 10 0" stroke="#20232b" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          {config.glasses && config.glasses === 'visor' && (
            <path d="M17 21h30a3 3 0 0 1 3 3v3a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4v-3a3 3 0 0 1 3-3z" fill="#15171d" stroke={lensStroke} strokeWidth="1.3" opacity="0.92" />
          )}
          {config.glasses && config.glasses !== 'visor' && (
            <g>
              <rect x="19.5" y="22" width="11" height="8" rx={config.glasses === 'aviator' ? 4 : 2.6}
                fill={lensFill} stroke={lensStroke} strokeWidth="1.3" />
              <rect x="33.5" y="22" width="11" height="8" rx={config.glasses === 'aviator' ? 4 : 2.6}
                fill={lensFill} stroke={lensStroke} strokeWidth="1.3" />
              <path d="M30.5 26h3" stroke={lensStroke} strokeWidth="1.3" />
            </g>
          )}
          {config.hat === 'cap' && (
            <>
              <path d="M15 17q17-13 34 0v3H15z" fill="#23262f" />
              <path d="M15 20q-6 1-7 4h22z" fill="#171a21" />
            </>
          )}
          {config.hat === 'fedora' && (
            <>
              <path d="M14 20h36q-4-11-18-11T14 20z" fill="#1d2028" />
              <rect x="12" y="19" width="40" height="3.4" rx="1.7" fill="#12141a" />
              <rect x="19" y="16" width="26" height="3" fill="#e3b23c" opacity=".8" />
            </>
          )}
          {config.hat === 'crown' && (
            <>
              <path d="M18 16l4 7h20l4-7-6 4-8-7-8 7z" fill="#f8e3a8" stroke="#8a6a1f" strokeWidth="1" />
              <circle cx="32" cy="13.5" r="1.8" fill="#a8413e" />
            </>
          )}
          {config.watch && (
            <>
              <circle cx="54" cy="55" r="7" fill="#15171d" stroke={watchMetal.dark} strokeWidth="2" />
              <path d="M54 51v4l2.5 2" stroke={watchMetal.light} strokeWidth="1.4" fill="none" strokeLinecap="round" />
            </>
          )}
        </g>
      </svg>
      {presence && (
        <i
          className="absolute rounded-full"
          style={{
            width: Math.max(9, size * 0.24), height: Math.max(9, size * 0.24),
            bottom: 0, insetInlineEnd: 0, background: dot[presence],
            border: '2px solid var(--ink)',
          }}
        />
      )}
    </span>
  );
}
