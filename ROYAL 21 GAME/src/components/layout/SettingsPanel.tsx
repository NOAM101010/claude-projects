import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { GameButton } from '@/components/ui/GameButton';
import { useSettings } from '@/stores/useSettings';
import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';
import { audio, type Bus } from '@/audio/AudioManager';

/**
 * Quick audio settings, reachable from the in-game HUD gear without leaving the
 * table (navigating to /settings would tear down a live game — and cash a poker
 * player out). Everything here is client-local (useSettings persist), so it is
 * safe to touch mid-hand. "Full settings" links out for the rest.
 */
function Slider({ label, value, onChange, disabled }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-3 ${disabled ? 'opacity-45' : ''}`}>
      <span className="text-[13px] w-24" style={{ color: 'var(--muted)' }}>{label}</span>
      <input
        type="range" min={0} max={1} step={0.05} value={value} disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="flex-1 accent-[color:var(--gold)]"
      />
      <span className="num text-[12px] w-9 text-end">{Math.round(value * 100)}</span>
    </label>
  );
}

export function SettingsPanel() {
  const navigate = useNavigate();
  const { t } = useT();
  const settings = useSettings();
  const open = useUI((s) => s.panel) === 'settings';
  const openPanel = useUI((s) => s.openPanel);

  return (
    <Modal open={open} onClose={() => openPanel(null)} title={t('settings.quickTitle')} sticky={false}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="eyebrow">{t('settings.audio')}</div>
          <GameButton size="sm" tone={settings.muted ? 'gold' : 'ghost'}
            onClick={() => { settings.toggleMuteAll(); if (settings.muted) audio.play('click'); }}>
            {settings.muted ? t('settings.unmuteAll') : t('settings.muteAll')}
          </GameButton>
        </div>
        {(['master', 'music', 'sfx', 'ambient'] as Bus[]).map((bus) => (
          <Slider key={bus} label={t(`settings.${bus}`)} value={settings[bus]} disabled={settings.muted}
            onChange={(value) => { settings.setLevel(bus, value); audio.play('click'); }} />
        ))}

        <GameButton tone="ghost" block onClick={() => { openPanel(null); navigate('/settings'); }}>
          {t('settings.fullSettings')}
        </GameButton>
      </div>
    </Modal>
  );
}
