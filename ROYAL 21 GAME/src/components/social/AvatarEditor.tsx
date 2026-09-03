import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { GameButton } from '@/components/ui/GameButton';
import { Avatar, AVATAR_SKINS, AVATAR_HAIRS } from './Avatar';
import { usePlayer } from '@/stores/usePlayer';
import { useT } from '@/hooks/useT';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Skin + hair picker. Everything else on the bust (shirt, hat, glasses, chain,
 * watch) stays owned by shop-item equips — this modal only touches the two
 * cosmetic slots that are otherwise frozen at signup.
 */
export function AvatarEditor({ open, onClose }: Props) {
  const { t } = useT();
  const profile = usePlayer((s) => s.profile);
  const setAvatar = usePlayer((s) => s.setAvatar);
  const [skin, setSkin] = useState(profile.avatar.skin);
  const [hair, setHair] = useState(profile.avatar.hair);

  const preview = { ...profile.avatar, skin, hair };
  const dirty = skin !== profile.avatar.skin || hair !== profile.avatar.hair;

  const save = () => {
    setAvatar({ ...profile.avatar, skin, hair });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('avatar.editTitle')} width={440}>
      <div className="flex flex-col items-center gap-5">
        <Avatar config={preview} size={112} level={profile.level} frame={profile.equipped?.frame} id="avatar-edit" />

        <Swatches label={t('avatar.skin')} colors={AVATAR_SKINS} value={skin} onChange={setSkin} />
        <Swatches label={t('avatar.hair')} colors={AVATAR_HAIRS} value={hair} onChange={setHair} />

        <div className="flex gap-2.5 w-full mt-1">
          <GameButton tone="ghost" block onClick={onClose}>{t('common.cancel')}</GameButton>
          <GameButton tone="gold" block disabled={!dirty} onClick={save}>{t('avatar.save')}</GameButton>
        </div>
      </div>
    </Modal>
  );
}

function Swatches({
  label, colors, value, onChange,
}: { label: string; colors: string[]; value: number; onChange: (index: number) => void }) {
  return (
    <div className="w-full">
      <div className="eyebrow mb-2">{label}</div>
      <div className="flex flex-wrap gap-2.5">
        {colors.map((color, index) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(index)}
            aria-label={`${label} ${index + 1}`}
            aria-pressed={value === index}
            className="rounded-full press"
            style={{
              width: 40, height: 40, background: color,
              border: value === index ? '3px solid var(--gold-hi)' : '2px solid var(--glass-line)',
              boxShadow: value === index ? '0 0 12px rgba(227,178,60,.5)' : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}
