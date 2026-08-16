import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { GameButton } from '@/components/ui/GameButton';
import { useT } from '@/hooks/useT';
import { roomsService } from '@/services/roomsService';

interface Props {
  open: boolean;
  roomId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Shown when a room's config carries a passwordHash and the current user
 * hasn't verified yet. The user types the plaintext, we SHA-256 it and
 * pass the hash to verify_room_password() — the plaintext never leaves
 * the device.
 */
export function PasswordPromptModal({ open, roomId, onSuccess, onCancel }: Props) {
  const { t } = useT();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!password.trim()) return;
    setBusy(true);
    setError(null);
    const ok = await roomsService.verifyPassword(roomId, password.trim());
    setBusy(false);
    if (ok) {
      setPassword('');
      onSuccess();
    } else {
      setError(t('privateTable.wrongPassword'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onCancel}
      title={t('privateTable.passwordPrompt')}
      subtitle={t('privateTable.passwordEnter')}
    >
      <div className="flex flex-col gap-3">
        <input
          className="w-full px-3 py-2.5 rounded-[var(--r-xs)] border border-white/10 bg-white/[0.05] outline-none focus:border-[color:var(--gold-line)] text-[14px]"
          type="password"
          value={password}
          onChange={(event) => { setPassword(event.target.value); setError(null); }}
          onKeyDown={(event) => { if (event.key === 'Enter') void submit(); }}
          autoFocus
          disabled={busy}
        />
        {error && (
          <p className="text-[12px] text-center" style={{ color: 'var(--crimson-hi)' }}>{error}</p>
        )}
        <div className="flex gap-2">
          <GameButton tone="ghost" block onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </GameButton>
          <GameButton tone="gold" block onClick={submit} disabled={busy || !password.trim()}>
            {t('privateTable.passwordSubmit')}
          </GameButton>
        </div>
      </div>
    </Modal>
  );
}
