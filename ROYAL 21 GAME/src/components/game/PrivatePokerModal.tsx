import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { GameButton } from '@/components/ui/GameButton';
import { useUI } from '@/stores/useUI';
import { usePlayer } from '@/stores/usePlayer';
import { usePokerRoom } from '@/stores/usePokerRoom';
import { useT } from '@/hooks/useT';
import { audio } from '@/audio/AudioManager';
import type { TableColor } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** When true, the modal creates a VIP High-Roller table (bigger stakes only). */
  vipOnly?: boolean;
}

const STAKE_OPTIONS = [
  { sb: 5,    bb: 10,   label: '5 / 10',       tier: 'micro' },
  { sb: 25,   bb: 50,   label: '25 / 50',      tier: 'low' },
  { sb: 100,  bb: 200,  label: '100 / 200',    tier: 'mid' },
  { sb: 500,  bb: 1000, label: '500 / 1K',     tier: 'high' },
] as const;

const VIP_STAKE_OPTIONS = [
  { sb: 500,   bb: 1000,  label: '500 / 1K',    tier: 'high' },
  { sb: 2500,  bb: 5000,  label: '2.5K / 5K',   tier: 'nosebleed' },
  { sb: 5000,  bb: 10000, label: '5K / 10K',    tier: 'whale' },
] as const;

const TIMER_OPTIONS = [15, 30, 60] as const;
const SEAT_OPTIONS = [2, 4, 6] as const;
const COLORS: { id: TableColor; swatch: string; ring: string }[] = [
  { id: 'green', swatch: 'linear-gradient(135deg, #1d4a37, #0c2018)', ring: '#2e9e6b' },
  { id: 'red',   swatch: 'linear-gradient(135deg, #4a1d1d, #200c0c)', ring: '#a8413e' },
  { id: 'blue',  swatch: 'linear-gradient(135deg, #1d354a, #0c1820)', ring: '#4aa8c8' },
  { id: 'gold',  swatch: 'linear-gradient(135deg, #4a3810, #201808)', ring: '#e3b23c' },
];

/**
 * Host a private poker table. Every option here rides along in the room's
 * `config` jsonb — the poker scene renders the color and enforces the
 * timer/seats, and the join flow prompts for the password when set.
 */
export function PrivatePokerModal({ open, onClose, vipOnly = false }: Props) {
  const navigate = useNavigate();
  const { t } = useT();
  const toast = useUI((s) => s.toast);
  const profile = usePlayer((s) => s.profile);
  const create = usePokerRoom((s) => s.create);

  const stakes = vipOnly ? VIP_STAKE_OPTIONS : STAKE_OPTIONS;
  const [stakeIdx, setStakeIdx] = useState(vipOnly ? 0 : 1);
  const [color, setColor] = useState<TableColor>(vipOnly ? 'gold' : 'green');
  const [seats, setSeats] = useState<typeof SEAT_OPTIONS[number]>(6);
  const [timer, setTimer] = useState<typeof TIMER_OPTIONS[number]>(30);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const stake = stakes[stakeIdx];

  const submit = async () => {
    if (!profile.id) return;
    setBusy(true);
    // Hash the password client-side; server compares hashes only.
    let passwordHash: string | undefined;
    if (password.trim()) {
      const { hashPassword } = await import('@/services/roomsService');
      passwordHash = await hashPassword(password.trim());
    }
    const room = await create(profile.id, stake.sb, stake.bb, {
      tableColor: color,
      maxSeats: seats,
      actionSeconds: timer,
      passwordHash,
      isVip: vipOnly,
    });
    setBusy(false);
    if (!room) {
      toast(t('poker.createFailed'), 'bad', '⚠');
      return;
    }
    audio.play('door');
    onClose();
    navigate(`/poker/${room.code}`);
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={vipOnly ? t('privateTable.vipTitle') : t('privateTable.title')}
    >
      <div className="flex flex-col gap-3.5">
        {/* Stakes */}
        <div>
          <div className="eyebrow mb-1.5" style={{ fontSize: 10 }}>{t('privateTable.stakes')}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {stakes.map((option, i) => (
              <GameButton
                key={option.label}
                size="sm"
                tone={stakeIdx === i ? 'gold' : 'ghost'}
                onClick={() => setStakeIdx(i)}
              >
                {option.label}
              </GameButton>
            ))}
          </div>
        </div>

        {/* Max seats */}
        <div>
          <div className="eyebrow mb-1.5" style={{ fontSize: 10 }}>{t('privateTable.seats')}</div>
          <div className="flex gap-1.5">
            {SEAT_OPTIONS.map((option) => (
              <GameButton
                key={option}
                size="sm"
                block
                tone={seats === option ? 'gold' : 'ghost'}
                onClick={() => setSeats(option)}
              >
                {option}
              </GameButton>
            ))}
          </div>
        </div>

        {/* Timer */}
        <div>
          <div className="eyebrow mb-1.5" style={{ fontSize: 10 }}>{t('privateTable.timer')}</div>
          <div className="flex gap-1.5">
            {TIMER_OPTIONS.map((option) => (
              <GameButton
                key={option}
                size="sm"
                block
                tone={timer === option ? 'gold' : 'ghost'}
                onClick={() => setTimer(option)}
              >
                {t('privateTable.seconds', { n: option })}
              </GameButton>
            ))}
          </div>
        </div>

        {/* Color */}
        <div>
          <div className="eyebrow mb-1.5" style={{ fontSize: 10 }}>{t('privateTable.color')}</div>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColor(c.id)}
                className="press rounded-full grid place-items-center"
                style={{
                  width: 40, height: 40,
                  background: c.swatch,
                  border: `2px solid ${color === c.id ? c.ring : 'rgba(255,255,255,.1)'}`,
                  boxShadow: color === c.id ? `0 0 12px ${c.ring}66` : 'none',
                }}
                aria-label={c.id}
              >
                {color === c.id && <span style={{ color: c.ring }}>✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Password */}
        <div>
          <div className="eyebrow mb-1.5" style={{ fontSize: 10 }}>{t('privateTable.password')}</div>
          <input
            className="w-full px-3 py-2 rounded-[var(--r-xs)] border border-white/10 bg-white/[0.05] outline-none focus:border-[color:var(--gold-line)] text-[13px]"
            type="text"
            value={password}
            onChange={(event) => setPassword(event.target.value.slice(0, 32))}
            placeholder={t('privateTable.passwordPlaceholder')}
            disabled={busy}
          />
        </div>

        <div className="flex gap-2 mt-1">
          <GameButton tone="ghost" block onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </GameButton>
          <GameButton tone="gold" block onClick={submit} disabled={busy}>
            {t('privateTable.create')}
          </GameButton>
        </div>
      </div>
    </Modal>
  );
}
