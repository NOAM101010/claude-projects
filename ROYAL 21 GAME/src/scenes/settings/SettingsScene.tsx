import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SceneShell } from '@/components/layout/SceneShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { Modal } from '@/components/ui/Modal';
import { resetOnboarding } from '@/components/ui/Onboarding';
import { useSettings, type Quality } from '@/stores/useSettings';
import { usePlayer } from '@/stores/usePlayer';
import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';
import { LANGS } from '@/i18n';
import { audio, type Bus } from '@/audio/AudioManager';
import { bugReportService } from '@/services/bugReportService';
import type { Lang } from '@/types';

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

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const { t } = useT();
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px]">{label}</span>
      <GameButton size="sm" tone={value ? 'gold' : 'ghost'} onClick={() => onChange(!value)}>
        {value ? t('common.on') : t('common.off')}
      </GameButton>
    </div>
  );
}

export default function SettingsScene() {
  const navigate = useNavigate();
  const { t } = useT();
  const settings = useSettings();
  const profile = usePlayer((s) => s.profile);
  const reset = usePlayer((s) => s.reset);
  const signOut = usePlayer((s) => s.signOut);
  const toast = useUI((s) => s.toast);

  const [bugOpen, setBugOpen] = useState(false);
  const [bugText, setBugText] = useState('');
  const [bugBusy, setBugBusy] = useState(false);

  const sendBug = async () => {
    if (!bugText.trim()) {
      toast(t('settings.bugEmpty'), 'bad', '⚠');
      return;
    }
    setBugBusy(true);
    const result = await bugReportService.submit(profile.id, bugText);
    setBugBusy(false);
    if (result.ok) {
      toast(t('settings.bugSent'), 'good', '✅');
      setBugText('');
      setBugOpen(false);
    } else if (result.reason === 'rate-limited') {
      toast(t('settings.bugRateLimited'), 'bad', '⏱');
    } else {
      toast(t('settings.bugFailed'), 'bad', '⚠');
    }
  };

  const qualities: Quality[] = ['auto', 'low', 'medium', 'high'];

  return (
    <SceneShell compactHud>
      <div className="mx-auto px-4 py-3 flex flex-col gap-3" style={{ maxWidth: 620 }}>
        <div>
          <span className="eyebrow">ROYAL 21</span>
          <h1 className="mt-1">{t('settings.title')}</h1>
        </div>

        <GlassPanel className="p-4 flex flex-col gap-3">
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
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px]" style={{ color: 'var(--muted)' }}>{t('settings.preview')}</span>
            <GameButton size="sm" tone="ghost" disabled={settings.muted}
              onClick={() => audio.play('win')}>
              {t('settings.previewAction')}
            </GameButton>
          </div>
        </GlassPanel>

        <GlassPanel className="p-4 flex flex-col gap-3">
          <div className="eyebrow">{t('settings.display')}</div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px]">{t('settings.quality')}</span>
            <div className="flex gap-1.5">
              {qualities.map((quality) => (
                <GameButton key={quality} size="sm" tone={settings.quality === quality ? 'gold' : 'ghost'}
                  onClick={() => settings.setQuality(quality)}>
                  {t(`settings.${quality}`)}
                </GameButton>
              ))}
            </div>
          </div>
          <Toggle label={t('settings.reducedMotion')} value={settings.reducedMotion} onChange={settings.setReducedMotion} />
          <Toggle label={t('settings.haptics')} value={settings.haptics} onChange={settings.setHapticsEnabled} />
          <Toggle label={t('settings.showPresence')} value={settings.showPresence} onChange={settings.setShowPresence} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px]">{t('settings.language')}</span>
            <div className="flex gap-1.5">
              {LANGS.map((entry) => (
                <GameButton key={entry.key} size="sm" tone={settings.lang === entry.key ? 'gold' : 'ghost'}
                  onClick={() => settings.setLang(entry.key as Lang)}>
                  {entry.label}
                </GameButton>
              ))}
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="p-4 flex flex-col gap-3">
          <div className="eyebrow">{t('settings.help')}</div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px]">{t('settings.replayTour')}</span>
            <GameButton size="sm" tone="ghost" onClick={() => { resetOnboarding(); navigate('/hub'); }}>
              {t('settings.replayTourAction')}
            </GameButton>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px]">🐛 {t('settings.reportBug')}</span>
            <GameButton size="sm" tone="ghost" onClick={() => setBugOpen(true)}>
              {t('settings.reportBugAction')}
            </GameButton>
          </div>
        </GlassPanel>

        <GlassPanel className="p-4 flex flex-col gap-3">
          <div className="eyebrow">{t('settings.account')}</div>
          <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
            {profile.username} · {profile.tag} {profile.isGuest ? '· guest' : ''}
          </p>
          <div className="flex gap-2">
            {/* Switching keeps this device's remembered accounts; signing out
                clears the session but not the list. Neither wipes the other
                player's progress — that lives on their own account. */}
            <GameButton tone="gold" block onClick={async () => { await signOut(); navigate('/login?mode=signin'); }}>
              {t('settings.switchUser')}
            </GameButton>
            <GameButton tone="ghost" block onClick={async () => { await signOut(); navigate('/'); }}>
              {t('settings.signOut')}
            </GameButton>
            <GameButton tone="danger" block onClick={() => {
              if (confirm(t('settings.resetWarn'))) { reset(); toast(t('common.save'), 'good', '↺'); }
            }}>
              {t('settings.resetLocal')}
            </GameButton>
          </div>
        </GlassPanel>

        <GameButton tone="gold" onClick={() => navigate('/hub')}>{t('common.back')}</GameButton>
      </div>

      <Modal open={bugOpen} onClose={() => setBugOpen(false)} title={t('settings.bugTitle')}>
        <div className="flex flex-col gap-3">
          <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
            {t('settings.bugSubtitle')}
          </p>
          <textarea
            value={bugText}
            onChange={(event) => setBugText(event.target.value)}
            placeholder={t('settings.bugPlaceholder')}
            className="w-full px-3 py-2 rounded-[var(--r-xs)] border border-white/10 bg-white/[0.05] outline-none focus:border-[color:var(--gold-line)] min-h-[120px] resize-y text-[13px]"
            maxLength={2000}
            disabled={bugBusy}
          />
          <div className="flex gap-2">
            <GameButton tone="ghost" block onClick={() => setBugOpen(false)} disabled={bugBusy}>
              {t('common.cancel')}
            </GameButton>
            <GameButton tone="gold" block onClick={sendBug} disabled={bugBusy || !bugText.trim()}>
              {t('settings.bugSend')}
            </GameButton>
          </div>
        </div>
      </Modal>
    </SceneShell>
  );
}
