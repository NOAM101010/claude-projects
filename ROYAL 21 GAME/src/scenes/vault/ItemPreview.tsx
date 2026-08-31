import { motion } from 'framer-motion';
import { PlayingCard } from '@/components/game/PlayingCard';
import { ChipStack } from '@/components/game/ChipStack';
import { Avatar } from '@/components/social/Avatar';
import { Dealer } from '@/components/game/Dealer';
import { VictoryEffect } from '@/components/effects/VictoryEffect';
import { CoinFace } from '@/components/game/CoinFace';
import { usePlayer } from '@/stores/usePlayer';
import { useT } from '@/hooks/useT';
import { symbolsForTheme } from '@/data/slots';
import { roomBackgroundOf } from '@/data/roomThemes';
import type { ShopItem } from '@/types';

/** Every item is previewed as the thing it actually is (§92). */
export function ItemPreview({ item, compact }: { item: ShopItem; compact?: boolean }) {
  const profile = usePlayer((s) => s.profile);
  const { t } = useT();
  const size = compact ? 'sm' : 'md';

  switch (item.category) {
    case 'cards':
      return (
        <div className="flex" style={{ marginInlineStart: 14 }}>
          {[{ r: 'A', s: 'S' }, { r: 'K', s: 'H' }].map((card, index) => (
            <div key={index} style={{ marginInlineStart: -14 }}>
              <PlayingCard card={card as never} size={size} fresh={false}
                face={item.payload.cardFace ?? 'cf-classic'} back={profile.equipped.cardBack} />
            </div>
          ))}
        </div>
      );
    case 'backs':
      return (
        <div className="flex" style={{ marginInlineStart: 14 }}>
          {[0, 1].map((index) => (
            <div key={index} style={{ marginInlineStart: -14 }}>
              <PlayingCard faceDown size={size} fresh={false} back={item.payload.cardBack ?? 'bk-crimson'} />
            </div>
          ))}
        </div>
      );
    case 'chips':
      return <ChipStack amount={1785} size={compact ? 22 : 32} skin={item.payload.chipSkin ?? 'ck-classic'} max={compact ? 5 : 9} />;
    case 'tables':
      return (
        <div className={`table-felt ${item.payload.table}`} style={{ width: compact ? 92 : 190, height: compact ? 54 : 106, borderRadius: 14 }} />
      );
    case 'dealers':
      return <Dealer mood="shuffle" skin={item.payload.dealerSkin ?? 'dl-house'} size={compact ? 70 : 120} />;
    case 'victory':
      return (
        <div className="relative grid place-items-center" style={{ width: compact ? 80 : 170, height: compact ? 70 : 150 }}>
          <span className="text-[26px]">🏆</span>
          <VictoryEffect kind={item.payload.victory ?? null} />
        </div>
      );
    case 'coins': {
      /* Coin category holds two very different beasts: Coin-Flip skins
         (`coinSkin` payload) and Daily-Rarity currencies (`currencySkin`). Both
         render as a CoinFace — the visual is the same, only the equip slot
         differs. Prefer whichever payload the item actually carries. */
      const coin = (
        <CoinFace skin={item.payload.coinSkin ?? item.payload.currencySkin ?? 'cn-classic'} face="heads" size={compact ? 44 : 84} />
      );
      if (compact) return coin;
      return (
        <div className="grid place-items-center gap-2">
          {coin}
          <p className="text-[10.5px] text-center max-w-[240px]" style={{ color: 'var(--muted)' }}>
            {t(item.payload.currencySkin ? 'vault.currencyCoinHint' : 'vault.coinsHint')}
          </p>
        </div>
      );
    }
    case 'reels': {
      const symbols = symbolsForTheme(item.payload.slotsTheme ?? 'sl-classic');
      return (
        <div
          className={`reel-well ${item.payload.slotsTheme ?? 'sl-classic'} flex items-center justify-center gap-1`}
          style={{ width: compact ? 68 : 132, height: compact ? 50 : 92, border: '1px solid', borderRadius: 'var(--r-sm)' }}
        >
          {[symbols[6], symbols[5], symbols[4]].map((symbol, i) => (
            <span key={i} style={{ fontSize: compact ? 15 : 26 }}>{symbol.glyph}</span>
          ))}
        </div>
      );
    }
    case 'emotes':
      return (
        <motion.span style={{ fontSize: compact ? 34 : 54 }} animate={{ y: [0, -8, 0], rotate: [0, -8, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}>
          {item.payload.emote}
        </motion.span>
      );
    case 'backgrounds': {
      // Miniature of the room background gradient — a "poster" of the actual scene.
      const bg = roomBackgroundOf(item.payload.roomBackground ?? null);
      return (
        <div
          style={{
            width: compact ? 100 : 190,
            height: compact ? 60 : 120,
            borderRadius: 10,
            background: bg.gradient,
            border: '1px solid rgba(255,255,255,.08)',
            boxShadow: `inset 0 0 40px ${bg.glowColor}`,
          }}
        />
      );
    }
    case 'decor':
      // Room decor is icon-only in the shop; the icon carries all the identity.
      return <span style={{ fontSize: compact ? 44 : 72, lineHeight: 1 }}>{item.icon}</span>;
    default:
      // clothing, glasses, watches, chains, frames — worn by your own avatar
      return (
        <Avatar
          config={{ ...profile.avatar, ...item.payload }}
          size={compact ? 62 : 118}
          level={profile.level}
          frame={item.category === 'frames' ? (item.payload.frame ?? null) : profile.equipped.frame}
          id={`prev-${item.id}`}
        />
      );
  }
}
