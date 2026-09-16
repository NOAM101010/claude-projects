import { useState } from 'react'
import { Crown } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { canCreateWorkspace } from '../lib/workspacesApi'
import type { Workspace } from '../lib/workspacesApi'
import type { AccountTier } from '../lib/accountApi'
import { HIDE_NEW_WORKSPACE_BUTTON, HIDE_WORKSPACE_NAME_UI } from '../config/locks'
import styles from './WorkspaceSwitcher.module.css'

interface WorkspaceSwitcherProps {
  workspaces: Workspace[]
  activeWorkspaceId: string
  tier: AccountTier
  onSwitch: (id: string) => void
  onCreate: (name: string) => Promise<void>
  /** פותח את מודל קוד הגישה (שדרוג ל-Pro) - ראה trading-journal-plan.md סעיף 1/5. */
  onOpenAccessCode: () => void
}

/**
 * בורר מרחבי עבודה בהדר. ל-Pro (או כשכבר קיים יותר מ-workspace אחד, למקרה של
 * downgrade עתידי) מציג dropdown + יצירה - ראה trading-journal-plan.md סעיף 2.
 * לדרגות שאינן Pro עם workspace יחיד מציג נקודת כניסה ברורה לשדרוג, כדי שהמעבר
 * ל-Pro לא יהיה "תור סמוי" בלי כפתור.
 */
export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  tier,
  onSwitch,
  onCreate,
  onOpenAccessCode,
}: WorkspaceSwitcherProps) {
  const { t } = useLanguage()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (tier !== 'pro' && workspaces.length <= 1) {
    return (
      <div className={styles.wrapper}>
        <button
          type="button"
          className={styles.newButton}
          onClick={onOpenAccessCode}
          aria-label={t('workspaceSwitcher.upgradeButton')}
          title={t('workspaceSwitcher.upgradeButton')}
        >
          <Crown size={14} className={styles.upgradeIcon} aria-hidden="true" />
          <span className={styles.upgradeText}>{t('workspaceSwitcher.upgradeButton')}</span>
        </button>
      </div>
    )
  }

  if (HIDE_WORKSPACE_NAME_UI) {
    return null
  }

  const canCreate = canCreateWorkspace(tier, workspaces.length)

  const openCreate = () => {
    setError(null)
    setName('')
    setShowCreate(true)
  }

  const submitCreate = async () => {
    if (!name.trim()) {
      setError(t('workspaceSwitcher.nameRequired'))
      return
    }
    setCreating(true)
    setError(null)
    try {
      await onCreate(name.trim())
      setShowCreate(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('workspaceSwitcher.createFailed'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      <select
        className={styles.select}
        value={activeWorkspaceId}
        onChange={(e) => onSwitch(e.target.value)}
        aria-label={t('workspaceSwitcher.ariaLabel')}
      >
        {workspaces.map((ws) => (
          <option key={ws.id} value={ws.id}>
            {ws.name}
          </option>
        ))}
      </select>

      {!showCreate && !HIDE_NEW_WORKSPACE_BUTTON && (
        <button type="button" className={styles.newButton} onClick={openCreate}>
          {t('workspaceSwitcher.newWorkspace')}
        </button>
      )}

      {showCreate && !HIDE_NEW_WORKSPACE_BUTTON && (
        <div className={`${styles.createBox} metal-panel holo-edge holo-edge--amber count-in`}>
          {canCreate ? (
            <>
              <input
                className={styles.input}
                placeholder={t('workspaceSwitcher.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <div className={styles.actions}>
                <button type="button" onClick={submitCreate} disabled={creating}>
                  {creating ? t('common.creating') : t('common.create')}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} disabled={creating}>
                  {t('common.cancel')}
                </button>
              </div>
            </>
          ) : (
            <p className={styles.upgradeHint}>
              {tier === 'pro' ? <>{t('workspaceSwitcher.proLimitReached')}</> : <>{t('workspaceSwitcher.requiresUpgrade')}</>}{' '}
              {tier === 'pro' ? (
                <button type="button" onClick={() => setShowCreate(false)}>
                  {t('common.close')}
                </button>
              ) : (
                <button type="button" onClick={onOpenAccessCode}>
                  {t('access.enterCode')}
                </button>
              )}
            </p>
          )}
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}
    </div>
  )
}
