import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SceneShell } from '@/components/layout/SceneShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { LightPool } from '@/components/effects/LightPool';
import { ItemPreview } from './ItemPreview';
import { ITEMS, itemById } from '@/data/items';
import { discountedPrice } from '@/data/economy';
import { todaysDailyOffers, todaysRarityItem, PACKS, packPricing, timeUntilNextRotation, DAILY_DISCOUNT } from '@/data/shopOffers';
import { usePlayer } from '@/stores/usePlayer';
import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';
import { fmt } from '@/lib/format';
import { audio } from '@/audio/AudioManager';
import { chipGlyphOf } from '@/components/game/CoinFace';
import type { ShopItem } from '@/types';
import type { Pack } from '@/data/shopOffers';

const CATEGORIES = ['deals', 'all', 'cards', 'backs', 'chips', 'tables', 'clothing', 'glasses', 'watches', 'chains', 'frames', 'emotes', 'victory', 'dealers', 'coins', 'reels', 'backgrounds'] as const;
type Category = (typeof CATEGORIES)[number];

/** The vault: a room you walk into, with the door closing behind you. */
export default function VaultScene() {
  const navigate = useNavigate();
  const { t, lang } = useT();
  const profile = usePlayer((s) => s.profile);
  const owned = usePlayer((s) => s.owned);
  const buy = usePlayer((s) => s.buy);
  const equip = usePlayer((s) => s.equip);
  const toast = useUI((s) => s.toast);
  const chip = chipGlyphOf(profile.equipped.currencySkin);
  const [category, setCategory] = useState<Category>('deals');
  const [selected, setSelected] = useState<ShopItem | null>(null);
  const [packPreview, setPackPreview] = useState<Pack | null>(null);
  const [entered, setEntered] = useState(false);
  const [countdown, setCountdown] = useState(() => timeUntilNextRotation());

  /* Guaranteed way out of the entry overlay. The animation's onAnimationComplete
     was the only automatic trigger and it was seen never firing in the wild
     (prod: the rotate transform never even applied), leaving the overlay stuck
     over the whole shop forever. This timeout always clears it. */
  useEffect(() => {
    const id = setTimeout(() => setEntered(true), 2500);
    return () => clearTimeout(id);
  }, []);

  // Live countdown to next rotation, updates every second.
  useEffect(() => {
    if (category !== 'deals') return;
    const timer = setInterval(() => setCountdown(timeUntilNextRotation()), 1000);
    return () => clearInterval(timer);
  }, [category]);

  const dailyOffers = useMemo(() => todaysDailyOffers(), []);
  const rarityItem = useMemo(() => todaysRarityItem(), []);

  const items = useMemo(
    () => (category === 'deals'
      ? []
      : ITEMS.filter((item) => (category === 'all' || item.category === category) && !item.dailyRarityOnly)),
    [category],
  );

  /** Purchase a pack — buys each item in sequence, applies the extra discount. */
  const purchasePack = async (packId: string) => {
    const pack = PACKS.find((p) => p.id === packId);
    if (!pack) return;
    const { discountedPrice: totalPrice } = packPricing(pack);
    if (profile.chips < totalPrice) {
      audio.play('error');
      toast(t('vault.cantAfford', { amount: fmt(totalPrice - profile.chips) }), 'bad', '⚠');
      return;
    }
    // Buy each item in turn. Any failure leaves the ones already bought in the
    // inventory — the alternative would be a server-side buy_pack() RPC.
    let bought = 0;
    for (const itemId of pack.itemIds) {
      if (owned.includes(itemId)) continue;
      const result = await buy(itemId);
      if (result.ok) bought += 1;
    }
    if (bought > 0) {
      audio.play('bigWin');
      toast(t('vault.packBought', { name: pack.name[lang], count: bought }), 'good', pack.icon);
    } else {
      toast(t('vault.packAllOwned'), 'neutral', 'ℹ');
    }
  };

  const isEquipped = (item: ShopItem) =>
    Object.values(profile.equipped).includes(Object.values(item.payload)[0] as string);

  const purchase = async (item: ShopItem) => {
    const price = discountedPrice(item.price, profile.level);
    if (profile.chips < price) {
      audio.play('error');
      toast(t('vault.cantAfford', { amount: fmt(price - profile.chips) }), 'bad', '⚠');
      return;
    }
    const result = await buy(item.id);
    if (result.ok) {
      toast(t('vault.bought', { name: item.name[lang] }), 'good', item.icon);
      return;
    }
    /* A purchase that fails server-side used to do nothing at all — the button
       just looked broken. Always say why. */
    const messages: Record<string, string> = {
      owned: t('vault.alreadyOwned'),
      insufficient: t('vault.cantAfford', { amount: fmt(Math.max(0, price - profile.chips)) }),
      'not-signed-in': t('vault.signInToBuy'),
      'unknown-item': t('vault.buyFailed'),
      server: t('vault.buyFailed'),
    };
    /* Show the server's own words when nothing above explains it — an opaque
       "try again" on a repeatable failure is worse than a raw message. */
    const known = messages[result.reason ?? 'server'];
    toast(known ?? `${t('vault.buyFailed')} (${result.detail ?? result.reason})`, 'bad', '⚠');
  };

  return (
    <SceneShell compactHud particles={false}>
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, #241d10, #12100c 55%, #08090b 88%)' }} />
        <LightPool x="50%" y="14%" size={720} color="rgba(227,178,60,.18)" />
      </div>

      {/* the door swings open once, then you are inside. No AnimatePresence /
          exit animation here: the fade-out was seen getting stuck in prod,
          pinning the overlay at opacity:1 forever. Unmounting on `entered`
          is instant and can't hang. */}
      {!entered && (
          <motion.button
            className="fixed inset-0 z-[300] grid place-items-center"
            style={{ background: 'rgba(8,9,11,.96)' }}
            initial={{ opacity: 1 }}
            onAnimationStart={() => audio.play('vault')}
            onClick={() => setEntered(true)}
          >
            <motion.div
              className="text-center"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <motion.svg viewBox="0 0 150 150" width={190} height={190}
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                initial={{ rotate: 0 }} animate={{ rotate: 360 }} transition={{ duration: 2.2, ease: [0.3, 0, 0.2, 1] }}
                onAnimationComplete={() => setTimeout(() => setEntered(true), 250)}>
                <circle cx="75" cy="75" r="62" fill="#14161b" stroke="rgba(227,178,60,.5)" strokeWidth="3" />
                <circle cx="75" cy="75" r="40" fill="none" stroke="#e3b23c" strokeWidth="4" />
                {[0, 90, 180, 270].map((angle) => (
                  <rect key={angle} x="71" y="24" width="8" height="24" rx="4" fill="#f8e3a8" transform={`rotate(${angle} 75 75)`} />
                ))}
                <circle cx="75" cy="75" r="12" fill="#8a6a1f" />
              </motion.svg>
              <div className="eyebrow mt-3">{t('loading.vault')}</div>
              <div className="text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>{t('vault.tapToEnter')}</div>
            </motion.div>
          </motion.button>
      )}

      <div className="mx-auto px-4 py-3" style={{ maxWidth: 1140 }}>
        <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
          <div>
            <span className="eyebrow">{t('vault.title')}</span>
            <h1 className="mt-1">THE VAULT</h1>
            <p className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>{t('vault.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <GlassPanel animate={false} gold className="px-4 py-2.5">
              <div className="eyebrow" style={{ fontSize: 9 }}>{t('vault.myChips')}</div>
              <b className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--gold-hi)' }}>{fmt(profile.chips)}</b>
            </GlassPanel>
            <GameButton tone="ghost" onClick={() => navigate('/inventory')}>{t('profile.title')}</GameButton>
          </div>
        </div>

        <div className="mb-4">
          <Tabs<Category>
            value={category}
            onChange={setCategory}
            tabs={CATEGORIES.map((key) => ({ key, label: t(`vault.categories.${key}`) }))}
          />
          {(category === 'coins' || category === 'chips') && (
            <p className="text-[11.5px] mt-2" style={{ color: 'var(--muted)' }}>
              {t(category === 'coins' ? 'vault.coinsHint' : 'vault.chipsHint')}
            </p>
          )}
        </div>

        {/* Deals section — shown only when the Deals tab is active. */}
        {category === 'deals' && (
          <div className="flex flex-col gap-6 mb-4">
            {/* Countdown to next rotation */}
            <div className="text-center">
              <span className="eyebrow" style={{ color: 'var(--gold-hi)' }}>
                🕒 {t('vault.nextRotationIn')}
              </span>
              <b className="block num mt-1" style={{ fontSize: 22, fontFamily: 'var(--font-display)', color: 'var(--gold-hi)' }}>
                {countdown}
              </b>
            </div>

            {/* Daily Rarity — an exclusive item that only appears here, once per day */}
            {rarityItem && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[22px]">🌟</span>
                  <div>
                    <b className="text-[14px]">{t('vault.dailyRarity')}</b>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{t('vault.dailyRarityHint')}</p>
                  </div>
                </div>
                <RareRotationCard item={rarityItem} onOpen={setSelected} owned={owned.includes(rarityItem.id)} lang={lang} t={t} equippedCoin={profile.equipped.currencySkin} exclusive />
              </div>
            )}

            {/* Special Packs */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[22px]">🎁</span>
                <div>
                  <b className="text-[14px]">{t('vault.specialPacks')}</b>
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{t('vault.specialPacksHint')}</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {PACKS.map((pack) => {
                  const pricing = packPricing(pack);
                  const alreadyOwnAll = pack.itemIds.every((id) => owned.includes(id));
                  return (
                    <div
                      key={pack.id}
                      className="p-3 rounded-[var(--r-sm)]"
                      style={{
                        background: `linear-gradient(135deg, ${pack.color}22, rgba(0,0,0,.15))`,
                        border: `1px solid ${pack.color}66`,
                      }}
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        <span className="text-[28px]">{pack.icon}</span>
                        <div className="flex-1 min-w-0">
                          <b className="text-[13.5px] block truncate">{pack.name[lang]}</b>
                          <p className="text-[11px] truncate" style={{ color: 'var(--muted)' }}>{pack.subtitle[lang]}</p>
                        </div>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-black"
                          style={{ background: 'var(--crimson)', color: '#fff' }}
                        >
                          -{Math.round(pack.discount * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2 text-[12px]">
                        <span className="line-through opacity-60 num">{fmt(pricing.fullPrice)}</span>
                        <b className="num" style={{ color: 'var(--gold-hi)', fontSize: 15 }}>{chip} {fmt(pricing.discountedPrice)}</b>
                      </div>
                      {/* Show the mini item icons so players know what's inside before opening the preview */}
                      <div className="flex items-center gap-1 mb-2 flex-wrap">
                        {pack.itemIds.map((id) => {
                          const it = itemById(id);
                          const isOwned = owned.includes(id);
                          return (
                            <div
                              key={id}
                              className="w-7 h-7 rounded-full grid place-items-center text-[14px]"
                              style={{
                                background: 'rgba(0,0,0,.35)',
                                border: `1px solid ${isOwned ? 'var(--jade)' : 'rgba(255,255,255,.12)'}`,
                                opacity: isOwned ? 0.55 : 1,
                              }}
                              title={it?.name[lang] ?? ''}
                            >
                              {it?.icon ?? '?'}
                            </div>
                          );
                        })}
                      </div>
                      <GameButton
                        tone={alreadyOwnAll ? 'ghost' : 'metal'}
                        block
                        size="sm"
                        onClick={() => { audio.play('click'); setPackPreview(pack); }}
                      >
                        {alreadyOwnAll ? t('vault.packAllOwned') : t('vault.previewPack')}
                      </GameButton>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Daily Offers */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[22px]">🔥</span>
                <div>
                  <b className="text-[14px]">{t('vault.dailyOffers')}</b>
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                    {t('vault.dailyOffersHint', { pct: Math.round(DAILY_DISCOUNT * 100) })}
                  </p>
                </div>
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(158px,1fr))' }}>
                {dailyOffers.map(({ item, discount }) => {
                  const has = owned.includes(item.id);
                  const dailyPrice = Math.floor(item.price * (1 - discount));
                  return (
                    <button
                      key={item.id}
                      className={`relative p-3 rounded-[var(--r-md)] text-center rar-card rar-${item.rarity} press`}
                      style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--rar) 11%, transparent), rgba(255,255,255,.02))' }}
                      onClick={() => { audio.play('click'); setSelected(item); }}
                    >
                      <span
                        className="absolute top-2 start-2 px-1.5 py-0.5 rounded-full text-[9px] font-black"
                        style={{ background: 'var(--crimson)', color: '#fff' }}
                      >
                        -{Math.round(discount * 100)}%
                      </span>
                      <div className="h-[80px] grid place-items-center mb-2 rounded-[var(--r-xs)]" style={{ background: 'rgba(0,0,0,.3)' }}>
                        <ItemPreview item={item} compact />
                      </div>
                      <b className="block text-[12.5px] truncate">{item.name[lang]}</b>
                      <div className="mt-1 text-[12px] num font-bold flex items-center justify-center gap-1.5" style={{ color: has ? 'var(--jade-hi)' : 'var(--gold-hi)' }}>
                        {has ? t('vault.owned') : (
                          <>
                            <span className="line-through opacity-50 font-normal">{fmt(item.price)}</span>
                            {fmt(dailyPrice)}
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* display cases */}
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(158px,1fr))' }}>
          {items.map((item, index) => {
            const has = owned.includes(item.id);
            const worn = has && isEquipped(item);
            const price = discountedPrice(item.price, profile.level);
            const discounted = price < item.price;
            return (
              <motion.button
                key={item.id}
                className={`relative p-3 rounded-[var(--r-md)] text-center rar-card rar-${item.rarity}`}
                style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--rar) 11%, transparent), rgba(255,255,255,.02))' }}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(0.4, index * 0.02) }}
                whileHover={{ y: -5 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { audio.play('click'); setSelected(item); }}
              >
                {worn && (
                  <span className="absolute top-2 start-2 px-2 rounded-full text-[9.5px] font-black"
                    style={{ background: 'var(--jade)', color: '#03150c' }}>{t('vault.equipped')}</span>
                )}
                <div className="h-[86px] grid place-items-center mb-2 rounded-[var(--r-xs)]" style={{ background: 'rgba(0,0,0,.3)' }}>
                  <ItemPreview item={item} compact />
                </div>
                <div className="text-[9.5px] font-bold tracking-[.18em] uppercase" style={{ color: 'var(--rar)' }}>
                  {t(`vault.rarity.${item.rarity}`)}
                </div>
                <b className="block text-[12.5px] truncate" style={{ fontFamily: 'var(--font-display)' }}>{item.name[lang]}</b>
                {item.desc && (
                  <p className="text-[10px] mt-1 opacity-70 min-h-5" style={{ lineHeight: 1.3 }}>{item.desc[lang]}</p>
                )}
                <div className="mt-1.5 text-[12px] num font-bold flex items-center justify-center gap-1.5" style={{ color: has ? 'var(--jade-hi)' : 'var(--gold-hi)' }}>
                  {has ? (
                    t('vault.owned')
                  ) : item.price === 0 ? '—' : (
                    <>
                      {discounted && <span className="line-through opacity-50 font-normal">{fmt(item.price)}</span>}
                      {fmt(price)}
                    </>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* preview table */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name[lang]} width={460}
        subtitle={selected ? t(`vault.rarity.${selected.rarity}`) : undefined}>
        {selected && (
          <>
            <div className="rounded-[var(--r-md)] p-4 mb-4 grid place-items-center" style={{ background: 'rgba(0,0,0,.35)', minHeight: 180 }}>
              <ItemPreview item={selected} />
            </div>
            {owned.includes(selected.id) ? (
              <GameButton tone={isEquipped(selected) ? 'ghost' : 'gold'} size="lg" block
                disabled={isEquipped(selected)}
                onClick={() => { equip(selected.id); setSelected(null); }}>
                {isEquipped(selected) ? t('vault.equipped') : t('vault.equip')}
              </GameButton>
            ) : (
              <GameButton tone="gold" size="lg" block disabled={profile.chips < discountedPrice(selected.price, profile.level)}
                onClick={() => purchase(selected)}>
                {t('vault.buy')} · {chip} {fmt(discountedPrice(selected.price, profile.level))}
                {discountedPrice(selected.price, profile.level) < selected.price && (
                  <span className="line-through opacity-60 ms-1.5">{fmt(selected.price)}</span>
                )}
              </GameButton>
            )}
          </>
        )}
      </Modal>

      {/* Pack preview — see every item and simulate equipping before spending chips */}
      {packPreview && (
        <PackPreviewModal
          pack={packPreview}
          owned={owned}
          equipped={profile.equipped}
          canAfford={profile.chips >= packPricing(packPreview).discountedPrice}
          onClose={() => setPackPreview(null)}
          onBuy={async () => {
            const packId = packPreview.id;
            setPackPreview(null);
            await purchasePack(packId);
          }}
          onSelectItem={(item) => { setPackPreview(null); setSelected(item); }}
          lang={lang}
          t={t}
        />
      )}
    </SceneShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Pack preview — expands a pack into every item inside, with a full ItemPreview
   for the currently focused one so the player can see exactly what they'll   */
/* wear before spending chips.                                                */
/* -------------------------------------------------------------------------- */
interface PackPreviewProps {
  pack: Pack;
  owned: string[];
  equipped: import('@/types').Equipped;
  canAfford: boolean;
  onClose: () => void;
  onBuy: () => void;
  onSelectItem: (item: ShopItem) => void;
  lang: 'he' | 'en';
  t: (key: string, params?: Record<string, string | number>) => string;
}

function PackPreviewModal({ pack, owned, equipped, canAfford, onClose, onBuy, onSelectItem, lang, t }: PackPreviewProps) {
  const packItems = pack.itemIds.map((id) => itemById(id)).filter((x): x is ShopItem => !!x);
  const [focusIdx, setFocusIdx] = useState(0);
  const focus = packItems[focusIdx];
  const pricing = packPricing(pack);
  const alreadyOwnAll = pack.itemIds.every((id) => owned.includes(id));
  const chip = chipGlyphOf(equipped.currencySkin);

  return (
    <Modal open onClose={onClose} title={pack.name[lang]} subtitle={pack.subtitle[lang]} width={520}>
      {/* Focused item preview */}
      {focus && (
        <div
          className="rounded-[var(--r-md)] p-4 mb-3 grid place-items-center relative"
          style={{ background: 'rgba(0,0,0,.4)', minHeight: 170, border: `1px solid ${pack.color}55` }}
        >
          <ItemPreview item={focus} />
          <div className="absolute top-2 start-2 text-[10px] tracking-wider uppercase" style={{ color: 'var(--rar)' }}>
            {t(`vault.rarity.${focus.rarity}`)}
          </div>
          <div className="absolute bottom-2 start-2 end-2 text-center">
            <b className="text-[13px]" style={{ fontFamily: 'var(--font-display)' }}>{focus.name[lang]}</b>
            {focus.desc && (
              <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--muted)' }}>{focus.desc[lang]}</p>
            )}
          </div>
        </div>
      )}

      {/* Item strip — tap any to focus the preview */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
        {packItems.map((item, idx) => {
          const isOwned = owned.includes(item.id);
          const active = idx === focusIdx;
          return (
            <button
              key={item.id}
              onClick={() => { audio.play('hover'); setFocusIdx(idx); }}
              onDoubleClick={() => onSelectItem(item)}
              className="relative flex-none rounded-[var(--r-xs)] p-2 grid place-items-center"
              style={{
                width: 64, height: 64,
                background: active ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.3)',
                border: `1px solid ${active ? pack.color : (isOwned ? 'var(--jade)' : 'rgba(255,255,255,.12)')}`,
                opacity: isOwned ? 0.55 : 1,
              }}
              title={item.name[lang]}
            >
              <span className="text-[22px]">{item.icon}</span>
              {isOwned && (
                <span
                  className="absolute -top-1 -end-1 w-4 h-4 rounded-full text-[9px] font-black grid place-items-center"
                  style={{ background: 'var(--jade)', color: '#03150c' }}
                >✓</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Price breakdown */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div>
          <div className="text-[10px] tracking-wider uppercase" style={{ color: 'var(--muted)' }}>
            {t('vault.packContents', { count: packItems.length })}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="line-through opacity-60 num text-[13px]">{fmt(pricing.fullPrice)}</span>
            <b className="num" style={{ color: 'var(--gold-hi)', fontSize: 20, fontFamily: 'var(--font-display)' }}>
              {chip} {fmt(pricing.discountedPrice)}
            </b>
          </div>
        </div>
        <span
          className="px-2.5 py-1 rounded-full text-[11px] font-black"
          style={{ background: 'var(--crimson)', color: '#fff' }}
        >
          -{Math.round(pack.discount * 100)}%
        </span>
      </div>

      <div className="flex gap-2">
        <GameButton tone="ghost" size="lg" block onClick={onClose}>
          {t('common.back')}
        </GameButton>
        <GameButton
          tone="gold"
          size="lg"
          block
          disabled={alreadyOwnAll || !canAfford}
          onClick={onBuy}
        >
          {alreadyOwnAll ? t('vault.packAllOwned') : (canAfford ? t('vault.buyPack') : t('vault.notEnough'))}
        </GameButton>
      </div>
    </Modal>
  );
}

interface RareCardProps {
  item: ShopItem;
  owned: boolean;
  lang: 'he' | 'en';
  onOpen: (item: ShopItem) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** exclusive = only available here; shows a stronger visual treatment. */
  exclusive?: boolean;
  /** Equipped coin skin — the price glyph follows it (currency coins only). */
  equippedCoin?: string | null;
}

function RareRotationCard({ item, owned, lang, onOpen, t, exclusive = false, equippedCoin }: RareCardProps) {
  return (
    <motion.button
      className={`relative w-full p-4 rounded-[var(--r-md)] rar-card rar-${item.rarity} press flex items-center gap-4 overflow-hidden`}
      style={{
        background: exclusive
          ? 'linear-gradient(120deg, color-mix(in srgb, var(--rar) 35%, transparent), rgba(168,120,240,.14))'
          : 'linear-gradient(120deg, color-mix(in srgb, var(--rar) 22%, transparent), rgba(0,0,0,.15))',
        boxShadow: exclusive
          ? '0 8px 26px rgba(0,0,0,.32), 0 0 0 1px rgba(255,215,80,.2)'
          : '0 6px 20px rgba(0,0,0,.28)',
      }}
      onClick={() => onOpen(item)}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
    >
      {exclusive && (
        <span
          className="absolute top-2 end-2 px-2 py-0.5 rounded-full text-[9.5px] font-black tracking-wider"
          style={{
            background: 'linear-gradient(90deg, var(--gold), var(--gold-hi))',
            color: '#1a1206',
            boxShadow: '0 2px 6px rgba(0,0,0,.35)',
          }}
        >
          {t('vault.exclusiveTag')}
        </span>
      )}
      <div className="grid place-items-center rounded-[var(--r-xs)]" style={{ width: 92, height: 92, background: 'rgba(0,0,0,.35)' }}>
        <ItemPreview item={item} compact />
      </div>
      <div className="flex-1 text-start min-w-0">
        <div className="text-[10px] tracking-wider uppercase" style={{ color: 'var(--rar)' }}>
          {t(`vault.rarity.${item.rarity}`)} · {exclusive ? t('vault.exclusiveOnly') : t('vault.limitedToday')}
        </div>
        <b className="block text-[15px] mt-0.5 truncate" style={{ fontFamily: 'var(--font-display)' }}>{item.name[lang]}</b>
        {item.desc && (
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{item.desc[lang]}</p>
        )}
        {item.payload.currencySkin && (
          <p className="text-[10.5px] mt-1" style={{ color: 'var(--gold-hi)' }}>{t('vault.currencyCoinHint')}</p>
        )}
        <div className="mt-2 num font-bold" style={{ color: owned ? 'var(--jade-hi)' : 'var(--gold-hi)', fontSize: 15 }}>
          {owned ? t('vault.owned') : `${chipGlyphOf(equippedCoin)} ${item.price.toLocaleString()}`}
        </div>
      </div>
    </motion.button>
  );
}
