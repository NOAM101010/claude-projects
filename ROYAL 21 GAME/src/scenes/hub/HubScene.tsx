import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SceneShell } from '@/components/layout/SceneShell';
import { HubCard } from './HubCard';
import {
  BlackjackTableArt, CoinStandArt, DuelTableArt, GameNightArt, GiftArt, HighCardArt,
  LoungeArt, MyRoomDoorArt, PokerTableArt, RouletteTableArt, ScratchCounterArt, SlotMachineArt, VaultDoorArt,
} from './hubObjects';
import { LightPool } from '@/components/effects/LightPool';
import { GameButton } from '@/components/ui/GameButton';
import { Modal } from '@/components/ui/Modal';
import { Onboarding } from '@/components/ui/Onboarding';
import { PrivatePokerModal } from '@/components/game/PrivatePokerModal';
import { usePlayer } from '@/stores/usePlayer';
import { useSocial } from '@/stores/useSocial';
import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';
import { todayKey, fmt } from '@/lib/format';
import { audio } from '@/audio/AudioManager';
import { STREAK_REWARD, STREAK_MILESTONES, isStreakMilestone, nextStreakDay } from '@/data/economy';
import { isVipEligible } from '@/data/vip';
import { SNG_BUYINS } from '@/games/poker/engine';

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mt-7 first:mt-2">
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="text-[17px]" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
        {hint && <span className="text-[11.5px]" style={{ color: 'var(--dim)' }}>{hint}</span>}
      </div>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 210px), 1fr))' }}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * The hub: every room in the game, laid out so nothing overlaps.
 *
 * This used to be a floor plan of absolutely positioned objects at fixed
 * percentage coordinates. It looked right at one viewport shape and stacked the
 * objects on top of each other at every other — which is what it was doing on
 * the reporter's screen. The art is the same; the geometry is now a grid, so
 * the room reflows instead of collapsing.
 */
export default function HubScene() {
  const navigate = useNavigate();
  const { t } = useT();
  const profile = usePlayer((s) => s.profile);
  const daily = usePlayer((s) => s.daily);
  const claimDaily = usePlayer((s) => s.claimDaily);
  const addXp = usePlayer((s) => s.addXp);
  const allFriends = useSocial((s) => s.friends);
  const friends = useMemo(() => allFriends.filter((f) => f.presence !== 'offline'), [allFriends]);
  const toast = useUI((s) => s.toast);
  const showMoment = useUI((s) => s.showMoment);
  const [giftOpen, setGiftOpen] = useState(() => new URLSearchParams(window.location.search).get('gift') === '1');
  const [sngOpen, setSngOpen] = useState(false);
  const [rouletteOpen, setRouletteOpen] = useState(false);
  const [pokerOpen, setPokerOpen] = useState(false);

  const giftReady = daily.lastClaim !== todayKey();
  const previewDay = nextStreakDay(daily);
  const vipEligible = isVipEligible(profile);
  const previewChips = STREAK_REWARD(previewDay);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('gift')) return;
    url.searchParams.delete('gift');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const takeGift = () => {
    const result = claimDaily();
    if (!result) return;
    audio.duck(1200);
    audio.play('bigWin');
    addXp(15);
    showMoment(
      result.comeback
        ? { kind: 'bigWin', title: t('hub.comebackTitle'), subtitle: `+${fmt(result.chips)}`, icon: '👋', duration: 2400 }
        : { kind: 'bigWin', title: t('hub.gift'), subtitle: `+${fmt(result.chips)}`, icon: '🎁', duration: 2000 },
    );
    setGiftOpen(false);
  };

  return (
    <SceneShell>
      {/* ---------- background: floor, back wall, light rigging ---------- */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% -10%, #16211c, #0b0f0d 45%, #08090b 80%)' }} />
        <div className="absolute inset-x-0 bottom-0 h-[46%]" style={{ background: 'linear-gradient(0deg, #0e1815, transparent)' }} />
        <motion.div animate={{ opacity: [0.75, 1, 0.75] }} transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}>
          <LightPool x="50%" y="24%" size={760} color="rgba(227,178,60,.15)" />
          <LightPool x="14%" y="52%" size={420} color="rgba(227,178,60,.10)" />
          <LightPool x="86%" y="62%" size={420} color="rgba(74,168,200,.09)" />
        </motion.div>
      </div>

      <div className="mx-auto px-4 pt-1" style={{ maxWidth: 1180 }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="eyebrow">{t('hub.eyebrow')}</span>
            <h1 className="mt-1 text-[clamp(24px,4vw,38px)]">{t('hub.welcome', { name: profile.username })}</h1>
          </div>
          <div className="flex items-center gap-2">
            <GameButton tone="metal" size="sm" onClick={() => navigate('/lobby')}>
              🎰 {t('lobby.openTables')}
            </GameButton>
            <GameButton
              tone={giftReady ? 'gold' : 'ghost'}
              size="sm"
              onClick={() => (giftReady ? setGiftOpen(true) : toast(t('hub.giftTaken'), 'neutral', '🎁'))}
            >
              🔥 {daily.day} · {giftReady ? t('hub.giftReady') : t('hub.giftTaken')}
            </GameButton>
          </div>
        </div>

        {/* ---------------------------- the tables --------------------------- */}
        <Section title={t('hub.sectionTables')} hint={t('hub.sectionTablesHint')}>
          <HubCard
            span={2}
            label={t('hub.blackjack')}
            action={t('hub.sitDown')}
            blurb={t('hub.blurbBlackjack')}
            hoverSound="card"
            onEnter={() => navigate('/blackjack/solo')}
          >
            {(focused) => <BlackjackTableArt focused={focused} dealerSkin={profile.equipped.dealerSkin ?? 'dl-house'} />}
          </HubCard>

          <HubCard
            label={t('duel.title')}
            action={t('hub.challenge')}
            blurb={t('hub.blurbDuel')}
            hoverSound="chip"
            glow="rgba(74,168,200,.26)"
            onEnter={() => navigate('/room/new?game=duel')}
          >
            {(focused) => <DuelTableArt focused={focused} />}
          </HubCard>

          <HubCard
            span={2}
            label={t('poker.title')}
            action={t('poker.sitDown')}
            blurb={t('poker.subtitle')}
            badge={t('hub.badgeNew')}
            hoverSound="chip"
            glow="rgba(46,158,107,.28)"
            onEnter={() => setPokerOpen(true)}
          >
            {(focused) => <PokerTableArt focused={focused} />}
          </HubCard>

          <HubCard
            label={t('sng.title')}
            action={t('sng.register')}
            blurb={t('sng.blurb')}
            badge={t('hub.badgeNew')}
            hoverSound="chip"
            glow="rgba(227,178,60,.3)"
            onEnter={() => setSngOpen(true)}
          >
            {(focused) => <PokerTableArt focused={focused} />}
          </HubCard>

          <HubCard
            label={t('roulette.title')}
            action={t('roulette.play')}
            blurb={t('hub.blurbRoulette')}
            badge={t('hub.badgeNew')}
            hoverSound="chip"
            glow="rgba(168,65,62,.26)"
            onEnter={() => setRouletteOpen(true)}
          >
            {(focused) => <RouletteTableArt focused={focused} />}
          </HubCard>

          <HubCard
            label={t('hub.gameNight')}
            action={t('hub.hostNight')}
            blurb={t('hub.blurbNight')}
            badge={t('hub.badgeNew')}
            hoverSound="notify"
            glow="rgba(123,91,214,.26)"
            onEnter={() => navigate('/night/new')}
          >
            {(focused) => <GameNightArt focused={focused} />}
          </HubCard>
        </Section>

        {/* --------------------------- quick games --------------------------- */}
        <Section title={t('hub.sectionQuick')} hint={t('hub.sectionQuickHint')}>
          <HubCard
            label={t('hub.slots')}
            action={t('hub.spin')}
            blurb={t('hub.blurbSlots')}
            badge={t('hub.badgeNew')}
            hoverSound="chip"
            onEnter={() => navigate('/game/slots')}
          >
            {(focused) => <SlotMachineArt focused={focused} />}
          </HubCard>

          <HubCard
            label={t('games.coinflip')}
            action={t('hub.flip')}
            blurb={t('hub.blurbCoin')}
            hoverSound="coin"
            onEnter={() => navigate('/game/coinflip')}
          >
            {(focused) => <CoinStandArt focused={focused} />}
          </HubCard>

          <HubCard
            label={t('games.highcard')}
            action={t('hub.draw')}
            blurb={t('hub.blurbHighcard')}
            hoverSound="card"
            onEnter={() => navigate('/game/highcard')}
          >
            {(focused) => <HighCardArt focused={focused} />}
          </HubCard>

          <HubCard
            label={t('games.baccarat')}
            action={t('baccarat.deal')}
            blurb={t('games.baccaratHint')}
            hoverSound="card"
            onEnter={() => navigate('/game/baccarat')}
          >
            {(focused) => <HighCardArt focused={focused} />}
          </HubCard>

          <HubCard
            label={t('hub.counter')}
            action={t('hub.scratchIt')}
            blurb={t('hub.blurbScratch')}
            hoverSound="scratch"
            onEnter={() => navigate('/game/scratch')}
          >
            {(focused) => <ScratchCounterArt focused={focused} />}
          </HubCard>
        </Section>

        {/* ---------------------------- your place --------------------------- */}
        <Section title={t('hub.sectionYours')} hint={t('hub.sectionYoursHint')}>
          <HubCard
            label={t('hub.lounge')}
            action={t('friends.title')}
            blurb={friends.length ? t('hub.blurbLoungeLive', { count: friends.length }) : t('hub.blurbLounge')}
            hoverSound="notify"
            glow="rgba(74,168,200,.24)"
            onEnter={() => useUI.getState().openPanel('friends')}
          >
            {(focused) => <LoungeArt friends={friends} focused={focused} />}
          </HubCard>

          <HubCard
            label={t('hub.vault')}
            action={t('hub.openVault')}
            blurb={t('hub.blurbVault')}
            hoverSound="vault"
            onEnter={() => navigate('/vault')}
          >
            {(focused) => <VaultDoorArt focused={focused} />}
          </HubCard>

          <HubCard
            label={t('vip.title')}
            action={vipEligible ? t('vip.enter') : t('vip.locked')}
            blurb={vipEligible ? t('vip.blurbUnlocked') : t('vip.blurbLocked')}
            hoverSound="vault"
            badge={vipEligible ? '👑' : undefined}
            glow="rgba(227,178,60,.28)"
            onEnter={() => navigate('/vip')}
          >
            {(focused) => (
              <div className="relative w-full h-full grid place-items-center" style={{ minHeight: 120 }}>
                <div
                  className="text-[60px]"
                  style={{
                    opacity: focused ? 1 : 0.85,
                    filter: `drop-shadow(0 6px 22px rgba(227,178,60,${focused ? 0.6 : 0.35}))`,
                    transition: 'all .3s',
                    transform: focused ? 'scale(1.08)' : 'scale(1)',
                  }}
                >
                  {vipEligible ? '👑' : '🔒'}
                </div>
              </div>
            )}
          </HubCard>

          <HubCard
            label={t('hub.myRoom')}
            action={t('hub.enterRoom')}
            blurb={t('hub.blurbMyRoom')}
            hoverSound="vault"
            onEnter={() => navigate(`/profile/${profile.id}`)}
          >
            {(focused) => <MyRoomDoorArt focused={focused} name={profile.username} />}
          </HubCard>

          <HubCard
            label={t('hub.gift')}
            action={giftReady ? t('hub.giftReady') : t('hub.giftTaken')}
            blurb={t('hub.blurbGift')}
            hoverSound="notify"
            onEnter={() => (giftReady ? setGiftOpen(true) : toast(t('hub.giftTaken'), 'neutral', '🎁'))}
          >
            {() => <GiftArt ready={giftReady} />}
          </HubCard>
        </Section>
      </div>

      {/* First visit only; Settings can replay it. */}
      <Onboarding />

      <Modal open={giftOpen} onClose={() => setGiftOpen(false)} title={t('hub.gift')}>
        <div className="text-center">
          <motion.div
            className="text-[64px]"
            animate={isStreakMilestone(previewDay) ? { rotate: [0, -12, 12, 0], scale: [1, 1.15, 1] } : { rotate: [0, -6, 6, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {isStreakMilestone(previewDay) ? '🏆' : '🎁'}
          </motion.div>
          <p className="mt-2 mb-1" style={{ color: 'var(--muted)' }}>
            🔥 {t('hub.streakDay', { day: previewDay })}
          </p>
          <p
            className="mt-1 mb-2 num text-[28px] font-black"
            style={{
              color: isStreakMilestone(previewDay) ? 'var(--gold-hi)' : 'var(--text)',
              fontFamily: 'var(--font-display)',
            }}
          >
            +{fmt(previewChips)}
          </p>
          {isStreakMilestone(previewDay) && (
            <p className="text-[12px] mb-3" style={{ color: 'var(--gold-hi)' }}>
              ✨ {t('hub.streakMilestone', { day: previewDay })}
            </p>
          )}
          {/* Preview of upcoming milestones — motivation to keep the streak alive */}
          <div className="flex justify-center gap-2 mb-4 mt-3">
            {STREAK_MILESTONES.map((day) => (
              <div
                key={day}
                className="px-2 py-1 rounded text-[10.5px]"
                style={{
                  background: previewDay >= day ? 'rgba(227,178,60,.20)' : 'var(--glass)',
                  border: `1px solid ${previewDay >= day ? 'var(--gold-line)' : 'var(--glass-line)'}`,
                  color: previewDay >= day ? 'var(--gold-hi)' : 'var(--dim)',
                  opacity: previewDay >= day ? 1 : 0.6,
                }}
              >
                {previewDay >= day ? '✅' : '🎯'} {t('hub.streakDay', { day })}
              </div>
            ))}
          </div>
          <GameButton tone="gold" size="lg" block onClick={takeGift}>{t('moments.collect')}</GameButton>
        </div>
      </Modal>

      <Modal open={rouletteOpen} onClose={() => setRouletteOpen(false)} title={t('roulette.title')}>
        <p className="text-center mb-4 text-[12.5px]" style={{ color: 'var(--muted)' }}>{t('roulette.modePrompt')}</p>
        <div className="flex flex-col gap-2">
          <GameButton tone="gold" size="lg" block onClick={() => { setRouletteOpen(false); navigate('/game/roulette/solo'); }}>
            {t('roulette.solo')}
          </GameButton>
          <GameButton tone="jade" size="lg" block onClick={() => { setRouletteOpen(false); navigate('/game/roulette/room/new'); }}>
            {t('roulette.withFriends')}
          </GameButton>
        </div>
      </Modal>

      <PrivatePokerModal open={pokerOpen} onClose={() => setPokerOpen(false)} />

      <Modal open={sngOpen} onClose={() => setSngOpen(false)} title={t('sng.title')}>
        <p className="text-center mb-4 text-[12.5px]" style={{ color: 'var(--muted)' }}>{t('sng.buyInPrompt')}</p>
        <div className="flex flex-col gap-2">
          {SNG_BUYINS.map((amount) => (
            <GameButton
              key={amount}
              tone={amount === SNG_BUYINS[1] ? 'gold' : 'metal'}
              disabled={amount > profile.chips}
              onClick={() => { setSngOpen(false); navigate(`/poker/sng/new?buyIn=${amount}`); }}
            >
              {fmt(amount)}
            </GameButton>
          ))}
        </div>
      </Modal>
    </SceneShell>
  );
}
