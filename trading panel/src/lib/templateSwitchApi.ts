import { supabaseUrl } from './supabase'
import type { WorkspaceTemplate } from './workspacesApi'

/**
 * קורא ל-Edge Function `switch-template` - מממש קוד גישה חד-פעמי מסוג "template-switch"
 * עבור ה-workspace הנתון **וכותב בפועל** את התבנית החדשה (ראה
 * supabase/functions/switch-template/index.ts + 027_protect_workspace_template.sql).
 * בכוונה **לא** קורא בנפרד ל-`setWorkspaceTemplate` הקליינטי - טריגר ה-DB חוסם כתיבת
 * template ע"י Basic client ברגע שכבר נבחרה תבנית, כך שרק ה-Edge Function (service_role,
 * אחרי אימות הקוד) יכול לבצע את השינוי הזה בפועל.
 */
export async function redeemTemplateSwitchCode(
  accessToken: string,
  workspaceId: string,
  code: string,
  template: WorkspaceTemplate,
): Promise<void> {
  const res = await fetch(`${supabaseUrl}/functions/v1/switch-template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ workspaceId, code, template }),
  })
  const data = (await res.json()) as { ok?: boolean; error?: string }
  if (!res.ok) throw new Error(data.error ?? `Failed to redeem template-switch code (${res.status})`)
}
