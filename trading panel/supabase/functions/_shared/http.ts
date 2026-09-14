// עוזרי HTTP/CORS משותפים לכל ה-Edge Functions (נקראות ישירות מהדפדפן).
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

export function preflightResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'שגיאה לא ידועה'
}
