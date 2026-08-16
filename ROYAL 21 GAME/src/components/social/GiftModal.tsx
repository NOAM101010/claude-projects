import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { GameButton } from '@/components/ui/GameButton';
import { giftService } from '@/services/giftService';
import { usePlayer } from '@/stores/usePlayer';
import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';
import { fmt } from '@/lib/format';
import { GIFT_DAILY_LIMIT } from '@/data/economy';
import { audio } from '@/audio/AudioManager';
import type { Friend } from '@/types';

const QUICK_AMOUNTS = [50, 100, 250, 500];

const reasonKey: Record<string, string> = {
  self: 'friends.giftSelf',
  'invalid-amount': 'friends.giftInvalid',
  limit: 'friends.giftLimit',
  insufficient: 'friends.giftInsufficient',
  'unknown-recipient': 'friends.giftInvalid',
  'not-signed-in': 'friends.giftOffline',
  server: 'friends.giftFailed',
};

export function GiftModal({ friend, onClose }: { friend: Friend | null; onClose: () => void }) {
  const { t } = useT();
  const toast = useUI((s) => s.toast);
  const profile = usePlayer((s) => s.profile);
  const addChips = usePlayer((s) => s.addChips);
  const [sentToday, setSentToday] = useState(0);
  const [amount, setAmount] = useState(50);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const remaining = giftService.remaining(sentToday);

  useEffect(() => {
    if (!friend) return;
    setAmount(50);
    setMessage('');
    void giftService.sentToday(profile.id).then(setSentToday);
  }, [friend, profile.id]);

  if (!friend) return null;

  const send = async () => {
    if (sending) return;
    setSending(true);
    const result = await giftService.send(friend.id, amount, message);
    setSending(false);
    if (!result.ok) {
      toast(t(reasonKey[result.reason ?? 'server']), 'bad', '⚠');
      return;
    }
    addChips(-amount, { silent: true });
    audio.play('vault');
    toast(t('friends.giftSent', { name: friend.username, amount: fmt(amount) }), 'good', '🎁');
    setSentToday((value) => value + amount);
    onClose();
  };

  return (
    <Modal open={!!friend} onClose={onClose} title={t('friends.giftTitle', { name: friend.username })}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          {QUICK_AMOUNTS.map((value) => (
            <GameButton
              key={value}
              size="sm"
              tone={amount === value ? 'gold' : 'metal'}
              disabled={value > remaining || value > profile.chips}
              onClick={() => setAmount(value)}
            >
              {fmt(value)}
            </GameButton>
          ))}
        </div>

        <input
          className="px-3 py-2.5 rounded-[var(--r-xs)] border border-white/10 bg-white/5 outline-none"
          placeholder={t('friends.giftMessagePlaceholder')}
          value={message}
          maxLength={80}
          onChange={(event) => setMessage(event.target.value)}
        />

        <p className="text-[12px] text-center" style={{ color: 'var(--muted)' }}>
          {t('friends.giftRemaining', { remaining: fmt(remaining), limit: fmt(GIFT_DAILY_LIMIT) })}
        </p>

        <GameButton
          tone="gold" size="lg" block
          disabled={sending || remaining <= 0 || amount > profile.chips || amount > remaining}
          onClick={send}
        >
          🎁 {t('friends.giftSend')}
        </GameButton>
      </div>
    </Modal>
  );
}
