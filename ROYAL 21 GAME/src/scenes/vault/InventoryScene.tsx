import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SceneShell } from '@/components/layout/SceneShell';
import { GameButton } from '@/components/ui/GameButton';
import { Tabs } from '@/components/ui/Tabs';
import { ItemPreview } from './ItemPreview';
import { ITEMS } from '@/data/items';
import { usePlayer } from '@/stores/usePlayer';
import { useT } from '@/hooks/useT';
import { audio } from '@/audio/AudioManager';

const CATEGORIES = ['all', 'cards', 'backs', 'chips', 'tables', 'clothing', 'frames', 'emotes', 'victory', 'dealers', 'coins', 'reels'] as const;
type Category = (typeof CATEGORIES)[number];

export default function InventoryScene() {
  const navigate = useNavigate();
  const { t, lang } = useT();
  const profile = usePlayer((s) => s.profile);
  const owned = usePlayer((s) => s.owned);
  const favorites = usePlayer((s) => s.favorites);
  const equip = usePlayer((s) => s.equip);
  const toggleFavorite = usePlayer((s) => s.toggleFavorite);
  const [category, setCategory] = useState<Category>('all');

  const items = useMemo(
    () => ITEMS.filter((item) => owned.includes(item.id) && (category === 'all' || item.category === category)),
    [owned, category],
  );

  const isEquipped = (payload: object) =>
    Object.values(profile.equipped).includes(Object.values(payload)[0] as string);

  return (
    <SceneShell compactHud>
      <div className="mx-auto px-4 py-3" style={{ maxWidth: 1040 }}>
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <span className="eyebrow">{t('profile.title')}</span>
            <h1 className="mt-1">{t('vault.categories.all')}</h1>
          </div>
          <GameButton tone="ghost" onClick={() => navigate('/vault')}>{t('vault.title')}</GameButton>
        </div>

        <div className="mb-4">
          <Tabs<Category> value={category} onChange={setCategory}
            tabs={CATEGORIES.map((key) => ({ key, label: t(`vault.categories.${key}`) }))} />
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-[42px] mb-2 ambient-float">🗄️</div>
            <p style={{ color: 'var(--muted)' }}>{t('vault.empty')}</p>
            <GameButton tone="gold" className="mt-4" onClick={() => navigate('/vault')}>{t('vault.title')}</GameButton>
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))' }}>
            {items.map((item) => {
              const worn = isEquipped(item.payload);
              return (
                <motion.div key={item.id}
                  className={`relative p-3 rounded-[var(--r-md)] text-center rar-card rar-${item.rarity}`}
                  style={{ background: 'rgba(255,255,255,.03)' }}
                  whileHover={{ y: -4 }}>
                  <button
                    className="absolute top-2 end-2 text-[14px]"
                    onClick={() => { audio.play('click'); toggleFavorite(item.id); }}
                    aria-label={t('vault.favorite')}
                  >
                    {favorites.includes(item.id) ? '★' : '☆'}
                  </button>
                  <div className="h-[82px] grid place-items-center mb-2 rounded-[var(--r-xs)]" style={{ background: 'rgba(0,0,0,.28)' }}>
                    <ItemPreview item={item} compact />
                  </div>
                  <b className="block text-[12.5px] truncate mb-2" style={{ fontFamily: 'var(--font-display)' }}>{item.name[lang]}</b>
                  <GameButton size="sm" block tone={worn ? 'ghost' : 'gold'} disabled={worn || item.category === 'emotes'}
                    onClick={() => equip(item.id)}>
                    {item.category === 'emotes' ? '😎' : worn ? t('vault.equipped') : t('vault.equip')}
                  </GameButton>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </SceneShell>
  );
}
