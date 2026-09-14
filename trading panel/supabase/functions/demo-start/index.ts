// demo-start: יוצר account חדש בדרגת 'demo' ומנפיק לו JWT.
// נקרא ע"י הלקוח פעם ראשונה שאין לו session שמור ב-localStorage.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'
import { mintAccessToken } from '../_shared/jwt.ts'
import { errorMessage, jsonResponse, preflightResponse } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflightResponse()
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    // SUPABASE_JWT_SECRET is NOT auto-injected in newer (publishable/secret key
    // system) Supabase projects. APP_JWT_SECRET is a manually-set secret whose
    // value must equal the project's actual JWT secret (Settings > API > JWT
    // Keys > legacy JWT secret) so PostgREST/RLS accepts tokens we mint here.
    const jwtSecret = Deno.env.get('APP_JWT_SECRET')
    if (!supabaseUrl || !serviceRoleKey || !jwtSecret) {
      throw new Error('חסרים secrets בסביבת ה-Edge Function (SUPABASE_URL/SERVICE_ROLE_KEY/APP_JWT_SECRET)')
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: account, error: insertError } = await admin
      .from('accounts')
      .insert({ tier: 'demo' })
      .select('id')
      .single()
    if (insertError || !account) throw insertError ?? new Error('יצירת חשבון דמו נכשלה')

    const accessToken = await mintAccessToken(account.id, jwtSecret)

    return jsonResponse({ accountId: account.id, accessToken })
  } catch (err) {
    return jsonResponse({ error: errorMessage(err) }, 500)
  }
})
