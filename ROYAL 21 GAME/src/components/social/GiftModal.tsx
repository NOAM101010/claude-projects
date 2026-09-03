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

const QUICK_AMOUNTS = [500, 5000, 20000, 50000];

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
  const [sentToday, setSentToday] = useState(0);
  const [amount, setAmount] = useState(500);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const remaining = giftService.remaining(sentToday);

  useEffect(() => {
    if (!friend) return;
    setAmount(500);
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
    // send_gift() already debited the sender server-side and handed back the
    // real balance — adopt it instead of deducting again locally (which would
    // double-charge once persist() pushed the delta). setChips stamps the
    // server figure as the synced baseline, so no further push happens.
    if (typeof result.balance === 'number') {
      usePlayer.getState().setChips(result.balance);
    } else {
      // send_gift() should always return the sender's post-debit balance — if we
      // land here the RPC returned a non-number, so log it and settle locally.
      console.warn('[gift] send_gift returned no balance; deducting locally', result);
      usePlayer.getState().addChips(-amount, { silent: true, localOnly: true });
    }
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
