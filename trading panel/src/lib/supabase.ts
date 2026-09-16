import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env')
}

function createSupabaseClient(accessToken: string | null): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  })
}

// אין יצירה עגלה של לקוח anon ב-module load: session.ts תמיד קורא ל-setSupabaseAccessToken
// (או ל-getSupabase, במסלולים שלא צריכים session) לפני כל שימוש אמיתי, כך שלקוח אחד
// בדיוק נוצר בפועל - לא אחד "זמני" שמושלך מיד ואחד "אמיתי" שמחליף אותו (ראה
// Multiple GoTrueClient instances warning שזה תיקן).
let client: SupabaseClient | null = null

/**
 * מחליף את הלקוח הפעיל בלקוח חדש שנושא את ה-JWT הנתון בכל בקשה (כ-Authorization
 * header גלובלי), כדי ש-`auth.uid()` ב-RLS יזהה נכון את account_id. supabase-js לא
 * תומך בהחלפת header דינמי על לקוח קיים - לכן יוצרים לקוח חדש בכל החלפת session.
 */
export function setSupabaseAccessToken(accessToken: string | null): void {
  client = createSupabaseClient(accessToken)
}

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createSupabaseClient(null)
  }
  return client
}
