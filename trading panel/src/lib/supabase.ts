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

let client: SupabaseClient = createSupabaseClient(null)

/**
 * מחליף את הלקוח הפעיל בלקוח חדש שנושא את ה-JWT הנתון בכל בקשה (כ-Authorization
 * header גלובלי), כדי ש-`auth.uid()` ב-RLS יזהה נכון את account_id. supabase-js לא
 * תומך בהחלפת header דינמי על לקוח קיים - לכן יוצרים לקוח חדש בכל החלפת session.
 */
export function setSupabaseAccessToken(accessToken: string | null): void {
  client = createSupabaseClient(accessToken)
}

export function getSupabase(): SupabaseClient {
  return client
}
