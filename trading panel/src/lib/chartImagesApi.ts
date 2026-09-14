import { getSupabase } from './supabase'

/** שם ה-bucket ב-Supabase Storage (לא public, ראה supabase/006_chart_images_storage.sql). */
export const CHART_IMAGES_BUCKET = 'chart-images'

/** בונה את נתיב הקובץ ב-bucket: תיקיית-שורש = account_id (כפי ש-RLS על storage.objects דורש), שם קובץ ייחודי. */
export function buildChartImagePath(accountId: string, fileId: string): string {
  return `${accountId}/${fileId}.jpg`
}

/**
 * מעלה Blob (כבר דחוס - ראה `imageCompression.ts`) ל-Storage תחת נתיב ייחודי לחשבון,
 * ומחזיר את הנתיב (לא URL ציבורי - ה-bucket פרטי, תצוגה דרך `getChartImageUrl`).
 */
export async function uploadChartImage(accountId: string, blob: Blob): Promise<string> {
  const supabase = getSupabase()
  const path = buildChartImagePath(accountId, crypto.randomUUID())
  const { error } = await supabase.storage.from(CHART_IMAGES_BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  return path
}

/** יוצר signed URL זמני (שעה) לתצוגת תמונה מה-bucket הפרטי. */
export async function getChartImageUrl(path: string): Promise<string> {
  const supabase = getSupabase()
  const { data, error } = await supabase.storage.from(CHART_IMAGES_BUCKET).createSignedUrl(path, 60 * 60)
  if (error || !data) throw error ?? new Error('Failed to create the image link')
  return data.signedUrl
}

/** מוחק קובץ תמונה מה-Storage. נקרא כשמוחקים טרייד עם תמונה, או כשמחליפים/מסירים תמונה קיימת - כדי לא להשאיר קבצים יתומים. */
export async function deleteChartImage(path: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.storage.from(CHART_IMAGES_BUCKET).remove([path])
  if (error) throw error
}

/** סופר כמה טריידים ב-workspace כבר כוללים תמונת גרף, לאכיפת המגבלה התלויית-דרגה
 * (`CHART_IMAGE_LIMIT_BY_TIER`/`canUploadChartImage` ב-tierLimits.ts). */
export async function countWorkspaceChartImages(workspaceId: string): Promise<number> {
  const supabase = getSupabase()
  const { count, error } = await supabase
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .not('chart_image_url', 'is', null)
  if (error) throw error
  return count ?? 0
}
