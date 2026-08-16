import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';
import { Modal } from './Modal';
import { GameButton } from './GameButton';

/**
 * Global confirmation dialog driven by `useUI.confirm({...})`. Mounted once at
 * the app root — any code path that wants a "are you sure?" pause just calls
 * `useUI.getState().confirm(...)` instead of routing through a local modal.
 *
 * Used for leaving a live game, quitting a private table, cashing out
 * mid-hand, and similar destructive navigations.
 */
export function ConfirmModal() {
  const { t } = useT();
  const prompt = useUI((s) => s.confirmPrompt);
  const close = useUI((s) => s.closeConfirm);

  const handleConfirm = () => {
    const p = prompt;
    close();
    p?.onConfirm();
  };
  const handleCancel = () => {
    const p = prompt;
    close();
    p?.onCancel?.();
  };

  return (
    <Modal open={!!prompt} onClose={handleCancel} title={prompt?.title} sticky width={420}>
      {prompt?.body && (
        <p className="text-[13px] mb-4" style={{ color: 'var(--muted)' }}>{prompt.body}</p>
      )}
      <div className="flex gap-2 justify-end mt-2">
        <GameButton tone="ghost" onClick={handleCancel}>
          {prompt?.cancelLabel ?? t('common.cancel')}
        </GameButton>
        <GameButton tone={prompt?.tone === 'danger' ? 'danger' : 'gold'} onClick={handleConfirm}>
          {prompt?.confirmLabel ?? t('common.confirm')}
        </GameButton>
      </div>
    </Modal>
  );
}
