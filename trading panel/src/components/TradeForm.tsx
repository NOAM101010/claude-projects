import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { computePnl } from '../lib/stats'
import { formatCurrency, isoToLocalInputValue, localInputValueToIso } from '../lib/format'
import { CURRENCIES, SETUPS } from '../types/trade'
import type { CurrencyCode, Direction, Trade } from '../types/trade'
import { DEFAULT_FIELD_SETTINGS } from '../lib/workspacesApi'
import type { FieldSettings } from '../lib/workspacesApi'
import { canUploadChartImage, deleteChartImage, getChartImageUrl, uploadChartImage } from '../lib/chartImagesApi'
import { compressImage } from '../lib/imageCompression'
import { SetupPicker } from './SetupPicker'
import styles from './TradeForm.module.css'

interface TradeFormProps {
  /** טרייד קיים לעריכה, או undefined להוספת טרייד חדש */
  initialTrade?: Trade
  /** אילו שדות אופציונליים מוצגים בטופס (הגדרת workspace) - ברירת מחדל: כולם דלוקים */
  fieldSettings?: FieldSettings
  /** נדרש להעלאת תמונת גרף (נתיב הקובץ ב-Storage מתחיל ב-accountId/). */
  accountId: string
  /** כמה טריידים ב-workspace הנוכחי כבר כוללים תמונת גרף - לאכיפת מגבלת 50 (`canUploadChartImage`). */
  chartImageCount: number
  onSave: (trade: Trade) => void | Promise<void>
  onCancel: () => void
}

interface FormState {
  symbol: string
  direction: Direction
  entryAt: string // local input value
  entryPrice: string
  quantity: string
  stopLoss: string
  takeProfit: string
  exitAt: string // local input value
  exitPrice: string
  currency: CurrencyCode
  fee: string
  notes: string
  setup: string // '' = ללא הגדרה
}

function toFormState(trade: Trade | undefined): FormState {
  if (!trade) {
    return {
      symbol: '',
      direction: 'long',
      entryAt: '',
      entryPrice: '',
      quantity: '',
      stopLoss: '',
      takeProfit: '',
      exitAt: '',
      exitPrice: '',
      currency: 'USD',
      fee: '',
      notes: '',
      setup: '',
    }
  }
  return {
    symbol: trade.symbol,
    direction: trade.direction,
    entryAt: isoToLocalInputValue(trade.entryAt),
    entryPrice: String(trade.entryPrice),
    quantity: String(trade.quantity),
    stopLoss: trade.stopLoss !== null ? String(trade.stopLoss) : '',
    takeProfit: trade.takeProfit !== null ? String(trade.takeProfit) : '',
    exitAt: isoToLocalInputValue(trade.exitAt),
    exitPrice: trade.exitPrice !== null ? String(trade.exitPrice) : '',
    currency: trade.currency,
    fee: trade.fee !== null ? String(trade.fee) : '',
    notes: trade.notes,
    setup: trade.setup ?? '',
  }
}

function parseOptionalNumber(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}

export function TradeForm({
  initialTrade,
  fieldSettings = DEFAULT_FIELD_SETTINGS,
  accountId,
  chartImageCount,
  onSave,
  onCancel,
}: TradeFormProps) {
  const { t, locale } = useLanguage()
  const [form, setForm] = useState<FormState>(() => toFormState(initialTrade))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // תמונת גרף: הנתיב הקיים (אם עריכה), קובץ חדש שנבחר (טרם הועלה), preview לתצוגה, וסימון הסרה.
  const existingImagePath = initialTrade?.chartImageUrl ?? null
  const [newImageFile, setNewImageFile] = useState<File | null>(null)
  const [removeExistingImage, setRemoveExistingImage] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [showFullImage, setShowFullImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)

  // preview של קובץ חדש שנבחר - object URL מקומי, לא תלוי ברשת.
  useEffect(() => {
    if (!newImageFile) return
    const url = URL.createObjectURL(newImageFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [newImageFile])

  // preview של תמונה קיימת (עריכה) - ה-bucket פרטי, צריך signed URL.
  useEffect(() => {
    if (newImageFile || removeExistingImage || !existingImagePath) return
    let cancelled = false
    setPreviewLoading(true)
    getChartImageUrl(existingImagePath)
      .then((url) => {
        if (!cancelled) setPreviewUrl(url)
      })
      .catch(() => {
        if (!cancelled) setImageError(t('tradeForm.errorImagePreviewFailed'))
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingImagePath, removeExistingImage])

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setImageError(null)
    if (!file) return
    const hasImageOnThisTradeAlready = Boolean(existingImagePath) && !removeExistingImage
    if (!canUploadChartImage(chartImageCount, hasImageOnThisTradeAlready)) {
      setImageError(t('tradeForm.errorImageLimit'))
      e.target.value = ''
      return
    }
    setRemoveExistingImage(false)
    setNewImageFile(file)
  }

  const handleRemoveImage = () => {
    setNewImageFile(null)
    setPreviewUrl(null)
    setRemoveExistingImage(true)
    setImageError(null)
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const livePnl = useMemo(() => {
    const entryPrice = Number(form.entryPrice)
    const quantity = Number(form.quantity)
    const exitPrice = parseOptionalNumber(form.exitPrice)
    if (Number.isNaN(entryPrice) || Number.isNaN(quantity) || exitPrice === null) return null
    return computePnl({ direction: form.direction, entryPrice, exitPrice, quantity, fee: parseOptionalNumber(form.fee) })
  }, [form.direction, form.entryPrice, form.quantity, form.exitPrice, form.fee])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setImageError(null)

    if (!form.symbol.trim()) {
      setError(t('tradeForm.errorSymbolRequired'))
      return
    }
    const entryPrice = Number(form.entryPrice)
    const quantity = Number(form.quantity)
    if (!form.entryAt || Number.isNaN(entryPrice) || entryPrice <= 0) {
      setError(t('tradeForm.errorEntryRequired'))
      return
    }
    if (Number.isNaN(quantity) || quantity <= 0) {
      setError(t('tradeForm.errorQuantityPositive'))
      return
    }
    if ((form.exitAt && !form.exitPrice) || (!form.exitAt && form.exitPrice)) {
      setError(t('tradeForm.errorExitBothOrNeither'))
      return
    }

    const entryAtIso = localInputValueToIso(form.entryAt)
    if (!entryAtIso) {
      setError(t('tradeForm.errorEntryDateInvalid'))
      return
    }
    const exitAtIso = localInputValueToIso(form.exitAt)
    const exitPrice = parseOptionalNumber(form.exitPrice)
    const fee = parseOptionalNumber(form.fee)

    setSaving(true)
    try {
      // תמונת גרף: מעלים חדשה (אם נבחרה), מוחקים אם סומנה להסרה, או משאירים כמו שהיה.
      // מחיקת הנתיב הישן קורית רק אחרי ש-onSave מצליח, כדי לא לאבד תמונה אם השמירה נכשלת.
      let chartImageUrl: string | null = existingImagePath
      let oldPathToDelete: string | null = null

      if (newImageFile) {
        const hasImageOnThisTradeAlready = Boolean(existingImagePath)
        if (!canUploadChartImage(chartImageCount, hasImageOnThisTradeAlready)) {
          setImageError(t('tradeForm.errorImageLimit'))
          setSaving(false)
          return
        }
        const compressed = await compressImage(newImageFile)
        chartImageUrl = await uploadChartImage(accountId, compressed)
        if (existingImagePath) oldPathToDelete = existingImagePath
      } else if (removeExistingImage && existingImagePath) {
        chartImageUrl = null
        oldPathToDelete = existingImagePath
      }

      const trade: Trade = {
        id: initialTrade?.id ?? crypto.randomUUID(),
        symbol: form.symbol.trim().toUpperCase(),
        direction: form.direction,
        entryAt: entryAtIso,
        entryPrice,
        quantity,
        stopLoss: parseOptionalNumber(form.stopLoss),
        takeProfit: parseOptionalNumber(form.takeProfit),
        exitAt: exitAtIso,
        exitPrice,
        pnl: computePnl({ direction: form.direction, entryPrice, exitPrice, quantity, fee }),
        currency: form.currency,
        fee,
        notes: form.notes.trim(),
        setup: form.setup ? form.setup : undefined,
        chartImageUrl: chartImageUrl ?? undefined,
      }

      await onSave(trade)

      if (oldPathToDelete) {
        await deleteChartImage(oldPathToDelete).catch(() => {
          // לא חוסמים את המשתמש אם ניקוי התמונה הישנה נכשל - הטרייד כבר נשמר בהצלחה.
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('tradeForm.errorSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="symbol">{t('tradeForm.symbolLabel')}</label>
          <input
            id="symbol"
            type="text"
            value={form.symbol}
            onChange={(e) => update('symbol', e.target.value)}
            placeholder="AAPL"
            required
          />
        </div>
        <div className={styles.field}>
          <label>{t('tradeForm.directionLabel')}</label>
          <div className={styles.directionToggle}>
            <button
              type="button"
              data-dir="long"
              data-active={form.direction === 'long'}
              onClick={() => update('direction', 'long')}
            >
              Long
            </button>
            <button
              type="button"
              data-dir="short"
              data-active={form.direction === 'short'}
              onClick={() => update('direction', 'short')}
            >
              Short
            </button>
          </div>
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="entryAt">{t('tradeForm.entryDateLabel')}</label>
          <input
            id="entryAt"
            type="datetime-local"
            value={form.entryAt}
            onChange={(e) => update('entryAt', e.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="entryPrice">{t('tradeForm.entryPriceLabel')}</label>
          <input
            id="entryPrice"
            type="number"
            step="any"
            min="0"
            value={form.entryPrice}
            onChange={(e) => update('entryPrice', e.target.value)}
            required
          />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="quantity">{t('tradeForm.quantityLabel')}</label>
          <input
            id="quantity"
            type="number"
            step="any"
            min="0"
            value={form.quantity}
            onChange={(e) => update('quantity', e.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="currency">{t('tradeForm.currencyLabel')}</label>
          <select id="currency" value={form.currency} onChange={(e) => update('currency', e.target.value as CurrencyCode)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(fieldSettings.stopLoss || fieldSettings.takeProfit) && (
        <div className={styles.row}>
          {fieldSettings.stopLoss && (
            <div className={styles.field}>
              <label htmlFor="stopLoss">
                {t('tradeForm.stopLossLabel')} <span className={styles.optional}>{t('common.optional')}</span>
              </label>
              <input id="stopLoss" type="number" step="any" value={form.stopLoss} onChange={(e) => update('stopLoss', e.target.value)} />
            </div>
          )}
          {fieldSettings.takeProfit && (
            <div className={styles.field}>
              <label htmlFor="takeProfit">
                {t('tradeForm.takeProfitLabel')} <span className={styles.optional}>{t('common.optional')}</span>
              </label>
              <input
                id="takeProfit"
                type="number"
                step="any"
                value={form.takeProfit}
                onChange={(e) => update('takeProfit', e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="exitAt">
            {t('tradeForm.exitDateLabel')} <span className={styles.optional}>{t('tradeForm.exitDateHint')}</span>
          </label>
          <input id="exitAt" type="datetime-local" value={form.exitAt} onChange={(e) => update('exitAt', e.target.value)} />
        </div>
        <div className={styles.field}>
          <label htmlFor="exitPrice">{t('tradeForm.exitPriceLabel')}</label>
          <input id="exitPrice" type="number" step="any" min="0" value={form.exitPrice} onChange={(e) => update('exitPrice', e.target.value)} />
        </div>
      </div>

      {fieldSettings.fee && (
        <div className={styles.field}>
          <label htmlFor="fee">
            {t('tradeForm.feeLabel')} <span className={styles.optional}>{t('common.optional')}</span>
          </label>
          <input id="fee" type="number" step="any" min="0" value={form.fee} onChange={(e) => update('fee', e.target.value)} />
        </div>
      )}

      <div className={`${styles.pnlPreview} metal-panel holo-edge holo-edge--amber`}>
        <span>{t('tradeForm.pnlPreviewLabel')}</span>
        <strong className={livePnl === null ? undefined : livePnl >= 0 ? styles.pnlPositive : styles.pnlNegative}>
          {livePnl === null ? '—' : formatCurrency(livePnl, form.currency, locale)}
        </strong>
      </div>

      {fieldSettings.setup && (
        <div className={styles.field}>
          <label htmlFor="setup">
            {t('tradeForm.setupLabel')} <span className={styles.optional}>{t('common.optional')}</span>
          </label>
          <SetupPicker
            id="setup"
            value={form.setup}
            onChange={(value) => update('setup', value)}
            options={SETUPS}
            noSetupLabel={t('tradeForm.noSetupOption')}
          />
        </div>
      )}

      {fieldSettings.notes && (
        <div className={styles.field}>
          <label htmlFor="notes">
            {t('tradeForm.notesLabel')} <span className={styles.optional}>{t('common.optional')}</span>
          </label>
          <textarea id="notes" value={form.notes} onChange={(e) => update('notes', e.target.value)} />
        </div>
      )}

      <div className={styles.field}>
        <label htmlFor="chartImage">
          {t('tradeForm.chartImageLabel')} <span className={styles.optional}>{t('common.optional')}</span>
        </label>
        <input id="chartImage" type="file" accept="image/*" onChange={handleFileChange} disabled={saving} />
        {previewLoading && <p className={styles.optional}>{t('tradeForm.previewLoading')}</p>}
        {previewUrl && !removeExistingImage && (
          <div className={styles.imagePreviewWrap}>
            <button type="button" className={styles.imagePreviewButton} onClick={() => setShowFullImage(true)}>
              <img src={previewUrl} alt={t('tradeForm.previewAlt')} className={styles.imagePreview} />
            </button>
            <button type="button" className={styles.removeImageButton} onClick={handleRemoveImage} disabled={saving}>
              {t('tradeForm.removeImage')}
            </button>
          </div>
        )}
        {imageError && <p className={styles.error}>{imageError}</p>}
      </div>

      {showFullImage && previewUrl && (
        <div className={styles.lightboxOverlay} onClick={() => setShowFullImage(false)} role="dialog" aria-modal="true">
          <img src={previewUrl} alt={t('tradeForm.fullImageAlt')} className={styles.lightboxImage} />
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={saving}>
          {saving ? t('tradeForm.saving') : initialTrade ? t('tradeForm.saveChanges') : t('tradeForm.addTrade')}
        </button>
        <button type="button" className={styles.cancel} onClick={onCancel} disabled={saving}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}
