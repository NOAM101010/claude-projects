/**
 * דגלים גלובליים לנעילת ה-scope של ההשקה הראשונית (שלב A בתוכנית ה-redesign,
 * `vectorized-gliding-perlis.md`). כולם ניתנים להחזרה ל-`false` כדי לשחזר התנהגות
 * מלאה בלי שינוי קוד נוסף - התשתית שהם נועלים (i18n/מטבע/דמו) נשארת שלמה מתחת.
 */
export const LOCK_LANGUAGE_TO_ENGLISH = false
export const LOCK_CURRENCY_TO_USD = false
export const REQUIRE_ACCESS_CODE_GATE = true
/**
 * שולט על `LaunchScreen` (מוצג בתחילת **כל** טעינה של האפליקציה, גם למשתמש עם session
 * שמור - ראה `App.tsx`, לפני בדיקת ה-gate). זה מנגנון אחד מאוחד: אין עוד "reveal"
 * חד-פעמי-לסשן נפרד בתוך `AccessCodeGate`/`AnimatedBackground` (הוסר - הרקע שם
 * הוא עכשיו אנימציה תמימה ורציפה בלבד, לא "אינטרו").
 */
export const SHOW_INTRO_SPLASH = true
/** "+ New workspace" hidden for now per user request - focus on the single-workspace
 * experience being fully polished before Pro's multi-workspace flow gets attention.
 * The upgrade-to-Pro entry point itself stays visible - this only hides workspace
 * *creation* once already Pro. Fully reversible: flip to false, no other code changes. */
export const HIDE_NEW_WORKSPACE_BUTTON = true
/** Hides the workspace Name field (in `WorkspaceSettings`) and the workspace-name
 * dropdown/switcher (in `WorkspaceSwitcher`) per user request after live testing - the
 * underlying `workspaces.name` column and rename capability are untouched. Fully
 * reversible: flip to false, no other code changes. */
export const HIDE_WORKSPACE_NAME_UI = true
